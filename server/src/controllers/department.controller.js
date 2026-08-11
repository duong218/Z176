import * as departmentService from '../services/department.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export const list = asyncHandler(async (req, res) => {
  const activeOnly = req.query.activeOnly !== 'false';
  const data = await departmentService.listDepartments({ activeOnly });
  res.json({ success: true, message: 'OK', code: 'DEPARTMENT_LIST_OK', data });
});

export const create = asyncHandler(async (req, res) => {
  const { name, code } = req.body ?? {};
  const data = await departmentService.createDepartment({ name, code });
  res.status(201).json({
    success: true,
    message: 'Tạo bộ phận thành công',
    code: 'DEPARTMENT_CREATED',
    data,
  });
});
