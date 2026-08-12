import * as departmentService from '../services/department.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { writeAudit } from '../services/audit.service.js';

export const list = asyncHandler(async (req, res) => {
  const activeOnly = req.query.activeOnly !== 'false';
  const data = await departmentService.listDepartments({ activeOnly });
  res.json({ success: true, message: 'OK', code: 'DEPARTMENT_LIST_OK', data });
});

export const create = asyncHandler(async (req, res) => {
  const { name, code, description } = req.body ?? {};
  const data = await departmentService.createDepartment({ name, code, description });

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'CREATE_DEPARTMENT',
    resourceType: 'Department',
    resourceId: data._id,
    metadata: { detail: `Tạo bộ phận mới: ${name} (${code})` },
    ipAddress: req.ip,
  });
  res.status(201).json({
    success: true,
    message: 'Tạo bộ phận thành công',
    code: 'DEPARTMENT_CREATED',
    data,
  });
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, code, description, isActive } = req.body ?? {};
  const data = await departmentService.updateDepartment(id, { name, code, description, isActive });

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'UPDATE_DEPARTMENT',
    resourceType: 'Department',
    resourceId: data._id ?? id,
    metadata: { detail: `Cập nhật bộ phận: ${data.name}` },
    ipAddress: req.ip,
  });
  res.json({
    success: true,
    message: 'Cập nhật bộ phận thành công',
    code: 'DEPARTMENT_UPDATED',
    data,
  });
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await departmentService.deactivateDepartment(id);

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'DEACTIVATE_DEPARTMENT',
    resourceType: 'Department',
    resourceId: id,
    metadata: { detail: `Ngừng sử dụng bộ phận: ${id}` },
    ipAddress: req.ip,
  });
  res.json({
    success: true,
    message: 'Đã ngừng sử dụng bộ phận',
    code: 'DEPARTMENT_DEACTIVATED',
    data,
  });
});