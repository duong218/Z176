import { AuditLog, Employee, Department } from '../models/index.js';

// Ký tự đặc biệt cần escape khi dựng RegExp từ input người dùng (tránh lỗi cú pháp regex / ReDoS đơn giản)
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const auditService = {
  /** Ghi audit — không lưu nội dung câu hỏi/đáp án trong metadata (SKILLS.md mục 4.1). */
  async writeAudit({ actorUserId, action, resourceType, resourceId, metadata, ipAddress }) {
    await AuditLog.create({
      actorUserId,
      action,
      resourceType,
      resourceId,
      metadata,
      ipAddress,
    });
  },

  /**
   * @param {object} filters
   * @param {number|string} [filters.page]
   * @param {number|string} [filters.limit]
   * @param {string} [filters.action] - 1 hoặc nhiều action, phân tách bởi dấu phẩy (vd "LOCK_USER,RESET_PASSWORD")
   * @param {string} [filters.resourceType]
   * @param {string} [filters.from] - ISO date, lọc createdAt >= from (00:00:00)
   * @param {string} [filters.to] - ISO date, lọc createdAt <= to (23:59:59)
   * @param {string} [filters.q] - từ khóa tìm theo họ tên / mã nhân viên / tên phòng ban của người thực hiện
   */
  async getAuditLogs(filters = {}) {
    const { page = 1, limit = 20, action, resourceType, from, to, q } = filters;
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 20;
    const skip = (numericPage - 1) * numericLimit;

    const query = {};

    if (action) {
      const actions = String(action)
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      if (actions.length) query.action = { $in: actions };
    }

    if (resourceType) {
      query.resourceType = resourceType;
    }

    if (from || to) {
      query.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) query.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
        }
      }
      if (Object.keys(query.createdAt).length === 0) delete query.createdAt;
    }

    // Tìm theo tên / mã nhân viên / phòng ban: suy ra danh sách actorUserId phù hợp trước
    if (q && q.trim()) {
      const regex = new RegExp(escapeRegExp(q.trim()), 'i');

      const matchedDepartments = await Department.find({ name: regex }).select('_id').lean();
      const deptIds = matchedDepartments.map((d) => d._id);

      const employeeOr = [{ fullname: regex }, { employeeCode: regex }];
      if (deptIds.length) employeeOr.push({ departmentId: { $in: deptIds } });

      const matchedEmployees = await Employee.find({ $or: employeeOr }).select('userId').lean();
      const userIds = matchedEmployees.map((e) => e.userId);

      if (userIds.length === 0) {
        // Không có nhân viên nào khớp từ khóa -> chắc chắn không có log nào phù hợp
        return {
          items: [],
          pagination: { total: 0, page: numericPage, limit: numericLimit, totalPages: 0 },
        };
      }
      query.actorUserId = { $in: userIds };
    }

    const [items, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .populate('actorUserId', 'username roleCode')
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    // Ghép thêm hồ sơ nhân viên (họ tên, mã NV, phòng ban) cho từng log hiển thị
    const actorIds = [...new Set(items.map((i) => i.actorUserId?._id?.toString()).filter(Boolean))];
    const employees = actorIds.length
      ? await Employee.find({ userId: { $in: actorIds } })
          .populate('departmentId', 'name')
          .select('userId fullname employeeCode departmentId')
          .lean()
      : [];
    const employeeByUserId = new Map(employees.map((e) => [e.userId.toString(), e]));

    const enrichedItems = items.map((item) => {
      if (!item.actorUserId) return item;
      const emp = employeeByUserId.get(item.actorUserId._id.toString());
      return {
        ...item,
        actorUserId: {
          ...item.actorUserId,
          fullname: emp?.fullname || null,
          employeeCode: emp?.employeeCode || null,
          departmentName: emp?.departmentId?.name || null,
        },
      };
    });

    return {
      items: enrichedItems,
      pagination: {
        total,
        page: numericPage,
        limit: numericLimit,
        totalPages: Math.ceil(total / numericLimit),
      },
    };
  },
};

// Vẫn export function độc lập để tương thích với các module khác nếu đang import trực tiếp
export async function writeAudit(params) {
  return auditService.writeAudit(params);
}