import { MOCK_OVERVIEW_STATS } from '../mock-data/admin.mock';
import { apiRequest } from './api';
import { getAuthHeaders } from './auth.service';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchOverviewStats() {
  await delay(800);
  return MOCK_OVERVIEW_STATS;
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

export async function createUser(username, roleId) {
  const res = await apiRequest('/users', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ username, roleId })
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