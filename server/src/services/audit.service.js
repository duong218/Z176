import { AuditLog } from '../models/index.js';

/** Ghi audit — không lưu nội dung câu hỏi/đáp án trong metadata (SKILLS.md mục 4.1). */
export async function writeAudit({ actorUserId, action, resourceType, resourceId, metadata, ipAddress }) {
  await AuditLog.create({
    actorUserId,
    action,
    resourceType,
    resourceId,
    metadata,
    ipAddress,
  });
}
