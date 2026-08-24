import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';
import XLSX from 'xlsx';
import ExcelJS from 'exceljs'; // MỚI — dùng để xuất Excel có định dạng (màu, border, độ rộng cột) cho export-credentials, khác với XLSX (chỉ dùng để ĐỌC file import ở dưới)
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
  // Đồng bộ với toggleUserLock(): mở khóa (kể cả qua nhánh tái sử dụng này)
  // phải xóa lockedAt, nếu không mốc đếm 6 tháng xóa cứng cũ sẽ còn sót lại
  // dù tài khoản đã active — vô hại cho job purge (chỉ quét isActive:false)
  // nhưng để lại dữ liệu rác, dễ gây hiểu nhầm nếu field này được dùng ở nơi
  // khác sau này.
  existingUser.lockedAt = undefined;
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

  // Audit: KHÔNG ghi ở đây nữa — user.controller.js đã ghi audit log đúng
  // chuẩn (action: 'CREATE_USER', kèm metadata.detail) ngay sau khi gọi hàm
  // này. Log cũ ở đây dùng action dạng chữ thường ('Tạo tài khoản', không
  // khớp mã ACTION_LABELS phía client) và không có metadata.detail, gây ra
  // MỖI LẦN TẠO TÀI KHOẢN BỊ GHI TRÙNG 2 DÒNG LOG (1 dòng có chi tiết từ
  // controller, 1 dòng "-" từ đây) — xem Nhật ký (Log) ở AuditLogTab.jsx.

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

  // Audit: KHÔNG ghi ở đây nữa — user.controller.js đã ghi audit log đúng
  // chuẩn (action: 'UPDATE_ROLE', kèm metadata.detail) ngay sau khi gọi hàm
  // này, cùng lý do như createUser() ở trên — tránh trùng log.

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
  // MỚI — Theo dõi mốc thời gian lần khóa gần nhất để phục vụ xóa cứng tự
  // động sau 6 tháng (account-purge.service.js). Khóa -> ghi lại thời điểm
  // khóa. Mở khóa -> xóa mốc này, để nếu sau đó bị khóa lại thì đồng hồ 6
  // tháng tính lại từ đầu (không cộng dồn thời gian đã khóa trước đó).
  user.lockedAt = isActive ? undefined : new Date();
  // Tăng tokenVersion để lập tức invalid token hiện tại
  user.tokenVersion += 1;
  await user.save();

  // Audit: KHÔNG ghi ở đây nữa — user.controller.js đã ghi audit log đúng
  // chuẩn (action: 'LOCK_USER'/'UNLOCK_USER', kèm metadata.detail) ngay sau
  // khi gọi hàm này, cùng lý do như createUser() ở trên — tránh trùng log.

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

  // Audit: KHÔNG ghi ở đây nữa — user.controller.js đã ghi audit log đúng
  // chuẩn (action: 'RESET_PASSWORD', kèm metadata.detail) ngay sau khi gọi
  // hàm này, cùng lý do như createUser() ở trên — tránh trùng log.

  return { tempPassword };
}

/**
 * MỚI: Xuất danh sách TÀI KHOẢN NHÂN VIÊN (role 'candidate' — KHÔNG bao gồm
 * admin/examiner/leader) ra file Excel định dạng rõ ràng, kèm username +
 * mật khẩu. Vì mật khẩu tạm không lưu dạng plain text trong DB (chỉ lưu
 * hash), hành động xuất này BẮT BUỘC phải reset mật khẩu tạm cho từng tài
 * khoản trước khi ghi vào file — đây là điểm khác biệt quan trọng so với
 * resetUserPassword() (chỉ reset 1 tài khoản, không xuất file).
 *
 * Chỉ áp dụng cho tài khoản đang hoạt động (isActive: true) — tài khoản đã
 * khóa bị bỏ qua vì không dùng được nên reset không có ý nghĩa.
 *
 * Trả về { buffer, count } — buffer là file .xlsx dạng Buffer, count là số
 * tài khoản đã được reset + đưa vào file.
 */
