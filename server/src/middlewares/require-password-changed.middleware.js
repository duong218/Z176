import { ApiError } from '../utils/api-error.js';

/** Chặn thao tác nghiệp vụ khi admin seed bắt buộc đổi mật khẩu lần đầu. */
export function requirePasswordChanged(req, _res, next) {
  if (req.auth?.mustChangePassword) {
    next(
      new ApiError(
        403,
        'Vui lòng đổi mật khẩu trước khi sử dụng chức năng này',
        'AUTH_MUST_CHANGE_PASSWORD',
      ),
    );
    return;
  }
  next();
}
