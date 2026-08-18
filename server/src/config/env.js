import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function optional(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return undefined;
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  port: Number(process.env.PORT ?? 5000),
  mongodbUri: optional('MONGODB_URI'),
  jwtSecret: optional('JWT_SECRET'),
  jwtRefreshSecret: optional('JWT_REFRESH_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  /** Dev mặc định bật seed admin; production: chỉ khi SEED_ON_START=true */
  seedOnStart:
    process.env.SEED_ON_START === 'true' ||
    (process.env.SEED_ON_START !== 'false' &&
      (process.env.NODE_ENV ?? 'development') !== 'production'),
  adminSeedEmail: optional('ADMIN_SEED_EMAIL'),
  adminSeedPassword: optional('ADMIN_SEED_PASSWORD'),
  /** Demo local: false để vào app ngay; production/Z176 thật: luôn true */
  adminSeedMustChangePassword: process.env.ADMIN_SEED_MUST_CHANGE_PASSWORD !== 'false',
  examSessionSecret: optional('EXAM_SESSION_SECRET'),
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 5),
  loginRateLimitWindowMinutes: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES ?? 15),
  accountLockMaxAttempts: Number(process.env.ACCOUNT_LOCK_MAX_ATTEMPTS ?? 5),
  accountLockMinutes: Number(process.env.ACCOUNT_LOCK_MINUTES ?? 15),
  cloudinary: {
    cloudName: optional('CLOUDINARY_CLOUD_NAME'),
    apiKey: optional('CLOUDINARY_API_KEY'),
    apiSecret: optional('CLOUDINARY_API_SECRET'),
  },
  /**
   * OAuth2 với Gmail cá nhân (KHÔNG dùng Service Account nữa vì Service Account
   * không có storage quota trên Drive cá nhân — xem lịch sử debug).
   * refreshToken lấy 1 lần qua scripts/get-google-refresh-token.js.
   */
  googleBackup: {
    clientId: optional('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: optional('GOOGLE_OAUTH_CLIENT_SECRET'),
    refreshToken: optional('GOOGLE_REFRESH_TOKEN'),
    folderId: optional('GOOGLE_DRIVE_BACKUP_FOLDER_ID'),
  },
};

export function assertRuntimeEnv() {
  if (!env.mongodbUri) {
    throw new Error('MONGODB_URI is required');
  }
  if (!env.jwtSecret || !env.jwtRefreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET are required for auth');
  }
}