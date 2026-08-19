import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { env } from '../config/env.js';
import { writeAudit } from './audit.service.js';

const CRON_EXPRESSION = '0 * * * *'; // Chạy mỗi giờ, phút 0
const TIMEZONE = 'Asia/Ho_Chi_Minh';

// Ngưỡng "cũ": file nằm trong uploadDir quá 6 tiếng coi như bị bỏ dở (đủ dư
// so với thời gian bình thường 1 người dùng preview import rồi bấm xác
// nhận). Áp dụng chung cho mọi file tạm trong uploadDir — cả file Excel
// import câu hỏi/nhân viên (question.service.js, user.service.js) lẫn file
// tài liệu ôn tập (uploadStudyDocument) trước khi được đẩy lên Cloudinary,
// vì tất cả đều dùng chung `diskStorage` trỏ vào cùng uploadDir
// (upload.middleware.js). Không đụng tới ảnh câu hỏi vì uploadQuestionImage
// dùng memoryStorage, không sinh file trên đĩa.
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Dọn các file cũ hơn MAX_AGE_MS còn sót lại trong uploadDir. Đây là lưới an
 * toàn cho các luồng preview/confirm không hoàn tất (người dùng đóng tab,
 * đổi ý, phiên hết hạn...) — luồng bình thường (confirmImportQuestions,
 * upload study document) đã tự xoá file của chính nó sau khi xử lý xong,
 * job này chỉ dọn phần rơi rớt lại.
 */
async function runUploadCleanup() {
  const dir = path.resolve(env.uploadDir);
  if (!fs.existsSync(dir)) {
    return;
  }

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    console.error('[upload-cleanup] Không đọc được thư mục upload:', err.message);
    return;
  }

  const now = Date.now();
  const deleted = [];
  const failed = [];

  for (const name of entries) {
    const filePath = path.join(dir, name);
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue; // bỏ qua thư mục con nếu có
      if (now - stat.mtimeMs < MAX_AGE_MS) continue; // còn mới, chưa tới lượt dọn

      fs.unlinkSync(filePath);
      deleted.push(name);
    } catch (err) {
      // Lỗi ở 1 file không được chặn việc dọn các file còn lại.
      failed.push({ name, message: err.message });
    }
  }

  if (deleted.length > 0 || failed.length > 0) {
    console.log(
      `[upload-cleanup] Đã xoá ${deleted.length} file tạm quá hạn` +
        (failed.length > 0 ? `, lỗi ${failed.length} file` : '') +
        (deleted.length > 0 ? `: ${deleted.join(', ')}` : ''),
    );

    await writeAudit({
      actorUserId: null, // job hệ thống tự động, không phải hành động của user cụ thể
      action: 'UPLOAD_TMP_CLEANUP',
      resourceType: 'Upload',
      metadata: { deletedCount: deleted.length, deleted, failed },
    }).catch(() => {
      /* audit lỗi không được chặn job dọn file */
    });
  }
}

/** Gọi 1 lần khi server khởi động (trong src/index.js), đăng ký job chạy mỗi giờ. */
export function initUploadCleanupScheduler() {
  cron.schedule(CRON_EXPRESSION, runUploadCleanup, { timezone: TIMEZONE });
  console.log(`[upload-cleanup] Đã đăng ký cron dọn file tạm: "${CRON_EXPRESSION}" (${TIMEZONE})`);

  // Chạy ngay 1 lần lúc khởi động để dọn rác tồn đọng từ trước khi server
  // được restart (không đợi tới lần chạy cron đầu tiên).
  runUploadCleanup().catch((err) => {
    console.error('[upload-cleanup] Lần chạy dọn dẹp lúc khởi động thất bại:', err.message);
  });
}

export { runUploadCleanup };