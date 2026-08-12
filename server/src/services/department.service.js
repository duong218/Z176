import { Department } from '../models/index.js';
import { normalizeDeptName, normalizeDeptCode } from '../models/department.model.js';
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

/**
 * Tìm phòng ban theo tên — KHÔNG phân biệt hoa/thường, có dấu hay không dấu,
 * khoảng trắng thừa (so khớp qua field `slug` đã chuẩn hoá).
 *
 * Có fallback cho các phòng ban được tạo TRƯỚC KHI field `slug` tồn tại:
 * quét trong bộ nhớ theo `name` chuẩn hoá, và tiện thể backfill `slug` cho
 * document đó để các lần tìm sau nhanh hơn (không cần chạy migration tay).
 */
export async function findDepartmentByName(name) {
  const slug = normalizeDeptName(name);
  if (!slug) return null;

  let dept = await Department.findOne({ slug, isActive: true });
  if (dept) return dept;

  const legacyCandidates = await Department.find({
    isActive: true,
    slug: { $exists: false },
  });
  dept = legacyCandidates.find((d) => normalizeDeptName(d.name) === slug) || null;
  if (dept) {
    dept.slug = slug;
    await dept.save().catch(() => {
      /* backfill best-effort, không chặn luồng chính nếu lỗi */
    });
  }
  return dept;
}

/**
 * Tìm phòng ban theo tên (chuẩn hoá dấu/hoa-thường); nếu KHÔNG tìm thấy thì
 * TỰ ĐỘNG TẠO MỚI phòng ban với đúng tên đã nhập. Dùng khi Excel import
 * KHÔNG có cột mã phòng ban (tương thích file mẫu cũ).
 */
export async function findOrCreateDepartmentByName(name) {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = await findDepartmentByName(trimmed);
  if (existing) return existing;

  try {
    const doc = await Department.create({ name: trimmed });
    return doc;
  } catch (err) {
    if (err.code === 11000) {
      const dept = await findDepartmentByName(trimmed);
      if (dept) return dept;
    }
    throw err;
  }
}

/**
 * Tìm phòng ban theo MÃ (không phân biệt hoa/thường/dấu — vd "cntt" và
 * "CNTT" luôn là 1 phòng ban).
 */
export async function findDepartmentByCode(code) {
  const normalizedCode = normalizeDeptCode(code);
  if (!normalizedCode) return null;
  return Department.findOne({ code: normalizedCode, isActive: true });
}

/**
 * Tìm phòng ban theo MÃ PHÒNG BAN — khoá chính để import Excel xác định
 * phòng ban (vd "CNTT" luôn ra đúng 1 phòng ban dù cột tên ghi "cong nghe
 * thong tin" hay "công nghệ thông tin" ở các dòng khác nhau).
 *
 * - Có mã trùng với phòng ban đã tồn tại -> trả về phòng ban đó (bỏ qua
 *   cột tên, mã là nguồn sự thật).
 * - Chưa có phòng ban nào mang mã này -> thử tìm theo TÊN trước (trường
 *   hợp phòng ban đã được tạo từ lần import trước bằng tên, chưa gắn mã)
 *   để gắn mã vào, tránh tạo trùng phòng ban.
 * - Không tìm thấy theo cả mã và tên -> tự tạo phòng ban mới với tên lấy
 *   từ cột "Phòng ban" (nếu có), hoặc dùng chính mã làm tên tạm.
 */
export async function findOrCreateDepartmentByCode({ code, name }) {
  const normalizedCode = normalizeDeptCode(code);
  if (!normalizedCode) return null;

  const existingByCode = await findDepartmentByCode(normalizedCode);
  if (existingByCode) return existingByCode;

  const trimmedName = name?.trim();
  if (trimmedName) {
    const byName = await findDepartmentByName(trimmedName);
    if (byName) {
      if (!byName.code) {
        byName.code = normalizedCode;
        await byName.save().catch(() => {
          /* nếu mã bị trùng với phòng ban khác do race condition, giữ
           * nguyên phòng ban tìm theo tên, không chặn luồng import */
        });
      }
      return byName;
    }
  }

  try {
    const doc = await Department.create({
      name: trimmedName || normalizedCode,
      code: normalizedCode,
    });
    return doc;
  } catch (err) {
    if (err.code === 11000) {
      // Race condition: dòng import khác cùng lúc tạo phòng ban với mã này.
      const dept = await findDepartmentByCode(normalizedCode);
      if (dept) return dept;
    }
    throw err;
  }
}

export async function updateDepartment(id, { name, code, description, isActive } = {}) {
  const dept = await Department.findById(id);
  assertFound(dept, 'Không tìm thấy bộ phận', 'DEPARTMENT_NOT_FOUND');

  if (name !== undefined) {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw new ApiError(400, 'Tên bộ phận là bắt buộc', 'DEPARTMENT_VALIDATION');
    }
    dept.name = trimmed;
  }
  if (code !== undefined) dept.code = code?.trim() || undefined;
  if (description !== undefined) dept.description = description?.trim() || '';
  if (isActive !== undefined) dept.isActive = Boolean(isActive);

  try {
    await dept.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'Bộ phận đã tồn tại', 'DEPARTMENT_DUPLICATE');
    }
    throw err;
  }
  return dept.toObject();
}

// Xóa mềm: chỉ tắt isActive, KHÔNG xóa hẳn khỏi DB, vì Question/Employee/
// ExamCandidate... có thể đang tham chiếu departmentId tới bộ phận này. Xóa
// cứng sẽ để lại dữ liệu mồ côi hoặc gãy tham chiếu.
export async function deactivateDepartment(id) {
  const dept = await Department.findById(id);
  assertFound(dept, 'Không tìm thấy bộ phận', 'DEPARTMENT_NOT_FOUND');
  dept.isActive = false;
  await dept.save();
  return { id: dept._id.toString(), isActive: false };
}

export async function getDepartmentById(id) {
  const dept = await Department.findById(id);
  assertFound(dept, 'Không tìm thấy bộ phận', 'DEPARTMENT_NOT_FOUND');
  return dept;
}