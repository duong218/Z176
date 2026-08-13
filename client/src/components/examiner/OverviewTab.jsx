import { useState, useEffect } from 'react';
import { BookOpen, FolderOpen, Building, FileSignature, ServerCrash } from 'lucide-react';
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
import {
  fetchQuestions,
  fetchTopics,
  fetchDepartments,
  fetchMyExamProposals,
} from '../../services/examiner.service';

// MỚI — Tab Tổng quan cho Người ra đề. Không có sẵn API tổng hợp riêng nên
// dùng lại đúng các API đã có (fetchQuestions với limit=1 chỉ để lấy
// pagination.total, fetchTopics, fetchDepartments, fetchMyExamProposals) rồi
// tự tính số liệu ở client — không bịa thêm field/API nào không tồn tại.

// Nhãn hiển thị cho trạng thái đề xuất kỳ thi — khớp đúng enum EXAM_STATUS
// thật ở server/src/models/constants.js (draft, pending_review, rejected,
// approved, published, archived).
const STATUS_META = {
  draft: { label: 'Bản nháp', color: '#64748B' },
  pending_review: { label: 'Chờ duyệt', color: '#F6AD37' },
  approved: { label: 'Đã duyệt', color: '#22C55E' },
  rejected: { label: 'Bị từ chối', color: '#E53E3E' },
  published: { label: 'Đã phát hành', color: '#008BC5' },
  archived: { label: 'Đã lưu trữ', color: '#94A3B8' },
};

function statusMeta(status) {
  return STATUS_META[status] || { label: status || 'Không rõ', color: '#94A3B8' };
}

export const OverviewTab = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    Promise.all([
      fetchQuestions({ limit: 1 }),
      fetchTopics(),
      fetchDepartments(),
      fetchMyExamProposals(),
    ])
      .then(([questionsRes, topics, departments, proposals]) => {
        if (cancelled) return;
        setData({
          totalQuestions: questionsRes?.pagination?.total ?? 0,
          totalTopics: Array.isArray(topics) ? topics.length : 0,
          totalDepartments: Array.isArray(departments) ? departments.length : 0,
          proposals: Array.isArray(proposals) ? proposals : [],
        });
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-pulse">
              <div className="h-10 w-10 bg-slate-200 rounded-lg mb-3" />
              <div className="h-4 w-24 bg-slate-200 rounded mb-2" />
              <div className="h-8 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#FEECEC] border border-[#E53E3E]/30 text-[#0F172A] rounded-lg p-4 flex items-center gap-3">
        <ServerCrash className="w-5 h-5 shrink-0 text-[#E53E3E]" />
        <p className="font-medium">Không tải được dữ liệu tổng quan. Vui lòng thử lại.</p>
      </div>
    );
  }

  // Đếm số đề xuất theo từng trạng thái, giữ thứ tự xuất hiện tự nhiên trong
  // dữ liệu thay vì áp thứ tự cố định — tránh giả định enum không chắc chắn.
  const statusCounts = data.proposals.reduce((acc, p) => {
    const key = p.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    label: statusMeta(status).label,
    color: statusMeta(status).color,
    count,
  }));
  const hasProposals = data.proposals.length > 0;

  const summaryCards = [
    { label: 'Câu hỏi trong ngân hàng', value: data.totalQuestions, icon: BookOpen, color: 'bg-[#008BC5]/10 text-[#008BC5]' },
    { label: 'Chủ đề', value: data.totalTopics, icon: FolderOpen, color: 'bg-amber-100 text-amber-600' },
    { label: 'Bộ phận / Phòng ban', value: data.totalDepartments, icon: Building, color: 'bg-purple-100 text-purple-600' },
    { label: 'Đề xuất kỳ thi đã tạo', value: data.proposals.length, icon: FileSignature, color: 'bg-[#22C55E]/10 text-[#22C55E]' },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-[#0F172A]">Thống kê nhanh</h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className="text-xl font-bold text-[#0F172A] mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* MỚI — Biểu đồ đề xuất kỳ thi theo trạng thái, giúp Người ra đề thấy
          ngay có bao nhiêu đề xuất đang chờ duyệt / đã duyệt / bị từ chối mà
          không cần mở tab "Đề xuất kỳ thi" để đếm thủ công. */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <p className="text-sm font-medium text-slate-500 mb-3">Đề xuất kỳ thi theo trạng thái</p>
        {!hasProposals ? (
          <div className="py-10 text-center text-slate-400 text-sm">Bạn chưa tạo đề xuất kỳ thi nào.</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#334155', fontSize: 13 }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#334155', fontSize: 13 }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8 }}
                  formatter={(value, _name, props) => [`${value} đề xuất`, props?.payload?.label]}
                />
                <Bar dataKey="count" name="Số đề xuất" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {chartData.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};