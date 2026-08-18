import { backupService } from '../services/backup.service.js';
import { auditService } from '../services/audit.service.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

// POST /api/backups - backup thủ công (admin bấm nút), dump -> upload Drive -> xoay vòng giữ tối đa 5 bản
export const createBackup = asyncHandler(async (req, res) => {
  const driveFile = await backupService.createBackupToDrive({ prefix: 'z176-manual' });
  const { kept, deleted } = await backupService.rotateDriveBackups();

  // Lưu ý: driveFile.id là ID file trên Google Drive (chuỗi tự do), KHÔNG phải
  // Mongoose ObjectId, nên không gán vào resourceId (schema AuditLog validate
  // resourceId là ObjectId) — chỉ đặt trong metadata để tránh lỗi validation.
  await auditService.writeAudit({
    actorUserId: req.user?.id,
    action: 'BACKUP_MANUAL_CREATE',
    resourceType: 'Backup',
    metadata: { driveFileId: driveFile.id, fileName: driveFile.name, kept, deleted },
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    data: { id: driveFile.id, name: driveFile.name, size: Number(driveFile.size ?? 0), createdTime: driveFile.createdTime },
    message: 'Tạo bản sao lưu thành công.',
  });
});

// GET /api/backups - danh sách các bản backup đang lưu trên Google Drive (tối đa 5 bản, mới nhất trước)
export const listBackups = asyncHandler(async (req, res) => {
  const files = await backupService.listDriveBackups();
  res.json({
    success: true,
    data: files.map((f) => ({ id: f.id, name: f.name, size: Number(f.size ?? 0), createdTime: f.createdTime })),
    maxKept: backupService.MAX_BACKUPS_KEPT,
  });
});

// GET /api/backups/:fileId/download - tải về 1 bản backup cụ thể từ Drive
export const downloadBackup = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const { fileName } = req.query;

  res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'backup.gz'}"`);
  res.setHeader('Content-Type', 'application/gzip');

  await backupService.streamDriveFileToResponse(fileId, res);

  // fileId là Drive file id (string), không phải ObjectId -> để trong metadata
  await auditService.writeAudit({
    actorUserId: req.user?.id,
    action: 'BACKUP_DOWNLOAD',
    resourceType: 'Backup',
    metadata: { driveFileId: fileId, fileName },
    ipAddress: req.ip,
  });
});

// POST /api/backups/restore - upload file .gz và khôi phục DB (bắt buộc xác nhận rõ ràng)
export const restoreBackup = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Vui lòng chọn file backup (.gz) để khôi phục.', 'NO_FILE');
  }

  // Bắt buộc client gửi confirm=RESTORE để tránh khôi phục nhầm (thao tác xoá toàn bộ dữ liệu hiện tại)
  if (req.body?.confirm !== 'RESTORE') {
    await backupService.cleanupLocalFile(req.file.path);
    throw new ApiError(
      400,
      'Thao tác khôi phục sẽ XOÁ TOÀN BỘ dữ liệu hiện tại. Vui lòng xác nhận trước khi tiếp tục.',
      'CONFIRMATION_REQUIRED'
    );
  }

  try {
    await backupService.restoreFromLocalFile(req.file.path);
  } finally {
    await backupService.cleanupLocalFile(req.file.path);
  }

  await auditService.writeAudit({
    actorUserId: req.user?.id,
    action: 'BACKUP_RESTORE',
    resourceType: 'Backup',
    metadata: { originalFileName: req.file.originalname },
    ipAddress: req.ip,
  });

  res.json({ success: true, message: 'Khôi phục dữ liệu thành công.' });
});