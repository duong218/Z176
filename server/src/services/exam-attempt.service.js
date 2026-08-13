import {
  Employee,
  Exam,
  ExamCandidate,
  ExamCodeQuestion,
  Question,
  Answer,
  ExamAttempt,
  AttemptQuestion,
  CandidateAnswer,
  Result,
  ATTEMPT_TYPE,
  ATTEMPT_STATUS,
  EXAM_STATUS,
} from '../models/index.js';
import { ApiError } from '../utils/api-error.js';

// Mặc định mỗi thí sinh có 1 lượt thi CHÍNH THỨC cho 1 kỳ thi. Việc Người duyệt
// đề cấp phép thêm lượt là tính năng chưa thiết kế schema (xem ghi chú dự án) —
// KHÔNG tự bịa field ở đây, để nguyên hằng số này cho tới khi có quyết định.
const MAX_OFFICIAL_ATTEMPTS = 1;

/**
 * Nếu thí sinh rời trang thi (không heartbeat/thao tác gì) quá thời gian này
 * thì lượt thi đang in_progress sẽ bị hệ thống tự động nộp.
 */
const INACTIVITY_TIMEOUT_MS = 60_000; // 1 phút

/** Trộn ngẫu nhiên mảng (Fisher–Yates), không sửa mảng gốc. */
function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Sinh snapshot câu hỏi + đáp án đã xáo RIÊNG cho 1 lượt thi cụ thể, dựa trên
 * đúng bộ câu hỏi của phòng ban (ExamCodeQuestion) — không đổi tập câu hỏi,
 * chỉ đổi thứ tự hiển thị cho từng thí sinh. Idempotent theo unique index,
 * nhưng chỉ nên gọi 1 lần lúc tạo attempt mới (không gọi lại khi resume).
 */
async function generateAttemptQuestionSnapshot(attemptId, examCodeId) {
  const examCodeQuestions = await ExamCodeQuestion.find({ examCodeId }).select('questionId');
  const questionIds = examCodeQuestions.map((q) => q.questionId);

  const answers = await Answer.find({ questionId: { $in: questionIds } }).select('_id questionId');
  const answersByQuestion = new Map();
  for (const a of answers) {
    const key = a.questionId.toString();
    if (!answersByQuestion.has(key)) answersByQuestion.set(key, []);
    answersByQuestion.get(key).push(a._id);
  }

  const shuffledQuestionIds = shuffle(questionIds);
  const docs = shuffledQuestionIds.map((qid, index) => ({
    examAttemptId: attemptId,
    questionId: qid,
    orderIndex: index,
    answerOrder: shuffle(answersByQuestion.get(qid.toString()) || []),
  }));

  if (docs.length > 0) {
    await AttemptQuestion.insertMany(docs);
  }
}

/** Dựng lại danh sách câu hỏi (kèm option đã đúng thứ tự xáo) từ snapshot của 1 lượt thi. */
async function buildQuestionsFromSnapshot(attemptId) {
  const snapshot = await AttemptQuestion.find({ examAttemptId: attemptId }).sort({ orderIndex: 1 });
  if (snapshot.length === 0) return [];

  const questionIds = snapshot.map((s) => s.questionId);
  const questionDocs = await Question.find({ _id: { $in: questionIds } });
  const questionById = new Map(questionDocs.map((q) => [q._id.toString(), q]));

  const answerIds = snapshot.flatMap((s) => s.answerOrder);
  const answerDocs = await Answer.find({ _id: { $in: answerIds } }).select('_id content');
  const answerById = new Map(answerDocs.map((a) => [a._id.toString(), a]));

  return snapshot
    .filter((s) => questionById.has(s.questionId.toString()))
    .map((s) => {
      const q = questionById.get(s.questionId.toString());
      return {
        id: q._id,
        orderIndex: s.orderIndex,
        content: q.content,
        questionKind: q.questionKind,
        answerType: q.answerType,
        imageUrl: q.imageUrl || null,
        options: s.answerOrder
          .filter((aid) => answerById.has(aid.toString()))
          .map((aid) => {
            const a = answerById.get(aid.toString());
            return { id: a._id, content: a.content };
          }),
      };
    });
}

