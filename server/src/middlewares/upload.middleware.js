import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const MAX_EXCEL_BYTES = 5 * 1024 * 1024;
const MAX_STUDY_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB

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

// MỚI — Upload tài liệu ôn tập: PDF/Word/Excel, tối đa 20MB. Dùng chung
// `storage` (diskStorage vào env.uploadDir) với uploadExcel — tên file được
// đặt tiền tố timestamp nên không đụng nhau dù cùng thư mục.
const STUDY_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function studyDocumentFilter(_req, file, cb) {
  const nameLower = file.originalname.toLowerCase();
  const ok =
    STUDY_DOCUMENT_MIME_TYPES.has(file.mimetype) ||
    nameLower.endsWith('.pdf') ||
    nameLower.endsWith('.doc') ||
    nameLower.endsWith('.docx') ||
    nameLower.endsWith('.xls') ||
    nameLower.endsWith('.xlsx');
  if (!ok) {
    cb(
      new ApiError(
        400,
        'Chỉ chấp nhận file PDF, Word (.doc, .docx) hoặc Excel (.xls, .xlsx)',
        'DOCUMENT_FILE_TYPE',
      ),
    );
    return;
  }
  cb(null, true);
}

export const uploadStudyDocument = multer({
  storage,
  limits: { fileSize: MAX_STUDY_DOCUMENT_BYTES },
  fileFilter: studyDocumentFilter,
}).single('file');

// MỚI — Upload ảnh câu hỏi (đề bài). memoryStorage (KHÔNG diskStorage như
// Excel/tài liệu) vì cần buffer trong RAM để hash SHA-256 làm public_id
// Cloudinary rồi upload thẳng lên, không lưu file tạm trên đĩa server.
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const MAX_QUESTION_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

function questionImageFilter(_req, file, cb) {
  const nameLower = file.originalname.toLowerCase();
  const ok =
    IMAGE_MIME_TYPES.has(file.mimetype) ||
    nameLower.endsWith('.jpg') ||
    nameLower.endsWith('.jpeg') ||
    nameLower.endsWith('.png');
  if (!ok) {
    cb(new ApiError(400, 'Chỉ chấp nhận ảnh JPG hoặc PNG', 'IMAGE_FILE_TYPE'));
    return;
  }
  cb(null, true);
}

export const uploadQuestionImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_QUESTION_IMAGE_BYTES },
  fileFilter: questionImageFilter,
}).single('image');