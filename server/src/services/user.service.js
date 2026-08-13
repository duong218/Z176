import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';
import XLSX from 'xlsx';
import { User, Role, Employee } from '../models/index.js';
import { ApiError } from '../utils/api-error.js';
import * as auditService from './audit.service.js';
import { assignEmployeeToActiveExamIfAny } from './exam-code-generation.service.js';
import { findOrCreateDepartmentByName, findOrCreateDepartmentByCode } from './department.service.js';

/** Lấy danh sách user kèm thông tin role + hồ sơ nhân viên (nếu có) */
export async function listUsers() {
  const users = await User.find().populate('roleId', 'code name').sort({ createdAt: -1 }).lean();

  const employees = await Employee.find({ userId: { $in: users.map((u) => u._id) } })
    .populate('departmentId', 'name code')
    .lean();
  const employeeByUserId = new Map(employees.map((e) => [e.userId.toString(), e]));

  return users.map((u) => {
    const emp = employeeByUserId.get(u._id.toString());
    return {
      ...u,
      fullname: emp?.fullname ?? '',
      employeeCode: emp?.employeeCode ?? '',
      departmentId: emp?.departmentId?._id ?? emp?.departmentId ?? '',
      departmentName: emp?.departmentId?.name ?? '',
      dob: emp?.dob ?? '',
      gender: emp?.gender ?? '',
      phone: emp?.phone ?? '',
      address: emp?.address ?? '',
      position: emp?.position ?? '',
    };
  });
}

/**
 * Sinh mật khẩu tạm (6 chữ số) + hash — dùng chung cho tạo mới, reset và
 * tái sử dụng tài khoản.
 */
async function generateTempPassword() {
  const tempPassword = crypto.randomInt(100000, 999999).toString();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  return { tempPassword, passwordHash };
}

/**
 * MỚI: Tìm một tài khoản đã tồn tại có thể "trùng" với dữ liệu nhân viên mới
 * đang định tạo — để quyết định tái sử dụng (nếu đang khóa) hay báo lỗi (nếu
 * đang hoạt động).
 *
 * QUAN TRỌNG: không phải mọi tài khoản trong hệ thống đều có Employee đi kèm
 * — một số tài khoản cũ (tạo trước khi có tính năng hồ sơ nhân viên, hoặc
 * tạo thủ công chỉ với username) không có Employee.employeeCode nào cả. Nếu
 * chỉ tìm theo `Employee.findOne({ employeeCode })`, các tài khoản kiểu này
 * sẽ "lọt lưới" và rơi xuống nhánh báo lỗi USERNAME_EXISTS như cũ dù đang bị
 * khóa. Vì vậy hàm này tìm theo CẢ HAI: employeeCode (nếu có) VÀ username —
 * ưu tiên khớp theo employeeCode trước (đáng tin hơn vì đây mới là "mã nhân
 * viên" thật sự), sau đó mới tới khớp theo username.
 *
 * Trả về { existingUser, existingEmployee } — existingEmployee có thể là
 * null nếu tài khoản trùng không có hồ sơ Employee nào (tài khoản kiểu cũ).
 */
async function findExistingAccountForReuse({ employeeCode, username }) {
  if (employeeCode) {
    const employee = await Employee.findOne({ employeeCode });
    if (employee) {
      const user = await User.findById(employee.userId).select('+passwordHash');
      if (user) return { existingUser: user, existingEmployee: employee };
    }
  }

  if (username) {
    const user = await User.findOne({ username: username.toLowerCase() }).select('+passwordHash');
    if (user) {
      const employee = await Employee.findOne({ userId: user._id });
      return { existingUser: user, existingEmployee: employee ?? null };
    }
  }

  return { existingUser: null, existingEmployee: null };
}

