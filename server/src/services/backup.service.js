import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import fssync from 'fs';
import { google } from 'googleapis';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const MAX_BACKUPS_KEPT = 5;
const TMP_DIR = path.join(os.tmpdir(), 'z176-backups');

async function ensureTmpDir() {
  await fs.mkdir(TMP_DIR, { recursive: true });
}

function assertGoogleConfigured() {
  const { clientId, clientSecret, refreshToken, folderId } = env.googleBackup;
  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new ApiError(
      500,
      'Chưa cấu hình Google Drive backup (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN / GOOGLE_DRIVE_BACKUP_FOLDER_ID).',
      'GOOGLE_BACKUP_NOT_CONFIGURED'
    );
  }
}

/**
 * Tạo Drive client bằng OAuth2 (Gmail cá nhân), KHÔNG dùng Service Account.
 * Lý do: Service Account không có storage quota riêng trên Drive cá nhân
 * ("Service Accounts do not have storage quota"), chỉ dùng được với Shared Drive
 * (Google Workspace). Vì Z176 dùng Gmail cá nhân miễn phí, phải dùng OAuth2
 * với refresh token lấy 1 lần qua scripts/get-google-refresh-token.js.
 */
function getDriveClient() {
  assertGoogleConfigured();
  const { clientId, clientSecret, refreshToken } = env.googleBackup;

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: 'v3', auth: oAuth2Client });
}

/** Chạy mongodump/mongorestore, reject bằng ApiError nếu lỗi hoặc thiếu binary. */
function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      reject(
        new ApiError(
          500,
          `Không thể chạy lệnh "${cmd}". Cần cài mongodb-database-tools trên server. Chi tiết: ${err.message}`,
          'BACKUP_TOOL_NOT_FOUND'
        )
      );
    });
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(
        new ApiError(500, `Lệnh "${cmd}" thất bại (mã ${code}): ${stderr.slice(-2000)}`, 'BACKUP_COMMAND_FAILED')
      );
    });
  });
}

async function cleanupLocalFile(filePath) {
  try {
    if (filePath && fssync.existsSync(filePath)) {
      await fs.unlink(filePath);
    }
  } catch {
    // best-effort, không throw để không che lấp lỗi chính
  }
}

/** mongodump ra file .gz tạm trên đĩa local (chỉ để chuẩn bị upload lên Drive, sẽ xoá ngay sau đó). */
async function dumpToLocalFile(prefix = 'z176-backup') {
  await ensureTmpDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${prefix}-${timestamp}.gz`;
  const filePath = path.join(TMP_DIR, fileName);

  await runCommand('mongodump', [`--uri=${env.mongodbUri}`, `--archive=${filePath}`, '--gzip']);

  const stat = await fs.stat(filePath);
  return { filePath, fileName, size: stat.size };
}

/** Upload file .gz local lên thư mục Drive chỉ định trong env (Drive cá nhân qua OAuth2), trả về metadata file trên Drive. */
async function uploadToDrive(filePath, fileName) {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [env.googleBackup.folderId],
    },
    media: {
      mimeType: 'application/gzip',
      body: fssync.createReadStream(filePath),
    },
    fields: 'id, name, size, createdTime',
  });
  return res.data;
}

/** Toàn bộ luồng: dump DB -> upload Drive -> xoá file tạm local. */
async function createBackupToDrive({ prefix = 'z176-backup' } = {}) {
  const { filePath, fileName } = await dumpToLocalFile(prefix);
  try {
    const driveFile = await uploadToDrive(filePath, fileName);
    return driveFile;
  } finally {
    await cleanupLocalFile(filePath);
  }
}

/** Danh sách các bản backup trên Drive, mới nhất trước. */
async function listDriveBackups() {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${env.googleBackup.folderId}' in parents and trashed = false`,
    fields: 'files(id, name, size, createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });
  return res.data.files ?? [];
}

/** Giữ tối đa maxKept bản mới nhất trên Drive, xoá các bản cũ hơn. */
async function rotateDriveBackups(maxKept = MAX_BACKUPS_KEPT) {
  const drive = getDriveClient();
  const files = await listDriveBackups(); // đã sort mới nhất trước
  const toDelete = files.slice(maxKept);

  for (const file of toDelete) {
    await drive.files.delete({ fileId: file.id });
  }
  return { kept: files.length - toDelete.length, deleted: toDelete.map((f) => f.name) };
}

/** Tải 1 file từ Drive về đĩa local tạm (dùng khi cần mongorestore, hoặc trả về client). */
async function downloadDriveFileToLocal(fileId, fileName) {
  await ensureTmpDir();
  const drive = getDriveClient();
  const filePath = path.join(TMP_DIR, `download-${Date.now()}-${fileName}`);

  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

  await new Promise((resolve, reject) => {
    const dest = fssync.createWriteStream(filePath);
    res.data.pipe(dest).on('finish', resolve).on('error', reject);
  });

  return filePath;
}

/** Stream trực tiếp nội dung file Drive ra response (dùng cho endpoint download, không cần lưu local). */
async function streamDriveFileToResponse(fileId, res) {
  const drive = getDriveClient();
  const driveRes = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  driveRes.data.pipe(res);
}

/** mongorestore --drop từ 1 file archive .gz local (VD: file vừa upload từ client). NGUY HIỂM: xoá dữ liệu hiện tại. */
async function restoreFromLocalFile(localFilePath) {
  await runCommand('mongorestore', [`--uri=${env.mongodbUri}`, `--archive=${localFilePath}`, '--gzip', '--drop']);
}

export const backupService = {
  createBackupToDrive,
  listDriveBackups,
  rotateDriveBackups,
  downloadDriveFileToLocal,
  streamDriveFileToResponse,
  restoreFromLocalFile,
  cleanupLocalFile,
  MAX_BACKUPS_KEPT,
};