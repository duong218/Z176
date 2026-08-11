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
import { fetchMyExam, startExamAttempt, submitExamAttempt } from '../services/exam-attempt.service';

export const ExamModal = ({ isOpen, onClose, currentUser, onOpenLogin }) => {
  // step: 'loading' | 'confirm' | 'testing' | 'submitting' | 'result' | 'error'
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

  const [resultData, setResultData] = useState(null);

  const finishingRef = useRef(false);

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
      setStep('testing');
    } catch (err) {
      setSubmitError(err?.message || 'Không thể bắt đầu lượt thi.');
    }
  };

  // ── Nộp bài ─────────────────────────────────────────────
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

  if (!isOpen) return null;

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const questions = examData?.questions ?? [];
  const currentQ = questions[currentQuestionIndex];
  const answeredCount = Object.keys(selectedAnswers).filter((qId) => (selectedAnswers[qId] || []).length > 0).length;

  const handleSelectOption = (question, optionId) => {
    setSelectedAnswers((prev) => {
      const prevSelected = prev[question.id] || [];
      if (question.answerType === 'multiple') {
        const next = prevSelected.includes(optionId)
          ? prevSelected.filter((id) => id !== optionId)
          : [...prevSelected, optionId];
        return { ...prev, [question.id]: next };
      }
      return { ...prev, [question.id]: [optionId] };
    });
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
                  <li>Mỗi thí sinh có {examData.maxAttempts} lượt thi chính thức. Muốn thi lại cần được Người duyệt đề cấp phép riêng.</li>
                  {examData.attempt && (
                    <li className="text-[#008BC5] font-semibold">
                      Bạn đang có 1 lượt thi dở dang — bấm bên dưới để tiếp tục đúng lượt đó (không tính thêm lượt mới).
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
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-sm shrink-0">
              <div className="flex items-center gap-2 font-bold text-[#0F172A]">
                <span>
                  Câu {currentQuestionIndex + 1}/{questions.length}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-[#008BC5]">
                  Đã chọn: {answeredCount}/{questions.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0F172A] text-white font-bold font-mono text-base rounded-md">
                <Clock className="w-4 h-4 text-[#008BC5]" />
                <span>{formatTimer(examSecondsLeft)}</span>
              </div>
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