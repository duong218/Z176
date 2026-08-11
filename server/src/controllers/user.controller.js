import * as userService from '../services/user.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/api-error.js';

export const list = asyncHandler(async (req, res) => {
  const data = await userService.listUsers();
  res.json({ success: true, message: 'OK', code: 'USER_LIST_OK', data });
});

export const create = asyncHandler(async (req, res) => {
  const { username, roleId } = req.body ?? {};
  if (!username || !roleId) {
    throw new ApiError(400, 'Thiếu thông tin bắt buộc (username, roleId)', 'MISSING_FIELDS');
  }

  const { user, tempPassword } = await userService.createUser({
    adminId: req.auth.userId,
    username,
    roleId,
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    message: 'Tạo tài khoản thành công',
    code: 'USER_CREATED',
    data: user,
    tempPassword, // Chỉ trả về 1 lần
  });
});

export const updateRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { roleId } = req.body ?? {};
  if (!roleId) {
    throw new ApiError(400, 'Thiếu roleId', 'MISSING_FIELDS');
  }

  const data = await userService.updateUserRole({
    adminId: req.auth.userId,
    userId: id,
    newRoleId: roleId,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: 'Cập nhật phân quyền thành công', code: 'ROLE_UPDATED', data });
});

export const toggleLock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body ?? {};
  if (typeof isActive !== 'boolean') {
    throw new ApiError(400, 'isActive phải là boolean', 'INVALID_FIELD');
  }

  const data = await userService.toggleUserLock({
    adminId: req.auth.userId,
    userId: id,
    isActive,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản', code: 'LOCK_TOGGLED', data });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { tempPassword } = await userService.resetUserPassword({
    adminId: req.auth.userId,
    userId: id,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'Đã reset mật khẩu thành công',
    code: 'PASSWORD_RESET',
    tempPassword,
  });
});
