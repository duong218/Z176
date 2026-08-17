import { useState, useEffect } from 'react';
import { Plus, Loader2, X, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { fetchDepartments, createDepartment, updateDepartment, deleteDepartment } from '../../services/examiner.service';
import { useConfirm } from '../ConfirmDialog';

export const DepartmentTab = () => {
  const confirmAction = useConfirm();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const loadDepartments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDepartments();
      setDepartments(data);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải danh sách phòng ban');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleOpenAdd = () => {
    setEditingDepartment(null);
    setName('');
    setCode('');
    setDescription('');
    setIsOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setEditingDepartment(dept);
    setName(dept.name || '');
    setCode(dept.code || '');
    setDescription(dept.description || '');
    setIsOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      if (editingDepartment) {
        await updateDepartment(editingDepartment._id, { name, code: code.toUpperCase(), description });
      } else {
        await createDepartment({ name, code: code.toUpperCase(), description });
      }
      setIsOpen(false);
      setEditingDepartment(null);
      setName('');
      setCode('');
      setDescription('');
      await loadDepartments();
    } catch (err) {
      setError(err.message || (editingDepartment ? 'Lỗi khi cập nhật bộ phận' : 'Lỗi khi tạo phòng ban'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (dept) => {
    const ok = await confirmAction(
      `Bạn có chắc chắn muốn ngừng sử dụng bộ phận "${dept.name}"? Các câu hỏi/nhân viên đang gắn với bộ phận này sẽ không bị xóa, nhưng bộ phận sẽ không còn hiển thị để chọn nữa.`,
      { title: 'Ngừng sử dụng bộ phận', confirmLabel: 'Ngừng sử dụng' }
    );
    if (!ok) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteDepartment(dept._id);
      await loadDepartments();
    } catch (err) {
      setError(err.message || 'Lỗi khi ngừng sử dụng bộ phận');
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
        <div className="p-4 bg-[#FEECEC] border border-[#E53E3E]/30 text-[#0F172A] rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">Danh sách bộ phận / phòng ban</h3>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-[#008BC5] text-white rounded-lg font-medium hover:bg-[#007ba1] active:bg-[#007ba1] transition-colors w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          <span>Thêm bộ phận</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {departments.map(dept => (
          <div key={dept._id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex justify-between items-start gap-2 mb-2">
                <h4 className="font-bold text-slate-800 text-base">{dept.name}</h4>
                <span className="px-2 py-0.5 bg-blue-100 text-[#008BC5] rounded text-xs font-semibold uppercase">{dept.code}</span>
              </div>
              <p className="text-sm text-slate-500 line-clamp-3">{dept.description || 'Không có mô tả'}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
              <span>Trạng thái: {dept.isActive ? 'Hoạt động' : 'Tạm khóa'}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(dept)}
                  className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-[#008BC5] hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors"
                  title="Sửa bộ phận"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(dept)}
                  className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors"
                  title="Ngừng sử dụng bộ phận"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {departments.length === 0 && (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
            Chưa có bộ phận nào được tạo.
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {isOpen && (
        // Trên mobile modal trượt lên từ cạnh dưới màn hình (dễ với thao tác
        // ngón tay cái hơn là 1 hộp thoại giữa màn hình); từ sm trở lên vẫn
        // hiển thị căn giữa như cũ.
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto border border-slate-100">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0">
              <h3 className="font-bold text-lg text-[#0F172A]">{editingDepartment ? 'Sửa bộ phận' : 'Thêm bộ phận mới'}</h3>
              <button
                onClick={() => { setIsOpen(false); setEditingDepartment(null); }}
                className="text-slate-400 hover:text-slate-600 p-2 -mr-2 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Mã bộ phận (Ví dụ: XDM1)</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập mã viết tắt..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên bộ phận</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên bộ phận..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Mô tả</label>
                <textarea
                  placeholder="Nhập mô tả..."
                  rows="3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                />
              </div>
              <div className="pt-2 flex gap-3 pb-1">
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); setEditingDepartment(null); }}
                  className="flex-1 py-3 min-h-[46px] border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 min-h-[46px] bg-[#008BC5] text-white rounded-lg font-semibold hover:bg-[#007ba1] active:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 disabled:opacity-75"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingDepartment ? 'Cập nhật' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};