import { useState, useEffect } from 'react';
import { Plus, Loader2, X, AlertCircle } from 'lucide-react';
import { fetchTopics, createTopic } from '../../services/examiner.service';

export const TopicTab = ({ onViewQuestions } = {}) => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadTopics = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTopics();
      setTopics(data);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải danh sách chủ đề');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      await createTopic({ name, description });
      setIsOpen(false);
      setName('');
      setDescription('');
      await loadTopics();
    } catch (err) {
      setError(err.message || 'Lỗi khi tạo chủ đề');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-6">
          <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse"></div>
          <div className="h-10 w-32 bg-slate-200 rounded-lg animate-pulse"></div>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-pulse space-y-3">
            <div className="h-6 w-1/3 bg-slate-200 rounded"></div>
            <div className="h-4 w-2/3 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-[#0F172A]">Danh sách chủ đề</h3>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#008BC5] text-white rounded-lg font-medium hover:bg-[#007ba1] transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Thêm chủ đề</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {topics.map(topic => (
          <div key={topic._id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <h4 className="font-bold text-slate-800 text-base mb-2">{topic.name}</h4>
              <p className="text-sm text-slate-500 line-clamp-3">{topic.description || 'Không có mô tả'}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
              <span>Trạng thái: {topic.isActive ? 'Hoạt động' : 'Tạm khóa'}</span>
              {onViewQuestions && (
                <button
                  type="button"
                  onClick={() => onViewQuestions(topic._id)}
                  className="text-xs font-semibold text-[#008BC5] hover:underline"
                >
                  Xem câu hỏi →
                </button>
              )}
            </div>
          </div>
        ))}

        {topics.length === 0 && (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
            Chưa có chủ đề nào được tạo.
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-[#0F172A]">Thêm chủ đề mới</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên chủ đề</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên chủ đề..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Mô tả</label>
                <textarea
                  placeholder="Nhập mô tả..."
                  rows="3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-[#008BC5] text-white rounded-lg font-semibold hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 disabled:opacity-75"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};