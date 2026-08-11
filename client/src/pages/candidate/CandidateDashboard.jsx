import { useState, useEffect } from 'react';
import {
  UserCircle2,
  Building2,
  BadgeCheck,
  Award,
  XCircle,
  History,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  CheckSquare,
  BookOpen,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { fetchMyResults } from '../../services/report.service';

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Mặc định mỗi thí sinh chỉ có 1 lượt thi chính thức. Muốn thi lại phải được
// Người duyệt đề cấp phép riêng cho từng trường hợp (chưa có cơ chế cấp phép
// này ở backend hiện tại — sẽ cần xem exam-candidate.model.js để xác nhận field
// trước khi nối API thật, không tự bịa field ở đây).
const MAX_ATTEMPTS = 1;

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'exam', label: 'Thi trực tuyến', icon: CheckSquare },
  { id: 'history', label: 'Lịch sử kết quả', icon: History },
  { id: 'materials', label: 'Tài liệu ôn tập', icon: BookOpen },
];

export const CandidateDashboard = ({ currentUser, onOpenExam }) => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [results, setResults] = useState([]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchMyResults()
      .then((data) => {
        if (cancelled) return;
        setEmployee(data?.employee ?? null);
        setResults(Array.isArray(data?.results) ? data.results : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Không thể tải dữ liệu kết quả thi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalAttempts = results.length;
  const bestResult = results.reduce((best, r) => {
    if (!best) return r;
    return r.score > best.score ? r : best;
  }, null);
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - totalAttempts);

  const handleStartExam = () => {
    if (typeof onOpenExam === 'function') {
      onOpenExam();
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 mt-16 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2 flex items-center gap-3">
          <UserCircle2 className="w-8 h-8 text-[#008BC5]" />
          DASHBOARD CỦA TÔI
        </h1>
        <p className="text-slate-500">Thông tin cá nhân, thi trực tuyến và lịch sử kết quả thi của bạn.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Đang tải dữ liệu...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : !employee ? (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên nào. Vui lòng liên hệ quản trị viên để được hỗ trợ.
          </span>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar bên trái */}
          <aside className="md:w-60 shrink-0">
            <nav
              className="bg-white rounded-xl shadow-z176 border border-slate-200 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible md:sticky md:top-20"
              aria-label="Menu chức năng thí sinh"
            >
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors text-left min-touch-target ${
                      isActive
                        ? 'bg-[#008BC5]/10 text-[#008BC5] border border-[#008BC5]/30'
                        : 'text-slate-500 hover:text-[#0F172A] hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Nội dung chính */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* ── Mục: Dashboard (thông tin cá nhân + tổng quan nhanh) ── */}
            {activeSection === 'dashboard' && (
              <>
                <div className="bg-white rounded-xl shadow-z176 border border-slate-200 p-6">
                  <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                    <UserCircle2 className="w-5 h-5 text-[#008BC5]" />
                    Thông tin cá nhân
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3">
                      <UserCircle2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-slate-500">Họ và tên</div>
                        <div className="font-semibold text-[#0F172A]">{employee.fullname}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <BadgeCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-slate-500">Mã nhân viên</div>
                        <div className="font-semibold text-[#0F172A] font-mono">
                          {employee.employeeCode || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-slate-500">Phòng ban</div>
                        <div className="font-semibold text-[#0F172A]">
                          {employee.departmentName || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-z176 border border-slate-200 p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg bg-[#008BC5]/10 flex items-center justify-center shrink-0">
                      <History className="w-6 h-6 text-[#008BC5]" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Số lần đã thi</div>
                      <div className="text-xl font-bold text-[#0F172A]">{totalAttempts}</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-z176 border border-slate-200 p-5 flex items-center gap-4">
                    <div
                      className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                        bestResult?.passed ? 'bg-[#22C55E]/10' : 'bg-slate-100'
                      }`}
                    >
                      <Award className={`w-6 h-6 ${bestResult?.passed ? 'text-[#22C55E]' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Điểm cao nhất</div>
                      <div className="text-xl font-bold text-[#0F172A]">
                        {bestResult ? `${bestResult.score} điểm` : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lối tắt vào thi ngay từ Dashboard */}
                <div className="bg-[#0F172A] rounded-xl shadow-z176 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-[#008BC5]/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-6 h-6 text-[#38BDF8]" />
                    </div>
                    <div>
                      <div className="font-bold text-white">Sẵn sàng thi trực tuyến?</div>
                      <div className="text-sm text-slate-400">
                        Bạn còn {attemptsLeft} lượt thi. Chuyển sang mục "Thi trực tuyến" để bắt đầu.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSection('exam')}
                    className="w-full sm:w-auto px-5 py-3 bg-[#008BC5] text-white font-bold text-sm rounded-lg hover:bg-[#007ba1] transition-colors shrink-0 min-touch-target"
                  >
                    Đi tới mục thi
                  </button>
                </div>
              </>
            )}

            {/* ── Mục: Thi trực tuyến ── */}
            {activeSection === 'exam' && (
              <div className="bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-[#008BC5]" />
                    Thi trực tuyến
                  </h2>
                </div>

                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-500 mb-1">Số lượt đã thi</div>
                      <div className="text-xl font-bold text-[#0F172A]">{totalAttempts}/{MAX_ATTEMPTS}</div>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-500 mb-1">Lượt còn lại</div>
                      <div className="text-xl font-bold text-[#0F172A]">{attemptsLeft}</div>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-500 mb-1">Điểm cao nhất</div>
                      <div className="text-xl font-bold text-[#0F172A]">
                        {bestResult ? `${bestResult.score} điểm` : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm flex items-start gap-2.5">
                    <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>
                      Vui lòng chuẩn bị đầy đủ thời gian trước khi bắt đầu — bài thi có giới hạn thời gian và không thể
                      tạm dừng giữa chừng. Không thoát trình duyệt trong khi đang làm bài.
                    </span>
                  </div>

                  <button
                    onClick={handleStartExam}
                    disabled={attemptsLeft <= 0}
                    className="w-full min-h-[56px] bg-[#008BC5] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg rounded-full hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 shadow-z176 min-touch-target"
                  >
                    <ShieldCheck className="w-6 h-6" />
                    <span>VÀO THI CHÍNH THỨC</span>
                  </button>

                  {attemptsLeft <= 0 && (
                    <p className="text-center text-sm text-slate-500">
                      Bạn đã hoàn thành lượt thi chính thức. Nếu cần thi lại, vui lòng liên hệ Người duyệt đề để được
                      xem xét cấp phép cho lượt thi mới.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Mục: Lịch sử kết quả ── */}
            {activeSection === 'history' && (
              <div className="bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                    <History className="w-5 h-5 text-[#008BC5]" />
                    Lịch sử kết quả thi
                  </h2>
                </div>

                {results.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    Bạn chưa có lượt thi nào được ghi nhận.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                          <th className="px-4 py-3 text-left font-semibold">Bài thi</th>
                          <th className="px-4 py-3 text-left font-semibold">Thời gian nộp</th>
                          <th className="px-4 py-3 text-center font-semibold">Điểm</th>
                          <th className="px-4 py-3 text-center font-semibold">Số câu đúng</th>
                          <th className="px-4 py-3 text-center font-semibold">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {results.map((r) => (
                          <tr key={r._id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-[#0F172A]">{r.examTitle}</td>
                            <td className="px-4 py-3 text-slate-500">{formatDateTime(r.submittedAt)}</td>
                            <td className="px-4 py-3 text-center font-bold text-[#0F172A]">{r.score}</td>
                            <td className="px-4 py-3 text-center text-slate-500">
                              {r.correctCount}/{r.totalQuestions}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.passed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] font-semibold text-xs">
                                  <Award className="w-3.5 h-3.5" /> Đạt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-semibold text-xs">
                                  <XCircle className="w-3.5 h-3.5" /> Chưa đạt
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Mục: Tài liệu ôn tập (placeholder — chưa có nguồn dữ liệu thật) ── */}
            {activeSection === 'materials' && (
              <div className="bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#008BC5]" />
                    Tài liệu ôn tập
                  </h2>
                </div>
                <div className="p-8 text-center text-slate-500">
                  Chức năng đang được xây dựng. Tài liệu ôn tập sẽ được cập nhật tại đây trong thời gian tới.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};