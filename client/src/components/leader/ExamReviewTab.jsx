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
  published: { label: 'Đang phát hành', className: 'bg-[#EAF6FF] text-[#008BC5]' },
  archived: { label: 'Đã lưu trữ', className: 'bg-[#F6F8FA] text-[#334155]' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || { label: status, className: 'bg-[#F6F8FA] text-[#334155]' };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-semibold ${cfg.className}`}>
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
    <div className="space-y-8">

      {/* Pending Exams */}
      <div>
        <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#F6AD37]" />
          Đề xuất chờ duyệt
        </h2>

        {loading ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-base text-[#64748B]">Đang tải...</div>
        ) : pendingExams.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-base text-[#64748B]">
            Không có đề xuất nào đang chờ duyệt
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#F6F8FA] text-[#334155] text-base border-b border-[#E2E8F0]">
                    <tr>
                      <th className="p-4 font-semibold">Kỳ thi</th>
                      <th className="p-4 font-semibold">Chủ đề</th>
                      <th className="p-4 font-semibold">Cấu trúc</th>
                      <th className="p-4 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-base">
                    {pendingExams.map(exam => (
                      <tr key={exam._id} className="hover:bg-[#F6F8FA] transition-colors">
                        <td className="p-4 font-medium text-[#0F172A]">{exam.title}</td>
                        <td className="p-4 text-[#334155]">{exam.topicId?.name}</td>
                        <td className="p-4 text-[#334155] text-sm">
                          <div>Tgian: {exam.durationMinutes}p | Qua: {exam.passThresholdPercent}%</div>
                          <div>Tổng câu: {exam.totalQuestions} (Chung: {exam.commonQuestionCount}, Riêng: {exam.departmentQuestionCount})</div>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => openReject(exam._id)} className="px-3 py-2 bg-[#FEECEC] hover:bg-[#FDD8D8] text-[#C53030] font-semibold rounded-lg transition-colors text-sm min-touch-target">
                              Từ chối
                            </button>
                            <button onClick={() => openApprove(exam._id)} className="px-3 py-2 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#166534] font-semibold rounded-lg transition-colors text-sm min-touch-target">
                              Phê duyệt
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden space-y-3">
              {pendingExams.map(exam => (
                <div key={exam._id} className="bg-white p-4 rounded-xl border border-[#E2E8F0] space-y-3">
                  <div>
                    <div className="font-bold text-[#0F172A] text-base">{exam.title}</div>
                    <div className="text-base text-[#64748B]">{exam.topicId?.name}</div>
                  </div>
                  <div className="text-sm text-[#334155] bg-[#F6F8FA] rounded-lg p-2.5">
                    <div>Thời gian: {exam.durationMinutes} phút · Qua: {exam.passThresholdPercent}%</div>
                    <div>Tổng câu: {exam.totalQuestions} (Chung: {exam.commonQuestionCount}, Riêng: {exam.departmentQuestionCount})</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openReject(exam._id)} className="flex-1 h-11 bg-[#FEECEC] hover:bg-[#FDD8D8] text-[#C53030] font-semibold rounded-lg transition-colors text-base min-touch-target">
                      Từ chối
                    </button>
                    <button onClick={() => openApprove(exam._id)} className="flex-1 h-11 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#166534] font-semibold rounded-lg transition-colors text-base min-touch-target">
                      Phê duyệt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Approved Exams */}
      <div>
        <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-[#22C55E]" />
          Kỳ thi đã duyệt (Chờ phát hành)
        </h2>

        {loading ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-base text-[#64748B]">Đang tải...</div>
        ) : approvedExams.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-base text-[#64748B]">
            Không có kỳ thi nào đang chờ phát hành
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#F6F8FA] text-[#334155] text-base border-b border-[#E2E8F0]">
                    <tr>
                      <th className="p-4 font-semibold">Kỳ thi</th>
                      <th className="p-4 font-semibold">Chủ đề</th>
                      <th className="p-4 font-semibold">Thời gian diễn ra</th>
                      <th className="p-4 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-base">
                    {approvedExams.map(exam => (
                      <tr key={exam._id} className="hover:bg-[#F6F8FA] transition-colors">
                        <td className="p-4 font-medium text-[#0F172A]">{exam.title}</td>
                        <td className="p-4 text-[#334155]">{exam.topicId?.name}</td>
                        <td className="p-4 text-[#334155] text-sm">
                          <div>Bắt đầu: {new Date(exam.startDate).toLocaleString('vi-VN')}</div>
                          <div>Kết thúc: {new Date(exam.endDate).toLocaleString('vi-VN')}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2 justify-end items-center">
                            <button
                              onClick={() => handleArchive(exam._id)}
                              disabled={archivingId === exam._id}
                              className="px-3 py-2 bg-[#F6F8FA] hover:bg-[#E2E8F0] text-[#334155] font-semibold rounded-lg transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed min-touch-target"
                            >
                              {archivingId === exam._id ? 'Đang xử lý...' : 'Bỏ qua'}
                            </button>
                            <button onClick={() => handlePublish(exam._id)} className="px-3 py-2 bg-[#008BC5] hover:bg-[#0693E3] text-white font-semibold rounded-lg transition-colors flex items-center gap-1.5 text-sm min-touch-target">
                              <Globe className="w-4 h-4" /> Đăng chính thức
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden space-y-3">
              {approvedExams.map(exam => (
                <div key={exam._id} className="bg-white p-4 rounded-xl border border-[#E2E8F0] space-y-3">
                  <div>
                    <div className="font-bold text-[#0F172A] text-base">{exam.title}</div>
                    <div className="text-base text-[#64748B]">{exam.topicId?.name}</div>
                  </div>
                  <div className="text-sm text-[#334155] bg-[#F6F8FA] rounded-lg p-2.5">
                    <div>Bắt đầu: {new Date(exam.startDate).toLocaleString('vi-VN')}</div>
                    <div>Kết thúc: {new Date(exam.endDate).toLocaleString('vi-VN')}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleArchive(exam._id)}
                      disabled={archivingId === exam._id}
                      className="flex-1 h-11 bg-[#F6F8FA] hover:bg-[#E2E8F0] text-[#334155] font-semibold rounded-lg transition-colors text-base disabled:opacity-60 disabled:cursor-not-allowed min-touch-target"
                    >
                      {archivingId === exam._id ? 'Đang xử lý...' : 'Bỏ qua'}
                    </button>
                    <button onClick={() => handlePublish(exam._id)} className="flex-1 h-11 bg-[#008BC5] hover:bg-[#0693E3] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 text-base min-touch-target">
                      <Globe className="w-4 h-4" /> Đăng chính thức
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lịch sử duyệt kỳ thi — không xóa dấu vết sau khi Duyệt/Từ chối/Đăng chính thức/Bỏ qua */}
      <div>
        <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-[#64748B]" />
          Lịch sử duyệt kỳ thi
        </h2>

        {loading ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-base text-[#64748B]">Đang tải...</div>
        ) : historyExams.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-base text-[#64748B]">
            Chưa có kỳ thi nào được xử lý
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#F6F8FA] text-[#334155] text-base border-b border-[#E2E8F0]">
                    <tr>
                      <th className="p-4 font-semibold">Kỳ thi</th>
                      <th className="p-4 font-semibold">Chủ đề</th>
                      <th className="p-4 font-semibold">Trạng thái</th>
                      <th className="p-4 font-semibold">Thời gian xử lý</th>
                      <th className="p-4 font-semibold">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-base">
                    {historyExams.map(exam => {
                      const processedAt = exam.publishedAt || exam.approvedAt || exam.updatedAt || exam.createdAt;
                      return (
                        <tr key={exam._id} className="hover:bg-[#F6F8FA] transition-colors">
                          <td className="p-4 font-medium text-[#0F172A]">{exam.title}</td>
                          <td className="p-4 text-[#334155]">{exam.topicId?.name}</td>
                          <td className="p-4">
                            <StatusBadge status={exam.status} />
                          </td>
                          <td className="p-4 text-[#334155] text-sm">
                            {processedAt ? new Date(processedAt).toLocaleString('vi-VN') : '—'}
                          </td>
                          <td className="p-4 text-sm max-w-xs">
                            {exam.status === 'rejected' ? (
                              <span className="text-[#C53030]">{exam.rejectionReason || 'Không có lý do'}</span>
                            ) : exam.status === 'archived' ? (
                              <span className="flex items-center gap-1 text-[#64748B]">
                                <Archive className="w-4 h-4" /> Đã bị thay thế bởi kỳ thi khác hoặc bị bỏ qua
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden space-y-3">
              {historyExams.map(exam => {
                const processedAt = exam.publishedAt || exam.approvedAt || exam.updatedAt || exam.createdAt;
                return (
                  <div key={exam._id} className="bg-white p-4 rounded-xl border border-[#E2E8F0] space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-[#0F172A] text-base">{exam.title}</div>
                        <div className="text-base text-[#64748B]">{exam.topicId?.name}</div>
                      </div>
                      <StatusBadge status={exam.status} />
                    </div>
                    <div className="text-sm text-[#64748B]">
                      {processedAt ? new Date(processedAt).toLocaleString('vi-VN') : '—'}
                    </div>
                    {exam.status === 'rejected' && (
                      <div className="text-sm text-[#C53030] bg-[#FEECEC] rounded-lg p-2.5">
                        Lý do: {exam.rejectionReason || 'Không có lý do'}
                      </div>
                    )}
                    {exam.status === 'archived' && (
                      <div className="flex items-center gap-1.5 text-sm text-[#64748B]">
                        <Archive className="w-4 h-4 shrink-0" /> Đã bị thay thế bởi kỳ thi khác hoặc bị bỏ qua
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modals */}

      {/* Approve Modal */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden" style={{ boxShadow: '0px 1px 3px rgba(15,23,42,0.08)' }}>
            <div className="p-4 border-b border-[#E2E8F0] bg-[#F6F8FA] flex justify-between items-center">
              <h2 className="font-bold text-[#0F172A] text-base flex items-center gap-2"><Calendar className="w-5 h-5 text-[#22C55E]" /> Cài đặt thời gian</h2>
              <button onClick={() => setIsApproveModalOpen(false)} className="text-[#64748B] hover:text-[#334155] min-touch-target flex items-center justify-center"><XCircle className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleApprove} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1">Ngày bắt đầu</label>
                <input type="datetime-local" required className="w-full h-12 px-3 border border-[#E2E8F0] rounded-[10px] text-base text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0693E3] focus:border-[#008BC5]"
                  value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1">Ngày kết thúc</label>
                <input type="datetime-local" required className="w-full h-12 px-3 border border-[#E2E8F0] rounded-[10px] text-base text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0693E3] focus:border-[#008BC5]"
                  value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsApproveModalOpen(false)} className="px-4 h-12 bg-[#F6F8FA] text-[#334155] rounded-[10px] text-base font-semibold min-touch-target">Hủy</button>
                <button type="submit" className="px-4 h-12 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-[10px] text-base font-semibold min-touch-target">Phê duyệt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden" style={{ boxShadow: '0px 1px 3px rgba(15,23,42,0.08)' }}>
            <div className="p-4 border-b border-[#E2E8F0] bg-[#F6F8FA] flex justify-between items-center">
              <h2 className="font-bold text-[#0F172A] text-base flex items-center gap-2"><XCircle className="w-5 h-5 text-[#E53E3E]" /> Từ chối đề xuất</h2>
              <button onClick={() => setIsRejectModalOpen(false)} className="text-[#64748B] hover:text-[#334155] min-touch-target flex items-center justify-center"><XCircle className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleReject} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1">Lý do từ chối</label>
                <textarea required className="w-full p-3 border border-[#E2E8F0] rounded-[10px] text-base text-[#0F172A] min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#0693E3] focus:border-[#E53E3E]"
                  placeholder="Nhập lý do để Người ra đề chỉnh sửa..."
                  value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsRejectModalOpen(false)} className="px-4 h-12 bg-[#F6F8FA] text-[#334155] rounded-[10px] text-base font-semibold min-touch-target">Hủy</button>
                <button type="submit" className="px-4 h-12 bg-[#E53E3E] hover:bg-[#C53030] text-white rounded-[10px] text-base font-semibold min-touch-target">Từ chối</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};