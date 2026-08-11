import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { ApiError } from './utils/api-error.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'OK', code: 'HEALTH_OK' });
  });

  app.use('/api', apiRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: 'Không tìm thấy tài nguyên',
      code: 'NOT_FOUND',
    });
  });

  app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode ?? 500;
    const isApiError = err instanceof ApiError;
    const message =
      env.isProduction && !isApiError && statusCode === 500
        ? 'Lỗi máy chủ'
        : (err.message ?? 'Lỗi máy chủ');
    res.status(statusCode).json({
      success: false,
      message,
      code: err.code ?? 'INTERNAL_ERROR',
    });
  });

  return app;
}
