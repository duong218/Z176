import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { Role, User } from '../models/index.js';

/** Mã role mặc định — document trong DB, không enum cứng toàn app */
const DEFAULT_ROLES = [
  {
    code: 'admin',
    name: 'Quản trị hệ thống',
    description: 'Quản lý tài khoản, phân quyền, backup',
  },
  {
    code: 'examiner',
    name: 'Người ra đề',
    description: 'Ngân hàng câu hỏi, sinh mã đề, quản lý kỳ thi',
  },
  {
    code: 'candidate',
    name: 'Người dự thi',
    description: 'Làm bài thi, xem kết quả được phép',
  },
  {
    code: 'leader',
    name: 'Người duyệt đề',
    description: 'Phê duyệt đề/kỳ thi (Should Have FR-006)',
  },
];

export async function seedRolesIfEmpty() {
  for (const role of DEFAULT_ROLES) {
    await Role.updateOne({ code: role.code }, { $setOnInsert: role }, { upsert: true });
  }
}

export async function seedAdminIfConfigured() {
  if (!env.adminSeedEmail || !env.adminSeedPassword) {
    return { seeded: false, reason: 'ADMIN_SEED_EMAIL/PASSWORD not set' };
  }

  const adminRole = await Role.findOne({ code: 'admin' });
  if (!adminRole) {
    return { seeded: false, reason: 'admin role missing' };
  }

  const username = env.adminSeedEmail.trim().toLowerCase();
  const existing = await User.findOne({ username });
  if (existing) {
    return { seeded: false, reason: 'admin user already exists' };
  }

  const passwordHash = await bcrypt.hash(env.adminSeedPassword, env.bcryptSaltRounds);
  await User.create({
    username,
    passwordHash,
    roleId: adminRole._id,
    mustChangePassword: env.adminSeedMustChangePassword,
  });

  return {
    seeded: true,
    username,
    mustChangePassword: env.adminSeedMustChangePassword,
  };
}

export async function runStartupSeed({ includeAdmin = true } = {}) {
  await seedRolesIfEmpty();
  const adminResult = includeAdmin
    ? await seedAdminIfConfigured()
    : { seeded: false, reason: 'skipped' };
  return { rolesSeeded: true, adminResult };
}
