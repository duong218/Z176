import cron from 'node-cron';
import { purgeExpiredLockedAccounts } from './account-purge.service.js';

const CRON_EXPRESSION = '0 4 * * *'; // 04:00 mỗi ngày — sau backup (03:00), trước giờ hành chính
const TIMEZONE = 'Asia/Ho_Chi_Minh';

async function runAccountPurge() {
  try {
    const { purgedCount, purgedUsernames, skippedWithHistoryCount } = await purgeExpiredLockedAccounts();

    if (purgedCount > 0 || skippedWithHistoryCount > 0) {
      console.log(
        `[account-purge] Đã xóa cứng ${purgedCount} tài khoản khóa quá 6 tháng` +
          (purgedCount > 0 ? `: ${purgedUsernames.join(', ')}` : '') +
          (skippedWithHistoryCount > 0
            ? `. Bỏ qua ${skippedWithHistoryCount} tài khoản vì có dấu vết lịch sử (đã từng thi hoặc từng ghi audit log)`
            : ''),
      );
    }
  } catch (err) {
    // Cron lỗi không được làm crash server
    console.error('[account-purge] Xóa cứng tài khoản khóa lâu ngày thất bại:', err.message);
  }
}

/** Gọi 1 lần khi server khởi động (trong src/index.js), đăng ký job chạy 04:00 mỗi ngày giờ VN. */
export function initAccountPurgeScheduler() {
  cron.schedule(CRON_EXPRESSION, runAccountPurge, { timezone: TIMEZONE });
  console.log(`[account-purge] Đã đăng ký cron xóa cứng tài khoản khóa lâu: "${CRON_EXPRESSION}" (${TIMEZONE})`);
}

export { runAccountPurge };