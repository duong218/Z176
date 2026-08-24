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

// Giới hạn tần suất cho các route lượt thi (start/answer/heartbeat/submit) —
// chặn trường hợp gọi thẳng API bằng script/Postman (bỏ qua UI, dùng token
// đăng nhập hợp lệ) để spam liên tục.
//
// QUAN TRỌNG — key theo userId (`req.auth.userId`), KHÔNG theo IP:
// hệ thống chỉ cho phép 1 phiên đăng nhập/tài khoản tại 1 thời điểm (xem
// A13 — tokenVersion), nên userId là định danh ổn định và duy nhất cho
// mỗi thí sinh, kể cả khi hàng chục/hàng trăm thí sinh cùng ngồi sau 1 NAT
// (cùng IP công ty/trường học) trong 1 phòng thi lớn. Rate limit theo IP
// trước đây khiến TOÀN BỘ thí sinh cùng mạng LAN chung 1 bộ đếm, dễ chạm
// giới hạn dù từng người dùng hoàn toàn hợp lệ; theo userId thì mỗi thí
// sinh có bộ đếm riêng, không còn bị ảnh hưởng bởi người khác cùng mạng —
// dù phòng thi có 100, 1000 người thi cùng lúc trên cùng 1 IP cũng không
// còn là vấn đề.
//
// Fallback về req.ip khi chưa có req.auth (về lý thuyết không xảy ra vì
// examAttemptRateLimiter LUÔN được gắn SAU authenticate trên route — xem
// exam-attempt.routes.js — nhưng giữ fallback để middleware không bao giờ
// ném lỗi nếu thứ tự route lỡ bị đổi trong tương lai).
//
// Giữ nguyên hành vi bypass ở dev/test giống loginRateLimiter, để không cản
// trở việc test thủ công lúc phát triển.
export const examAttemptRateLimiter = env.isProduction
  ? rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.auth?.userId ?? req.ip,
      message: {
        success: false,
        message: 'Thao tác quá nhanh, vui lòng thử lại sau.',
        code: 'EXAM_ATTEMPT_RATE_LIMIT',
      },
    })
  : (req, res, next) => next(); // Bypass in dev/test