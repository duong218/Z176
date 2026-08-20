import { useState, useEffect } from 'react';
import { fetchMyExamProposals, createExamProposal, submitForReview, fetchTopics, fetchQuestionStatsByTopic } from '../../services/examiner.service';
import { FilePlus, Send, AlertCircle, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../ToastContext';
import { useConfirm } from '../ConfirmDialog';

export const ExamProposalTab = () => {
  const { showToast } = useToast();
  const confirmAction = useConfirm();
  const [exams, setExams] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    topicId: '',
    durationMinutes: 30,
    totalQuestions: 20,
    commonQuestionCount: 10,
    departmentQuestionCount: 10,
    passThresholdPercent: 70,
  });

  // Thống kê số câu hỏi (chung + riêng theo từng bộ phận) của chủ đề đang
  // chọn trong form — dùng để hiển thị gợi ý và validate ngay trên UI, tránh
  // để tới lúc Người duyệt đề publish mới phát hiện thiếu câu hỏi.
  const [topicStats, setTopicStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!formData.topicId) {
      setTopicStats(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    fetchQuestionStatsByTopic(formData.topicId)
      .then((data) => { if (!cancelled) setTopicStats(data); })
      .catch(() => { if (!cancelled) setTopicStats(null); })
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, [formData.topicId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [examsData, topicsData] = await Promise.all([
        fetchMyExamProposals(),
        fetchTopics()
      ]);
      setExams(Array.isArray(examsData) ? examsData : []);
      setTopics(Array.isArray(topicsData) ? topicsData : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Tính trước xem cấu hình (commonQuestionCount/departmentQuestionCount) có
  // khả thi không, THEO ĐÚNG công thức bù mà backend
  // (exam-code-generation.service.js) đang dùng: nếu 1 bộ phận thiếu câu
  // riêng, phần thiếu sẽ được bù từ pool câu chung. Chỉ thật sự KHÔNG khả
  // thi nếu pool chung không đủ để bù cho bộ phận đó.
  const commonCount = topicStats?.commonCount ?? 0;
  const common = Number(formData.commonQuestionCount) || 0;
  const perDept = Number(formData.departmentQuestionCount) || 0;
  const total = Number(formData.totalQuestions) || 0;

  const commonExceedsPool = common > commonCount;
  const sumMismatch = formData.topicId && common + perDept !== total;

  const infeasibleDepartments = (topicStats?.departments ?? [])
    .map((d) => {
      const shortfall = Math.max(0, perDept - d.count);
      const neededCommon = common + shortfall;
      return { ...d, shortfall, neededCommon, infeasible: neededCommon > commonCount };
    })
    .filter((d) => d.shortfall > 0);

  const hasBlockingError =
    !!formData.topicId &&
    (commonExceedsPool || sumMismatch || infeasibleDepartments.some((d) => d.infeasible));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (hasBlockingError) {
      showToast('Cấu hình số câu hỏi chưa hợp lệ so với ngân hàng câu hỏi hiện có của chủ đề này. Vui lòng kiểm tra lại phần cảnh báo trong form.', 'warning');
      return;
    }
    try {
      await createExamProposal({
        ...formData,
        durationMinutes: Number(formData.durationMinutes),
        totalQuestions: Number(formData.totalQuestions),
        commonQuestionCount: Number(formData.commonQuestionCount),
        departmentQuestionCount: Number(formData.departmentQuestionCount),
        passThresholdPercent: Number(formData.passThresholdPercent),
      });
      setIsModalOpen(false);
      showToast('Đã tạo đề xuất kỳ thi thành công.', 'success');
      loadData();
    } catch (error) {
      showToast(error.message || 'Lỗi khi tạo đề xuất', 'error');
    }
  };

  const handleSubmitReview = async (id) => {
    const ok = await confirmAction(
      'Bạn có chắc chắn muốn gửi đề xuất này cho Người duyệt đề duyệt?',
      { title: 'Gửi duyệt đề xuất', confirmLabel: 'Gửi duyệt', danger: false }
    );
    if (!ok) return;
    try {
      await submitForReview(id);
      showToast('Đã gửi đề xuất cho Người duyệt đề.', 'success');
      loadData();
    } catch (error) {
      showToast(error.message || 'Lỗi khi gửi duyệt', 'error');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft': return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium border border-slate-200 flex items-center gap-1"><FilePlus className="w-3 h-3" /> Nháp</span>;
      case 'pending_review': return <span className="bg-[#FFFBEB] text-[#B45309] px-2 py-1 rounded text-xs font-medium border border-[#F6AD37]/40 flex items-center gap-1"><Clock className="w-3 h-3" /> Chờ duyệt</span>;
      case 'rejected': return <span className="bg-[#FEECEC] text-[#C53030] px-2 py-1 rounded text-xs font-medium border border-[#E53E3E]/30 flex items-center gap-1"><XCircle className="w-3 h-3" /> Bị từ chối</span>;
      case 'approved': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium border border-blue-200 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Đã duyệt</span>;
      case 'published': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-medium border border-emerald-200 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Đã đăng</span>;
      case 'archived': return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium border border-gray-200">Đã lưu trữ</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* MỚI — animate-fade-in-up: đồng bộ hiệu ứng xuất hiện khi tab vừa tải
          xong, cùng pattern với AccountTab.jsx / AuditLogTab.jsx bên Admin. */}
      <div className="animate-fade-in-up flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm" style={{ '--stagger-delay': '0ms' }}>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">Danh sách đề xuất kỳ thi</h2>
          <p className="text-sm text-slate-500">Tạo cấu trúc đề thi và trình Người duyệt đề phê duyệt</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-[#008BC5] hover:bg-sky-600 active:bg-sky-600 text-white rounded-lg font-medium transition-colors w-full sm:w-auto"
        >
          <FilePlus className="w-4 h-4" /> Tạo đề xuất mới
        </button>
      </div>

      {/* Trên mobile dùng danh sách dạng thẻ (dễ đọc, không phải cuộn ngang);
          từ md trở lên vẫn dùng bảng như cũ vì màn hình đủ rộng. */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500 text-sm">
          Đang tải...
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 sm:p-12 text-center text-slate-500">
          <FilePlus className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-600 text-base">Chưa có đề xuất nào</p>
          <p className="text-sm mt-1">Bấm "Tạo đề xuất mới" để bắt đầu</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="animate-fade-in-up md:hidden space-y-3" style={{ '--stagger-delay': '80ms' }}>
            {exams.map(exam => (
              <div key={exam._id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 text-base leading-snug break-words">{exam.title}</h3>
                    <p className="text-sm text-slate-500 mt-0.5 break-words">{exam.topicId?.name}</p>
                  </div>
                  <div className="shrink-0">{getStatusBadge(exam.status)}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-lg p-2.5 text-xs text-slate-600">
                  <div>
                    <div className="font-semibold text-slate-800">{exam.durationMinutes}p</div>
                    <div>Thời gian</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{exam.totalQuestions}</div>
                    <div>Tổng câu</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{exam.commonQuestionCount}/{exam.departmentQuestionCount}</div>
                    <div>Chung/Riêng</div>
                  </div>
                </div>

                {exam.status === 'rejected' && exam.rejectionReason && (
                  <div className="flex items-start gap-1.5 text-[#C53030] text-xs bg-[#FEECEC] p-2.5 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{exam.rejectionReason}</span>
                  </div>
                )}

                {(exam.status === 'draft' || exam.status === 'rejected') && (
                  <button
                    onClick={() => handleSubmitReview(exam._id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-[#FFFBEB] hover:bg-[#FDECC8] active:bg-[#FDECC8] text-[#92400E] rounded-lg font-medium transition-colors"
                  >
                    <Send className="w-4 h-4" /> Gửi duyệt
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop / tablet table */}
          <div className="animate-fade-in-up hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" style={{ '--stagger-delay': '80ms' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                    <th className="p-4 font-semibold">Tên kỳ thi</th>
                    <th className="p-4 font-semibold">Chủ đề</th>
                    <th className="p-4 font-semibold">Cấu trúc</th>
                    <th className="p-4 font-semibold">Trạng thái</th>
                    <th className="p-4 font-semibold">Ghi chú</th>
                    <th className="p-4 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {exams.map(exam => (
                    <tr key={exam._id} className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-800">{exam.title}</td>
                      <td className="p-4 text-slate-600">{exam.topicId?.name}</td>
                      <td className="p-4 text-slate-600 text-xs">
                        <div>Thời gian: {exam.durationMinutes}p</div>
                        <div>Tổng câu: {exam.totalQuestions}</div>
                        <div>Chung: {exam.commonQuestionCount} / Riêng: {exam.departmentQuestionCount}</div>
                      </td>
                      <td className="p-4">{getStatusBadge(exam.status)}</td>
                      <td className="p-4 text-slate-600">
                        {exam.status === 'rejected' && (
                          <div className="flex items-start gap-1 text-[#C53030] text-xs bg-[#FEECEC] p-2 rounded">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{exam.rejectionReason}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {(exam.status === 'draft' || exam.status === 'rejected') && (
                          <button
                            onClick={() => handleSubmitReview(exam._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFBEB] hover:bg-[#FDECC8] text-[#92400E] rounded font-medium transition-colors"
                          >
                            <Send className="w-4 h-4" /> Gửi duyệt
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Tạo đề xuất kỳ thi mới</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 -mr-2 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto">
              <form id="createExamForm" onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên kỳ thi</label>
                  <input required type="text" className="w-full p-2.5 text-base border border-slate-300 rounded-lg focus:border-[#008BC5] outline-none"
                    value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="VD: Hội thi chuyên môn tháng 10" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chủ đề liên kết</label>
                  <select required className="w-full p-2.5 text-base border border-slate-300 rounded-lg focus:border-[#008BC5] outline-none bg-white"
                    value={formData.topicId} onChange={e => setFormData({ ...formData, topicId: e.target.value })}>
                    <option value="">-- Chọn chủ đề --</option>
                    {topics.map(t => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {formData.topicId && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                    {statsLoading ? (
                      <p className="text-slate-500">Đang tải số liệu ngân hàng câu hỏi...</p>
                    ) : topicStats ? (
                      <>
                        <p className="font-semibold text-slate-700">
                          Ngân hàng câu hỏi của chủ đề này: <span className="text-[#008BC5]">{topicStats.commonCount} câu chung</span>
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
                          {topicStats.departments.map((d) => (
                            <div key={d.departmentId} className="flex justify-between text-slate-600">
                              <span className="truncate" title={d.name}>{d.name}</span>
                              <span className="font-semibold ml-1">{d.count}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-slate-400 italic">
                          Nếu bộ phận nào thiếu câu riêng, hệ thống sẽ tự động bù thêm từ pool câu chung khi phát hành đề — miễn pool chung còn đủ dư.
                        </p>
                      </>
                    ) : (
                      <p className="text-[#E53E3E]">Không tải được số liệu câu hỏi cho chủ đề này.</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút)</label>
                    <input required type="number" min="1" inputMode="numeric" className="w-full p-2.5 text-base border border-slate-300 rounded-lg focus:border-[#008BC5] outline-none"
                      value={formData.durationMinutes} onChange={e => setFormData({ ...formData, durationMinutes: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tổng số câu hỏi</label>
                    <input required type="number" min="1" inputMode="numeric" className="w-full p-2.5 text-base border border-slate-300 rounded-lg focus:border-[#008BC5] outline-none"
                      value={formData.totalQuestions} onChange={e => setFormData({ ...formData, totalQuestions: e.target.value })} />
                  </div>
                </div>
                {sumMismatch && (
                  <p className="text-xs text-[#C53030] flex items-center gap-1 -mt-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Số câu chung + số câu bộ phận ({common + perDept}) phải bằng đúng Tổng số câu hỏi ({total}).
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số câu hỏi chung</label>
                    <input required type="number" min="0" inputMode="numeric" className="w-full p-2.5 text-base border border-slate-300 rounded-lg focus:border-[#008BC5] outline-none"
                      value={formData.commonQuestionCount} onChange={e => setFormData({ ...formData, commonQuestionCount: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số câu bộ phận</label>
                    <input required type="number" min="0" inputMode="numeric" className="w-full p-2.5 text-base border border-slate-300 rounded-lg focus:border-[#008BC5] outline-none"
                      value={formData.departmentQuestionCount} onChange={e => setFormData({ ...formData, departmentQuestionCount: e.target.value })} />
                  </div>
                </div>

                {formData.topicId && topicStats && (
                  <>
                    {commonExceedsPool && (
                      <p className="text-xs text-[#C53030] flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Số câu chung ({common}) vượt quá số câu chung hiện có ({commonCount}) của chủ đề này.
                      </p>
                    )}
                    {infeasibleDepartments.length > 0 && (
                      <div className="space-y-1">
                        {infeasibleDepartments.map((d) => (
                          <p key={d.departmentId} className={`text-xs flex items-center gap-1 ${d.infeasible ? 'text-[#C53030]' : 'text-[#B45309]'}`}>
                            {d.infeasible ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                            {d.name}: chỉ có {d.count}/{perDept} câu riêng
                            {d.infeasible
                              ? ` — kể cả bù từ pool chung cũng không đủ (cần bù ${d.shortfall} câu nhưng pool chung chỉ có ${commonCount} câu, cần ${d.neededCommon} câu).`
                              : ` — sẽ tự bù ${d.shortfall} câu từ pool chung (đủ khả thi).`}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Điểm đạt tối thiểu (%)</label>
                  <input required type="number" min="0" max="100" inputMode="numeric" className="w-full p-2.5 text-base border border-slate-300 rounded-lg focus:border-[#008BC5] outline-none"
                    value={formData.passThresholdPercent} onChange={e => setFormData({ ...formData, passThresholdPercent: e.target.value })} />
                </div>
              </form>
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-3 min-h-[46px] bg-slate-200 hover:bg-slate-300 active:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors">
                Hủy
              </button>
              <button type="submit" form="createExamForm" disabled={hasBlockingError}
                className="px-4 py-3 min-h-[46px] bg-[#008BC5] hover:bg-sky-600 active:bg-sky-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#008BC5]">
                Lưu đề xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};