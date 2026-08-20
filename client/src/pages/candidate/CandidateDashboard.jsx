import { useState, useEffect, useRef } from 'react';
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
  FileText,
  Eye,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { fetchMyResults } from '../../services/report.service';
import { fetchMyExam } from '../../services/exam-attempt.service';
import {
  fetchMyStudyDocuments,
  previewStudyDocument,
  downloadStudyDocument,
} from '../../services/study-document.service';

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

// MỚI — Custom tick cho trục X của biểu đồ "Điểm số qua các lần thi". Tên kỳ
// thi trong thực tế có thể rất dài (ví dụ "Chuyển đề tổng hợp cơ quan Z176"),
// nếu hiển thị nguyên văn sẽ luôn có nguy cơ đè lên nhãn cột bên cạnh dù đã
// xoay góc. Ở đây cắt còn tối đa 14 ký tự + "…", tên đầy đủ vẫn xem được qua
// Tooltip khi hover/chạm vào cột, hoặc qua thẻ <title> (tooltip trình duyệt).
const MAX_TICK_CHARS = 14;
const TruncatedTick = ({ x, y, payload }) => {
  const full = String(payload.value ?? '');
  const short = full.length > MAX_TICK_CHARS ? `${full.slice(0, MAX_TICK_CHARS)}…` : full;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text
        x={0}
        y={0}
        dy={10}
        textAnchor="end"
        transform="rotate(-40)"
        fill="#334155"
        fontSize={12}
      >
        {short}
      </text>
    </g>
  );
};

const isPdf = (doc) =>
  doc.mimeType === 'application/pdf' || doc.originalFileName?.toLowerCase().endsWith('.pdf');

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'exam', label: 'Thi trực tuyến', icon: CheckSquare },
  { id: 'history', label: 'Lịch sử kết quả', icon: History },
  { id: 'materials', label: 'Tài liệu ôn tập', icon: BookOpen },
];

