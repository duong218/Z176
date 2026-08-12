import { apiRequest } from './api';
import { getAuthHeaders } from './auth.service';
import { fetchActiveExam } from './exam-review.service';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchOverviewStats() {
  const [users, activeExam] = await Promise.all([
    fetchUsers(),
    fetchActiveExam(),
  ]);

  const usersByRole = users.reduce((acc, u) => {
    if (u.roleCode) acc[u.roleCode] = (acc[u.roleCode] || 0) + 1;
    return acc;
  }, {});

  return {
    totalUsers: users.length,
    usersByRole, // { admin, examiner, leader, candidate }
    activeExam,  // exam object hoặc null
  };
}

export async function fetchUsers() {
  const res = await apiRequest('/users', {
    headers: getAuthHeaders(),
  });
  const usersData = Array.isArray(res.data) ? res.data : [];
  return usersData.map(u => ({
    ...u,
    roleCode: u.roleId?.code,
    roleName: u.roleId?.name,
    roleId: u.roleId?._id || u.roleId // Fallback if not populated
  }));
}

export async function fetchRoles() {
  const res = await apiRequest('/roles', {
    headers: getAuthHeaders(),
  });
  return res.data;
}

/**
 * @param {string} username
 * @param {string} roleId
 * @param {{ fullname: string, departmentId: string, employeeCode?: string }} [employeeInfo]
 *   Chỉ cần truyền khi roleId ứng với role 'candidate' (thí sinh) — backend sẽ tự
 *   tạo Employee gắn với User mới tạo. Với các role khác, để undefined/bỏ qua.
 */
export async function createUser(username, roleId, employeeInfo) {
  const body = { username, roleId };
  if (employeeInfo) {
    body.fullname = employeeInfo.fullname;
    body.departmentId = employeeInfo.departmentId;
    body.employeeCode = employeeInfo.employeeCode;
  }

  const res = await apiRequest('/users', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  });
  return res; // contains data (user) and tempPassword
}

export async function updateUserRole(userId, roleId) {
  const res = await apiRequest(`/users/${userId}/role`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ roleId })
  });
  return res.data;
}

export async function toggleUserLock(userId, isActive) {
  const res = await apiRequest(`/users/${userId}/lock`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ isActive })
  });
  return res.data;
}

export async function resetUserPassword(userId) {
  const res = await apiRequest(`/users/${userId}/reset-password`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return res.tempPassword;
}

export async function fetchAuditLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);

  const res = await apiRequest(`/audit-logs?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function triggerBackup() {
  await delay(2500);
  // Mock backup response
  return {
    success: true,
    message: 'Backup dữ liệu thành công',
    downloadUrl: 'https://drive.google.com/file/d/demo-backup-link/view'
  };
}

/**
 * Import hàng loạt nhân viên (tài khoản 'candidate') từ file Excel.
 * Trả về { total, created, updated, failed, results: [...] } — xem
 * server/src/services/user.service.js#importEmployeesFromExcelFile để biết
 * đầy đủ ý nghĩa từng field trong results.
 */
export async function importEmployeesExcel(file) {
  const formData = new FormData();
  formData.append('file', file);

  const headers = getAuthHeaders();
  delete headers['Content-Type']; // để browser tự set boundary cho multipart/form-data

  const res = await apiRequest('/users/import', {
    method: 'POST',
    headers,
    body: formData,
  });
  return res.data;
}

// Xuất kết quả import ra CSV (UTF-8 BOM) để admin tải về — dùng gửi
// username/mật khẩu tạm cho hàng nghìn nhân viên cùng lúc.
export function downloadImportResultsCsv(results) {
  const header = ['Dòng', 'Mã NV', 'Username', 'Họ tên', 'Phòng ban', 'Trạng thái', 'Mật khẩu tạm', 'Ghi chú'];
  const statusLabel = { created: 'Tạo mới', updated: 'Cập nhật', error: 'Lỗi' };
  const rows = results.map((r) => [
    r.row,
    r.employeeCode,
    r.username,
    r.fullname,
    r.department,
    statusLabel[r.status] || r.status,
    r.tempPassword,
    r.message,
  ]);
  const csvLines = [header, ...rows].map((row) =>
    row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','),
  );
  const csvContent = '\uFEFF' + csvLines.join('\r\n'); // BOM để Excel đọc đúng UTF-8

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ket-qua-import-nhan-vien-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}