import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Lock, Unlock, KeyRound, Loader2, X, Eye, Copy, Check, Upload, FileSpreadsheet, AlertTriangle, Columns3, ChevronDown } from 'lucide-react';
import { fetchUsers, fetchRoles, createUser, updateUserRole, toggleUserLock, resetUserPassword, importEmployeesExcel, downloadImportResultsCsv } from '../../services/admin.service';
import { apiRequest } from '../../services/api';
import { getAuthHeaders } from '../../services/auth.service';
import { useToast } from '../ToastContext';
import { useConfirm } from '../ConfirmDialog';

// Danh sách cột có thể hiển thị trong bảng tài khoản. `alwaysOn` = cột lõi
// không cho ẩn (Username, Phân quyền, Trạng thái, Hành động). Các cột còn
// lại lấy từ hồ sơ nhân viên (Employee) — có thể trống nếu tài khoản không
// phải role 'candidate' hoặc chưa được import kèm dữ liệu đó.
const ACCOUNT_COLUMNS = [
  { key: 'fullname', label: 'Họ tên' },
  { key: 'employeeCode', label: 'Mã NV' },
  { key: 'departmentName', label: 'Phòng ban' },
  { key: 'dob', label: 'Ngày sinh' },
  { key: 'gender', label: 'Giới tính' },
  { key: 'phone', label: 'SĐT' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'position', label: 'Chức vụ' },
];

const ACCOUNT_COLUMNS_STORAGE_KEY = 'z176_account_table_columns';

// TODO: nếu dự án đã có department.service.js riêng, thay hàm tạm này bằng
// import fetchDepartments từ đó để đồng nhất convention thay vì gọi apiRequest trực tiếp ở đây.
async function fetchDepartments() {
  const res = await apiRequest('/departments', { headers: getAuthHeaders() });
  return res.data;
}

