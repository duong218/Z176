import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const MAX_EXCEL_BYTES = 5 * 1024 * 1024;

function ensureUploadDir() {
  const dir = path.resolve(env.uploadDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, ensureUploadDir());
  },
  filename(_req, file, cb) {
    const safe = file.originalname.replace(/[^\w.-]/g, '_').slice(0, 80);
    cb(null, `${Date.now()}-${safe}`);
  },
});

function excelFilter(_req, file, cb) {
  const ok =
    file.mimetype ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.originalname.toLowerCase().endsWith('.xlsx') ||
    file.originalname.toLowerCase().endsWith('.xls');
  if (!ok) {
    cb(new ApiError(400, 'Chỉ chấp nhận file Excel (.xlsx)', 'IMPORT_FILE_TYPE'));
    return;
  }
  cb(null, true);
}

export const uploadExcel = multer({
  storage,
  limits: { fileSize: MAX_EXCEL_BYTES },
  fileFilter: excelFilter,
}).single('file');
