import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User, Role, Employee } from '../models/index.js';
import { ApiError } from '../utils/api-error.js';
import * as auditService from './audit.service.js';
import { assignEmployeeToActiveExamIfAny } from './exam-code-generation.service.js';

/** Lấy danh sách user kèm thông tin role */
export async function listUsers() {
  return User.find().populate('roleId', 'code name').sort({ createdAt: -1 }).lean();
}

/**
 * Tạo user mới, sinh pass ngẫu nhiên (6 chữ số).
 *
 * MỚI: nếu role được chọn có code = 'candidate' (thí sinh), bắt buộc phải kèm
 * employeeInfo (fullname, departmentId, employeeCode tuỳ chọn) — hệ thống sẽ tự
 * tạo Employee gắn với user này ngay trong cùng lượt tạo, tránh trường hợp tài
 * khoản thí sinh "mồ côi" không có hồ sơ nhân viên (Employee.userId) đi kèm.
 */
export async function createUser({ adminId, username, roleId, ipAddress, employeeInfo }) {
  // Check duplicate
  const existing = await User.findOne({ username: username.toLowerCase() });
  if (existing) {
    throw new ApiError(400, 'Tên đăng nhập đã tồn tại', 'USERNAME_EXISTS');
  }

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

  // Sinh mật khẩu tạm (6 chữ số)
  const tempPassword = crypto.randomInt(100000, 999999).toString();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

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
  return { user: userObj, tempPassword, employee };
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
  const tempPassword = crypto.randomInt(100000, 999999).toString();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

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