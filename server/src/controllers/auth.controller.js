import {
  REFRESH_COOKIE,
  changePassword,
  loginWithUsernamePassword,
  logoutUser,
  refreshAccessToken,
  refreshCookieOptions,
  getAuthProfile,
} from '../services/auth.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/api-error.js';

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    throw new ApiError(400, 'Thiếu tên đăng nhập hoặc mật khẩu', 'AUTH_VALIDATION');
  }

  const result = await loginWithUsernamePassword(username, password);
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
  res.json({
    success: true,
    message: 'Đăng nhập thành công',
    code: 'AUTH_LOGIN_OK',
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  const result = await refreshAccessToken(token);
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
  res.json({
    success: true,
    message: 'Làm mới phiên thành công',
    code: 'AUTH_REFRESH_OK',
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
});

export const logout = asyncHandler(async (req, res) => {
  if (req.auth?.userId) {
    await logoutUser(req.auth.userId);
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({
    success: true,
    message: 'Đăng xuất thành công',
    code: 'AUTH_LOGOUT_OK',
  });
});

export const me = asyncHandler(async (req, res) => {
  const profile = await getAuthProfile(req.auth.userId);
  res.json({
    success: true,
    message: 'OK',
    code: 'AUTH_ME_OK',
    data: profile,
  });
});

export const changePasswordHandler = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Thiếu mật khẩu', 'AUTH_VALIDATION');
  }
  await changePassword(req.auth.userId, currentPassword, newPassword);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({
    success: true,
    message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
    code: 'AUTH_PASSWORD_CHANGED',
  });
});
