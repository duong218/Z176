import { examAttemptService } from '../services/exam-attempt.service.js';
import { writeAudit } from '../services/audit.service.js';
import { asyncHandler } from '../utils/async-handler.js';

function clientIp(req) {
  return req.ip ?? req.headers['x-forwarded-for']?.toString()?.split(',')[0]?.trim();
}

export const examAttemptController = {
  getMyExam: asyncHandler(async (req, res) => {
    const data = await examAttemptService.getMyExam(req.auth.userId);
    res.json({ success: true, message: 'OK', data });
  }),

  start: asyncHandler(async (req, res) => {
    const data = await examAttemptService.startAttempt(req.auth.userId);

    await writeAudit({
      actorUserId: req.auth.userId,
      action: data.resumed ? 'RESUME_EXAM_ATTEMPT' : 'START_EXAM_ATTEMPT',
      resourceType: 'ExamAttempt',
      resourceId: data.attemptId,
      metadata: { detail: data.resumed ? 'Tiếp tục lượt thi đang dở' : 'Bắt đầu lượt thi chính thức' },
      ipAddress: clientIp(req),
    });

    res.status(201).json({ success: true, message: 'OK', data });
  }),

  submit: asyncHandler(async (req, res) => {
    const { answers } = req.body ?? {};
    const data = await examAttemptService.submitAttempt(req.auth.userId, req.params.id, answers);

    await writeAudit({
      actorUserId: req.auth.userId,
      action: 'SUBMIT_EXAM_ATTEMPT',
      resourceType: 'ExamAttempt',
      resourceId: req.params.id,
      metadata: { detail: `Nộp bài thi: ${data.correctCount}/${data.totalQuestions} câu đúng, ${data.score} điểm` },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, message: 'Nộp bài thành công', data });
  }),
};