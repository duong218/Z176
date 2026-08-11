import { Role } from '../models/index.js';

export async function listRoles() {
  return Role.find({ isActive: true }).sort({ createdAt: 1 }).lean();
}
