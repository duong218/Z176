import { AuditLog } from '../models/index.js';

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

  async getAuditLogs(filters = {}) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      AuditLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('actorUserId', 'username fullName roleCode')
        .lean(),
      AuditLog.countDocuments()
    ]);

    return {
      items,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }
};

// Vẫn export function độc lập để tương thích với các module khác nếu đang import trực tiếp
export async function writeAudit(params) {
  return auditService.writeAudit(params);
}