export const CandidateDashboard = ({ currentUser, onOpenExam, examModalOpen, activeExam }) => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [results, setResults] = useState([]);
  const [refreshTick, setRefreshTick] = useState(0);

  // MỚI — Thay cho việc tự tính lượt thi ở client (hằng số cứng MAX_ATTEMPTS=1
  // + đếm Result), lấy thẳng trạng thái lượt thi THẬT từ backend qua
  // GET /api/exam-attempts/my-exam (examAttemptService.getMyExam). Đây là
  // nguồn sự thật duy nhất biết về extraAttemptsGranted (lượt được Người
  // duyệt đề cấp thêm) — tự tính lại ở client sẽ luôn lệch mỗi khi Leader cấp
  // thêm lượt, vì client không có cách nào biết con số đó.
  //   examStatus = { attemptsUsed, maxAttempts, canTake, attempt } | null
  //   null nghĩa là: chưa tải xong, hoặc hiện không có kỳ thi nào đang active
  //   (backend trả lỗi EXAM_NOT_ACTIVE — coi như chưa có gì để thi).
  const [examStatus, setExamStatus] = useState(null);
  const [examStatusLoading, setExamStatusLoading] = useState(true);

  // MỚI — Tài liệu ôn tập: 2 danh sách riêng — theo kỳ thi đang active (lọc
  // theo topicId) và toàn bộ tài liệu cũ đã đăng (không lọc topicId). Tải lười
  // (lazy) khi người dùng mở mục "Tài liệu ôn tập" lần đầu, tránh gọi API
  // thừa cho những ai không bao giờ xem mục này.
  const [activeDocs, setActiveDocs] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState(null);
  const [docsLoadedOnce, setDocsLoadedOnce] = useState(false);
  const [busyDocId, setBusyDocId] = useState(null);

  // ExamModal được mở/đóng ở App.jsx (dùng chung cho cả trang chủ). Khi modal
  // vừa chuyển từ mở -> đóng (thí sinh vừa thi xong hoặc huỷ), tự fetch lại
  // kết quả — nếu không, Dashboard sẽ hiển thị số liệu cũ dù backend đã có
  // Result mới (đây chính là bug đã gặp: nộp bài xong nhưng dashboard không đổi).
  const prevExamModalOpenRef = useRef(examModalOpen);
  useEffect(() => {
    if (prevExamModalOpenRef.current && !examModalOpen) {
      setRefreshTick((t) => t + 1);
    }
    prevExamModalOpenRef.current = examModalOpen;
  }, [examModalOpen]);

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
  }, [refreshTick]);

  // MỚI — Tải trạng thái lượt thi thật từ backend. Tách riêng useEffect khỏi
  // fetchMyResults ở trên vì đây là 2 nguồn dữ liệu độc lập (Result đã nộp vs
  // trạng thái lượt/quyền còn lại) và fetchMyExam có thể lỗi hợp lệ
  // (EXAM_NOT_ACTIVE) mà không nên chặn phần hiển thị lịch sử kết quả.
  useEffect(() => {
    let cancelled = false;

    setExamStatusLoading(true);

    fetchMyExam()
      .then((data) => {
        if (cancelled) return;
        setExamStatus({
          attemptsUsed: data?.attemptsUsed ?? 0,
          maxAttempts: data?.maxAttempts ?? 1,
          canTake: Boolean(data?.canTake),
          attempt: data?.attempt ?? null,
        });
      })
      .catch(() => {
        // EXAM_NOT_ACTIVE hoặc CANDIDATE_NOT_ASSIGNED — coi như chưa có kỳ thi
        // nào để thi, không hiện lỗi (đã có UI riêng xử lý trường hợp !activeExam).
        if (cancelled) return;
        setExamStatus(null);
      })
      .finally(() => {
        if (!cancelled) setExamStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshTick, activeExam?._id]);

  // MỚI — Tải tài liệu ôn tập khi mở mục "materials" lần đầu, hoặc khi kỳ thi
  // active thay đổi (topicId đổi -> danh sách "tài liệu kỳ thi hiện tại" phải
  // tải lại theo topic mới).
  useEffect(() => {
    if (activeSection !== 'materials') return;

    let cancelled = false;
    setDocsLoading(true);
    setDocsError(null);

    const activeTopicId = activeExam?.topicId?._id || activeExam?.topicId;

    const requests = [
      activeTopicId
        ? fetchMyStudyDocuments({ topicId: activeTopicId })
        : Promise.resolve([]),
      fetchMyStudyDocuments(),
    ];

    Promise.all(requests)
      .then(([activeList, allList]) => {
        if (cancelled) return;
        setActiveDocs(Array.isArray(activeList) ? activeList : []);
        setAllDocs(Array.isArray(allList) ? allList : []);
        setDocsLoadedOnce(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setDocsError(err?.message || 'Không thể tải tài liệu ôn tập.');
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSection, activeExam?.topicId?._id, activeExam?.topicId]);

  const handlePreviewDoc = async (doc) => {
    setBusyDocId(doc._id);
    setDocsError(null);
    try {
      await previewStudyDocument(doc._id);
    } catch (err) {
      setDocsError(err?.message || 'Không thể mở tài liệu.');
    } finally {
      setBusyDocId(null);
    }
  };

  const handleDownloadDoc = async (doc) => {
    setBusyDocId(doc._id);
    setDocsError(null);
    try {
      await downloadStudyDocument(doc._id, doc.originalFileName || doc.title);
    } catch (err) {
      setDocsError(err?.message || 'Không thể tải tài liệu.');
    } finally {
      setBusyDocId(null);
    }
  };

  // "Số lần đã thi" ở khối tổng quan Dashboard vẫn hiển thị TOÀN BỘ lịch sử
  // (thành tích chung của thí sinh qua các kỳ thi) — không liên quan tới việc
  // khoá/mở nút thi.
  const totalAttempts = results.length;
  const bestResult = results.reduce((best, r) => {
    if (!best) return r;
    return r.score > best.score ? r : best;
  }, null);

  // Lượt thi CHÍNH THỨC cho kỳ thi đang active — lấy thẳng từ examStatus
  // (backend), đã tính đúng cả lượt được Người duyệt đề cấp thêm
  // (extraAttemptsGranted). Không có kỳ thi active hoặc chưa tải xong thì coi
  // như 0/1 và khoá nút, tránh nháy sai trạng thái trước khi tải xong.
  const maxAttempts = examStatus?.maxAttempts ?? 1;
  const attemptsForActiveExam = examStatus?.attemptsUsed ?? 0;
  const attemptsLeft = examStatus ? Math.max(0, maxAttempts - attemptsForActiveExam) : 0;
  // canTake đã tính cả trường hợp đang có lượt in_progress (được phép vào tiếp
  // dù attemptsLeft có thể hiện 0 sau khi lượt đó tính vào finishedCount).
  const canStartExam = Boolean(activeExam) && Boolean(examStatus?.canTake);

  const handleStartExam = () => {
    if (typeof onOpenExam === 'function') {
      onOpenExam();
    }
  };

  // Tài liệu cũ = toàn bộ tài liệu TRỪ những tài liệu đã hiện trong danh sách
  // "kỳ thi hiện tại", tránh hiển thị trùng lặp 2 lần trong cùng 1 mục.
  const activeDocIds = new Set(activeDocs.map((d) => d._id));
  const olderDocs = allDocs.filter((d) => !activeDocIds.has(d._id));

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
        <div className="p-4 bg-[#FEECEC] border border-[#E53E3E]/30 text-[#0F172A] rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : !employee ? (
        <div className="p-4 bg-[#FFFBEB] border border-[#F6AD37]/40 text-[#0F172A] rounded-xl flex items-center gap-3">
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
              className="bg-white rounded-xl shadow-z176 border border-slate-200 p-2 grid grid-cols-2 gap-2 md:flex md:flex-col md:gap-1 md:sticky md:top-20"
              aria-label="Menu chức năng thí sinh"
            >
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex flex-col md:flex-row items-center md:items-center gap-1.5 md:gap-2.5 px-2 py-3 md:px-4 md:py-3 rounded-lg text-base font-semibold text-center md:text-left transition-colors min-touch-target ${
                      isActive
                        ? 'bg-[#008BC5]/10 text-[#008BC5] border border-[#008BC5]/30'
                        : 'text-slate-500 hover:text-[#0F172A] hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="leading-tight">{item.label}</span>
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
                {/* MỚI — animate-fade-in-up: hiệu ứng xuất hiện so le khi mục
                    "Dashboard" vừa được chọn, đồng bộ pattern với AdminDashboard
                    (xem OverviewTab.jsx / AccountTab.jsx bên Admin). */}
                <div className="animate-fade-in-up bg-white rounded-xl shadow-z176 border border-slate-200 p-6" style={{ '--stagger-delay': '0ms' }}>
                  <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                    <UserCircle2 className="w-5 h-5 text-[#008BC5]" />
                    Thông tin cá nhân
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3">
                      <UserCircle2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm text-slate-500">Họ và tên</div>
                        <div className="font-semibold text-[#0F172A]">{employee.fullname}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <BadgeCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm text-slate-500">Mã nhân viên</div>
                        <div className="font-semibold text-[#0F172A] font-mono">
                          {employee.employeeCode || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm text-slate-500">Phòng ban</div>
                        <div className="font-semibold text-[#0F172A]">
                          {employee.departmentName || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="animate-fade-in-up grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ '--stagger-delay': '60ms' }}>
                  <div className="bg-white rounded-xl shadow-z176 border border-slate-200 p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg bg-[#008BC5]/10 flex items-center justify-center shrink-0">
                      <History className="w-6 h-6 text-[#008BC5]" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Số lần đã thi</div>
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
                      <div className="text-sm text-slate-500">Điểm cao nhất</div>
                      <div className="text-xl font-bold text-[#0F172A]">
                        {bestResult ? `${bestResult.score} điểm` : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* MỚI — Biểu đồ điểm số qua các lần thi, giúp thí sinh thấy
                    ngay xu hướng kết quả của mình thay vì phải mở tab "Lịch
                    sử kết quả" và tự đọc bảng. Sắp xếp theo thời gian nộp bài
                    tăng dần (cũ → mới, trái → phải) để đọc như 1 dòng thời
                    gian. Cột tô màu theo đúng 2 màu semantic Đạt/Không đạt. */}
                {results.length > 0 && (() => {
                  const chartData = [...results]
                    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
                    .map((r) => ({
                      label: r.examTitle,
                      score: r.score,
                      passed: r.passed,
                      submittedAt: formatDateTime(r.submittedAt),
                    }));
                  // Mỗi cột cần tối thiểu ~90px để nhãn xoay đủ góc không đè
                  // nhau. Khi số kỳ thi vượt quá độ rộng khung nhìn, biểu đồ
                  // sẽ rộng hơn 100% và người dùng scroll ngang để xem — thay
                  // vì nén cứng vào width="100%" khiến nhãn càng lúc càng
                  // chồng lên nhau khi có thêm kỳ thi mới theo thời gian.
                  const MIN_BAR_WIDTH = 90;
                  const chartMinWidth = Math.max(chartData.length * MIN_BAR_WIDTH, 320);

                  return (
                    <div className="animate-fade-in-up bg-white rounded-xl shadow-z176 border border-slate-200 p-6" style={{ '--stagger-delay': '120ms' }}>
                      <h2 className="text-lg font-bold text-[#0F172A] mb-1 flex items-center gap-2">
                        <History className="w-5 h-5 text-[#008BC5]" />
                        Điểm số qua các lần thi
                      </h2>
                      <p className="text-sm text-slate-500 mb-4">Sắp xếp theo thời gian, từ lần thi cũ nhất đến gần nhất</p>
                      {/* Scroll ngang khi nhiều kỳ thi, thay vì để Recharts tự
                          nén cột + nhãn vào đúng 100% chiều rộng khung nhìn. */}
                      <div className="h-72 overflow-x-auto overflow-y-hidden -mx-2 px-2">
                        <div style={{ minWidth: chartMinWidth, height: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                              <XAxis
                                dataKey="label"
                                tick={<TruncatedTick />}
                                axisLine={{ stroke: '#E2E8F0' }}
                                tickLine={false}
                                interval={0}
                                angle={-40}
                                textAnchor="end"
                                height={78}
                              />
                              <YAxis
                                allowDecimals={false}
                                tick={{ fill: '#334155', fontSize: 13 }}
                                axisLine={{ stroke: '#E2E8F0' }}
                                tickLine={false}
                                width={36}
                              />
                              <Tooltip
                                contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8 }}
                                labelFormatter={(label) => label}
                                formatter={(value, _name, props) => [
                                  `${value} điểm — ${props?.payload?.passed ? 'Đạt' : 'Không đạt'}`,
                                  props?.payload?.submittedAt,
                                ]}
                              />
                              <Bar dataKey="score" name="Điểm" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                {chartData.map((r, index) => (
                                  <Cell key={index} fill={r.passed ? '#22C55E' : '#E53E3E'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      {chartData.length > 4 && (
                        <p className="text-xs text-slate-400 mt-2 sm:hidden">
                          Vuốt ngang để xem thêm các kỳ thi khác →
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Lối tắt vào thi ngay từ Dashboard */}
                <div className="animate-fade-in-up bg-white rounded-xl shadow-z176 border border-[#E2E8F0] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ '--stagger-delay': '180ms' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-[#EAF6FF] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-6 h-6 text-[#008BC5]" />
                    </div>
                    <div>
                      <div className="font-bold text-[#0F172A] text-base">Sẵn sàng thi trực tuyến?</div>
                      <div className="text-base text-[#334155]">
                        {activeExam
                          ? `Bạn còn ${attemptsLeft} lượt thi cho kỳ thi đang diễn ra. Chuyển sang mục "Thi trực tuyến" để bắt đầu.`
                          : 'Hiện chưa có kỳ thi nào đang diễn ra. Vui lòng quay lại sau.'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSection('exam')}
                    className="w-full sm:w-auto px-5 py-3 bg-[#008BC5] text-white font-bold text-base rounded-lg hover:bg-[#0693E3] transition-colors shrink-0 min-touch-target"
                  >
                    Đi tới mục thi
                  </button>
                </div>
              </>
            )}

            {/* ── Mục: Thi trực tuyến ── */}
            {activeSection === 'exam' && (
              // MỚI — animate-fade-in-up: đồng bộ hiệu ứng xuất hiện khi chuyển
              // sang mục "Thi trực tuyến", cùng pattern với AdminDashboard.
              <div className="animate-fade-in-up bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden" style={{ '--stagger-delay': '0ms' }}>
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-[#008BC5]" />
                    Thi trực tuyến
                  </h2>
                </div>

                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-sm text-slate-500 mb-1">Số lượt đã thi (kỳ thi hiện tại)</div>
                      <div className="text-xl font-bold text-[#0F172A]">{attemptsForActiveExam}/{maxAttempts}</div>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-sm text-slate-500 mb-1">Lượt còn lại</div>
                      <div className="text-xl font-bold text-[#0F172A]">{attemptsLeft}</div>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-sm text-slate-500 mb-1">Điểm cao nhất</div>
                      <div className="text-xl font-bold text-[#0F172A]">
                        {bestResult ? `${bestResult.score} điểm` : '—'}
                      </div>
                    </div>
                  </div>

                  {!activeExam ? (
                    <div className="p-4 bg-[#F6F8FA] border border-slate-200 rounded-lg text-slate-500 text-sm flex items-start gap-2.5">
                      <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>Hiện không có kỳ thi nào đang diễn ra. Vui lòng quay lại sau khi Người duyệt đề đăng kỳ thi mới.</span>
                    </div>
                  ) : (
                    <div className="p-4 bg-[#FFFBEB] border border-[#F6AD37]/40 rounded-lg text-[#0F172A] text-sm flex items-start gap-2.5">
                      <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>
                        Vui lòng chuẩn bị đầy đủ thời gian trước khi bắt đầu — bài thi có giới hạn thời gian và không thể
                        tạm dừng giữa chừng. Không thoát trình duyệt trong khi đang làm bài.
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleStartExam}
                    disabled={examStatusLoading || !canStartExam}
                    className="w-full min-h-[56px] bg-[#008BC5] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg rounded-full hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 shadow-z176 min-touch-target"
                  >
                    <ShieldCheck className="w-6 h-6" />
                    <span>VÀO THI CHÍNH THỨC</span>
                  </button>

                  {activeExam && !examStatusLoading && !canStartExam && (
                    <p className="text-center text-sm text-slate-500">
                      Bạn đã hoàn thành lượt thi chính thức cho kỳ thi "{activeExam.title}". Nếu cần thi lại, vui lòng liên hệ
                      Người duyệt đề để được xem xét cấp phép cho lượt thi mới.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Mục: Lịch sử kết quả ── */}
            {activeSection === 'history' && (
              // MỚI — animate-fade-in-up: đồng bộ hiệu ứng xuất hiện khi chuyển
              // sang mục "Lịch sử kết quả", cùng pattern với AdminDashboard.
              <div className="animate-fade-in-up bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden" style={{ '--stagger-delay': '0ms' }}>
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
                  <>
                    {/* Desktop Table — MỚI: animate-fade-in-up, so le sau header */}
                    <div className="animate-fade-in-up hidden sm:block overflow-x-auto" style={{ '--stagger-delay': '80ms' }}>
                      <table className="w-full text-base">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-sm uppercase">
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
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F0FDF4] text-[#166534] font-semibold text-sm">
                                    <Award className="w-3.5 h-3.5" /> Đạt
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FEECEC] text-[#C53030] font-semibold text-sm">
                                    <XCircle className="w-3.5 h-3.5" /> Chưa đạt
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List — MỚI: animate-fade-in-up, so le sau header */}
                    <div className="animate-fade-in-up sm:hidden p-4 space-y-3" style={{ '--stagger-delay': '80ms' }}>
                      {results.map((r) => (
                        <div key={r._id} className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-[#0F172A] text-base leading-snug">{r.examTitle}</span>
                            {r.passed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F0FDF4] text-[#166534] font-semibold text-sm shrink-0">
                                <Award className="w-3.5 h-3.5" /> Đạt
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FEECEC] text-[#C53030] font-semibold text-sm shrink-0">
                                <XCircle className="w-3.5 h-3.5" /> Chưa đạt
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-base">
                            <span className="text-slate-500">Nộp lúc: {formatDateTime(r.submittedAt)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-base pt-1 border-t border-slate-100">
                            <span>
                              <span className="text-slate-500">Điểm: </span>
                              <span className="font-bold text-[#0F172A]">{r.score}</span>
                            </span>
                            <span>
                              <span className="text-slate-500">Số câu đúng: </span>
                              <span className="font-semibold text-[#0F172A]">{r.correctCount}/{r.totalQuestions}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Mục: Tài liệu ôn tập ── */}
            {activeSection === 'materials' && (
              <div className="space-y-6">
                {docsError && (
                  <div className="p-4 bg-[#FEECEC] border border-[#E53E3E]/30 text-[#0F172A] rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{docsError}</span>
                  </div>
                )}

                {docsLoading && !docsLoadedOnce ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang tải tài liệu...</span>
                  </div>
                ) : (
                  <>
                    {/* Tài liệu của kỳ thi hiện tại — MỚI: animate-fade-in-up */}
                    <div className="animate-fade-in-up bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden" style={{ '--stagger-delay': '0ms' }}>
                      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                        <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-[#008BC5]" />
                          Tài liệu kỳ thi hiện tại
                        </h2>
                        {activeExam && (
                          <p className="text-sm text-slate-500 mt-0.5">Chủ đề: {activeExam.title}</p>
                        )}
                      </div>

                      {!activeExam ? (
                        <div className="p-8 text-center text-slate-500 text-base">
                          Hiện không có kỳ thi nào đang diễn ra nên chưa có tài liệu để hiển thị ở mục này.
                        </div>
                      ) : activeDocs.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-base">
                          Chưa có tài liệu ôn tập nào cho kỳ thi hiện tại.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {activeDocs.map((doc) => (
                            <DocumentRow
                              key={doc._id}
                              doc={doc}
                              busy={busyDocId === doc._id}
                              onPreview={handlePreviewDoc}
                              onDownload={handleDownloadDoc}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tất cả tài liệu đã đăng (bao gồm tài liệu cũ) — MỚI: animate-fade-in-up */}
                    <div className="animate-fade-in-up bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden" style={{ '--stagger-delay': '100ms' }}>
                      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                        <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                          <FileText className="w-5 h-5 text-[#008BC5]" />
                          Tất cả tài liệu
                        </h2>
                        <p className="text-sm text-slate-500 mt-0.5">Bao gồm tài liệu của các kỳ thi trước đây.</p>
                      </div>

                      {olderDocs.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-base">
                          Không có tài liệu nào khác ngoài danh sách ở trên.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {olderDocs.map((doc) => (
                            <DocumentRow
                              key={doc._id}
                              doc={doc}
                              busy={busyDocId === doc._id}
                              onPreview={handlePreviewDoc}
                              onDownload={handleDownloadDoc}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Dòng hiển thị 1 tài liệu — dùng chung cho cả 2 danh sách ở mục "Tài liệu ôn tập".
const DocumentRow = ({ doc, busy, onPreview, onDownload }) => (
  <div className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
    <div className="flex items-start gap-3 flex-1 min-w-0">
      <div className="w-10 h-10 rounded-lg bg-[#EAF6FF] flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-[#008BC5]" />
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-[#0F172A] text-base truncate">{doc.title}</div>
        <div className="text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>{doc.topicId?.name || '—'}</span>
          <span>·</span>
          <span>Cập nhật: {formatDateTime(doc.createdAt)}</span>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
      {isPdf(doc) && (
        <button
          onClick={() => onPreview(doc)}
          disabled={busy}
          className="min-h-[44px] px-3 flex items-center gap-1.5 text-sm font-semibold text-[#008BC5] border border-[#008BC5]/40 rounded-lg hover:bg-[#EAF6FF] disabled:opacity-50 transition-colors"
        >
          <Eye className="w-4 h-4" />
          <span>Xem</span>
        </button>
      )}
      <button
        onClick={() => onDownload(doc)}
        disabled={busy}
        className="min-h-[44px] px-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        <span>Tải về</span>
      </button>
    </div>
  </div>
);