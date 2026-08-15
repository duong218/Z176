import { examAttemptService } from '../services/exam-attempt.service.js';
import { writeAudit } from '../services/audit.service.js';
import { asyncHandler } from '../utils/async-handler.js';

function clientIp(req) {
  return req.ip ?? req.headers['x-forwarded-for']?.toString()?.split(',')[0]?.trim();
}

export const examAttemptController = {
  getMyExam: asyncHandler(async (req, res) => {
    const data = await examAttemptService.getMyExam(req.auth.userId);

    // getMyExam có thể tự phát hiện + tự nộp bài do rời quá 1 phút ngay trong
    // lần gọi này (data.autoSubmitted khác null). Ghi audit riêng cho sự kiện
    // đó để có dấu vết, tách biệt với audit "OK" thông thường của getMyExam.
    if (data.autoSubmitted) {
      await writeAudit({
        actorUserId: req.auth.userId,
        action: 'AUTO_SUBMIT_EXAM_ATTEMPT',
        resourceType: 'ExamAttempt',
        resourceId: data.attempt?.id ?? null,
        metadata: { detail: 'Tự động nộp bài do rời khỏi ca thi quá 1 phút (phát hiện lúc getMyExam)' },
        ipAddress: clientIp(req),
      });
    }

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

  // Autosave 1 câu trả lời. Gọi mỗi lần thí sinh chọn/đổi đáp án. Không audit
  // (tần suất quá cao, sẽ làm phình audit log vô ích).
  answer: asyncHandler(async (req, res) => {
    const { questionId, selectedAnswerIds } = req.body ?? {};
    const data = await examAttemptService.recordAnswer(
      req.auth.userId,
      req.params.id,
      questionId,
      selectedAnswerIds,
    );
    res.json({ success: true, message: 'OK', data });
  }),

  // Heartbeat giữ phiên sống, client gọi định kỳ khi tab đang hiển thị. Nếu
  // phát hiện đã idle quá hạn thì service tự nộp bài ngay trong lệnh gọi này —
  // ghi audit riêng cho trường hợp đó, tương tự getMyExam.
  heartbeat: asyncHandler(async (req, res) => {
    const data = await examAttemptService.heartbeat(req.auth.userId, req.params.id);

    if (data.autoSubmitReason) {
      await writeAudit({
        actorUserId: req.auth.userId,
        action: 'AUTO_SUBMIT_EXAM_ATTEMPT',
        resourceType: 'ExamAttempt',
        resourceId: req.params.id,
        metadata: { detail: 'Tự động nộp bài do rời khỏi ca thi quá 1 phút (phát hiện lúc heartbeat)' },
        ipAddress: clientIp(req),
      });
    }

    res.json({ success: true, message: 'OK', data });
  }),

  // MỚI — Leader cấp thêm 1 lượt thi chính thức cho 1 thí sinh (theo examCandidateId).
  grantExtraAttempt: asyncHandler(async (req, res) => {
    const data = await examAttemptService.grantExtraAttempt(req.params.examCandidateId, req.auth.userId);

    await writeAudit({
      actorUserId: req.auth.userId,
      action: 'GRANT_EXTRA_EXAM_ATTEMPT',
      resourceType: 'ExamCandidate',
      resourceId: data.examCandidateId,
      metadata: {
        detail: `Cấp thêm lượt thi cho ${data.employeeName ?? 'thí sinh'} — kỳ thi: ${data.examTitle} (tổng lượt được cấp thêm: ${data.extraAttemptsGranted})`,
      },
      ipAddress: clientIp(req),
    });

    res.json({ success: true, message: 'Đã cấp thêm lượt thi cho thí sinh', data });
  }),
};