export async function exportCandidateCredentialsExcel({ adminId, ipAddress }) {
  const candidateRole = await Role.findOne({ code: 'candidate' });
  if (!candidateRole) {
    throw new ApiError(500, 'Không tìm thấy role "candidate" trong hệ thống', 'ROLE_NOT_FOUND');
  }

  const users = await User.find({ roleId: candidateRole._id, isActive: true }).sort({ username: 1 });
  if (!users.length) {
    throw new ApiError(404, 'Không có tài khoản nhân viên nào đang hoạt động để xuất', 'NO_CANDIDATE_USERS');
  }

  const employees = await Employee.find({ userId: { $in: users.map((u) => u._id) } })
    .populate('departmentId', 'name')
    .lean();
  const employeeByUserId = new Map(employees.map((e) => [e.userId.toString(), e]));

  // Reset mật khẩu tạm cho TỪNG tài khoản — dùng chung generateTempPassword()
  // với resetUserPassword() để đồng nhất độ dài/độ khó mật khẩu.
  const rows = [];
  for (const user of users) {
    const { tempPassword, passwordHash } = await generateTempPassword();
    user.passwordHash = passwordHash;
    user.mustChangePassword = true;
    user.tokenVersion += 1; // vô hiệu hóa mọi phiên đăng nhập cũ
    await user.save();

    const emp = employeeByUserId.get(user._id.toString());
    rows.push({
      fullname: emp?.fullname ?? '',
      employeeCode: emp?.employeeCode ?? '',
      departmentName: emp?.departmentId?.name ?? '',
      position: emp?.position ?? '',
      username: user.username,
      tempPassword,
    });
  }

  const buffer = await buildCredentialsWorkbook(rows);

  await auditService.writeAudit({
    actorUserId: adminId,
    action: 'EXPORT_CANDIDATE_CREDENTIALS',
    resourceType: 'User',
    resourceId: null,
    metadata: { detail: `Xuất danh sách + reset mật khẩu tạm cho ${rows.length} tài khoản nhân viên` },
    ipAddress,
  });

  return { buffer, count: rows.length };
}

/** Dựng workbook Excel định dạng rõ ràng cho danh sách username/mật khẩu tạm. */
async function buildCredentialsWorkbook(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Z176 - Hệ thống thi nội bộ';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Danh sách nhân viên', {
    views: [{ state: 'frozen', ySplit: 1 }], // khóa dòng tiêu đề khi cuộn
  });

  sheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Họ tên', key: 'fullname', width: 26 },
    { header: 'Mã nhân viên', key: 'employeeCode', width: 16 },
    { header: 'Phòng ban', key: 'departmentName', width: 24 },
    { header: 'Chức vụ', key: 'position', width: 20 },
    { header: 'Username', key: 'username', width: 18 },
    { header: 'Mật khẩu tạm', key: 'tempPassword', width: 16 },
  ];

  rows.forEach((r, i) => sheet.addRow({ stt: i + 1, ...r }));

  // Header: nền xanh đậm, chữ trắng, in đậm, căn giữa
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008BC5' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
      bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
      left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
      right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
    };
  });
  headerRow.height = 22;

  // Dữ liệu: border mỏng + zebra stripe cho dễ đọc, cột mật khẩu tô vàng nhạt
  // để nổi bật (đây là thông tin nhạy cảm, cần dễ nhìn thấy khi gửi/in).
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const isEven = i % 2 === 0;
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left' };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F9FC' } };
      }
      const isPasswordCol = sheet.getColumn(colNumber).key === 'tempPassword';
      const isUsernameCol = sheet.getColumn(colNumber).key === 'username';
      if (isPasswordCol) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (isUsernameCol) {
        cell.font = { bold: true };
      }
    });
    row.height = 18;
  }

  sheet.autoFilter = { from: 'A1', to: `G1` };

  // Ghi chú cảnh báo bảo mật ở cuối file
  const noteRowIndex = sheet.rowCount + 2;
  const note = sheet.getCell(`A${noteRowIndex}`);
  note.value = 'Lưu ý: Mật khẩu tạm chỉ hiển thị được 1 lần duy nhất tại thời điểm xuất. Vui lòng gửi cho nhân viên và yêu cầu đổi mật khẩu ngay lần đăng nhập đầu tiên. Không chia sẻ file này cho người không liên quan.';
  note.font = { italic: true, size: 10, color: { argb: 'FFB91C1C' } };
  sheet.mergeCells(`A${noteRowIndex}:G${noteRowIndex}`);
  sheet.getRow(noteRowIndex).alignment = { wrapText: true };

  return workbook.xlsx.writeBuffer();
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
 * Đọc file Excel và tách các dòng dữ liệu hợp lệ (bỏ dòng trống/chú thích).
 * Dùng chung cho cả preview và (trước đây) import trực tiếp.
 */
function readImportRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new ApiError(400, 'Không đọc được file upload', 'IMPORT_FILE_MISSING');
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new ApiError(400, 'File Excel không có sheet', 'IMPORT_EMPTY');

  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  if (!rawRows.length) throw new ApiError(400, 'Sheet trống', 'IMPORT_EMPTY');

  const rows = [];
  for (let i = 0; i < rawRows.length; i += 1) {
    const rowIndex = i + 2; // dòng 1 là header

    // Bỏ qua dòng trống hoặc dòng chú thích/hướng dẫn ở cuối file mẫu (vd
    // "Ghi chú:", "- Cột màu xanh...") — các dòng này chỉ có nội dung ở 1
    // cột duy nhất (thường là cột "Họ tên"), không phải dòng dữ liệu nhân
    // viên thật, nên KHÔNG tính là lỗi thiếu phòng ban/họ tên.
    const nonEmptyCellCount = Object.values(rawRows[i]).filter(
      (v) => String(v ?? '').trim() !== '',
    ).length;
    if (nonEmptyCellCount <= 1) continue;

    rows.push({ rowIndex, raw: rawRows[i] });
  }
  return rows;
}

/**
 * MỚI: Phân loại 1 dòng đã parse (chưa ghi DB) — xác định sẽ 'create' (tạo
 * mới), 'reuse' (trùng mã/username với tài khoản đã khóa -> tái sử dụng),
 * 'update' (trùng với tài khoản đang hoạt động -> chỉ cập nhật hồ sơ), hay
 * 'conflict' (trùng username thuộc 1 mã nhân viên KHÁC, không liên quan gì
 * tới employeeCode của dòng này — không thể xử lý tự động, cần admin sửa
 * lại file).
 */
async function classifyImportRow(parsed) {
  const { existingUser, existingEmployee } = await findExistingAccountForReuse({
    employeeCode: parsed.employeeCode,
    username: parsed.username,
  });

  if (!existingUser) {
    return { ...parsed, action: 'create' };
  }

  if (!existingUser.isActive) {
    return {
      ...parsed,
      action: 'reuse',
      reuseTarget: {
        userId: existingUser._id.toString(),
        username: existingUser.username,
        fullname: existingEmployee?.fullname ?? '(không có hồ sơ)',
        employeeCode: existingEmployee?.employeeCode ?? '',
      },
    };
  }

  // existingUser đang HOẠT ĐỘNG.
  // Nếu tài khoản trùng đó chính là do khớp employeeCode với dòng này (tức
  // employeeCode của dòng này khớp đúng employeeCode hiện có) -> coi là
  // "update hồ sơ" (hành vi cũ: cùng 1 nhân viên, chỉ cập nhật lại thông tin).
  const sameEmployeeCode =
    parsed.employeeCode && existingEmployee?.employeeCode === parsed.employeeCode;
  if (sameEmployeeCode || existingUser.username === parsed.username) {
    return {
      ...parsed,
      action: 'update',
      updateTarget: {
        userId: existingUser._id.toString(),
        username: existingUser.username,
        fullname: existingEmployee?.fullname ?? '',
      },
    };
  }

  // Trường hợp hiếm: username sinh ra từ employeeCode của dòng này lại trùng
  // với 1 tài khoản đang hoạt động KHÁC (không cùng employeeCode) -> xung đột
  // thật sự, không thể tự xử lý.
  return {
    ...parsed,
    action: 'conflict',
    conflictWith: {
      username: existingUser.username,
      fullname: existingEmployee?.fullname ?? '',
      employeeCode: existingEmployee?.employeeCode ?? '',
    },
  };
}

/**
 * MỚI — BƯỚC 1/2: Xem trước kết quả import mà KHÔNG ghi gì vào DB.
 * Trả về danh sách từng dòng kèm phân loại (create/reuse/update/conflict/
 * duplicate_in_file/error) để admin xác nhận trước khi ghi thật — đặc biệt
 * quan trọng với dòng 'reuse' (ghi đè lên tài khoản của nhân viên đã nghỉ),
 * 'conflict' (trùng tài khoản đang hoạt động, cần biết rõ trùng với ai để
 * admin tự sửa file/username), và 'duplicate_in_file' (nhiều dòng TRONG
 * CÙNG file này lại có cùng mã nhân viên — nếu cứ để xử lý bình thường,
 * các dòng này sẽ cùng trỏ vào 1 tài khoản đích và dòng xử lý sau sẽ ghi đè
 * âm thầm lên dòng xử lý trước lúc confirm, mất dữ liệu mà không có cảnh
 * báo nào).
 */
