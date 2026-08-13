import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Role, User } from '../models/index.js';
import { ApiError, assertFound } from '../utils/api-error.js';

const REFRESH_COOKIE = 'refreshToken';

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export { REFRESH_COOKIE };

function signAccessToken(user, roleCode) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      roleCode,
      tv: user.tokenVersion ?? 0,
    },
    env.jwtSecret,
    { expiresIn: env.jwtAccessExpiresIn },
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      tv: user.tokenVersion ?? 0,
      type: 'refresh',
    },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpiresIn },
  );
}

function isAccountLocked(user) {
  return user.lockUntil && user.lockUntil > new Date();
}

async function registerFailedLogin(user) {
  const attempts = (user.failedLoginAttempts ?? 0) + 1;
  user.failedLoginAttempts = attempts;
  if (attempts >= env.accountLockMaxAttempts) {
    user.lockUntil = new Date(Date.now() + env.accountLockMinutes * 60 * 1000);
    user.failedLoginAttempts = 0;
  }
  await user.save();
}

async function clearFailedLogin(user) {
  if (user.failedLoginAttempts || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  }
}

export async function loginWithUsernamePassword(username, password) {
  const normalized = username.trim().toLowerCase();
  const user = await User.findOne({ username: normalized })
    .select('+passwordHash')
    .populate('roleId');

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Tên đăng nhập hoặc mật khẩu không đúng', 'AUTH_INVALID');
  }

  if (isAccountLocked(user)) {
    throw new ApiError(
      423,
      'Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau.',
      'AUTH_LOCKED',
    );
  }

  const role = user.roleId;
  if (!role || !role.isActive) {
    throw new ApiError(403, 'Vai trò không hợp lệ', 'AUTH_ROLE_INACTIVE');
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    await registerFailedLogin(user);
    throw new ApiError(401, 'Tên đăng nhập hoặc mật khẩu không đúng', 'AUTH_INVALID');
  }

  await clearFailedLogin(user);

  // Mỗi lần đăng nhập thành công đều tăng tokenVersion — nghĩa là bất kỳ
  // access/refresh token nào đã cấp trước đó (ví dụ đang mở ở 1 trình duyệt
  // khác) sẽ ngay lập tức lệch `tv` so với DB và bị middleware `authenticate`
  // từ chối với mã AUTH_ACCESS_REVOKED ở request kế tiếp của nó — tận dụng
  // đúng cơ chế thu hồi phiên đã có sẵn (vốn dùng cho đổi mật khẩu/logout),
  // để đạt hiệu quả "chỉ 1 phiên đăng nhập hoạt động tại 1 thời điểm" mà
  // không cần thêm field/schema mới.
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  const accessToken = signAccessToken(user, role.code);
  const refreshToken = signRefreshToken(user);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id.toString(),
      username: user.username,
      roleCode: role.code,
      roleName: role.name,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new ApiError(401, 'Phiên đăng nhập hết hạn', 'AUTH_REFRESH_MISSING');
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
  } catch {
    throw new ApiError(401, 'Phiên đăng nhập hết hạn', 'AUTH_REFRESH_INVALID');
  }

  if (payload.type !== 'refresh') {
    throw new ApiError(401, 'Phiên đăng nhập hết hạn', 'AUTH_REFRESH_INVALID');
  }

  const user = await User.findById(payload.sub).populate('roleId');
  assertFound(user, 'Người dùng không tồn tại', 'AUTH_USER_NOT_FOUND');

  if (!user.isActive) {
    throw new ApiError(403, 'Tài khoản đã bị vô hiệu', 'AUTH_INACTIVE');
  }

  if ((user.tokenVersion ?? 0) !== (payload.tv ?? 0)) {
    throw new ApiError(401, 'Phiên đăng nhập đã bị thu hồi', 'AUTH_REFRESH_REVOKED');
  }

  const role = user.roleId;
  if (!role || !role.isActive) {
    throw new ApiError(403, 'Vai trò không hợp lệ', 'AUTH_ROLE_INACTIVE');
  }

  const accessToken = signAccessToken(user, role.code);
  const newRefreshToken = signRefreshToken(user);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: user._id.toString(),
      username: user.username,
      roleCode: role.code,
      roleName: role.name,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function logoutUser(userId) {
  const user = await User.findById(userId);
  if (user) {
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
  }
}

export async function getAuthProfile(userId) {
  const user = await User.findById(userId).populate('roleId');
  assertFound(user, 'Người dùng không tồn tại', 'AUTH_USER_NOT_FOUND');
  if (!user.isActive) {
    throw new ApiError(403, 'Tài khoản đã bị vô hiệu', 'AUTH_INACTIVE');
  }
  const role = user.roleId;
  return {
    id: user._id.toString(),
    username: user.username,
    roleCode: role?.code,
    roleName: role?.name,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  assertFound(user, 'Người dùng không tồn tại', 'AUTH_USER_NOT_FOUND');

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    throw new ApiError(401, 'Mật khẩu hiện tại không đúng', 'AUTH_PASSWORD_WRONG');
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, 'Mật khẩu mới tối thiểu 8 ký tự', 'AUTH_PASSWORD_WEAK');
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);
  user.mustChangePassword = false;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
}

/**
 * MỚI: phân biệt "access token hết hạn do quá thời gian sống" (JWT
 * TokenExpiredError) với "token không hợp lệ" (sai chữ ký, bị sửa, sai
 * định dạng...). Trước đây cả 2 trường hợp đều chung 1 mã AUTH_ACCESS_INVALID
 * nên frontend không thể biết khi nào nên tự động gọi /auth/refresh rồi thử
 * lại, so với khi nào nên đăng xuất luôn (token rác/giả mạo thì refresh cũng
 * vô ích, không nên tốn 1 lượt gọi API).
 *
 * jsonwebtoken ném ra instance TokenExpiredError (kế thừa từ JsonWebTokenError)
 * khi token còn đúng chữ ký nhưng đã qua `exp` — dùng `err.name` để phân biệt
 * thay vì `instanceof` để không phải import thêm class từ thư viện.
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Phiên đăng nhập đã hết hạn', 'AUTH_ACCESS_EXPIRED');
    }
    throw new ApiError(401, 'Phiên không hợp lệ', 'AUTH_ACCESS_INVALID');
  }
}