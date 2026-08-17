import fs from 'fs';
import { StudyDocument, Employee, Topic } from '../models/index.js';
import { DOCUMENT_SCOPE } from '../models/constants.js';
import { ApiError, assertFound } from '../utils/api-error.js';

/** Lấy departmentId của candidate qua hồ sơ Employee liên kết (giống cách audit.service tra cứu). */
async function getCandidateDepartmentId(userId) {
  const emp = await Employee.findOne({ userId }).select('departmentId').lean();
  return emp?.departmentId ?? null;
}

/** Dành cho admin/examiner/leader — xem toàn bộ tài liệu để quản lý, không lọc theo phòng ban. */
export async function listDocumentsForStaff({ topicId } = {}) {
  const query = { isActive: true };
  if (topicId) query.topicId = topicId;
  return StudyDocument.find(query)
    .populate('topicId', 'name')
    .populate('departmentId', 'name')
    .populate('uploadedBy', 'username')
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Dành cho candidate — lọc scope giống hệt pattern Question: thấy tài liệu
 * Common + tài liệu DepartmentSpecific đúng phòng ban của mình.
 * topicId truyền vào khi cần lọc theo kỳ thi đang active; bỏ trống để xem
 * toàn bộ tài liệu (mọi topic) mà candidate có quyền xem.
 */
export async function listDocumentsForCandidate(userId, { topicId } = {}) {
  const departmentId = await getCandidateDepartmentId(userId);
  const scopeQuery = departmentId
    ? {
        $or: [
          { scope: DOCUMENT_SCOPE.COMMON },
          { scope: DOCUMENT_SCOPE.DEPARTMENT_SPECIFIC, departmentId },
        ],
      }
    : { scope: DOCUMENT_SCOPE.COMMON };

  const query = { isActive: true, ...scopeQuery };
  if (topicId) query.topicId = topicId;

  return StudyDocument.find(query)
    .populate('topicId', 'name')
    .sort({ createdAt: -1 })
    .lean();
}

export async function createDocument({ topicId, title, scope, departmentId, file }, uploadedBy) {
  if (!topicId) {
    throw new ApiError(400, 'Vui lòng chọn chủ đề', 'DOCUMENT_TOPIC_REQUIRED');
  }
  const topic = await Topic.findById(topicId);
  assertFound(topic, 'Không tìm thấy chủ đề', 'TOPIC_NOT_FOUND');

  const resolvedScope =
    scope === DOCUMENT_SCOPE.DEPARTMENT_SPECIFIC
      ? DOCUMENT_SCOPE.DEPARTMENT_SPECIFIC
      : DOCUMENT_SCOPE.COMMON;

  if (resolvedScope === DOCUMENT_SCOPE.DEPARTMENT_SPECIFIC && !departmentId) {
    throw new ApiError(400, 'Vui lòng chọn phòng ban cho tài liệu riêng', 'DOCUMENT_DEPARTMENT_REQUIRED');
  }

  const doc = await StudyDocument.create({
    topicId,
    title: title?.trim() || file.originalname,
    filePath: file.path,
    originalFileName: file.originalname,
    mimeType: file.mimetype,
    scope: resolvedScope,
    departmentId: resolvedScope === DOCUMENT_SCOPE.DEPARTMENT_SPECIFIC ? departmentId : undefined,
    uploadedBy,
  });
  return doc.toObject();
}

/** Chỉ người đăng (examiner) hoặc admin được xóa mềm. */
export async function deactivateDocument(id, requester) {
  const doc = await StudyDocument.findById(id);
  assertFound(doc, 'Không tìm thấy tài liệu', 'DOCUMENT_NOT_FOUND');

  const isOwner = doc.uploadedBy?.toString() === requester.userId;
  const isAdmin = requester.roleCode === 'admin';
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, 'Bạn không có quyền xóa tài liệu này', 'DOCUMENT_FORBIDDEN');
  }

  doc.isActive = false;
  await doc.save();
  return { id: doc._id.toString(), isActive: false };
}

/** Kiểm tra quyền xem/tải file trước khi controller stream file ra. */
export async function getDocumentForAccess(id, requester) {
  const doc = await StudyDocument.findById(id).lean();
  assertFound(doc, 'Không tìm thấy tài liệu', 'DOCUMENT_NOT_FOUND');

  if (!doc.isActive) {
    throw new ApiError(404, 'Tài liệu không còn tồn tại', 'DOCUMENT_NOT_FOUND');
  }

  if (requester.roleCode === 'candidate' && doc.scope === DOCUMENT_SCOPE.DEPARTMENT_SPECIFIC) {
    const departmentId = await getCandidateDepartmentId(requester.userId);
    if (!departmentId || departmentId.toString() !== doc.departmentId?.toString()) {
      throw new ApiError(403, 'Bạn không có quyền truy cập tài liệu này', 'DOCUMENT_FORBIDDEN');
    }
  }

  if (!fs.existsSync(doc.filePath)) {
    throw new ApiError(404, 'File không còn tồn tại trên máy chủ', 'DOCUMENT_FILE_MISSING');
  }

  return doc;
}