import { useState, useEffect } from 'react';
import { Users, Shield, ServerCrash, Cloud, Loader2, CheckCircle } from 'lucide-react';
import { fetchOverviewStats, triggerBackup } from '../../services/admin.service';

export const OverviewTab = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState(null);

  useEffect(() => {
    fetchOverviewStats().then(data => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupResult(null);
    try {
      const res = await triggerBackup();
      setBackupResult(res);
    } catch (err) {
      setBackupResult({ success: false, message: 'Backup thất bại' });
    } finally {
      setBackupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-pulse">
            <div className="h-10 w-10 bg-slate-200 rounded-lg mb-3"></div>
            <div className="h-4 w-24 bg-slate-200 rounded mb-2"></div>
            <div className="h-8 w-16 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-bold text-[#0F172A]">Thống kê nhanh</h3>

        {/* Backup Area */}
        <div className="flex flex-col items-end">
          <button
            onClick={handleBackup}
            disabled={backupLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#F6AD37] text-white rounded-lg font-medium hover:bg-orange-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {backupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
            <span>Backup dữ liệu</span>
          </button>
          <span className="text-xs text-slate-500 mt-1 italic">Demo: lưu tạm trên Google Drive</span>
        </div>
      </div>

      {backupResult && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${backupResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {backupResult.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <ServerCrash className="w-5 h-5 shrink-0" />}
          <div>
            <p className="font-medium">{backupResult.message}</p>
            {backupResult.downloadUrl && (
              <a href={backupResult.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline mt-1 block hover:text-green-600">
                Xem file trên Google Drive
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-[#008BC5]/10 text-[#008BC5] rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Tổng số tài khoản</p>
            <p className="text-2xl font-bold text-[#0F172A]">{stats.totalUsers}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Role: Admin / Người duyệt đề</p>
            <p className="text-2xl font-bold text-[#0F172A]">{stats.usersByRole?.admin || 0} / {stats.usersByRole?.leader || 0}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-[#22C55E]/10 text-[#22C55E] rounded-xl flex items-center justify-center">
            <ServerCrash className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Kỳ thi đang diễn ra</p>
            <p className="text-lg font-bold text-[#0F172A]">{stats.activeExams !== null ? stats.activeExams : 'Chưa có dữ liệu'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
