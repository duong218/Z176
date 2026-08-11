import { useState, useEffect } from 'react';
import { fetchMyExamProposals, createExamProposal, submitForReview, fetchTopics } from '../../services/examiner.service';
import { FilePlus, Send, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

export const ExamProposalTab = () => {
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

  const handleCreate = async (e) => {
    e.preventDefault();
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
      loadData();
    } catch (error) {
      alert(error.message || 'Lỗi khi tạo đề xuất');
    }
  };

  const handleSubmitReview = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn gửi đề xuất này cho Người duyệt đề duyệt?')) return;
    try {
      await submitForReview(id);
      loadData();
    } catch (error) {
      alert(error.message || 'Lỗi khi gửi duyệt');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft': return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium border border-slate-200 flex items-center gap-1"><FilePlus className="w-3 h-3" /> Nháp</span>;
      case 'pending_review': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium border border-amber-200 flex items-center gap-1"><Clock className="w-3 h-3" /> Chờ duyệt</span>;
      case 'rejected': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium border border-red-200 flex items-center gap-1"><XCircle className="w-3 h-3" /> Bị từ chối</span>;
      case 'approved': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium border border-blue-200 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Đã duyệt</span>;
      case 'published': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-medium border border-emerald-200 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Đã đăng</span>;
      case 'archived': return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium border border-gray-200">Đã lưu trữ</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">Danh sách đề xuất kỳ thi</h2>
          <p className="text-sm text-slate-500">Tạo cấu trúc đề thi và trình Người duyệt đề phê duyệt</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#008BC5] hover:bg-sky-600 text-white rounded-lg font-medium transition-colors"
        >
          <FilePlus className="w-4 h-4" /> Tạo đề xuất mới
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Đang tải...</td></tr>
              ) : exams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <FilePlus className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium text-slate-600 text-base">Chưa có đề xuất nào</p>
                    <p className="text-sm mt-1">Bấm "Tạo đề xuất mới" để bắt đầu</p>
                  </td>
                </tr>
              ) : (
                exams.map(exam => (
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
                        <div className="flex items-start gap-1 text-red-600 text-xs bg-red-50 p-2 rounded">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{exam.rejectionReason}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {(exam.status === 'draft' || exam.status === 'rejected') && (
                        <button
                          onClick={() => handleSubmitReview(exam._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-medium transition-colors"
                        >
                          <Send className="w-4 h-4" /> Gửi duyệt
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 md:p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Tạo đề xuất kỳ thi mới</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto">
              <form id="createExamForm" onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên kỳ thi</label>
                  <input required type="text" className="w-full p-2 border border-slate-300 rounded focus:border-[#008BC5] outline-none"
                    value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="VD: Hội thi chuyên môn tháng 10" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chủ đề liên kết</label>
                  <select required className="w-full p-2 border border-slate-300 rounded focus:border-[#008BC5] outline-none"
                    value={formData.topicId} onChange={e => setFormData({ ...formData, topicId: e.target.value })}>
                    <option value="">-- Chọn chủ đề --</option>
                    {topics.map(t => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút)</label>
                    <input required type="number" min="1" className="w-full p-2 border border-slate-300 rounded focus:border-[#008BC5] outline-none"
                      value={formData.durationMinutes} onChange={e => setFormData({ ...formData, durationMinutes: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tổng số câu hỏi</label>
                    <input required type="number" min="1" className="w-full p-2 border border-slate-300 rounded focus:border-[#008BC5] outline-none"
                      value={formData.totalQuestions} onChange={e => setFormData({ ...formData, totalQuestions: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số câu hỏi chung</label>
                    <input required type="number" min="0" className="w-full p-2 border border-slate-300 rounded focus:border-[#008BC5] outline-none"
                      value={formData.commonQuestionCount} onChange={e => setFormData({ ...formData, commonQuestionCount: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số câu bộ phận</label>
                    <input required type="number" min="0" className="w-full p-2 border border-slate-300 rounded focus:border-[#008BC5] outline-none"
                      value={formData.departmentQuestionCount} onChange={e => setFormData({ ...formData, departmentQuestionCount: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Điểm đạt tối thiểu (%)</label>
                  <input required type="number" min="0" max="100" className="w-full p-2 border border-slate-300 rounded focus:border-[#008BC5] outline-none"
                    value={formData.passThresholdPercent} onChange={e => setFormData({ ...formData, passThresholdPercent: e.target.value })} />
                </div>
              </form>
            </div>

            <div className="p-4 md:p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors">
                Hủy
              </button>
              <button type="submit" form="createExamForm" className="px-4 py-2 bg-[#008BC5] hover:bg-sky-600 text-white rounded-lg font-medium transition-colors">
                Lưu đề xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
