import { useState, useEffect } from 'react';
import { Users, FileCheck2, CheckCircle2, XCircle, ServerCrash } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fetchOverviewStats } from '../../services/report.service';

// Tab Tổng quan cho Người duyệt đề (leader). Dùng đúng API /reports/overview
// (report.service.js -> fetchOverviewStats), trả về:
// { totalSubmissions, totalCandidates, passedCount, failedCount, passRate, avgScore }
// — khớp đúng reportService.getOverviewStats() ở server, không bịa field nào khác.
//
// SỬA LỖI: file này trước đây bị copy nhầm nội dung của
// components/examiner/OverviewTab.jsx (gọi fetchQuestions/fetchTopics/
// fetchDepartments/fetchMyExamProposals từ examiner.service.js), khiến
// Leader dashboard gọi nhầm các API chỉ dành cho role examiner -> 403.

const PASS_COLOR = '#22C55E';
const FAIL_COLOR = '#E53E3E';

export const OverviewTab = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchOverviewStats()
      .then((res) => {
        if (cancelled) return;
        if (res?.success) {
          setStats(res.data);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadData = () => {
    setLoading(true);
    setError(false);
    fetchOverviewStats()
      .then((res) => {
        if (res?.success) {
          setStats(res.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-40 bg-slate-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800 p-5 rounded-xl border border-slate-700 animate-pulse">
              <div className="h-10 w-10 bg-slate-700 rounded-lg mb-3" />
              <div className="h-4 w-24 bg-slate-700 rounded mb-2" />
              <div className="h-8 w-16 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
        <div className="flex items-center gap-3">
          <ServerCrash className="w-5 h-5 shrink-0" />
          <p className="font-medium">Không tải được dữ liệu tổng quan. Vui lòng thử lại.</p>
        </div>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const hasSubmissions = stats.totalSubmissions > 0;
  const pieData = [
    { name: 'Đạt', value: stats.passedCount, color: PASS_COLOR },
    { name: 'Không đạt', value: stats.failedCount, color: FAIL_COLOR },
  ];

  const summaryCards = [
    { label: 'Tổng số thí sinh', value: stats.totalCandidates, icon: Users, color: 'bg-[#008BC5]/10 text-[#008BC5]' },
    { label: 'Tổng lượt nộp bài', value: stats.totalSubmissions, icon: FileCheck2, color: 'bg-purple-500/10 text-purple-400' },
    { label: 'Số lượt Đạt', value: stats.passedCount, icon: CheckCircle2, color: 'bg-[#22C55E]/10 text-[#22C55E]' },
    { label: 'Số lượt Không đạt', value: stats.failedCount, icon: XCircle, color: 'bg-[#E53E3E]/10 text-[#E53E3E]' },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white">Thống kê nhanh</h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-400 font-medium">{label}</p>
            <p className="text-xl font-bold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Biểu đồ tròn Đạt/Không đạt */}
        <div className="lg:col-span-2 bg-slate-800 p-5 rounded-xl border border-slate-700">
          <p className="text-sm font-medium text-slate-400 mb-3">Tỷ lệ Đạt / Không đạt</p>
          {!hasSubmissions ? (
            <div className="py-10 text-center text-slate-500 text-sm">Chưa có dữ liệu kết quả thi.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#E2E8F0' }}
                    formatter={(value, name) => [`${value} lượt`, name]}
                  />
                  <Legend wrapperStyle={{ color: '#CBD5E1', fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chỉ số phụ: tỷ lệ đạt % + điểm trung bình */}
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex flex-col justify-center gap-6">
          <div>
            <p className="text-xs text-slate-400 font-medium">Tỷ lệ Đạt</p>
            <p className="text-3xl font-bold text-[#22C55E] mt-1">{stats.passRate}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Điểm trung bình</p>
            <p className="text-3xl font-bold text-[#F6AD37] mt-1">{stats.avgScore}</p>
          </div>
        </div>
      </div>
    </div>
  );
};