/**
 * MỚI: Tái sử dụng một tài khoản đã bị khóa (nhân viên nghỉ việc) cho một
 * nhân viên mới, thay vì báo lỗi trùng mã/trùng username hoặc để MongoDB tự
 * chặn ở tầng unique index.
 *
 * Chỉ được gọi khi `existingUser` đang bị khóa (`isActive: false`).
 * `existingEmployee` có thể là null (tài khoản cũ không có hồ sơ Employee) —
 * trong trường hợp đó hàm sẽ TẠO MỚI Employee gắn với existingUser, thay vì
 * update như bình thường.
 *
 * Sẽ:
 * - Tạo mới hoặc cập nhật hồ sơ Employee theo dữ liệu nhân viên mới.
 * - Đổi username sang username mới (nếu khác) — có kiểm tra không trùng ai khác.
 * - Mở khóa tài khoản, sinh mật khẩu tạm mới, bắt đổi mật khẩu lần đầu.
 * - Tăng tokenVersion (phòng trường hợp token cũ còn hạn).
 * - Ghi audit log riêng để không mất dấu vết việc tái sử dụng.
 *
 * Trả về { user, tempPassword, employee }.
 */
async function reactivateLockedAccount({
  adminId,
  existingUser,
  existingEmployee,
  newUsername,
  employeeData,
  ipAddress,
}) {
  if (newUsername && newUsername !== existingUser.username) {
    const usernameTaken = await User.findOne({
      username: newUsername,
      _id: { $ne: existingUser._id },
    });
    if (usernameTaken) {
      throw new ApiError(
        400,
        `Username "${newUsername}" đã được tài khoản khác sử dụng`,
        'USERNAME_EXISTS',
      );
    }
    existingUser.username = newUsername;
  }

  const { tempPassword, passwordHash } = await generateTempPassword();
  existingUser.passwordHash = passwordHash;
  existingUser.mustChangePassword = true;
  existingUser.isActive = true;
  existingUser.failedLoginAttempts = 0;
  existingUser.lockUntil = undefined;
  existingUser.tokenVersion += 1;
  await existingUser.save();

  let employee = existingEmployee;
  if (employee) {
    employee.fullname = employeeData.fullname;
    employee.departmentId = employeeData.departmentId;
    employee.employeeCode = employeeData.employeeCode || employee.employeeCode;
    employee.dob = employeeData.dob ?? '';
    employee.gender = employeeData.gender ?? '';
    employee.phone = employeeData.phone ?? '';
    employee.address = employeeData.address ?? '';
    employee.position = employeeData.position ?? '';
    employee.isActive = true;
    await employee.save();
  } else {
    // Tài khoản cũ không có Employee đi kèm -> tạo mới, gắn vào User hiện có
    // thay vì tạo User mới (đây chính là điểm tái sử dụng).
    employee = await Employee.create({
      fullname: employeeData.fullname,
      departmentId: employeeData.departmentId,
      userId: existingUser._id,
      employeeCode: employeeData.employeeCode || undefined,
      dob: employeeData.dob ?? '',
      gender: employeeData.gender ?? '',
      phone: employeeData.phone ?? '',
      address: employeeData.address ?? '',
      position: employeeData.position ?? '',
      isActive: true,
    });
  }

  await auditService.writeAudit({
    actorUserId: adminId,
    action: 'Tái sử dụng tài khoản đã khóa',
    resourceType: 'User',
    resourceId: existingUser._id,
    metadata: {
      username: existingUser.username,
      employeeCode: employee.employeeCode,
      detail: 'Tài khoản của nhân viên đã nghỉ (bị khóa) được cấp lại cho nhân viên mới cùng mã',
    },
    ipAddress,
  });

  const userObj = existingUser.toObject();
  delete userObj.passwordHash;
  return { user: userObj, tempPassword, employee };
}

