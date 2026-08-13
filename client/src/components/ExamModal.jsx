import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Circle,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Z176_COMPANY_INFO } from '../data';
import { fetchMyResults } from '../services/report.service';
import {
  fetchMyExam,
  startExamAttempt,
  submitExamAttempt,
  answerExamQuestion,
  sendExamHeartbeat,
} from '../services/exam-attempt.service';

// ── Lưu tạm tiến trình đang làm dở vào localStorage ─────────────────────────
// Chỉ để tránh mất lựa chọn khi reload trang giữa chừng TRÊN CÙNG THIẾT BỊ.
// Điểm số/chấm điểm thật vẫn luôn do backend quyết định lúc nộp bài
// (submitExamAttempt), dữ liệu này KHÔNG được tin tưởng để tính điểm.
//
// Nguồn sự thật để KHÔI PHỤC lựa chọn khi mở lại (kể cả từ thiết bị khác) là
// `savedAnswers` server trả về trong fetchMyExam() — localStorage chỉ là lớp
// dự phòng cho trường hợp offline tạm thời trước khi autosave kịp gửi lên.
const draftKey = (attemptId) => `z176_exam_draft_${attemptId}`;

function loadDraftAnswers(attemptId) {
  if (!attemptId) return {};
  try {
    const raw = localStorage.getItem(draftKey(attemptId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDraftAnswers(attemptId, answers) {
  if (!attemptId) return;
  try {
    localStorage.setItem(draftKey(attemptId), JSON.stringify(answers));
  } catch {
    /* localStorage đầy/bị chặn — bỏ qua, không chặn luồng làm bài */
  }
}

function clearDraftAnswers(attemptId) {
  if (!attemptId) return;
  try {
    localStorage.removeItem(draftKey(attemptId));
  } catch {
    /* ignore */
  }
}

/** Chuyển savedAnswers dạng mảng [{questionId, selectedAnswerIds}] từ server
 * thành object { [questionId]: string[] } để khớp với state selectedAnswers. */
function savedAnswersToMap(savedAnswers) {
  const map = {};
  for (const item of savedAnswers ?? []) {
    if (!item?.questionId) continue;
    map[item.questionId] = Array.isArray(item.selectedAnswerIds) ? item.selectedAnswerIds : [];
  }
  return map;
}

// Client heartbeat mỗi 15s trong khi tab đang hiển thị — backend tính timeout
// dựa trên lastActiveAt (mốc server nhận request gần nhất), không phải đồng hồ
// client, nên khoảng heartbeat này chỉ cần đủ dày để phát hiện sớm, không cần
// chính xác tuyệt đối.
const HEARTBEAT_INTERVAL_MS = 15_000;

export const ExamModal = ({ isOpen, onClose, currentUser, onOpenLogin }) => {
  // step: 'loading' | 'confirm' | 'testing' | 'submitting' | 'result' | 'auto-submitted' | 'error'
  const [step, setStep] = useState('loading');
  const [loadError, setLoadError] = useState(null);

  // Thông tin nhân viên thật (currentUser chỉ có id/username/roleCode, không có
  // họ tên/mã NV/phòng ban — phải lấy riêng, giống CandidateDashboard).
  const [employee, setEmployee] = useState(null);

  // Dữ liệu đề thi + trạng thái lượt thi lấy từ GET /exam-attempts/my-exam
  const [examData, setExamData] = useState(null);

  // Lượt thi đang làm (sau khi bấm bắt đầu / resume)
  const [attemptId, setAttemptId] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [questionId]: string[] }
  const [examSecondsLeft, setExamSecondsLeft] = useState(0);
  const [submitError, setSubmitError] = useState(null);

  // Hiển thị/ẩn lưới điều hướng câu hỏi trên màn hình nhỏ (thuần UI, không ảnh hưởng dữ liệu)
  const [showQuestionGrid, setShowQuestionGrid] = useState(false);

  const [resultData, setResultData] = useState(null);

  const finishingRef = useRef(false);
  // Giữ attemptId mới nhất trong ref để heartbeat/interval luôn đọc đúng giá
  // trị hiện tại mà không phải dựng lại interval mỗi lần state đổi.
  const attemptIdRef = useRef(null);

  // ── Tải dữ liệu khi mở modal ─────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (!currentUser) {
      setStep('confirm');
      return;
    }

    let cancelled = false;
    setStep('loading');
    setLoadError(null);
    setResultData(null);
    setAttemptId(null);
    setExpiresAt(null);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    finishingRef.current = false;

    Promise.all([fetchMyResults(), fetchMyExam()])
      .then(([resultsData, exam]) => {
        if (cancelled) return;
        setEmployee(resultsData?.employee ?? null);
        setExamData(exam);

        // Nếu đang có lượt thi dở (resume, kể cả từ thiết bị/trình duyệt khác),
        // khôi phục ngay đáp án đã autosave trên server — đây là nguồn sự thật,
        // không phải localStorage (localStorage chỉ đúng trên đúng thiết bị đó).
        if (exam?.attempt) {
          setAttemptId(exam.attempt.id);
          setExpiresAt(exam.attempt.expiresAt ? new Date(exam.attempt.expiresAt) : null);
          setSelectedAnswers(savedAnswersToMap(exam.savedAnswers));
        }

        setStep('confirm');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err?.message || 'Không thể tải dữ liệu bài thi.');
        setStep('error');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentUser]);

  // ── Bắt đầu / tiếp tục lượt thi ────────────────────────────
  const handleStartExam = async () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    try {
      setSubmitError(null);
      const data = await startExamAttempt();
      setAttemptId(data.attemptId);
      setExpiresAt(new Date(data.expiresAt));

      // Lấy lại đề thi ngay sau khi bắt đầu/tiếp tục lượt thi — lúc này backend
      // đã có attempt "in_progress" nên trả về đúng bộ câu/đáp án đã xáo riêng
      // cho lượt thi này, thay vì bản preview mặc định (chưa xáo) lúc xác nhận.
      // Đồng thời trả kèm savedAnswers — nếu là resume (kể cả từ thiết bị
      // khác) thì đây chính là chỗ khôi phục đúng các lựa chọn đã chọn trước đó.
      const freshExamData = await fetchMyExam();
      setExamData(freshExamData);
      setSelectedAnswers(savedAnswersToMap(freshExamData?.savedAnswers));

      setStep('testing');
    } catch (err) {
      setSubmitError(err?.message || 'Không thể bắt đầu lượt thi.');
    }
  };

  // ── Nộp bài (thí sinh tự bấm) ─────────────────────────────
  const handleFinishExam = useCallback(async () => {
    if (!attemptId || finishingRef.current) return;
    finishingRef.current = true;
    setStep('submitting');

    const answers = (examData?.questions ?? []).map((q) => ({
      questionId: q.id,
      selectedAnswerIds: selectedAnswers[q.id] || [],
    }));

    try {
      const data = await submitExamAttempt(attemptId, answers);
      clearDraftAnswers(attemptId);
      setResultData(data);
      setStep('result');
    } catch (err) {
      setSubmitError(err?.message || 'Nộp bài thất bại, vui lòng thử lại.');
      setStep('testing');
    } finally {
      finishingRef.current = false;
    }
  }, [attemptId, examData, selectedAnswers]);

  // ── Đồng hồ đếm ngược — tính theo expiresAt thật của server ─
  useEffect(() => {
    if (step !== 'testing' || !expiresAt) return;

    const tick = () => {
      const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setExamSecondsLeft(secondsLeft);
      if (secondsLeft <= 0) {
        handleFinishExam();
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [step, expiresAt, handleFinishExam]);

  // Khôi phục lựa chọn đã lưu tạm trong localStorage (nếu có) ngay khi biết
  // attemptId — chỉ dùng làm lớp dự phòng bổ sung cho những câu CHƯA có trong
  // savedAnswers từ server (vd vừa chọn xong nhưng autosave chưa kịp gửi lên
  // trước khi F5). Không ghi đè lên đáp án đã có từ server.
  useEffect(() => {
    if (!attemptId) return;
    const draft = loadDraftAnswers(attemptId);
    if (Object.keys(draft).length > 0) {
      setSelectedAnswers((prev) => ({ ...draft, ...prev }));
    }
  }, [attemptId]);

  // ── Giữ attemptIdRef đồng bộ với state để interval bên dưới luôn đọc đúng ──
  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  // ── Heartbeat định kỳ trong lúc đang làm bài ─────────────────────────────
  // Chỉ gửi khi tab đang thực sự hiển thị (document.visibilityState==='visible')
  // — đúng yêu cầu ban đầu, tránh heartbeat "ma" khi thí sinh đang ở tab khác.
  // Nếu backend phát hiện đã rời quá 1 phút (autoSubmitReason khác null), coi
  // như bài đã bị hệ thống tự nộp — dừng làm bài ngay và hiện đúng thông báo.
  useEffect(() => {
    if (step !== 'testing' || !attemptId) return;

    let cancelled = false;

    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      const currentAttemptId = attemptIdRef.current;
      if (!currentAttemptId) return;
      try {
        const data = await sendExamHeartbeat(currentAttemptId);
        if (cancelled) return;
        if (data?.autoSubmitReason) {
          clearDraftAnswers(currentAttemptId);
          setStep('auto-submitted');
        }
      } catch {
        // Lỗi mạng tạm thời khi heartbeat — bỏ qua, thử lại ở lần kế tiếp,
        // không làm gián đoạn bài thi vì 1 lần heartbeat lỡ nhịp.
      }
    };

    // Gửi ngay 1 lần khi vào testing (không đợi đủ 15s đầu tiên), và mỗi khi
    // tab quay lại hiển thị — để bắt kịp trường hợp thí sinh rời tab >1 phút
    // rồi quay lại ngay, thay vì phải đợi tới chu kỳ interval kế tiếp.
    beat();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [step, attemptId]);

  // ── Autosave 1 câu trả lời lên server, không chặn UI (fire-and-forget) ───
  const answerRequestSeqRef = useRef(0);
  const autosaveAnswer = useCallback(
    async (questionId, selectedAnswerIds) => {
      const currentAttemptId = attemptIdRef.current;
      if (!currentAttemptId) return;
      const seq = ++answerRequestSeqRef.current;
      try {
        const data = await answerExamQuestion(currentAttemptId, questionId, selectedAnswerIds);
        // Nếu có request answer khác đã chạy sau request này, bỏ qua kết quả
        // cũ để tránh xử lý autoSubmit trùng/lệch thứ tự.
        if (seq !== answerRequestSeqRef.current) return;
        if (data?.autoSubmitReason) {
          clearDraftAnswers(currentAttemptId);
          setStep('auto-submitted');
        }
      } catch (err) {
        // Backend trả lỗi ATTEMPT_INVALID_STATUS nếu lượt thi vừa bị tự nộp
        // ngay giữa lúc client đang gửi câu trả lời — coi như đã tự nộp.
        if (err?.code === 'ATTEMPT_INVALID_STATUS') {
          clearDraftAnswers(currentAttemptId);
          setStep('auto-submitted');
        }
        // Các lỗi mạng khác: bỏ qua, đáp án vẫn còn trong localStorage draft
        // và selectedAnswers state, sẽ tự thử gửi lại ở lần chọn tiếp theo.
      }
    },
    [],
  );

  if (!isOpen) return null;

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const questions = examData?.questions ?? [];
  const currentQ = questions[currentQuestionIndex];
  const answeredCount = Object.keys(selectedAnswers).filter((qId) => (selectedAnswers[qId] || []).length > 0).length;
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const handleSelectOption = (question, optionId) => {
    setSelectedAnswers((prev) => {
      const prevSelected = prev[question.id] || [];
      const next =
        question.answerType === 'multiple'
          ? prevSelected.includes(optionId)
            ? prevSelected.filter((id) => id !== optionId)
            : [...prevSelected, optionId]
          : [optionId];
      const updated = { ...prev, [question.id]: next };
      saveDraftAnswers(attemptId, updated);
      autosaveAnswer(question.id, next);
      return updated;
    });
  };

  const handleJumpToQuestion = (index) => {
    setCurrentQuestionIndex(index);
    setShowQuestionGrid(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-[10px] shadow-2xl overflow-hidden border border-slate-200 my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#0F172A] text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#008BC5] text-white flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">HỆ THỐNG THI TRỰC TUYẾN Z176</h3>
              <p className="text-xs text-[#64748B]">An toàn lao động & Quy chế nội bộ</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-lg min-touch-target flex items-center justify-center"
            aria-label="Đóng giao diện thi"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* LOADING */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-[#008BC5]" />
            <span>Đang tải dữ liệu bài thi...</span>
          </div>
        )}

        {/* ERROR (không lấy được đề, chưa được gán đề, chưa có kỳ thi active...) */}
        {step === 'error' && (
          <div className="p-6 flex flex-col items-center justify-center gap-3 text-center flex-1">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="text-[#0F172A] font-semibold">{loadError}</p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2.5 bg-[#334155] text-white font-semibold text-sm rounded-lg hover:bg-[#1e293b] transition-colors"
            >
              Đóng
            </button>
          </div>
        )}

        {/* STEP: CONFIRMATION SCREEN */}
        {step === 'confirm' && (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 space-y-2">
              <h4 className="font-bold text-base text-[#0F172A]">Xác nhận thông tin cán bộ / công nhân thi:</h4>

              {currentUser ? (
                employee ? (
                  <div className="space-y-1.5 text-base text-[#334155] bg-white p-3 rounded-lg border border-slate-200">
                    <div>
                      Họ và tên: <strong className="text-[#0F172A]">{employee.fullname}</strong>
                    </div>
                    <div>
                      Mã nhân viên: <strong className="text-[#008BC5] font-mono">{employee.employeeCode || '—'}</strong>
                    </div>
                    <div>
                      Xưởng / Phòng: <strong className="text-[#0F172A]">{employee.departmentName || '—'}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
                    Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên. Vui lòng liên hệ quản trị viên.
                  </div>
                )
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm font-medium flex items-center justify-between gap-2">
                  <span>Bạn chưa đăng nhập thông tin nhân viên.</span>
                  <button
                    onClick={onOpenLogin}
                    className="px-3 py-1.5 bg-[#008BC5] text-white font-bold text-sm rounded-md hover:bg-[#007ba1]"
                  >
                    Đăng nhập ngay
                  </button>
                </div>
              )}
            </div>

            {currentUser && examData && (
              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-[10px] p-4 text-sm text-[#334155]">
                <h5 className="font-bold text-base text-[#0F172A]">{examData.exam.title}</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Bài thi gồm {examData.exam.totalQuestions} câu hỏi, làm trong tối đa{' '}
                    {examData.exam.durationMinutes} phút.
                  </li>
                  <li>Mỗi câu hỏi chọn 1 hoặc nhiều đáp án đúng tuỳ theo yêu cầu của từng câu.</li>
                  <li>Không thoát trình duyệt trong khi đang làm bài.</li>
                  <li>
                    Nếu rời khỏi tab đang thi quá 1 phút mà không quay lại, hệ thống sẽ tự động nộp bài với các đáp
                    án đã chọn gần nhất.
                  </li>
                  <li>Mỗi thí sinh có {examData.maxAttempts} lượt thi chính thức. Muốn thi lại cần được Người duyệt đề cấp phép riêng.</li>
                  {examData.attempt && (
                    <li className="text-[#008BC5] font-semibold">
                      Bạn đang có 1 lượt thi dở dang — bấm bên dưới để tiếp tục đúng lượt đó (không tính thêm lượt mới,
                      các câu đã chọn trước đó sẽ được khôi phục kể cả khi đổi thiết bị).
                    </li>
                  )}
                </ul>
              </div>
            )}

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="pt-2">
              {!currentUser ? (
                <button
                  onClick={onOpenLogin}
                  className="w-full min-h-[52px] bg-[#008BC5] text-white font-bold text-lg rounded-full hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 shadow-z176 min-touch-target"
                >
                  <span>ĐĂNG NHẬP ĐỂ VÀO THI</span>
                </button>
              ) : !examData?.canTake ? (
                <div className="text-center text-sm text-slate-500 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  Bạn đã sử dụng hết lượt thi chính thức. Nếu cần thi lại, vui lòng liên hệ Người duyệt đề.
                </div>
              ) : (
                <button
                  onClick={handleStartExam}
                  disabled={!employee}
                  className="w-full min-h-[52px] bg-[#008BC5] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg rounded-full hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 shadow-z176 min-touch-target"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  <span>{examData?.attempt ? 'TIẾP TỤC BÀI THI ĐANG DỞ' : 'XÁC NHẬN & BẮT ĐẦU BÀI THI'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP: TESTING SCREEN */}
        {step === 'testing' && currentQ && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Top Bar with Timer & Progress */}
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-sm gap-2">
                <button
                  onClick={() => setShowQuestionGrid((v) => !v)}
                  className="flex items-center gap-2 font-bold text-[#0F172A] px-2 py-1 -mx-2 -my-1 rounded-lg hover:bg-slate-200 transition-colors min-touch-target"
                  aria-expanded={showQuestionGrid}
                  aria-label="Mở/đóng danh sách câu hỏi"
                >
                  <span>
                    Câu {currentQuestionIndex + 1}/{questions.length}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-[#008BC5]">
                    Đã chọn: {answeredCount}/{questions.length}
                  </span>
                </button>

                <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0F172A] text-white font-bold font-mono text-base rounded-md shrink-0">
                  <Clock className="w-4 h-4 text-[#008BC5]" />
                  <span>{formatTimer(examSecondsLeft)}</span>
                </div>
              </div>

              {/* Progress bar - thuần hiển thị, tính từ answeredCount/questions.length đã có sẵn */}
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#008BC5] rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Question grid navigator - mở rộng khi bấm vào "Câu x/y" phía trên.
                  Hữu ích cho đề 30-40 câu để nhảy nhanh tới câu cần xem lại. */}
              {showQuestionGrid && (
                <div className="pt-1 pb-0.5 max-h-40 overflow-y-auto">
                  <div className="grid grid-cols-8 min-[420px]:grid-cols-10 gap-1.5">
                    {questions.map((q, idx) => {
                      const isAnswered = (selectedAnswers[q.id] || []).length > 0;
                      const isCurrent = idx === currentQuestionIndex;
                      return (
                        <button
                          key={q.id}
                          onClick={() => handleJumpToQuestion(idx)}
                          className={`aspect-square rounded-md text-xs font-bold flex items-center justify-center border transition-colors ${
                            isCurrent
                              ? 'bg-[#008BC5] border-[#008BC5] text-white ring-2 ring-[#008BC5]/40'
                              : isAnswered
                              ? 'bg-[#EAF6FF] border-[#008BC5]/40 text-[#008BC5]'
                              : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                          }`}
                          aria-label={`Đi tới câu ${idx + 1}${isAnswered ? ', đã trả lời' : ', chưa trả lời'}`}
                          aria-current={isCurrent}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Question Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-snug">
                {currentQuestionIndex + 1}. {currentQ.content}
                {currentQ.answerType === 'multiple' && (
                  <span className="block text-xs font-semibold text-[#008BC5] mt-1">(Chọn nhiều đáp án đúng)</span>
                )}
              </div>

              {/* Options list */}
              <div className="space-y-2.5">
                {currentQ.options.map((opt) => {
                  const isSelected = (selectedAnswers[currentQ.id] || []).includes(opt.id);
                  const Icon =
                    currentQ.answerType === 'multiple'
                      ? isSelected
                        ? CheckSquare
                        : Square
                      : isSelected
                      ? CheckCircle2
                      : Circle;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(currentQ, opt.id)}
                      className={`w-full min-h-[52px] p-3 rounded-lg text-left text-base font-medium transition-all flex items-start gap-3 border min-touch-target ${
                        isSelected
                          ? 'bg-[#EAF6FF] border-[#008BC5] text-[#0F172A] font-semibold ring-2 ring-[#008BC5]/30'
                          : 'bg-slate-50 border-slate-200 text-[#334155] hover:bg-slate-100'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 mt-0.5 ${isSelected ? 'text-[#008BC5]' : 'text-slate-400'}`}
                      />
                      <span className="leading-snug">{opt.content}</span>
                    </button>
                  );
                })}
              </div>

              {/* Question Navigation Bar */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 py-2.5 bg-slate-200 disabled:opacity-40 text-[#0F172A] font-bold text-sm rounded-lg hover:bg-slate-300 transition-colors flex items-center gap-1 min-touch-target"
                >
                  <ArrowLeft className="w-4 h-4" /> Câu trước
                </button>

                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    className="px-4 py-2.5 bg-[#008BC5] text-white font-bold text-sm rounded-lg hover:bg-[#007ba1] transition-colors flex items-center gap-1 min-touch-target"
                  >
                    Câu sau <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleFinishExam}
                    className="px-5 py-2.5 bg-[#22C55E] text-white font-bold text-base rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 min-touch-target"
                  >
                    <CheckCircle2 className="w-5 h-5" /> NỘP BÀI THI
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP: SUBMITTING */}
        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-[#008BC5]" />
            <span>Đang nộp bài và chấm điểm...</span>
          </div>
        )}

        {/* STEP: AUTO-SUBMITTED (hệ thống tự nộp do rời khỏi ca thi quá 1 phút) */}
        {step === 'auto-submitted' && (
          <div className="p-6 flex flex-col items-center justify-center gap-3 text-center flex-1">
            <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center shadow-z176">
              <AlertCircle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-[#0F172A]">Bạn đã rời khỏi ca thi quá 1 phút</h3>
            <p className="text-sm text-[#334155] max-w-sm">
              Hệ thống đã tự động nộp bài với các đáp án bạn đã chọn gần nhất. Nếu cần thi lại, vui lòng liên hệ
              Người duyệt đề để được xem xét cấp phép cho lượt thi mới.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-3 bg-[#334155] text-white font-bold text-base rounded-lg hover:bg-[#1e293b] transition-colors min-touch-target"
            >
              Đóng
            </button>
          </div>
        )}

        {/* STEP: RESULT SCREEN */}
        {step === 'result' && resultData && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-center">
            <div
              className="w-16 h-16 rounded-full mx-auto flex items-center justify-center shadow-z176"
              style={{ backgroundColor: resultData.passed ? '#22C55E' : '#E53E3E' }}
            >
              {resultData.passed ? (
                <Award className="w-10 h-10 text-white" />
              ) : (
                <AlertCircle className="w-10 h-10 text-white" />
              )}
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#0F172A]">
                {resultData.passed ? 'XIN CHÚC MỪNG — BẠN ĐÃ ĐẠT!' : 'KẾT QUẢ: CHƯA ĐẠT YÊU CẦU'}
              </h3>
              <p className="text-sm text-[#334155] mt-1">{Z176_COMPANY_INFO.contestTitle}</p>
            </div>

            {/* Score Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 max-w-sm mx-auto space-y-1">
              <span className="text-sm text-slate-500 font-medium block">Số câu trả lời đúng</span>
              <div className="text-3xl font-extrabold text-[#0F172A]">
                {resultData.correctCount} / {resultData.totalQuestions} câu
              </div>
              <div className="text-xs font-semibold mt-1">
                {resultData.passed ? (
                  <span className="text-[#22C55E]">Đã đáp ứng quy định thi an toàn lao động Z176 ({resultData.score} điểm)</span>
                ) : (
                  <span className="text-[#E53E3E]">Điểm của bạn: {resultData.score}</span>
                )}
              </div>
            </div>

            {!resultData.passed && (
              <div className="max-w-sm mx-auto p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 flex items-start gap-2.5 text-left">
                <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  Kết quả đã được ghi nhận. Nếu cần thi lại, vui lòng liên hệ Người duyệt đề để được xem xét cấp phép
                  cho lượt thi mới.
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3 bg-[#334155] text-white font-bold text-base rounded-lg hover:bg-[#1e293b] transition-colors min-touch-target"
              >
                Trở về trang chủ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};