import { useState, useEffect } from 'react';
import { Users, FileText, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { fetchOverviewStats, exportReport } from '../../services/report.service';

export const OverviewTab = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await fetchOverviewStats();
      if (res.success) {
        setStats(res.data);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi tải thống kê');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportReport();
    } catch (err) {
      alert(err.message || 'Lỗi khi tải file báo cáo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-[#008BC5] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
        <p>Lỗi: {error}</p>
        <button
          onClick={loadStats}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Tổng quan kết quả thi</h2>
          <p className="text-sm text-slate-400">Số liệu tổng hợp trên toàn hệ thống</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#008BC5] hover:bg-[#007AB0] text-white font-medium rounded-lg transition-colors min-touch-target"
        >
          <FileText className="w-5 h-5" />
          <span>Xuất báo cáo (Toàn bộ)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Candidates */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Tổng số thí sinh đã thi</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.totalCandidates}</p>
            </div>
          </div>
        </div>

        {/* Total Submissions */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <FileText className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Tổng số lượt nộp bài</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.totalSubmissions}</p>
            </div>
          </div>
        </div>

        {/* Passed Count */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Số lượt Đạt</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.passedCount}</p>
            </div>
          </div>
        </div>

        {/* Failed Count */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Số lượt Không đạt</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.failedCount}</p>
            </div>
          </div>
        </div>

        {/* Pass Rate */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Tỷ lệ Đạt chung</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.passRate}%</p>
            </div>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Điểm trung bình</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.avgScore}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