export async function previewEmployeesFromExcelFile(filePath) {
  const rows = readImportRows(filePath);

  // Vòng 1: parse riêng từng dòng (không phụ thuộc DB) để trước hết phát
  // hiện trùng employeeCode NGAY TRONG FILE — phải làm trước khi đối chiếu
  // DB, vì nếu 2 dòng cùng mã cùng được coi là "update" tài khoản đích, hệ
  // thống sẽ không có cách nào biết dòng nào mới "đúng" hơn dòng nào.
  const parsedRows = [];
  const parseErrors = [];
  for (const { rowIndex, raw } of rows) {
    try {
      const parsed = await buildEmployeeImportRow(raw, rowIndex);
      parsedRows.push(parsed);
    } catch (err) {
      parseErrors.push({
        rowIndex,
        action: 'error',
        message: err.message ?? 'Lỗi không xác định',
      });
    }
  }

  // Gom nhóm theo employeeCode để tìm mã nào xuất hiện > 1 lần trong file.
  const rowIndexesByCode = new Map();
  for (const p of parsedRows) {
    const list = rowIndexesByCode.get(p.employeeCode) ?? [];
    list.push(p.rowIndex);
    rowIndexesByCode.set(p.employeeCode, list);
  }

  const preview = [];
  let toCreate = 0;
  let toReuse = 0;
  let toUpdate = 0;
  let conflicts = 0;
  let duplicatesInFile = 0;
  let errors = parseErrors.length;

  for (const parsed of parsedRows) {
    const duplicateRowIndexes = rowIndexesByCode
      .get(parsed.employeeCode)
      .filter((idx) => idx !== parsed.rowIndex);

    if (duplicateRowIndexes.length > 0) {
      duplicatesInFile += 1;
      preview.push({
        ...parsed,
        action: 'duplicate_in_file',
        duplicateRows: duplicateRowIndexes,
        message: `Mã nhân viên "${parsed.employeeCode}" xuất hiện ở nhiều dòng trong cùng file (dòng ${[parsed.rowIndex, ...duplicateRowIndexes].sort((a, b) => a - b).join(', ')}) — hãy sửa file để mỗi mã chỉ còn 1 dòng rồi import lại`,
      });
      continue;
    }

    const classified = await classifyImportRow(parsed);
    preview.push(classified);
    if (classified.action === 'create') toCreate += 1;
    else if (classified.action === 'reuse') toReuse += 1;
    else if (classified.action === 'update') toUpdate += 1;
    else if (classified.action === 'conflict') conflicts += 1;
  }

  // Gộp lại đúng thứ tự dòng gốc trong file cho preview dễ đọc.
  const merged = [...preview, ...parseErrors].sort((a, b) => a.rowIndex - b.rowIndex);

  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore cleanup */
  }

  return {
    total: rows.length,
    toCreate,
    toReuse,
    toUpdate,
    conflicts,
    duplicatesInFile,
    errors,
    rows: merged,
  };
}


/**
 * MỚI — BƯỚC 2/2: Ghi thật vào DB, dựa trên danh sách dòng ĐÃ ĐƯỢC PHÂN LOẠI
 * ở bước preview (client gửi lại nguyên payload `rows` từ preview — không
 * đọc lại file Excel nữa, tránh phải giữ file tạm giữa 2 request và tránh
 * parse lại tốn thời gian với file hàng chục nghìn dòng).
 *
 * Chỉ xử lý các dòng có action 'create' | 'reuse' | 'update' — dòng
 * 'conflict' hoặc 'error' bị bỏ qua (không tính vào kết quả) vì admin chưa
 * xác nhận cách xử lý cho các dòng đó (họ cần tự sửa lại file rồi import lại
 * riêng các dòng đó ở lượt sau).
 */
