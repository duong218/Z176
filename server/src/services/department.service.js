import { Department } from '../models/index.js';
import { ApiError, assertFound } from '../utils/api-error.js';

export async function listDepartments({ activeOnly = true } = {}) {
  const filter = activeOnly ? { isActive: true } : {};
  return Department.find(filter).sort({ name: 1 }).lean();
}

export async function createDepartment({ name, code, description }) {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new ApiError(400, 'Tên bộ phận là bắt buộc', 'DEPARTMENT_VALIDATION');
  }
  try {
    const doc = await Department.create({
      name: trimmed,
      code: code?.trim() || undefined,
      description: description?.trim() || '',
    });
    return doc.toObject();
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'Bộ phận đã tồn tại', 'DEPARTMENT_DUPLICATE');
    }
    throw err;
  }
}

// Escape ký tự đặc biệt trong regex để tránh lỗi hoặc khớp sai khi tên bộ
// phận chứa các ký tự như . ( ) + * ? [ ] ^ $ | \
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function findDepartmentByName(name) {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  // So khớp KHÔNG phân biệt hoa/thường (vd "Công nghệ thông tin" và
  // "công nghệ thông tin" phải được coi là cùng 1 bộ phận) — trước đây dùng
  // exact match nên chỉ cần lệch hoa/thường khi nhập Excel là báo không tìm
  // thấy bộ phận, dù bộ phận đó đã tồn tại trong hệ thống.
  return Department.findOne({
    name: { $regex: `^${escapeRegExp(trimmed)}$`, $options: 'i' },
    isActive: true,
  });
}

export async function getDepartmentById(id) {
  const dept = await Department.findById(id);
  assertFound(dept, 'Không tìm thấy bộ phận', 'DEPARTMENT_NOT_FOUND');
  return dept;
}