/**
 * Xác định employee + kỳ thi đang published + ExamCandidate (đề đã gán) cho
 * userId hiện tại. Dùng chung cho cả các endpoint để đảm bảo cùng 1 nguồn sự thật.
 */
async function resolveCandidateContext(userId) {
  const employee = await Employee.findOne({ userId });
  if (!employee) {
    throw new ApiError(404, 'Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên nào', 'EMPLOYEE_NOT_FOUND');
  }

  const exam = await Exam.findOne({ status: EXAM_STATUS.PUBLISHED });
  if (!exam) {
    throw new ApiError(404, 'Hiện không có kỳ thi nào đang diễn ra', 'EXAM_NOT_ACTIVE');
  }

  const examCandidate = await ExamCandidate.findOne({ examId: exam._id, employeeId: employee._id });
  if (!examCandidate) {
    throw new ApiError(403, 'Bạn chưa được gán đề thi cho kỳ thi này. Vui lòng liên hệ Người ra đề / quản trị viên.', 'CANDIDATE_NOT_ASSIGNED');
  }

  return { employee, exam, examCandidate };
}

async function getOfficialAttempts(examCandidateId) {
  return ExamAttempt.find({
    examCandidateId,
    attemptType: ATTEMPT_TYPE.OFFICIAL,
  }).sort({ createdAt: -1 });
}

/** Nếu lượt thi đang in_progress mà đã quá expiresAt thì tự chuyển sang expired. */
async function expireIfNeeded(attempt) {
  if (
    attempt.status === ATTEMPT_STATUS.IN_PROGRESS &&
    attempt.expiresAt &&
    attempt.expiresAt.getTime() <= Date.now()
  ) {
    attempt.status = ATTEMPT_STATUS.EXPIRED;
    await attempt.save();
  }
  return attempt;
}

/**
 * Kiểm tra 1 attempt đang in_progress có bị thí sinh rời đi quá
 * INACTIVITY_TIMEOUT_MS hay không (dựa trên lastActiveAt — mốc thời gian gần
 * nhất server nhận được heartbeat/getMyExam/answer cho lượt thi này).
 *
 * Nếu vượt quá hạn: tự nộp bài NGAY tại đây bằng cách gọi lại submitAttempt
 * (không có answersPayload — submitAttempt sẽ tự lấy đáp án đã autosave trong
 * CandidateAnswer), đánh dấu autoSubmitReason = 'inactive_timeout'.
 *
 * Nếu attempt chưa từng có lastActiveAt (thí sinh vừa start, chưa kịp
 * heartbeat/thao tác lần nào) thì KHÔNG tính là bỏ đi — tránh tự nộp oan lượt
 * thi vừa mới bắt đầu.
 *
 * Gọi hàm này ở đầu mọi luồng có thể nhận request cho 1 attempt cụ thể
 * (getMyExam, recordAnswer, heartbeat) để đảm bảo phát hiện timeout dù thí
 * sinh thao tác lại từ bất kỳ đâu (kể cả đổi thiết bị).
 */
async function checkAndAutoSubmitIfInactive(attempt, userId) {
  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) return attempt;
  if (!attempt.lastActiveAt) return attempt;

  const idleMs = Date.now() - attempt.lastActiveAt.getTime();
  if (idleMs <= INACTIVITY_TIMEOUT_MS) return attempt;

  await examAttemptService.submitAttempt(userId, attempt._id.toString(), null, 'inactive_timeout');
  return ExamAttempt.findById(attempt._id);
}

