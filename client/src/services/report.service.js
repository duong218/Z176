import { apiRequest } from './api';
import { getAuthHeaders } from './auth.service';

export const fetchOverviewStats = async () => {
  return apiRequest('/reports/overview', {
    headers: getAuthHeaders(),
  });
};

export const fetchResultsByDepartment = async () => {
  return apiRequest('/reports/by-department', {
    headers: getAuthHeaders(),
  });
};

export const fetchDetailedResults = async (filters = {}) => {
  const query = new URLSearchParams();
  if (filters.page) query.append('page', filters.page);
  if (filters.limit) query.append('limit', filters.limit);
  if (filters.departmentId) query.append('departmentId', filters.departmentId);
  if (filters.passed !== undefined && filters.passed !== '') query.append('passed', filters.passed);
  if (filters.startDate) query.append('startDate', filters.startDate);
  if (filters.endDate) query.append('endDate', filters.endDate);
  if (filters.search) query.append('search', filters.search);

  return apiRequest(`/reports/results?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
};

export const exportReport = async (filters = {}) => {
  const query = new URLSearchParams();
  if (filters.departmentId) query.append('departmentId', filters.departmentId);
  if (filters.passed !== undefined && filters.passed !== '') query.append('passed', filters.passed);
  if (filters.startDate) query.append('startDate', filters.startDate);
  if (filters.endDate) query.append('endDate', filters.endDate);
  if (filters.search) query.append('search', filters.search);

  // Since export returns a file (blob), we cannot use the standard apiRequest wrapper if it expects JSON.
  // Assuming apiRequest parses JSON. We need to fetch the blob directly.
  const token = localStorage.getItem('token');
  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/export?${query.toString()}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Lỗi khi tải file báo cáo');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ket_qua_thi.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// MỚI — Lịch sử kết quả thi của chính thí sinh đang đăng nhập (role 'candidate').
// Trả về { employee: { fullname, employeeCode, departmentName } | null, results: [...] }
export const fetchMyResults = async () => {
  const res = await apiRequest('/reports/my-results', {
    headers: getAuthHeaders(),
  });
  return res.data;
};