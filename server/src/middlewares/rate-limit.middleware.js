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
