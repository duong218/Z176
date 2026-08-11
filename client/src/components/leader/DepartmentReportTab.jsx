import { useState, useEffect } from 'react';
import { FileText, Building2 } from 'lucide-react';
import { fetchResultsByDepartment, exportReport } from '../../services/report.service';

export const DepartmentReportTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchResultsByDepartment();
      if (res.success) {
        const responseData = res.data || [];
        setData(Array.isArray(responseData) ? responseData : []);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err.message || 'Lỗi tải dữ liệu phòng ban');
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
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Thống kê theo Phòng ban</h2>
          <p className="text-sm text-slate-400">Chi tiết số lượng thí sinh, lượt thi và tỷ lệ đạt</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#008BC5] hover:bg-[#007AB0] text-white font-medium rounded-lg transition-colors min-touch-target"
        >
          <FileText className="w-5 h-5" />
          <span>Xuất Excel toàn bộ</span>
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-medium">Phòng ban</th>
                <th className="px-6 py-4 font-medium text-center">Số thí sinh</th>
                <th className="px-6 py-4 font-medium text-center">Số lượt nộp</th>
                <th className="px-6 py-4 font-medium text-center text-green-400">Đạt</th>
                <th className="px-6 py-4 font-medium text-center text-red-400">Không đạt</th>
                <th className="px-6 py-4 font-medium text-center">Tỷ lệ Đạt</th>
                <th className="px-6 py-4 font-medium text-center">Điểm TB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Building2 className="w-12 h-12 mb-3 text-slate-600" />
                      <p className="text-base font-medium text-slate-400">Chưa có thống kê phòng ban</p>
                      <p className="text-sm mt-1">Hiện chưa có dữ liệu kết quả thi để thống kê theo phòng ban.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-white">{item.departmentName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">{item.totalCandidates}</td>
                    <td className="px-6 py-4 text-center">{item.totalSubmissions}</td>
                    <td className="px-6 py-4 text-center font-medium text-green-400">{item.passedCount}</td>
                    <td className="px-6 py-4 text-center font-medium text-red-400">{item.failedCount}</td>
                    <td className="px-6 py-4 text-center font-medium text-emerald-400">{item.passRate}%</td>
                    <td className="px-6 py-4 text-center text-[#F6AD37]">{item.avgScore}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
