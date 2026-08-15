import { useState, useEffect } from 'react';
import { FileText, Search, Filter, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { fetchDetailedResults, exportReport } from '../../services/report.service';
import { grantExtraAttempt } from '../../services/exam-review.service';
import { useToast } from '../ToastContext';
import { useConfirm } from '../ConfirmDialog';

export const DetailedResultsTab = () => {
  const { showToast } = useToast();
  const confirmAction = useConfirm();
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grantingId, setGrantingId] = useState(null);

  const [filters, setFilters] = useState({
    search: '',
    passed: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (page = 1) => {
    try {
      setLoading(true);
      const res = await fetchDetailedResults({ ...filters, page, limit: pagination.limit });
      if (res.success) {
        const responseData = res.data?.data || res.data || [];
        setData(Array.isArray(responseData) ? responseData : []);
        setPagination(res.data?.pagination || res.pagination || { page: 1, limit: 10, totalPages: 1, total: 0 });
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi tải kết quả chi tiết');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = (e) => {
    e.preventDefault();
    loadData(1);
  };

  const handleExport = async () => {
    try {
      await exportReport(filters);
    } catch (err) {
      showToast(err.message || 'Lỗi khi xuất file Excel', 'error');
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadData(newPage);
    }
  };

  // MỚI — Cấp thêm 1 lượt thi chính thức cho thí sinh đã thi (mở lại lượt thi
  // để họ thi lại). Không xóa/reset kết quả cũ, chỉ cấp thêm quyền làm 1 lượt
  // mới; thí sinh tự đăng nhập và bấm "Bắt đầu thi" như bình thường.
  const handleGrantExtraAttempt = async (item) => {
    if (!item.examCandidateId) {
      showToast('Thiếu thông tin thí sinh, không thể cấp lại lượt thi.', 'error');
      return;
    }
    const ok = await confirmAction(
      `Cấp thêm 1 lượt thi chính thức cho "${item.employeeName}" (bài thi: ${item.examTitle})? Thí sinh sẽ có thể đăng nhập và làm lại bài thi này.`,
      { title: 'Cấp lại lượt thi', confirmLabel: 'Cấp lượt thi', danger: false }
    );
    if (!ok) return;

    setGrantingId(item._id);
    try {
      await grantExtraAttempt(item.examCandidateId);
      showToast(`Đã cấp thêm lượt thi cho ${item.employeeName}.`, 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi khi cấp lại lượt thi', 'error');
    } finally {
      setGrantingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Kết quả chi tiết</h2>
          <p className="text-sm text-slate-400">Danh sách các bài thi đã nộp</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#008BC5] hover:bg-[#007AB0] text-white font-medium rounded-lg transition-colors min-touch-target"
        >
          <FileText className="w-5 h-5" />
          <span>Xuất Excel theo bộ lọc</span>
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <form onSubmit={applyFilters} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Tìm kiếm theo họ tên thí sinh..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#008BC5] transition-colors"
            />
          </div>
          <div className="w-full md:w-48">
            <select
              name="passed"
              value={filters.passed}
              onChange={handleFilterChange}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-[#008BC5] transition-colors"
            >
              <option value="">Tất cả kết quả</option>
              <option value="true">Đạt</option>
              <option value="false">Không đạt</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-[#008BC5]"
            />
            <span className="text-slate-500">-</span>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-[#008BC5]"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Lọc
          </button>
        </form>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-slate-700 border-t-[#008BC5] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400">
            <p>Lỗi: {error}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-medium">Họ và tên</th>
                    <th className="px-6 py-4 font-medium">Phòng ban</th>
                    <th className="px-6 py-4 font-medium">Bài thi</th>
                    <th className="px-6 py-4 font-medium text-center">Điểm</th>
                    <th className="px-6 py-4 font-medium text-center">Kết quả</th>
                    <th className="px-6 py-4 font-medium">Ngày nộp</th>
                    <th className="px-6 py-4 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <FileText className="w-12 h-12 mb-3 text-slate-600" />
                          <p className="text-base font-medium text-slate-400">Chưa có kết quả thi nào</p>
                          <p className="text-sm mt-1">Hệ thống chưa ghi nhận bài làm nào phù hợp với bộ lọc hiện tại.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{item.employeeName}</td>
                        <td className="px-6 py-4">{item.departmentName}</td>
                        <td className="px-6 py-4">{item.examTitle}</td>
                        <td className="px-6 py-4 text-center font-bold text-[#F6AD37]">{item.score}</td>
                        <td className="px-6 py-4 text-center">
                          {item.passed ? (
                            <span className="px-2 py-1 bg-[#22C55E]/10 text-[#22C55E] rounded-md text-xs font-semibold">ĐẠT</span>
                          ) : (
                            <span className="px-2 py-1 bg-[#E53E3E]/10 text-[#E53E3E] rounded-md text-xs font-semibold">KHÔNG ĐẠT</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {item.submittedAt ? new Date(item.submittedAt).toLocaleString('vi-VN') : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleGrantExtraAttempt(item)}
                            disabled={grantingId === item._id}
                            title="Mở lại lượt thi cho thí sinh này"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#008BC5]/10 hover:bg-[#008BC5]/20 text-[#008BC5] font-medium rounded-lg transition-colors text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {grantingId === item._id ? 'Đang cấp...' : 'Cấp lại lượt thi'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Trang {pagination.page} / {pagination.totalPages} (Tổng số {pagination.total} bản ghi)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="p-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="p-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};