export const AccountTab = ({ currentUser }) => {
  const { showToast } = useToast();
  const confirmAction = useConfirm();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Cột hiển thị trong bảng — nhớ lựa chọn của người dùng giữa các lần vào
  // lại trang (localStorage), mặc định hiện tất cả cột.
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ACCOUNT_COLUMNS_STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        return { ...Object.fromEntries(ACCOUNT_COLUMNS.map((c) => [c.key, true])), ...saved };
      }
    } catch {
      /* ignore parse error, dùng mặc định */
    }
    return Object.fromEntries(ACCOUNT_COLUMNS.map((c) => [c.key, true]));
  });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(ACCOUNT_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    if (!isColumnMenuOpen) return;
    const handleClickOutside = (e) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target)) {
        setIsColumnMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isColumnMenuOpen]);

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeColumns = ACCOUNT_COLUMNS.filter((c) => visibleColumns[c.key]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  // Chỉ dùng khi role được chọn là 'candidate' (thí sinh) — Employee đi kèm User.
  const [newFullname, setNewFullname] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [newEmployeeCode, setNewEmployeeCode] = useState('');

  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState('');

  // Password Reveal Modal
  const [tempPasswordModal, setTempPasswordModal] = useState({
    isOpen: false,
    title: '',
    username: '',
    password: ''
  });
  const [copied, setCopied] = useState(false);

  // Import Excel (bulk) state
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null); // { total, created, updated, failed, results }
  const fileInputRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, rolesData, departmentsData] = await Promise.all([
        fetchUsers(),
        fetchRoles(),
        fetchDepartments().catch(() => []), // không chặn cả trang nếu API department lỗi
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
    } catch (err) {
      showToast(err.message || 'Lỗi khi tải danh sách dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Xác định role đang chọn trong form tạo tài khoản có phải 'candidate' (thí sinh) không —
  // dùng để hiện/ẩn nhóm field Họ tên/Mã NV/Phòng ban.
  const isCandidateRoleSelected = roles.some(
    (r) => r._id === newRoleId && r.code === 'candidate',
  );

  const resetCreateForm = () => {
    setNewUsername('');
    setNewRoleId('');
    setNewFullname('');
    setNewDepartmentId('');
    setNewEmployeeCode('');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newRoleId) return;
    if (isCandidateRoleSelected && (!newFullname.trim() || !newDepartmentId)) {
      showToast('Tài khoản thí sinh bắt buộc phải có Họ tên và Phòng ban.', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      const employeeInfo = isCandidateRoleSelected
        ? {
            fullname: newFullname.trim(),
            departmentId: newDepartmentId,
            employeeCode: newEmployeeCode.trim() || undefined,
          }
        : undefined;

      const res = await createUser(newUsername, newRoleId, employeeInfo);
      setIsCreateOpen(false);
      resetCreateForm();
      // Reload table
      await loadData();
      // Show temporary password
      setTempPasswordModal({
        isOpen: true,
        title: 'Tài khoản được tạo thành công!',
        username: res.data.username,
        password: res.tempPassword
      });
    } catch (err) {
      showToast(err.message || 'Không thể tạo tài khoản', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!editingUser || !editingRoleId) return;
    setActionLoading(true);
    try {
      await updateUserRole(editingUser._id, editingRoleId);
      setIsEditRoleOpen(false);
      setEditingUser(null);
      setEditingRoleId('');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Không thể đổi quyền', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleLock = async (user) => {
    const actionText = user.isActive ? 'Khóa' : 'Mở khóa';
    const ok = await confirmAction(
      `Bạn có chắc chắn muốn ${actionText.toLowerCase()} tài khoản "${user.username}"?`,
      { title: `${actionText} tài khoản`, confirmLabel: actionText, danger: user.isActive }
    );
    if (!ok) return;
    setActionLoading(true);
    try {
      await toggleUserLock(user._id, !user.isActive);
      await loadData();
    } catch (err) {
      showToast(err.message || `Lỗi khi ${actionText.toLowerCase()} tài khoản`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (user) => {
    const ok = await confirmAction(
      `Bạn có chắc chắn muốn reset mật khẩu tài khoản "${user.username}"? Mật khẩu mới sẽ được sinh ngẫu nhiên.`,
      { title: 'Reset mật khẩu', confirmLabel: 'Reset', danger: false }
    );
    if (!ok) return;
    setActionLoading(true);
    try {
      const tempPass = await resetUserPassword(user._id);
      setTempPasswordModal({
        isOpen: true,
        title: 'Đã reset mật khẩu thành công!',
        username: user.username,
        password: tempPass
      });
    } catch (err) {
      showToast(err.message || 'Lỗi khi reset mật khẩu', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tempPasswordModal.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Import Excel hàng loạt nhân viên (role candidate) — xem admin.service.js
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const data = await importEmployeesExcel(file);
      setImportResult(data);
      await loadData();
    } catch (err) {
      showToast(err.message || 'Import thất bại', 'error');
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSelf = (user) => {
    const currentId = currentUser?._id || currentUser?.id;
    return user._id === currentId;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-6">
          <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse"></div>
          <div className="h-10 w-32 bg-slate-200 rounded-lg animate-pulse"></div>
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm animate-pulse flex justify-between">
            <div className="h-6 w-1/3 bg-slate-200 rounded"></div>
            <div className="h-6 w-1/4 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Tìm kiếm username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative" ref={columnMenuRef}>
            <button
              type="button"
              onClick={() => setIsColumnMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors justify-center"
            >
              <Columns3 className="w-5 h-5" />
              <span className="hidden sm:inline">Cột hiển thị</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {isColumnMenuOpen && (
              <div className="absolute z-20 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg p-2 right-0">
                <p className="text-xs font-semibold text-slate-500 uppercase px-2 pb-1">Hiện/ẩn cột</p>
                {ACCOUNT_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={!!visibleColumns[col.key]}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-slate-300 text-[#008BC5] focus:ring-[#008BC5]"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInputRef}
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex-1 sm:flex-none justify-center disabled:opacity-50"
          >
            {importLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            <span>Import Excel</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#008BC5] text-white rounded-lg font-medium hover:bg-[#007ba1] transition-colors flex-1 sm:flex-none justify-center"
          >
            <Plus className="w-5 h-5" />
            <span>Thêm tài khoản</span>
          </button>
        </div>
      </div>

      {/* Desktop Table (Hidden on Mobile) */}
      <div className="hidden sm:block overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
              <th className="p-4 font-semibold">Tài khoản (Username)</th>
              {activeColumns.map((col) => (
                <th key={col.key} className="p-4 font-semibold whitespace-nowrap">{col.label}</th>
              ))}
              <th className="p-4 font-semibold">Phân quyền</th>
              <th className="p-4 font-semibold">Trạng thái</th>
              <th className="p-4 font-semibold text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredUsers.map(user => (
              <tr key={user._id} className="hover:bg-slate-50/50">
                <td className="p-4 font-medium text-[#0F172A]">{user.username} {isSelf(user) && <span className="text-xs text-slate-400 font-normal italic">(Bạn)</span>}</td>
                {activeColumns.map((col) => (
                  <td key={col.key} className="p-4 text-sm text-slate-600 whitespace-nowrap">
                    {user[col.key] || <span className="text-slate-300">—</span>}
                  </td>
                ))}
                <td className="p-4">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                    user.roleCode === 'admin' ? 'bg-purple-100 text-purple-700' :
                    user.roleCode === 'examiner' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {user.roleName || user.roleCode}
                  </span>
                </td>
                <td className="p-4">
                  {user.isActive ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-[#22C55E] font-medium">
                      <CheckCircleIcon className="w-4 h-4" /> Hoạt động
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-[#E53E3E] font-medium">
                      <Lock className="w-4 h-4" /> Đã khóa
                    </span>
                  )}
                </td>
                <td className="p-4 flex justify-end gap-2">
                  <button
                    disabled={isSelf(user) || actionLoading}
                    onClick={() => {
                      setEditingUser(user);
                      setEditingRoleId(user.roleId);
                      setIsEditRoleOpen(true);
                    }}
                    className="p-2 text-slate-500 hover:text-[#008BC5] hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    title={isSelf(user) ? "Không thể đổi quyền của chính mình" : "Sửa phân quyền"}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleResetPassword(user)}
                    className="p-2 text-slate-500 hover:text-[#F6AD37] hover:bg-[#FFFBEB] rounded-lg transition-colors disabled:opacity-30"
                    title="Reset mật khẩu"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  {user.isActive ? (
                    <button
                      disabled={isSelf(user) || actionLoading}
                      onClick={() => handleToggleLock(user)}
                      className="p-2 text-slate-500 hover:text-[#E53E3E] hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      title={isSelf(user) ? "Không thể tự khóa tài khoản của mình" : "Khóa tài khoản"}
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      disabled={isSelf(user) || actionLoading}
                      onClick={() => handleToggleLock(user)}
                      className="p-2 text-slate-500 hover:text-[#22C55E] hover:bg-green-50 rounded-lg transition-colors disabled:opacity-30"
                      title="Mở khóa tài khoản"
                    >
                      <Unlock className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile List (Hidden on Desktop) */}
      <div className="sm:hidden space-y-4">
        {filteredUsers.map(user => (
          <div key={user._id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <span className="font-bold text-[#0F172A]">
                {user.username} {isSelf(user) && <span className="text-xs text-slate-400 font-normal italic">(Bạn)</span>}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                user.roleCode === 'admin' ? 'bg-purple-100 text-purple-700' :
                user.roleCode === 'examiner' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {user.roleName || user.roleCode}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              {user.isActive ? (
                <span className="text-[#22C55E] font-medium flex items-center gap-1"><CheckCircleIcon className="w-4 h-4" /> Hoạt động</span>
              ) : (
                <span className="text-[#E53E3E] font-medium flex items-center gap-1"><Lock className="w-4 h-4" /> Đã khóa</span>
              )}
            </div>

            {activeColumns.some((col) => user[col.key]) && (
              <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-500 pt-1">
                {activeColumns
                  .filter((col) => user[col.key])
                  .map((col) => (
                    <div key={col.key}>
                      <span className="text-slate-400">{col.label}: </span>
                      <span className="text-slate-700 font-medium">{user[col.key]}</span>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                disabled={isSelf(user) || actionLoading}
                onClick={() => {
                  setEditingUser(user);
                  setEditingRoleId(user.roleId);
                  setIsEditRoleOpen(true);
                }}
                className="flex-1 py-2 text-sm font-medium text-[#008BC5] bg-blue-50 rounded-lg disabled:opacity-30"
              >
                Sửa quyền
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleResetPassword(user)}
                className="flex-1 py-2 text-sm font-medium text-[#F6AD37] bg-[#FFFBEB] rounded-lg disabled:opacity-30"
              >
                Mật khẩu
              </button>
              <button
                disabled={isSelf(user) || actionLoading}
                onClick={() => handleToggleLock(user)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-30 ${user.isActive ? 'text-[#E53E3E] bg-red-50' : 'text-[#22C55E] bg-green-50'}`}
              >
                {user.isActive ? 'Khóa' : 'Mở khóa'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-[#0F172A]">Thêm tài khoản mới</h3>
              <button onClick={() => { setIsCreateOpen(false); resetCreateForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên đăng nhập (Username)</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập username..."
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Phân quyền (Role)</label>
                <select
                  required
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white"
                >
                  <option value="">-- Chọn phân quyền --</option>
                  {roles.map(role => (
                    <option key={role._id} value={role._id}>{role.name}</option>
                  ))}
                </select>
              </div>

              {/* Chỉ hiện khi role được chọn là Thí sinh (candidate) — bắt buộc kèm hồ sơ nhân viên */}
              {isCandidateRoleSelected && (
                <div className="space-y-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Hồ sơ nhân viên (bắt buộc cho tài khoản Thí sinh)</p>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Họ và tên</label>
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={newFullname}
                      onChange={(e) => setNewFullname(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Phòng ban</label>
                    <select
                      required
                      value={newDepartmentId}
                      onChange={(e) => setNewDepartmentId(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white"
                    >
                      <option value="">-- Chọn phòng ban --</option>
                      {departments.map(dept => (
                        <option key={dept._id} value={dept._id}>{dept.name}</option>
                      ))}
                    </select>
                    {departments.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Chưa có phòng ban nào trong hệ thống — tạo phòng ban trước ở Dashboard Người ra đề.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Mã nhân viên <span className="text-slate-400 font-normal">(không bắt buộc)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="NV-001"
                      value={newEmployeeCode}
                      onChange={(e) => setNewEmployeeCode(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); resetCreateForm(); }}
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

      {/* EDIT ROLE MODAL */}
      {isEditRoleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-[#0F172A]">Sửa phân quyền</h3>
              <button onClick={() => { setIsEditRoleOpen(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateRole} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-500">Tài khoản</label>
                <p className="text-base font-bold text-[#0F172A] mt-0.5">{editingUser?.username}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Phân quyền mới</label>
                <select
                  required
                  value={editingRoleId}
                  onChange={(e) => setEditingRoleId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008BC5] bg-white"
                >
                  {roles.map(role => (
                    <option key={role._id} value={role._id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsEditRoleOpen(false); setEditingUser(null); }}
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
                  Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEMPORARY PASSWORD DISPLAY MODAL */}
      {tempPasswordModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto text-[#22C55E]">
                <Eye className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-xl text-[#0F172A]">{tempPasswordModal.title}</h3>
              
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100 text-left">
                <div>
                  <span className="text-xs text-slate-500 block font-medium">Tên đăng nhập</span>
                  <span className="text-sm font-semibold text-[#0F172A]">{tempPasswordModal.username}</span>
                </div>
                <div className="pt-2 border-t border-slate-200/60 relative">
                  <span className="text-xs text-slate-500 block font-medium">Mật khẩu tạm thời</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-lg font-mono font-bold text-[#E53E3E] tracking-wider select-all">{tempPasswordModal.password}</span>
                    <button
                      onClick={copyToClipboard}
                      type="button"
                      className="flex items-center gap-1 text-xs text-[#008BC5] hover:text-[#007ba1] font-semibold bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[#FFFBEB] p-3 rounded-lg border border-[#F6AD37]/40 text-left text-xs text-[#92400E] font-medium">
                ⚠️ Mật khẩu tạm này chỉ hiển thị duy nhất một lần. Hãy sao chép và gửi cho người dùng. Họ sẽ bắt buộc phải đổi mật khẩu khi đăng nhập lần đầu.
              </div>

              <button
                type="button"
                onClick={() => setTempPasswordModal({ isOpen: false, title: '', username: '', password: '' })}
                className="w-full py-3 bg-[#0F172A] text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors shadow-md"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT EXCEL — KẾT QUẢ MODAL */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-[#0F172A] flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#008BC5]" /> Kết quả import
              </h3>
              <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#F0FDF4] rounded-lg p-3">
                  <div className="text-2xl font-bold text-[#22C55E]">{importResult.created}</div>
                  <div className="text-xs text-slate-500">Tạo mới</div>
                </div>
                <div className="bg-[#EAF6FF] rounded-lg p-3">
                  <div className="text-2xl font-bold text-[#008BC5]">{importResult.updated}</div>
                  <div className="text-xs text-slate-500">Cập nhật</div>
                </div>
                <div className="bg-[#FEECEC] rounded-lg p-3">
                  <div className="text-2xl font-bold text-[#E53E3E]">{importResult.failed}</div>
                  <div className="text-xs text-slate-500">Lỗi</div>
                </div>
              </div>

              {importResult.failed > 0 && (
                <div className="bg-[#FFFBEB] border border-[#F6AD37]/40 rounded-lg p-3 text-xs text-[#92400E] max-h-32 overflow-y-auto space-y-1">
                  <p className="flex items-center gap-1 font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> Các dòng lỗi:</p>
                  {importResult.results.filter(r => r.status === 'error').map(r => (
                    <p key={r.row}>Dòng {r.row}: {r.message}</p>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => downloadImportResultsCsv(importResult.results)}
                className="w-full py-2.5 bg-[#0F172A] text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 rotate-180" /> Tải file kết quả (username + mật khẩu)
              </button>
              <p className="text-xs text-slate-400 text-center">
                File chứa mật khẩu tạm — chỉ tải được 1 lần từ đây, hãy lưu lại cẩn thận.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CheckCircleIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);