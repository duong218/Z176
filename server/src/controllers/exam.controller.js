import { examService } from '../services/exam.service.js';
import { writeAudit } from '../services/audit.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/api-error.js';

function clientIp(req) {
  return req.ip ?? req.headers['x-forwarded-for']?.toString()?.split(',')[0]?.trim();
}

export const examController = {
  list: asyncHandler(async (req, res) => {
    const filters = {
      status: req.query.status,
      topicId: req.query.topicId,
    };
    
    // Nếu là examiner thì chỉ thấy bài của mình
    if (req.auth?.roleCode === 'examiner') {
      filters.createdBy = req.auth.userId;
    }

    const data = await examService.listExams(filters);
    res.json({ success: true, message: 'OK', data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await examService.createExamProposal(req.body, req.auth.userId);
    
    await writeAudit({
      actorUserId: req.auth.userId,
      action: 'CREATE_EXAM',
      resourceType: 'Exam',
      resourceId: data._id,
      metadata: { detail: `Tạo đề xuất kỳ thi: ${data.title}` },
      ipAddress: clientIp(req),
    });

    res.status(201).json({ success: true, message: 'Tạo đề xuất thành công', data });
  }),

  submit: asyncHandler(async (req, res) => {
    const data = await examService.submitExamForReview(req.params.id, req.auth.userId);

    await writeAudit({
      actorUserId: req.auth.userId,
      action: 'SUBMIT_EXAM',
      resourceType: 'Exam',
      resourceId: data._id,
      metadata: { detail: `Gửi duyệt kỳ thi: ${data.title}` },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, message: 'Gửi duyệt thành công', data });
  }),

  approve: asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.body ?? {};
    const data = await examService.approveExam(req.params.id, { startDate, endDate }, req.auth.userId);

    await writeAudit({
      actorUserId: req.auth.userId,
      action: 'APPROVE_EXAM',
      resourceType: 'Exam',
      resourceId: data._id,
      metadata: { detail: `Chấp thuận kỳ thi: ${data.title}` },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, message: 'Đã duyệt kỳ thi', data });
  }),

  reject: asyncHandler(async (req, res) => {
    const { rejectionReason } = req.body ?? {};
    const data = await examService.rejectExam(req.params.id, rejectionReason, req.auth.userId);

    await writeAudit({
      actorUserId: req.auth.userId,
      action: 'REJECT_EXAM',
      resourceType: 'Exam',
      resourceId: data._id,
      metadata: { detail: `Từ chối kỳ thi: ${data.title}` },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, message: 'Đã từ chối kỳ thi', data });
  }),

  publish: asyncHandler(async (req, res) => {
    const data = await examService.publishExam(req.params.id, req.auth.userId);

    await writeAudit({
      actorUserId: req.auth.userId,
      action: 'PUBLISH_EXAM',
      resourceType: 'Exam',
      resourceId: data._id,
      metadata: { detail: `Đăng chính thức kỳ thi: ${data.title}` },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, message: 'Đã đăng chính thức kỳ thi', data });
  }),

  getActive: asyncHandler(async (req, res) => {
    const data = await examService.getActiveExam();
    res.json({ success: true, message: 'OK', data });
  }),
};
