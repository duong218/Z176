import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { fetchAuditLogs } from '../../services/admin.service';

export const AuditLogTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs({ limit: 100 }).then(data => {
      const logsArray = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setLogs(logsArray);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm animate-pulse flex flex-col gap-2">
            <div className="h-4 w-1/4 bg-slate-200 rounded"></div>
            <div className="h-4 w-1/2 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="flex flex-col items-center justify-center text-slate-500">
          <Activity className="w-12 h-12 mb-3 text-slate-400" />
          <p className="text-base font-medium text-slate-600">Chưa có nhật ký nào</p>
          <p className="text-sm mt-1">Hệ thống chưa ghi nhận hoạt động nào hoặc không có dữ liệu phù hợp.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table (Hidden on Mobile) */}
      <div className="hidden sm:block overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
              <th className="p-4 font-semibold w-48">Thời gian</th>
              <th className="p-4 font-semibold w-40">Người dùng</th>
              <th className="p-4 font-semibold w-64">Hành động</th>
              <th className="p-4 font-semibold">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {logs.map(log => (
              <tr key={log._id} className="hover:bg-slate-50/50">
                <td className="p-4 text-sm text-slate-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                <td className="p-4 font-medium text-[#0F172A]">{log.actorUserId?.username || 'Hệ thống'}</td>
                <td className="p-4 text-sm font-medium">
                  <span className={`px-2 py-1 rounded text-xs ${
                    log.resourceType === 'User' ? 'bg-purple-100 text-purple-700' :
                    log.resourceType === 'Exam' ? 'bg-blue-100 text-blue-700' :
                    log.resourceType === 'Question' ? 'bg-orange-100 text-orange-700' :
                    log.resourceType === 'Topic' ? 'bg-emerald-100 text-emerald-700' :
                    log.resourceType === 'Department' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-600">{log.metadata?.detail || log.metadata?.questionId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile List (Hidden on Desktop) */}
      <div className="sm:hidden space-y-3">
        {logs.map(log => (
          <div key={log._id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex justify-between items-start gap-2">
              <span className="text-xs text-slate-500 font-medium">{formatDate(log.createdAt)}</span>
              <span className="font-bold text-[#0F172A] text-sm">{log.actorUserId?.username || 'Hệ thống'}</span>
            </div>
            <div>
              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mb-1 ${
                log.resourceType === 'User' ? 'bg-purple-100 text-purple-700' :
                log.resourceType === 'Exam' ? 'bg-blue-100 text-blue-700' :
                log.resourceType === 'Question' ? 'bg-orange-100 text-orange-700' :
                log.resourceType === 'Topic' ? 'bg-emerald-100 text-emerald-700' :
                log.resourceType === 'Department' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {log.action}
              </span>
              <p className="text-sm text-slate-600 mt-1">{log.metadata?.detail || log.metadata?.questionId || '-'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