/**
 * Tạo user mới, sinh pass ngẫu nhiên (6 chữ số).
 *
 * MỚI: nếu role được chọn có code = 'candidate' (thí sinh), bắt buộc phải kèm
 * employeeInfo (fullname, departmentId, employeeCode tuỳ chọn) — hệ thống sẽ tự
 * tạo Employee gắn với user này ngay trong cùng lượt tạo, tránh trường hợp tài
 * khoản thí sinh "mồ côi" không có hồ sơ nhân viên (Employee.userId) đi kèm.
 *
 * MỚI: nếu employeeCode trùng với một Employee đã có:
 * - Nếu User của employee đó đang bị khóa (nhân viên cũ đã nghỉ) -> tự động
 *   tái sử dụng tài khoản đó cho nhân viên mới (đổi username/hồ sơ, mở khóa,
 *   cấp mật khẩu tạm mới) thay vì tạo mới.
 * - Nếu User đó đang hoạt động -> báo lỗi trùng mã, không cho tạo/ghi đè.
 */
export async function createUser({ adminId, username, roleId, ipAddress, employeeInfo }) {
  const role = await Role.findById(roleId);
  if (!role) {
    throw new ApiError(400, 'Vai trò không hợp lệ', 'ROLE_NOT_FOUND');
  }

  const isCandidate = role.code === 'candidate';
  if (isCandidate) {
    if (!employeeInfo?.fullname || !employeeInfo?.departmentId) {
      throw new ApiError(
        400,
        'Tài khoản thí sinh bắt buộc phải có họ tên và phòng ban',
        'MISSING_EMPLOYEE_FIELDS',
      );
    }
  }

  // Trùng employeeCode HOẶC trùng username với tài khoản đã có -> kiểm tra có
  // tái sử dụng được không, trước khi báo lỗi trùng. Dò theo cả 2 tiêu chí vì
  // một số tài khoản cũ trong hệ thống không có Employee.employeeCode đi kèm
  // (xem ghi chú trong findExistingAccountForReuse).
  {
    const { existingUser, existingEmployee } = await findExistingAccountForReuse({
      employeeCode: isCandidate ? employeeInfo?.employeeCode : undefined,
      username,
    });

    if (existingUser) {
      if (existingUser.isActive) {
        const conflictField = existingEmployee?.employeeCode ? 'Mã nhân viên' : 'Tên đăng nhập';
        throw new ApiError(
          409,
          `${conflictField} đã tồn tại và tài khoản đang hoạt động`,
          existingEmployee?.employeeCode ? 'EMPLOYEE_CODE_ACTIVE' : 'USERNAME_EXISTS',
        );
      }

      // Tài khoản trùng đang bị khóa -> chỉ tái sử dụng được cho role candidate
      // (vì cần đủ employeeInfo). Nếu role không phải candidate thì vẫn báo
      // lỗi trùng như cũ để tránh tái sử dụng tài khoản admin/examiner/leader
      // đã khóa một cách ngoài ý muốn.
      if (!isCandidate) {
        throw new ApiError(400, 'Tên đăng nhập đã tồn tại', 'USERNAME_EXISTS');
      }

      const { user, tempPassword, employee } = await reactivateLockedAccount({
        adminId,
        existingUser,
        existingEmployee,
        newUsername: username?.toLowerCase(),
        employeeData: employeeInfo,
        ipAddress,
      });
      await assignEmployeeToActiveExamIfAny(employee).catch(() => {});
      return { user, tempPassword, employee, reused: true };
    }
  }

  // Sinh mật khẩu tạm (6 chữ số)
  const { tempPassword, passwordHash } = await generateTempPassword();

  const newUser = await User.create({
    username: username.toLowerCase(),
    roleId,
    passwordHash,
    mustChangePassword: true,
  });

  let employee = null;
  if (isCandidate) {
    try {
      employee = await Employee.create({
        fullname: employeeInfo.fullname,
        departmentId: employeeInfo.departmentId,
        userId: newUser._id,
        employeeCode: employeeInfo.employeeCode || undefined,
        isActive: true,
      });
    } catch (err) {
      // Tạo Employee thất bại (vd departmentId sai, trùng employeeCode...) —
      // rollback User vừa tạo để không để lại tài khoản không có hồ sơ nhân viên.
      await User.deleteOne({ _id: newUser._id });
      throw new ApiError(
        400,
        `Không thể tạo hồ sơ nhân viên: ${err.message}`,
        'EMPLOYEE_CREATE_FAILED',
      );
    }

    // Nếu đang có kỳ thi published, tự động gán nhân viên mới vào đúng mã đề
    // của phòng ban họ (tạo mã đề mới nếu phòng ban chưa có). KHÔNG chặn việc
    // tạo tài khoản nếu bước này thất bại — chỉ log cảnh báo phía service.
    await assignEmployeeToActiveExamIfAny(employee);
  }

  // Audit
  await auditService.writeAudit({
    actorUserId: adminId,
    action: 'Tạo tài khoản',
    resourceType: 'User',
    resourceId: newUser._id,
    metadata: {
      username: newUser.username,
      ...(employee ? { employeeId: employee._id, fullname: employee.fullname } : {}),
    },
    ipAddress,
  });

  // Trả về kèm mật khẩu tạm để hiển thị 1 lần
  const userObj = newUser.toObject();
  delete userObj.passwordHash;
  return { user: userObj, tempPassword, employee, reused: false };
}

