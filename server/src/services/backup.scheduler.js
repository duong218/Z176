import cron from 'node-cron';
import { backupService } from './backup.service.js';
import { auditService } from './audit.service.js';

const CRON_EXPRESSION = '0 3 * * *'; // 03:00 mỗi ngày
const TIMEZONE = 'Asia/Ho_Chi_Minh';

async function runScheduledBackup() {
  try {
    const driveFile = await backupService.createBackupToDrive({ prefix: 'z176-auto' });
    const { kept, deleted } = await backupService.rotateDriveBackups();

    console.log(
      `[backup-scheduler] Backup lên Drive thành công: ${driveFile.name} (id=${driveFile.id}). Đang giữ ${kept} bản, đã xoá: ${
        deleted.join(', ') || '(không có)'
      }`
    );

    await auditService.writeAudit({
      actorUserId: null, // hệ thống tự động, không phải hành động của user cụ thể
      action: 'BACKUP_AUTO_CREATE',
      resourceType: 'Backup',
      resourceId: driveFile.id,
      metadata: { fileName: driveFile.name, kept, deleted },
    });
  } catch (err) {
    // Cron lỗi không được làm crash server
    console.error('[backup-scheduler] Backup tự động thất bại:', err.message);

    await auditService
      .writeAudit({
        actorUserId: null,
        action: 'BACKUP_AUTO_FAILED',
        resourceType: 'Backup',
        metadata: { error: err.message },
      })
      .catch(() => {});
  }
}

/** Gọi 1 lần khi server khởi động (trong src/index.js), đăng ký job chạy 03:00 mỗi ngày giờ VN. */
export function initBackupScheduler() {
  cron.schedule(CRON_EXPRESSION, runScheduledBackup, { timezone: TIMEZONE });
  console.log(`[backup-scheduler] Đã đăng ký cron backup tự động: "${CRON_EXPRESSION}" (${TIMEZONE})`);
}

export { runScheduledBackup };