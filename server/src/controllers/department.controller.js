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