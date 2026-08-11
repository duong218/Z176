import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../models/index.js';
import { ApiError } from '../utils/api-error.js';
import * as auditService from './audit.service.js';

/** Lấy danh sách user kèm thông tin role */
export async function listUsers() {
  return User.find().populate('roleId', 'code name').sort({ createdAt: -1 }).lean();
}

/** Tạo user mới, sinh pass ngẫu nhiên (6 chữ số) */
export async function createUser({ adminId, username, roleId, ipAddress }) {
  // Check duplicate
  const existing = await User.findOne({ username: username.toLowerCase() });
  if (existing) {
    throw new ApiError(400, 'Tên đăng nhập đã tồn tại', 'USERNAME_EXISTS');
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

  // Audit
  await auditService.writeAudit({
    actorUserId: adminId,
    action: 'Tạo tài khoản',
    resourceType: 'User',
    resourceId: newUser._id,
    metadata: { username: newUser.username },
    ipAddress,
  });

  // Trả về kèm mật khẩu tạm để hiển thị 1 lần
  const userObj = newUser.toObject();
  delete userObj.passwordHash;
  return { user: userObj, tempPassword };
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
