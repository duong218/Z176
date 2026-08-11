import * as roleService from '../services/role.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export const list = asyncHandler(async (req, res) => {
  const data = await roleService.listRoles();
  res.json({ success: true, message: 'OK', code: 'ROLE_LIST_OK', data });
});