export const examAttemptService = {
  /**
   * Trả về đề thi của thí sinh (câu hỏi + đáp án, ẩn isCorrect) cùng trạng thái
   * lượt thi hiện tại. Chỉ trả câu hỏi khi thí sinh còn được phép làm bài
   * (đang có lượt in_progress để tiếp tục, hoặc chưa dùng hết lượt).
   *
   * Nếu đang có lượt in_progress: trả đúng thứ tự câu/đáp án đã xáo riêng cho
   * lượt đó (từ AttemptQuestion snapshot) — giữ nguyên xuyên suốt lượt thi —
   * kèm `savedAnswers` (đáp án đã autosave) để thí sinh mở lại từ thiết bị
   * khác vẫn thấy đúng lựa chọn đã chọn trước đó.
   * Nếu chưa bắt đầu (màn xác nhận): trả theo thứ tự mặc định của phòng ban —
   * chỉ để xem trước, chưa cần xáo (việc xáo thật diễn ra lúc bấm "Bắt đầu thi").
   *
   * Mỗi lần gọi cũng kiểm tra timeout: nếu lượt in_progress đã bị bỏ quá 1
   * phút thì tự động nộp ngay trong lần gọi này, và trả `autoSubmitted` để
   * client biết hiển thị đúng thông báo.
   */
  async getMyExam(userId) {
    const { exam, examCandidate } = await resolveCandidateContext(userId);

    let attempts = await getOfficialAttempts(examCandidate._id);
    for (const attempt of attempts) {
      await expireIfNeeded(attempt);
    }

    const inProgressBefore = attempts.find((a) => a.status === ATTEMPT_STATUS.IN_PROGRESS);
    let autoSubmitted = null;

    if (inProgressBefore) {
      const afterCheck = await checkAndAutoSubmitIfInactive(inProgressBefore, userId);
      if (afterCheck.status !== ATTEMPT_STATUS.IN_PROGRESS) {
        autoSubmitted = { reason: afterCheck.autoSubmitReason ?? 'inactive_timeout' };
      }
      // Refetch toàn bộ danh sách — attempt vừa check có thể vừa chuyển sang submitted.
      attempts = await getOfficialAttempts(examCandidate._id);
    }

    const inProgress = attempts.find((a) => a.status === ATTEMPT_STATUS.IN_PROGRESS);
    if (inProgress) {
      inProgress.lastActiveAt = new Date();
      await inProgress.save();
    }

    const finishedCount = attempts.filter((a) => a.status !== ATTEMPT_STATUS.IN_PROGRESS).length;
    const canTake = Boolean(inProgress) || finishedCount < MAX_OFFICIAL_ATTEMPTS;

    let questions = [];
    let savedAnswers = [];
    if (canTake) {
      if (inProgress) {
        questions = await buildQuestionsFromSnapshot(inProgress._id);

        const saved = await CandidateAnswer.find({ examAttemptId: inProgress._id }).select(
          'questionId selectedAnswerIds',
        );
        savedAnswers = saved.map((s) => ({
          questionId: s.questionId,
          selectedAnswerIds: s.selectedAnswerIds,
        }));
      } else {
        const examCodeQuestions = await ExamCodeQuestion.find({ examCodeId: examCandidate.examCodeId })
          .sort({ orderIndex: 1 })
          .populate('questionId');

        const questionIds = examCodeQuestions.map((q) => q.questionId._id);
        const answers = await Answer.find({ questionId: { $in: questionIds } })
          .sort({ sortOrder: 1 })
          .select('_id questionId content');

        const answersByQuestion = new Map();
        for (const a of answers) {
          const key = a.questionId.toString();
          if (!answersByQuestion.has(key)) answersByQuestion.set(key, []);
          answersByQuestion.get(key).push({ id: a._id, content: a.content });
        }

        questions = examCodeQuestions
          .filter((ecq) => ecq.questionId)
          .map((ecq) => ({
            id: ecq.questionId._id,
            orderIndex: ecq.orderIndex,
            content: ecq.questionId.content,
            questionKind: ecq.questionId.questionKind,
            answerType: ecq.questionId.answerType,
            imageUrl: ecq.questionId.imageUrl || null,
            options: answersByQuestion.get(ecq.questionId._id.toString()) || [],
          }));
      }
    }

    return {
      exam: {
        id: exam._id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        passThresholdPercent: exam.passThresholdPercent,
        totalQuestions: exam.totalQuestions,
      },
      attempt: inProgress
        ? {
            id: inProgress._id,
            status: inProgress.status,
            startedAt: inProgress.startedAt,
            expiresAt: inProgress.expiresAt,
          }
        : null,
      attemptsUsed: finishedCount,
      maxAttempts: MAX_OFFICIAL_ATTEMPTS,
      canTake,
      questions,
      savedAnswers,
      // Khác null CHỈ trong lần gọi getMyExam ngay sau khi hệ thống vừa phát
      // hiện và tự nộp bài do rời quá lâu — để client hiện đúng thông báo
      // "Bạn đã rời khỏi ca thi quá 1 phút, hệ thống đã tự động nộp bài."
      autoSubmitted,
    };
  },

  /**
   * Bắt đầu lượt thi chính thức. Nếu đang có lượt in_progress còn hạn thì trả về
   * đúng lượt đó (resume) thay vì tạo mới — tránh mất lượt khi thí sinh lỡ tải
   * lại trang / mất kết nối giữa chừng. Chỉ sinh snapshot xáo câu/đáp án khi
   * THỰC SỰ tạo lượt mới (không sinh lại khi resume, giữ nguyên thứ tự đã thấy).
   */
  async startAttempt(userId) {
    const { exam, examCandidate } = await resolveCandidateContext(userId);

    const attempts = await getOfficialAttempts(examCandidate._id);
    for (const attempt of attempts) {
      await expireIfNeeded(attempt);
    }

    const inProgress = attempts.find((a) => a.status === ATTEMPT_STATUS.IN_PROGRESS);
    if (inProgress) {
      inProgress.lastActiveAt = new Date();
      await inProgress.save();
      return {
        attemptId: inProgress._id,
        startedAt: inProgress.startedAt,
        expiresAt: inProgress.expiresAt,
        resumed: true,
      };
    }

    const finishedCount = attempts.filter((a) => a.status !== ATTEMPT_STATUS.IN_PROGRESS).length;
    if (finishedCount >= MAX_OFFICIAL_ATTEMPTS) {
      throw new ApiError(
        400,
        'Bạn đã sử dụng hết lượt thi chính thức. Nếu cần thi lại, vui lòng liên hệ Người duyệt đề để được cấp phép.',
        'ATTEMPT_LIMIT_REACHED',
      );
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + exam.durationMinutes * 60_000);

    const attempt = await ExamAttempt.create({
      examCandidateId: examCandidate._id,
      attemptType: ATTEMPT_TYPE.OFFICIAL,
      startedAt,
      expiresAt,
      status: ATTEMPT_STATUS.IN_PROGRESS,
      lastActiveAt: startedAt,
    });

    await generateAttemptQuestionSnapshot(attempt._id, examCandidate.examCodeId);

    return {
      attemptId: attempt._id,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      resumed: false,
    };
  },

  /**
   * Autosave 1 câu trả lời — upsert đúng 1 dòng CandidateAnswer cho
   * {examAttemptId, questionId}, KHÔNG tính điểm ở đây (isCorrect chỉ được
   * chấm thật lúc submitAttempt). Cũng cập nhật lastActiveAt để tính vào
   * heartbeat, và kiểm tra timeout trước khi cho ghi (tránh autosave vào 1
   * lượt thi vừa bị tự động nộp).
   */
  async recordAnswer(userId, attemptId, questionId, selectedAnswerIds) {
    if (!questionId) {
      throw new ApiError(400, 'Thiếu questionId', 'QUESTION_ID_REQUIRED');
    }

    const { examCandidate } = await resolveCandidateContext(userId);

    let attempt = await ExamAttempt.findOne({ _id: attemptId, examCandidateId: examCandidate._id });
    if (!attempt) {
      throw new ApiError(404, 'Không tìm thấy lượt thi', 'ATTEMPT_NOT_FOUND');
    }

    attempt = await expireIfNeeded(attempt);
    attempt = await checkAndAutoSubmitIfInactive(attempt, userId);

    if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
      throw new ApiError(
        400,
        attempt.autoSubmitReason === 'inactive_timeout'
          ? 'Bạn đã rời khỏi ca thi quá 1 phút, hệ thống đã tự động nộp bài.'
          : 'Lượt thi không còn ở trạng thái đang làm bài',
        'ATTEMPT_INVALID_STATUS',
      );
    }

    await CandidateAnswer.updateOne(
      { examAttemptId: attempt._id, questionId },
      { $set: { selectedAnswerIds: Array.isArray(selectedAnswerIds) ? selectedAnswerIds : [] } },
      { upsert: true },
    );

    attempt.lastActiveAt = new Date();
    await attempt.save();

    return { attemptId: attempt._id, savedAt: attempt.lastActiveAt };
  },

  /**
   * Heartbeat giữ phiên "còn sống". Client chỉ nên gọi định kỳ (vd ~15s) khi
   * tab đang hiển thị (document.visibilityState === 'visible'). Nếu server
   * phát hiện thí sinh đã idle quá hạn TRƯỚC heartbeat này thì tự nộp bài
   * ngay và trả rõ autoSubmitReason để client hiển thị thông báo.
   */
  async heartbeat(userId, attemptId) {
    const { examCandidate } = await resolveCandidateContext(userId);

    let attempt = await ExamAttempt.findOne({ _id: attemptId, examCandidateId: examCandidate._id });
    if (!attempt) {
      throw new ApiError(404, 'Không tìm thấy lượt thi', 'ATTEMPT_NOT_FOUND');
    }

    attempt = await expireIfNeeded(attempt);
    attempt = await checkAndAutoSubmitIfInactive(attempt, userId);

    if (attempt.status === ATTEMPT_STATUS.IN_PROGRESS) {
      attempt.lastActiveAt = new Date();
      await attempt.save();
    }

    return {
      status: attempt.status,
      autoSubmitReason: attempt.autoSubmitReason ?? null,
    };
  },

  /**
   * Nộp bài — chấm điểm phía server dựa trên Answer.isCorrect thật (không tin
   * điểm/đúng-sai gửi từ client), ghi CandidateAnswer + Result, đóng ExamAttempt.
   * Idempotent: nếu lượt thi đã submitted rồi (vd double-click) thì trả lại đúng
   * Result đã có, không chấm lại / không tạo Result trùng.
   *
   * Chấm theo đúng tập câu hỏi trong AttemptQuestion snapshot của lượt thi này
   * (không phải theo ExamCodeQuestion của phòng ban) — khớp chính xác với những
   * gì thí sinh đã thực sự nhìn thấy trong lượt thi đó.
   *
   * `answersPayload`:
   *   - Mảng [{questionId, selectedAnswerIds}]: nộp bài bình thường (thí sinh
   *     tự bấm nộp) — dùng đúng payload FE gửi lên.
   *   - null/undefined: TỰ ĐỘNG nộp (vd do checkAndAutoSubmitIfInactive gọi) —
   *     khi đó lấy đáp án từ CandidateAnswer đã autosave trong DB, vì không có
   *     request nào từ client mang theo đáp án cả.
   *
   * `autoSubmitReason`: truyền 'inactive_timeout' khi đây là lượt nộp do hệ
   * thống tự động phát hiện rời quá lâu, để lưu lại lý do trên ExamAttempt.
   */
  async submitAttempt(userId, attemptId, answersPayload, autoSubmitReason = null) {
    const { exam, examCandidate } = await resolveCandidateContext(userId);

    const attempt = await ExamAttempt.findOne({ _id: attemptId, examCandidateId: examCandidate._id });
    if (!attempt) {
      throw new ApiError(404, 'Không tìm thấy lượt thi', 'ATTEMPT_NOT_FOUND');
    }

    if (attempt.status === ATTEMPT_STATUS.SUBMITTED) {
      const existing = await Result.findOne({ examAttemptId: attempt._id });
      if (existing) {
        return {
          score: existing.score,
          correctCount: existing.correctCount,
          totalQuestions: existing.totalQuestions,
          passed: existing.passed,
          autoSubmitReason: attempt.autoSubmitReason ?? null,
        };
      }
    }

    if (![ATTEMPT_STATUS.IN_PROGRESS, ATTEMPT_STATUS.EXPIRED].includes(attempt.status)) {
      throw new ApiError(400, 'Lượt thi không ở trạng thái hợp lệ để nộp bài', 'ATTEMPT_INVALID_STATUS');
    }

    const snapshot = await AttemptQuestion.find({ examAttemptId: attempt._id });
    const questionIds = snapshot.map((s) => s.questionId);

    const correctAnswers = await Answer.find({ questionId: { $in: questionIds }, isCorrect: true }).select(
      '_id questionId',
    );
    const correctByQuestion = new Map();
    for (const a of correctAnswers) {
      const key = a.questionId.toString();
      if (!correctByQuestion.has(key)) correctByQuestion.set(key, new Set());
      correctByQuestion.get(key).add(a._id.toString());
    }

    // Nếu có payload từ client thì dùng payload đó (nộp bài bình thường).
    // Nếu không (tự động nộp do timeout) thì lấy đáp án đã autosave trong DB —
    // đây chính là lý do autosave (recordAnswer) phải tồn tại từ trước.
    const answersMap = new Map();
    if (Array.isArray(answersPayload)) {
      for (const item of answersPayload) {
        if (!item?.questionId) continue;
        const selected = Array.isArray(item.selectedAnswerIds) ? item.selectedAnswerIds.map(String) : [];
        answersMap.set(String(item.questionId), selected);
      }
    } else {
      const saved = await CandidateAnswer.find({ examAttemptId: attempt._id }).select(
        'questionId selectedAnswerIds',
      );
      for (const s of saved) {
        answersMap.set(s.questionId.toString(), s.selectedAnswerIds.map(String));
      }
    }

    let correctCount = 0;
    const candidateAnswerDocs = [];
    for (const s of snapshot) {
      const qid = s.questionId.toString();
      const selected = answersMap.get(qid) || [];
      const selectedSet = new Set(selected);
      const correctSet = correctByQuestion.get(qid) || new Set();
      const isCorrect =
        selectedSet.size === correctSet.size && [...selectedSet].every((id) => correctSet.has(id));
      if (isCorrect) correctCount += 1;

      candidateAnswerDocs.push({
        examAttemptId: attempt._id,
        questionId: s.questionId,
        selectedAnswerIds: selected,
        isCorrect,
      });
    }

    // Xoá câu trả lời cũ (autosave hoặc lần nộp trước) để tránh vi phạm unique
    // index { examAttemptId, questionId } khi ghi lại kết quả chấm chính thức.
    await CandidateAnswer.deleteMany({ examAttemptId: attempt._id });
    if (candidateAnswerDocs.length > 0) {
      await CandidateAnswer.insertMany(candidateAnswerDocs);
    }

    const totalQuestions = snapshot.length;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = score >= (exam.passThresholdPercent ?? 70);

    attempt.status = ATTEMPT_STATUS.SUBMITTED;
    attempt.submittedAt = new Date();
    if (autoSubmitReason) {
      attempt.autoSubmitReason = autoSubmitReason;
    }
    await attempt.save();

    const result = await Result.create({
      examAttemptId: attempt._id,
      score,
      correctCount,
      totalQuestions,
      passed,
    });

    return {
      score: result.score,
      correctCount: result.correctCount,
      totalQuestions: result.totalQuestions,
      passed: result.passed,
      autoSubmitReason: attempt.autoSubmitReason ?? null,
    };
  },
};