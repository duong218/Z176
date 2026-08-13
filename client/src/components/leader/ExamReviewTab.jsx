import { useState, useEffect } from 'react';
import {
  fetchPendingExams,
  fetchApprovedExams,
  fetchExamHistory,
  approveExam,
  rejectExam,
  publishExam,
  archiveExam,
} from '../../services/exam-review.service';
import { CheckCircle, XCircle, Clock, Globe, Calendar, History, Archive } from 'lucide-react';
import { useToast } from '../ToastContext';
import { useConfirm } from '../ConfirmDialog';

// Cấu hình hiển thị badge trạng thái cho bảng "Lịch sử duyệt kỳ thi"
const STATUS_BADGE = {
  rejected: { label: 'Đã từ chối', className: 'bg-[#FEECEC] text-[#C53030]' },
  published: { label: 'Đang phát hành', className: 'bg-[#008BC5]/10 text-[#008BC5]' },
  archived: { label: 'Đã lưu trữ', className: 'bg-slate-200 text-slate-600' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export const ExamReviewTab = () => {
  const { showToast } = useToast();
  const confirmAction = useConfirm();
  const [pendingExams, setPendingExams] = useState([]);
  const [approvedExams, setApprovedExams] = useState([]);
  const [historyExams, setHistoryExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archivingId, setArchivingId] = useState(null);

  // Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Approve Modal
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approveId, setApproveId] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [pending, approved, history] = await Promise.all([
        fetchPendingExams(),
        fetchApprovedExams(),
        fetchExamHistory(),
      ]);
      setPendingExams(Array.isArray(pending) ? pending : []);
      setApprovedExams(Array.isArray(approved) ? approved : []);
      setHistoryExams(Array.isArray(history) ? history : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (e) => {
    e.preventDefault();
    try {
      await approveExam(approveId, { startDate, endDate });
      setIsApproveModalOpen(false);
      setStartDate('');
      setEndDate('');
      showToast('Đã phê duyệt kỳ thi thành công.', 'success');
      loadData();
    } catch (error) {
      showToast(error.message || 'Lỗi khi duyệt kỳ thi', 'error');
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    try {
      await rejectExam(rejectId, rejectReason);
      setIsRejectModalOpen(false);
      setRejectReason('');
      showToast('Đã từ chối đề xuất kỳ thi.', 'warning');
      loadData();
    } catch (error) {
      showToast(error.message || 'Lỗi khi từ chối kỳ thi', 'error');
    }
  };

  const handlePublish = async (id) => {
    const ok = await confirmAction(
      'Bạn có chắc chắn muốn đăng chính thức kỳ thi này? Kỳ thi đang diễn ra (nếu có) sẽ bị lưu trữ.',
      { title: 'Đăng chính thức kỳ thi', confirmLabel: 'Đăng chính thức', danger: false }
    );
    if (!ok) return;
    try {
      await publishExam(id);
      showToast('Đã đăng chính thức kỳ thi.', 'success');
      loadData();
    } catch (error) {
      showToast(error.message || 'Lỗi khi đăng chính thức', 'error');
    }
  };

  const handleArchive = async (id) => {
    const ok = await confirmAction(
      'Bỏ qua kỳ thi này? Kỳ thi sẽ được lưu trữ và không thể phát hành nữa.',
      { title: 'Bỏ qua kỳ thi', confirmLabel: 'Bỏ qua' }
    );
    if (!ok) return;
    setArchivingId(id);
    try {
      await archiveExam(id);
      showToast('Đã lưu trữ kỳ thi.', 'success');
      loadData();
    } catch (error) {
      showToast(error.message || 'Lỗi khi bỏ qua kỳ thi', 'error');
    } finally {
      setArchivingId(null);
    }
  };

  const openApprove = (id) => {
    setApproveId(id);
    setIsApproveModalOpen(true);
  };

  const openReject = (id) => {
    setRejectId(id);
    setIsRejectModalOpen(true);
  };

  return (
    <div className="space-y-8 bg-white p-6 rounded-xl text-slate-800">

      {/* Pending Exams */}
      <div>
        <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#F6AD37]" />
          Đề xuất chờ duyệt
        </h2>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold">Kỳ thi</th>
                <th className="p-4 font-semibold">Chủ đề</th>
                <th className="p-4 font-semibold">Cấu trúc</th>
                <th className="p-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Đang tải...</td></tr>
              ) : pendingExams.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Không có đề xuất nào đang chờ duyệt</td></tr>
              ) : (
                pendingExams.map(exam => (
                  <tr key={exam._id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">{exam.title}</td>
                    <td className="p-4 text-slate-600">{exam.topicId?.name}</td>
                    <td className="p-4 text-slate-600 text-xs">
                      <div>Tgian: {exam.durationMinutes}p | Qua: {exam.passThresholdPercent}%</div>
                      <div>Tổng câu: {exam.totalQuestions} (Chung: {exam.commonQuestionCount}, Riêng: {exam.departmentQuestionCount})</div>
                    </td>
                    <td className="p-4 flex gap-2 justify-end">
                      <button onClick={() => openReject(exam._id)} className="px-3 py-1.5 bg-[#FEECEC] hover:bg-[#FDD8D8] text-[#C53030] font-medium rounded transition-colors flex items-center gap-1 text-xs">
                        Từ chối
                      </button>
                      <button onClick={() => openApprove(exam._id)} className="px-3 py-1.5 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#16A34A] font-medium rounded transition-colors flex items-center gap-1 text-xs">
                        Phê duyệt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approved Exams */}
      <div>
        <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-[#22C55E]" />
          Kỳ thi đã duyệt (Chờ phát hành)
        </h2>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold">Kỳ thi</th>
                <th className="p-4 font-semibold">Chủ đề</th>
                <th className="p-4 font-semibold">Thời gian diễn ra</th>
                <th className="p-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Đang tải...</td></tr>
              ) : approvedExams.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Không có kỳ thi nào đang chờ phát hành</td></tr>
              ) : (
                approvedExams.map(exam => (
                  <tr key={exam._id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-800">{exam.title}</td>
                    <td className="p-4 text-slate-600">{exam.topicId?.name}</td>
                    <td className="p-4 text-slate-600 text-xs">
                      <div>Bắt đầu: {new Date(exam.startDate).toLocaleString('vi-VN')}</div>
                      <div>Kết thúc: {new Date(exam.endDate).toLocaleString('vi-VN')}</div>
                    </td>
                    <td className="p-4 flex gap-2 justify-end items-center">
                      <button
                        onClick={() => handleArchive(exam._id)}
                        disabled={archivingId === exam._id}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded transition-colors text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {archivingId === exam._id ? 'Đang xử lý...' : 'Bỏ qua'}
                      </button>
                      <button onClick={() => handlePublish(exam._id)} className="px-3 py-1.5 bg-[#008BC5] hover:bg-sky-600 text-white font-medium rounded transition-colors flex items-center gap-1 text-xs shadow-sm">
                        <Globe className="w-3.5 h-3.5" /> Đăng chính thức
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lịch sử duyệt kỳ thi — không xóa dấu vết sau khi Duyệt/Từ chối/Đăng chính thức/Bỏ qua */}
      <div>
        <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-slate-500" />
          Lịch sử duyệt kỳ thi
        </h2>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold">Kỳ thi</th>
                <th className="p-4 font-semibold">Chủ đề</th>
                <th className="p-4 font-semibold">Trạng thái</th>
                <th className="p-4 font-semibold">Thời gian xử lý</th>
                <th className="p-4 font-semibold">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Đang tải...</td></tr>
              ) : historyExams.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Chưa có kỳ thi nào được xử lý</td></tr>
              ) : (
                historyExams.map(exam => {
                  const processedAt = exam.publishedAt || exam.approvedAt || exam.updatedAt || exam.createdAt;
                  return (
                    <tr key={exam._id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-800">{exam.title}</td>
                      <td className="p-4 text-slate-600">{exam.topicId?.name}</td>
                      <td className="p-4">
                        <StatusBadge status={exam.status} />
                      </td>
                      <td className="p-4 text-slate-600 text-xs">
                        {processedAt ? new Date(processedAt).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="p-4 text-slate-600 text-xs max-w-xs">
                        {exam.status === 'rejected' ? (
                          <span className="text-[#E53E3E]">{exam.rejectionReason || 'Không có lý do'}</span>
                        ) : exam.status === 'archived' ? (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Archive className="w-3.5 h-3.5" /> Đã bị thay thế bởi kỳ thi khác hoặc bị bỏ qua
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}

      {/* Approve Modal */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Calendar className="w-5 h-5 text-[#22C55E]" /> Cài đặt thời gian</h2>
              <button onClick={() => setIsApproveModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleApprove} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ngày bắt đầu</label>
                <input type="datetime-local" required className="w-full p-2 border border-slate-300 rounded focus:border-[#008BC5] outline-none"
                  value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ngày kết thúc</label>
                <input type="datetime-local" required className="w-full p-2 border border-slate-300 rounded focus:border-[#008BC5] outline-none"
                  value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg text-sm font-medium">Phê duyệt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><XCircle className="w-5 h-5 text-[#E53E3E]" /> Từ chối đề xuất</h2>
              <button onClick={() => setIsRejectModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleReject} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lý do từ chối</label>
                <textarea required className="w-full p-2 border border-slate-300 rounded focus:border-[#E53E3E] outline-none min-h-[100px]"
                  placeholder="Nhập lý do để Người ra đề chỉnh sửa..."
                  value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-[#E53E3E] hover:bg-[#C53030] text-white rounded-lg text-sm font-medium">Từ chối</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};