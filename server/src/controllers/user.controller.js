import * as userService from '../services/user.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/api-error.js';
import { writeAudit } from '../services/audit.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await userService.listUsers();
  res.json({ success: true, message: 'OK', code: 'USER_LIST_OK', data });
});

export const create = asyncHandler(async (req, res) => {
  const { username, roleId, fullname, departmentId, employeeCode } = req.body ?? {};
  if (!username || !roleId) {
    throw new ApiError(400, 'Thiếu thông tin bắt buộc (username, roleId)', 'MISSING_FIELDS');
  }

  const { user, tempPassword, employee, reused } = await userService.createUser({
    adminId: req.auth.userId,
    username,
    roleId,
    ipAddress: req.ip,
    // Chỉ có ý nghĩa khi roleId ứng với role 'candidate' — service sẽ tự kiểm tra
    // và báo lỗi nếu thiếu trong trường hợp đó. Với các role khác, các field này
    // bị bỏ qua nếu có gửi lên.
    employeeInfo: { fullname, departmentId, employeeCode },
  });

  // Khi reused=true, userService đã tự ghi audit riêng ("Tái sử dụng tài khoản
  // đã khóa") nên không ghi lại audit CREATE_USER ở đây để tránh trùng lặp log.
  if (!reused) {
    await writeAudit({
      actorUserId: req.auth.userId,
      action: 'CREATE_USER',
      resourceType: 'User',
      resourceId: user._id,
      metadata: { detail: `Tạo tài khoản mới: ${username}` },
      ipAddress: req.ip,
    });
  }

  res.status(201).json({
    success: true,
    message: reused
      ? `Mã nhân viên "${employeeCode}" trùng với tài khoản đã bị khóa — đã tự động mở khóa và cấp lại cho nhân viên mới`
      : 'Tạo tài khoản thành công',
    code: reused ? 'USER_REUSED' : 'USER_CREATED',
    data: { ...user, employee },
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

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'UPDATE_ROLE',
    resourceType: 'User',
    resourceId: id,
    metadata: { detail: `Cập nhật phân quyền cho tài khoản ${data.username}` },
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

  await writeAudit({
    actorUserId: req.auth.userId,
    action: isActive ? 'UNLOCK_USER' : 'LOCK_USER',
    resourceType: 'User',
    resourceId: id,
    metadata: { detail: `${isActive ? 'Mở khóa' : 'Khóa'} tài khoản ${data.username}` },
    ipAddress: req.ip,
  });

  res.json({ success: true, message: isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản', code: 'LOCK_TOGGLED', data });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { tempPassword, user } = await userService.resetUserPassword({
    adminId: req.auth.userId,
    userId: id,
    ipAddress: req.ip,
  });

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'RESET_PASSWORD',
    resourceType: 'User',
    resourceId: id,
    metadata: { detail: `Đặt lại mật khẩu cho tài khoản ${user?.username || id}` },
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'Đã reset mật khẩu thành công',
    code: 'PASSWORD_RESET',
    tempPassword,
  });
});

export const importExcel = asyncHandler(async (req, res) => {
  if (!req.file?.path) {
    throw new ApiError(400, 'Thiếu file Excel (field: file)', 'IMPORT_FILE_MISSING');
  }

  const data = await userService.importEmployeesFromExcelFile(
    req.file.path,
    req.auth.userId,
    req.ip,
  );

  res.json({
    success: true,
    message: `Import xong: ${data.created} tạo mới, ${data.reused} tái sử dụng (mã trùng tài khoản đã khóa), ${data.updated} cập nhật, ${data.failed} lỗi`,
    code: 'EMPLOYEE_IMPORT_DONE',
    data,
  });
});