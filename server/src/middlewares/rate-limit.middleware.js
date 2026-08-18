import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const loginRateLimiter = env.isProduction
  ? rateLimit({
      windowMs: env.loginRateLimitWindowMinutes * 60 * 1000,
      max: env.loginRateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Quá nhiều lần đăng nhập. Thử lại sau.',
        code: 'AUTH_RATE_LIMIT',
      },
    })
  : (req, res, next) => next(); // Bypass in dev/test

// MỚI — Giới hạn tần suất cho các route lượt thi (start/answer/heartbeat/
// submit) — chặn trường hợp gọi thẳng API bằng script/Postman (bỏ qua UI,
// dùng token đăng nhập hợp lệ) để spam liên tục. Client bình thường qua
// ExamModal.jsx chỉ gửi heartbeat mỗi 15s + vài lần đổi đáp án, nên 100
// request/phút/IP vẫn rất thoải mái, không ảnh hưởng người dùng thật.
// Giữ nguyên hành vi bypass ở dev/test giống loginRateLimiter, để không cản
// trở việc test thủ công lúc phát triển.
export const examAttemptRateLimiter = env.isProduction
  ? rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Thao tác quá nhanh, vui lòng thử lại sau.',
        code: 'EXAM_ATTEMPT_RATE_LIMIT',
      },
    })
  : (req, res, next) => next(); // Bypass in dev/test