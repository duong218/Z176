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
 * Dùng khi tạo bộ phận từ luồng import Excel (câu hỏi/nhân viên): nếu tên
 * hoặc mã trùng với 1 bộ phận đã bị XOÁ MỀM (isActive:false) từ trước thì
 * KHÔI PHỤC LẠI bộ phận đó (bật isActive:true, cập nhật mã/mô tả mới) thay
 * vì báo lỗi "đã tồn tại" — trên giao diện người dùng bấm Xoá thì hiểu là
 * xoá hẳn, không ai biết hệ thống đang xoá mềm, nên báo lỗi trùng ở đây rất
 * khó hiểu và bắt người dùng phải vào tận DB mới gỡ được.
 * Nếu bộ phận trùng tên/mã đang ACTIVE sẵn thì dùng luôn (không đụng gì).
 */
export async function upsertDepartmentForImport({ name, code, description }) {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    throw new ApiError(400, 'Tên bộ phận là bắt buộc', 'DEPARTMENT_VALIDATION');
  }
  const normalizedCode = code ? normalizeDeptCode(code) : undefined;
  const slug = normalizeDeptName(trimmedName);

  // Tìm theo TÊN trước — kể cả bộ phận đang bị vô hiệu hoá (bỏ filter
  // isActive so với findDepartmentByName()).
  let dept = await Department.findOne({ slug });
  if (!dept) {
    // Fallback cho bộ phận cũ tạo trước khi có field slug.
    const candidates = await Department.find({ slug: { $exists: false } });
    dept = candidates.find((d) => normalizeDeptName(d.name) === slug) || null;
  }
  // Không trùng tên -> thử trùng MÃ (vd người dùng đổi tên khác nhưng mã cũ
  // vẫn đụng 1 bộ phận đã xoá mềm trước đó).
  if (!dept && normalizedCode) {
    dept = await Department.findOne({ code: normalizedCode });
  }

  if (!dept) {
    return createDepartment({ name: trimmedName, code, description });
  }

  if (dept.isActive) {
    // Đã tồn tại và đang hoạt động sẵn -> dùng luôn, không tạo trùng.
    return dept.toObject();
  }

  // Bị xoá mềm -> khôi phục, ghi đè bằng thông tin người dùng vừa nhập.
  dept.isActive = true;
  dept.name = trimmedName;
  if (normalizedCode) dept.code = normalizedCode;
  if (description !== undefined) dept.description = description?.trim() || '';
  try {
    await dept.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(
        409,
        `Mã bộ phận "${code}" đang được dùng cho bộ phận khác, vui lòng chọn mã khác.`,
        'DEPARTMENT_CODE_DUPLICATE',
      );
    }
    throw err;
  }
  return dept.toObject();
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
      // Trùng tên với 1 bộ phận ĐANG BỊ VÔ HIỆU HOÁ (isActive:false) —
      // findDepartmentByName() chỉ tìm bộ phận active nên không thấy được.
      // Trả lỗi rõ ràng thay vì để lỗi Mongo (E11000) thô lọt ra client.
      throw new ApiError(
        409,
        `Tên bộ phận "${trimmed}" đã tồn tại (có thể đang bị vô hiệu hoá) — vui lòng đổi tên khác hoặc kích hoạt lại bộ phận cũ`,
        'DEPARTMENT_DUPLICATE',
      );
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