/** Đổi role */
export async function updateUserRole({ adminId, userId, newRoleId, ipAddress }) {
  if (adminId.toString() === userId.toString()) {
    throw new ApiError(403, 'Không thể tự đổi quyền của chính mình', 'CANNOT_CHANGE_OWN_ROLE');
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Không tìm thấy người dùng', 'USER_NOT_FOUND');

  const oldRoleId = user.roleId;
  user.roleId = newRoleId;
  await user.save();

  await auditService.writeAudit({
    actorUserId: adminId,
    action: 'Đổi quyền tài khoản',
    resourceType: 'User',
    resourceId: user._id,
    metadata: { username: user.username, oldRoleId, newRoleId },
    ipAddress,
  });

  return user;
}

/** Khóa / Mở khóa tài khoản */
export async function toggleUserLock({ adminId, userId, isActive, ipAddress }) {
  if (adminId.toString() === userId.toString()) {
    throw new ApiError(403, 'Không thể tự khóa/mở khóa tài khoản của chính mình', 'CANNOT_LOCK_SELF');
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Không tìm thấy người dùng', 'USER_NOT_FOUND');

  user.isActive = isActive;
  // Tăng tokenVersion để lập tức invalid token hiện tại
  user.tokenVersion += 1;
  await user.save();

  await auditService.writeAudit({
    actorUserId: adminId,
    action: isActive ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
    resourceType: 'User',
    resourceId: user._id,
    metadata: { username: user.username },
    ipAddress,
  });

  return user;
}

/** Reset mật khẩu */
export async function resetUserPassword({ adminId, userId, ipAddress }) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Không tìm thấy người dùng', 'USER_NOT_FOUND');

  // Sinh mật khẩu tạm (6 chữ số)
  const { tempPassword, passwordHash } = await generateTempPassword();

  user.passwordHash = passwordHash;
  user.mustChangePassword = true;
  user.tokenVersion += 1; // force logout out other sessions
  await user.save();

  await auditService.writeAudit({
    actorUserId: adminId,
    action: 'Reset mật khẩu',
    resourceType: 'User',
    resourceId: user._id,
    metadata: { username: user.username },
    ipAddress,
  });

  return { tempPassword };
}

// ─── Import Excel danh sách nhân viên (bulk) ───────────────────────────────

function normalizeKey(key) {
  return String(key ?? '')
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '');
}

function mapRowKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = v;
  }
  return out;
}