export async function confirmEmployeeImportRows(rows, adminId, ipAddress) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new ApiError(400, 'Không có dòng nào để xác nhận import', 'IMPORT_EMPTY');
  }

  const candidateRole = await Role.findOne({ code: 'candidate' });
  if (!candidateRole) {
    throw new ApiError(500, 'Chưa cấu hình role candidate trong hệ thống', 'ROLE_NOT_FOUND');
  }

  const results = [];
  let createdCount = 0;
  let updatedCount = 0;
  let reusedCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const { rowIndex, action } = row ?? {};
    if (action !== 'create' && action !== 'reuse' && action !== 'update') {
      continue; // bỏ qua conflict/error — admin chưa xác nhận cách xử lý
    }

    try {
      if (action === 'reuse' || action === 'update') {
        // Re-fetch trực tiếp bằng userId đã xác định ở bước preview (đáng tin
        // hơn là tìm lại theo employeeCode/username — dữ liệu có thể vừa đổi
        // giữa lúc preview và lúc confirm, vd admin thao tác tay song song).
        const targetUserId = row.reuseTarget?.userId ?? row.updateTarget?.userId;
        const existingUser = await User.findById(targetUserId).select('+passwordHash');
        if (!existingUser) {
          throw new ApiError(
            400,
            `Dòng ${rowIndex}: tài khoản dự kiến ${action === 'reuse' ? 'tái sử dụng' : 'cập nhật'} không còn tồn tại — có thể đã bị xóa giữa lúc xem trước và xác nhận`,
            'IMPORT_TARGET_MISSING',
          );
        }
        const existingEmployee = await Employee.findOne({ userId: existingUser._id });

        if (action === 'reuse') {
          if (existingUser.isActive) {
            // Đã có ai đó mở khóa tài khoản này giữa lúc preview và confirm
            // -> không tái sử dụng nữa để tránh ghi đè nhầm, báo lỗi rõ ràng.
            throw new ApiError(
              409,
              `Dòng ${rowIndex}: tài khoản "${existingUser.username}" đã được mở khóa bởi thao tác khác — không thể tự động tái sử dụng nữa`,
              'IMPORT_TARGET_NO_LONGER_LOCKED',
            );
          }
          const { user, tempPassword } = await reactivateLockedAccount({
            adminId,
            existingUser,
            existingEmployee,
            newUsername: row.username,
            employeeData: row,
            ipAddress,
          });
          results.push({
            row: rowIndex,
            employeeCode: row.employeeCode,
            username: user.username,
            fullname: row.fullname,
            department: row.departmentName,
            status: 'reused',
            tempPassword,
            message: `Đã mở khóa và cấp lại tài khoản (trước đó thuộc về "${row.reuseTarget?.fullname || row.reuseTarget?.username}")`,
          });
          reusedCount += 1;
          continue;
        }

        // action === 'update'
        if (existingEmployee) {
          existingEmployee.fullname = row.fullname;
          existingEmployee.departmentId = row.departmentId;
          existingEmployee.employeeCode = row.employeeCode || existingEmployee.employeeCode;
          existingEmployee.dob = row.dob;
          existingEmployee.gender = row.gender;
          existingEmployee.phone = row.phone;
          existingEmployee.address = row.address;
          existingEmployee.position = row.position;
          await existingEmployee.save();
        } else {
          await Employee.create({
            fullname: row.fullname,
            departmentId: row.departmentId,
            userId: existingUser._id,
            employeeCode: row.employeeCode,
            dob: row.dob,
            gender: row.gender,
            phone: row.phone,
            address: row.address,
            position: row.position,
            isActive: true,
          });
        }
        results.push({
          row: rowIndex,
          employeeCode: row.employeeCode,
          username: existingUser.username,
          fullname: row.fullname,
          department: row.departmentName,
          status: 'updated',
          tempPassword: '',
          message: 'Đã cập nhật hồ sơ (không tạo tài khoản mới)',
        });
        updatedCount += 1;
        continue;
      }

      // action === 'create'
      const usernameTaken = await User.findOne({ username: row.username });
      if (usernameTaken) {
        throw new ApiError(
          400,
          `Dòng ${rowIndex}: username "${row.username}" đã tồn tại — dữ liệu có thể vừa thay đổi giữa lúc xem trước và xác nhận, hãy import lại`,
          'IMPORT_USERNAME_CONFLICT',
        );
      }

      const { tempPassword, passwordHash } = await generateTempPassword();
      const newUser = await User.create({
        username: row.username,
        roleId: candidateRole._id,
        passwordHash,
        mustChangePassword: true,
      });

      let employee;
      try {
        employee = await Employee.create({
          fullname: row.fullname,
          departmentId: row.departmentId,
          userId: newUser._id,
          employeeCode: row.employeeCode,
          dob: row.dob,
          gender: row.gender,
          phone: row.phone,
          address: row.address,
          position: row.position,
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

      await assignEmployeeToActiveExamIfAny(employee).catch(() => {});

      results.push({
        row: rowIndex,
        employeeCode: row.employeeCode,
        username: row.username,
        fullname: row.fullname,
        department: row.departmentName,
        status: 'created',
        tempPassword,
        message: 'Tạo tài khoản thành công',
      });
      createdCount += 1;
    } catch (err) {
      failedCount += 1;
      results.push({
        row: rowIndex,
        employeeCode: row?.employeeCode ?? '',
        username: '',
        fullname: row?.fullname ?? '',
        department: row?.departmentName ?? '',
        status: 'error',
        tempPassword: '',
        message: err.message ?? 'Lỗi không xác định',
      });
    }
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
    total: results.length,
    created: createdCount,
    updated: updatedCount,
    reused: reusedCount,
    failed: failedCount,
    results,
  };
}