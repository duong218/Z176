import { apiRequest } from './api.js';

const TOKEN_KEY = 'z176_access_token';

// ── Token helpers ──────────────────────────────────────────────
export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveAccessToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── API calls ──────────────────────────────────────────────────

/**
 * Đăng nhập bằng username + password.
 * Server trả { success, data: { accessToken, user } } + set httpOnly refresh cookie.
 */
export async function loginUser(username, password) {
  const result = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (result?.data?.accessToken) {
    saveAccessToken(result.data.accessToken);
  }
  return result.data; // { accessToken, user }
}

/**
 * Refresh access token (dựa vào httpOnly cookie — FE không cần gửi gì thêm).
 */
export async function refreshAccessToken() {
  const result = await apiRequest('/auth/refresh', {
    method: 'POST',
  });
  if (result?.data?.accessToken) {
    saveAccessToken(result.data.accessToken);
  }
  return result.data;
}

/**
 * Lấy profile user hiện tại (cần Bearer token).
 */
export async function fetchMe() {
  const result = await apiRequest('/auth/me', {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return result.data; // { id, username, roleCode, roleName, mustChangePassword }
}

/**
 * Đăng xuất — invalidate refresh token trên server, xóa token local.
 */
export async function logoutUser() {
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch {
    /* server có thể không phản hồi — vẫn xóa token local */
  }
  clearAccessToken();
}

/**
 * Đổi mật khẩu tài khoản hiện tại.
 */
export async function changePassword(currentPassword, newPassword) {
  const result = await apiRequest('/auth/change-password', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return result;
}