// Sinh username từ mã nhân viên: bỏ dấu, bỏ mọi ký tự không phải a-z0-9
// (vd "NV-001" -> "nv001", "NV_045" -> "nv045") — đã chốt với người dùng.
function usernameFromEmployeeCode(code) {
  return String(code)
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

async function buildEmployeeImportRow(row, rowIndex) {
  const r = mapRowKeys(row);
  const fullname = r.fullname ?? r.hoten ?? r.hovaten;
  const deptCodeRaw = r.maphongban ?? r.mabophan ?? r.maban ?? r.madepartment;
  const deptName = r.department ?? r.phongban ?? r.bophan;
  const employeeCodeRaw = r.employeecode ?? r.manhanvien ?? r.manv ?? r.ma ?? r.masonhanvien;
  // Các field "hồ sơ tham khảo" — không bắt buộc, chỉ lưu để hiển thị.
  const dob = r.ngaysinh ?? r.dob ?? '';
  const gender = r.gioitinh ?? r.gender ?? '';
  const phone = r.sodienthoai ?? r.dienthoai ?? r.sdt ?? r.phone ?? '';
  const address = r.diachi ?? r.address ?? '';
  const position = r.chucvu ?? r.position ?? '';

  if (!String(fullname ?? '').trim()) {
    throw new ApiError(400, `Dòng ${rowIndex}: thiếu họ tên`, 'IMPORT_ROW_INVALID');
  }
  if (!String(deptCodeRaw ?? '').trim() && !String(deptName ?? '').trim()) {
    throw new ApiError(
      400,
      `Dòng ${rowIndex}: thiếu phòng ban (cần Mã phòng ban hoặc Phòng ban)`,
      'IMPORT_ROW_INVALID',
    );
  }

  // Thiếu mã nhân viên -> tự sinh mã tạm dựa theo số thứ tự dòng, tránh
  // chặn cả dòng chỉ vì thiếu mã (theo yêu cầu người dùng).
  const employeeCode = String(employeeCodeRaw ?? '').trim() || `TMP${rowIndex}`;

  const username = usernameFromEmployeeCode(employeeCode);
  if (!username) {
    throw new ApiError(
      400,
      `Dòng ${rowIndex}: mã nhân viên "${employeeCode}" không sinh được username hợp lệ`,
      'IMPORT_ROW_INVALID',
    );
  }

  // MÃ PHÒNG BAN là khoá chính để xác định/tạo phòng ban (nếu có trong file
  // Excel) — "cntt" và "CNTT" luôn quy về đúng 1 phòng ban, bất kể cột
  // "Phòng ban" ở các dòng ghi khác nhau ("cong nghe thong tin" hay "công
  // nghệ thông tin"). Cột tên chỉ dùng để đặt tên hiển thị khi cần tạo mới.
  // Nếu file không có cột mã (tương thích file mẫu cũ) thì rơi về so khớp
  // theo tên đã chuẩn hoá dấu/hoa-thường.
  const dept = String(deptCodeRaw ?? '').trim()
    ? await findOrCreateDepartmentByCode({ code: deptCodeRaw, name: deptName })
    : await findOrCreateDepartmentByName(String(deptName));
  if (!dept) {
    throw new ApiError(400, `Dòng ${rowIndex}: phòng ban không hợp lệ`, 'IMPORT_ROW_INVALID');
  }

  return {
    rowIndex,
    fullname: String(fullname).trim(),
    employeeCode,
    username,
    departmentId: dept._id,
    departmentName: dept.name,
    dob: String(dob ?? '').trim(),
    gender: String(gender ?? '').trim(),
    phone: String(phone ?? '').trim(),
    address: String(address ?? '').trim(),
    position: String(position ?? '').trim(),
  };
}

/**
 * Import hàng loạt nhân viên/tài khoản thí sinh từ Excel.
 * Quy tắc (đã chốt với người dùng):
 * - username = mã nhân viên đã bỏ dấu/ký tự đặc biệt, lowercase.
 * - phòng ban được xác định theo cột "Mã phòng ban" (khoá chính, không phân
 *   biệt hoa/thường/dấu) nếu có; nếu file không có cột mã thì fallback theo
 *   cột "Phòng ban" (tên, cũng không phân biệt dấu/hoa-thường). Không khớp
 *   phòng ban nào đã có thì TỰ ĐỘNG TẠO MỚI (không còn báo lỗi dòng).
 * - dòng có employeeCode đã tồn tại (Employee.employeeCode):
 *   + Nếu User gắn với employee đó đang HOẠT ĐỘNG -> chỉ CẬP NHẬT hồ sơ
 *     (fullname/phòng ban/...), giữ nguyên username & mật khẩu, KHÔNG tạo
 *     User mới (hành vi cũ).
 *   + Nếu User gắn với employee đó đang BỊ KHÓA (nhân viên cũ đã nghỉ) ->
 *     coi như "tái sử dụng": cập nhật hồ sơ, đổi username theo mã mới, mở
 *     khóa tài khoản và cấp mật khẩu tạm MỚI (status trả về là 'reused').
 * - dòng thiếu employeeCode -> tự sinh mã tạm TMP<rowIndex>.
 * - luôn gán role 'candidate'.
 */
export async function importEmployeesFromExcelFile(filePath, adminId, ipAddress) {
  if (!fs.existsSync(filePath)) {
    throw new ApiError(400, 'Không đọc được file upload', 'IMPORT_FILE_MISSING');
  }

  const candidateRole = await Role.findOne({ code: 'candidate' });
  if (!candidateRole) {
    throw new ApiError(500, 'Chưa cấu hình role candidate trong hệ thống', 'ROLE_NOT_FOUND');
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new ApiError(400, 'File Excel không có sheet', 'IMPORT_EMPTY');

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  if (!rows.length) throw new ApiError(400, 'Sheet trống', 'IMPORT_EMPTY');

  const results = [];
  let processedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let reusedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const rowIndex = i + 2; // dòng 1 là header

    // Bỏ qua dòng trống hoặc dòng chú thích/hướng dẫn ở cuối file mẫu (vd
    // "Ghi chú:", "- Cột màu xanh...") — các dòng này chỉ có nội dung ở 1
    // cột duy nhất (thường là cột "Họ tên"), không phải dòng dữ liệu nhân
    // viên thật, nên KHÔNG tính là lỗi thiếu phòng ban/họ tên.
    const nonEmptyCellCount = Object.values(rows[i]).filter(
      (v) => String(v ?? '').trim() !== '',
    ).length;
    if (nonEmptyCellCount <= 1) {
      continue;
    }

    processedCount += 1;
    try {
      const parsed = await buildEmployeeImportRow(rows[i], rowIndex);

      const { existingUser, existingEmployee } = await findExistingAccountForReuse({
        employeeCode: parsed.employeeCode,
        username: parsed.username,
      });

      if (existingUser) {
        if (!existingUser.isActive) {
          // Tài khoản của nhân viên cũ (đã nghỉ, bị khóa) -> tái sử dụng
          // cho nhân viên mới cùng mã: đổi username, mở khóa, cấp mật khẩu mới.
          const { user, tempPassword } = await reactivateLockedAccount({
            adminId,
            existingUser,
            existingEmployee,
            newUsername: parsed.username,
            employeeData: parsed,
            ipAddress,
          });

          results.push({
            row: rowIndex,
            employeeCode: parsed.employeeCode,
            username: user.username,
            fullname: parsed.fullname,
            department: parsed.departmentName,
            status: 'reused',
            tempPassword,
            message: 'Mã trùng với tài khoản đã bị khóa — đã tự động mở khóa và cấp lại cho nhân viên mới',
          });
          reusedCount += 1;
          continue;
        }

        // User đang hoạt động -> chỉ update hồ sơ, không đổi username/mật khẩu.
        // Nếu tài khoản trùng chưa có Employee (tài khoản kiểu cũ, khớp qua
        // username) thì tạo mới Employee gắn vào User đó, thay vì bỏ qua.
        if (existingEmployee) {
          existingEmployee.fullname = parsed.fullname;
          existingEmployee.departmentId = parsed.departmentId;
          existingEmployee.employeeCode = parsed.employeeCode || existingEmployee.employeeCode;
          existingEmployee.dob = parsed.dob;
          existingEmployee.gender = parsed.gender;
          existingEmployee.phone = parsed.phone;
          existingEmployee.address = parsed.address;
          existingEmployee.position = parsed.position;
          await existingEmployee.save();
        } else {
          await Employee.create({
            fullname: parsed.fullname,
            departmentId: parsed.departmentId,
            userId: existingUser._id,
            employeeCode: parsed.employeeCode,
            dob: parsed.dob,
            gender: parsed.gender,
            phone: parsed.phone,
            address: parsed.address,
            position: parsed.position,
            isActive: true,
          });
        }

        results.push({
          row: rowIndex,
          employeeCode: parsed.employeeCode,
          username: existingUser?.username ?? '',
          fullname: parsed.fullname,
          department: parsed.departmentName,
          status: 'updated',
          tempPassword: '',
          message: 'Đã cập nhật hồ sơ (không tạo tài khoản mới)',
        });
        updatedCount += 1;
        continue;
      }

      const usernameTaken = await User.findOne({ username: parsed.username });
      if (usernameTaken) {
        throw new ApiError(
          400,
          `Dòng ${rowIndex}: username "${parsed.username}" đã tồn tại (thuộc mã nhân viên khác) — kiểm tra lại dữ liệu`,
          'IMPORT_USERNAME_CONFLICT',
        );
      }

      const { tempPassword, passwordHash } = await generateTempPassword();

      const newUser = await User.create({
        username: parsed.username,
        roleId: candidateRole._id,
        passwordHash,
        mustChangePassword: true,
      });

      let employee;
      try {
        employee = await Employee.create({
          fullname: parsed.fullname,
          departmentId: parsed.departmentId,
          userId: newUser._id,
          employeeCode: parsed.employeeCode,
          dob: parsed.dob,
          gender: parsed.gender,
          phone: parsed.phone,
          address: parsed.address,
          position: parsed.position,
          isActive: true,
        });
      } catch (err) {
        await User.deleteOne({ _id: newUser._id });
        throw new ApiError(
          400,
          `Dòng ${rowIndex}: không thể tạo hồ sơ nhân viên (${err.message})`,
          'EMPLOYEE_CREATE_FAILED',
        );
      }

      // Không chặn import nếu bước gán mã đề thất bại
      await assignEmployeeToActiveExamIfAny(employee).catch(() => {});

      results.push({
        row: rowIndex,
        employeeCode: parsed.employeeCode,
        username: parsed.username,
        fullname: parsed.fullname,
        department: parsed.departmentName,
        status: 'created',
        tempPassword,
        message: 'Tạo tài khoản thành công',
      });
      createdCount += 1;
    } catch (err) {
      failedCount += 1;
      results.push({
        row: rowIndex,
        employeeCode: '',
        username: '',
        fullname: '',
        department: '',
        status: 'error',
        tempPassword: '',
        message: err.message ?? 'Lỗi không xác định',
      });
    }
  }

  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore cleanup */
  }

  if (createdCount > 0 || updatedCount > 0 || reusedCount > 0) {
    await auditService.writeAudit({
      actorUserId: adminId,
      action: 'Import nhân viên từ Excel',
      resourceType: 'User',
      metadata: { created: createdCount, updated: updatedCount, reused: reusedCount, failed: failedCount },
      ipAddress,
    });
  }

  return {
    total: processedCount,
    created: createdCount,
    updated: updatedCount,
    reused: reusedCount,
    failed: failedCount,
    results,
  };
}