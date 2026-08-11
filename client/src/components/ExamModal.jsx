import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, Clock, AlertCircle, ArrowLeft, ArrowRight, Award, ShieldCheck, RefreshCw } from 'lucide-react';
import { SAMPLE_QUESTIONS, Z176_COMPANY_INFO } from '../data';
export const ExamModal = ({
  isOpen,
  onClose,
  currentUser,
  onOpenLogin,
}) => {
  const [step, setStep] = useState('confirm');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [examSecondsLeft, setExamSecondsLeft] = useState(20 * 60); // 20 minutes
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);

  const handleFinishExam = useCallback(() => {
    let correctCount = 0;
    SAMPLE_QUESTIONS.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctOptionIndex) {
        correctCount += 1;
      }
    });

    setScore(correctCount);
    const isPass = correctCount >= Math.ceil(SAMPLE_QUESTIONS.length * 0.75);
    setPassed(isPass);
    setStep('result');
  }, [selectedAnswers]);

  // Reset exam on open
  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setExamSecondsLeft(20 * 60);
    }
  }, [isOpen]);

  // Exam timer
  useEffect(() => {
    let timer;
    if (isOpen && step === 'testing' && examSecondsLeft > 0) {
      timer = setInterval(() => {
        setExamSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleFinishExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, step, examSecondsLeft, handleFinishExam]);

  if (!isOpen) return null;

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectOption = (questionId, optionIndex) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleStartExam = () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    setStep('testing');
    setExamSecondsLeft(20 * 60);
  };

  const currentQ = SAMPLE_QUESTIONS[currentQuestionIndex];
  const answeredCount = Object.keys(selectedAnswers).length;

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
              <h3 className="font-bold text-base text-white leading-tight">
                HỆ THỐNG THI TRỰC TUYẾN Z176
              </h3>
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

        {/* STEP 1: CONFIRMATION SCREEN */}
        {step === 'confirm' && (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 space-y-2">
              <h4 className="font-bold text-base text-[#0F172A]">Xác nhận thông tin cán bộ / công nhân thi:</h4>

              {currentUser ? (
                <div className="space-y-1.5 text-base text-[#334155] bg-white p-3 rounded-lg border border-slate-200">
                  <div>
                    Họ và tên: <strong className="text-[#0F172A]">{currentUser.fullName}</strong>
                  </div>
                  <div>
                    Mã nhân viên: <strong className="text-[#008BC5] font-mono">{currentUser.employeeId}</strong>
                  </div>
                  <div>
                    Xưởng / Phòng: <strong className="text-[#0F172A]">{currentUser.department}</strong>
                  </div>
                </div>
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

            <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-[10px] p-4 text-sm text-[#334155]">
              <h5 className="font-bold text-base text-[#0F172A]">Lưu ý quan trọng khi làm bài:</h5>
              <ul className="list-disc pl-5 space-y-1">
                <li>Bài thi gồm {SAMPLE_QUESTIONS.length} câu hỏi làm trong tối đa 20 phút.</li>
                <li>Mỗi câu hỏi chọn 1 đáp án đúng nhất.</li>
                <li>Không thoát trình duyệt trong khi đang làm bài.</li>
                <li>Bạn được thi tối đa 2 lần, hệ thống tự động lưu kết quả tốt nhất.</li>
              </ul>
            </div>

            <div className="pt-2">
              {currentUser ? (
                <button
                  onClick={handleStartExam}
                  className="w-full min-h-[52px] bg-[#008BC5] text-white font-bold text-lg rounded-full hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 shadow-z176 min-touch-target"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  <span>XÁC NHẬN & BẮT ĐẦU BÀI THI</span>
                </button>
              ) : (
                <button
                  onClick={onOpenLogin}
                  className="w-full min-h-[52px] bg-[#008BC5] text-white font-bold text-lg rounded-full hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 shadow-z176 min-touch-target"
                >
                  <span>ĐĂNG NHẬP ĐỂ VÀO THI</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: TESTING SCREEN */}
        {step === 'testing' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Top Bar with Timer & Progress */}
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-sm shrink-0">
              <div className="flex items-center gap-2 font-bold text-[#0F172A]">
                <span>Câu {currentQuestionIndex + 1}/{SAMPLE_QUESTIONS.length}</span>
                <span className="text-slate-400">•</span>
                <span className="text-[#008BC5]">Đã chọn: {answeredCount}/{SAMPLE_QUESTIONS.length}</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0F172A] text-white font-bold font-mono text-base rounded-md">
                <Clock className="w-4 h-4 text-[#008BC5]" />
                <span>{formatTimer(examSecondsLeft)}</span>
              </div>
            </div>

            {/* Question Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div className="text-base sm:text-lg font-bold text-[#0F172A] leading-snug">
                {currentQ.id}. {currentQ.question}
              </div>

              {/* Options list */}
              <div className="space-y-2.5">
                {currentQ.options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[currentQ.id] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleSelectOption(currentQ.id, optIdx)}
                      className={`w-full min-h-[52px] p-3 rounded-lg text-left text-base font-medium transition-all flex items-start gap-3 border min-touch-target ${
                        isSelected
                          ? 'bg-[#EAF6FF] border-[#008BC5] text-[#0F172A] font-semibold ring-2 ring-[#008BC5]/30'
                          : 'bg-slate-50 border-slate-200 text-[#334155] hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-[#008BC5] text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="leading-snug">{opt}</span>
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

                {currentQuestionIndex < SAMPLE_QUESTIONS.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIndex((prev) => Math.min(SAMPLE_QUESTIONS.length - 1, prev + 1))}
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

        {/* STEP 3: RESULT SCREEN */}
        {step === 'result' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center shadow-z176" style={{ backgroundColor: passed ? '#22C55E' : '#E53E3E' }}>
              {passed ? (
                <Award className="w-10 h-10 text-white" />
              ) : (
                <AlertCircle className="w-10 h-10 text-white" />
              )}
            </div>

            <div>
              <h3 className="text-2xl font-bold text-[#0F172A]">
                {passed ? 'XIN CHÚC MỪNG — BẠN ĐÃ ĐẠT!' : 'KẾT QUẢ: CHƯA ĐẠT YÊU CẦU'}
              </h3>
              <p className="text-sm text-[#334155] mt-1">
                {Z176_COMPANY_INFO.contestTitle}
              </p>
            </div>

            {/* Score Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 max-w-sm mx-auto space-y-1">
              <span className="text-sm text-slate-500 font-medium block">Số câu trả lời đúng</span>
              <div className="text-3xl font-extrabold text-[#0F172A]">
                {score} / {SAMPLE_QUESTIONS.length} câu
              </div>
              <div className="text-xs font-semibold mt-1">
                {passed ? (
                  <span className="text-[#22C55E]">Đã đáp ứng quy định thi an toàn lao động Z176</span>
                ) : (
                  <span className="text-[#E53E3E]">Cần tối thiểu {Math.ceil(SAMPLE_QUESTIONS.length * 0.75)}/{SAMPLE_QUESTIONS.length} câu để đạt</span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {!passed && (
                <button
                  onClick={() => {
                    setStep('testing');
                    setSelectedAnswers({});
                    setCurrentQuestionIndex(0);
                    setExamSecondsLeft(20 * 60);
                  }}
                  className="w-full sm:w-auto px-5 py-3 bg-[#008BC5] text-white font-bold text-base rounded-lg hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 min-touch-target"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Thi lại lượt 2</span>
                </button>
              )}

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
