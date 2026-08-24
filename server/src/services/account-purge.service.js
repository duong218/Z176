import { User, Employee, ExamCandidate, AuditLog } from '../models/index.js';
import { writeAudit } from './audit.service.js';

// Số tháng tài khoản phải bị khóa LIÊN TỤC (không có lần mở khóa nào ở giữa)
// trước khi đủ điều kiện xóa cứng. Đếm từ `User.lockedAt` — mốc LẦN KHÓA GẦN
// NHẤT, được set lại mỗi lần chuyển isActive true -> false trong
// toggleUserLock() (user.service.js). Nếu tài khoản từng được mở khóa rồi
// khóa lại giữa chừng, lockedAt được tính lại từ đầu -> đồng hồ 6 tháng tự
// động reset, đúng yêu cầu nghiệp vụ (không cộng dồn thời gian khóa cũ).
const PURGE_LOCK_MONTHS = 6;

function lockedBeforeThreshold(now = new Date()) {
  const threshold = new Date(now);
  threshold.setMonth(threshold.getMonth() - PURGE_LOCK_MONTHS);
  return threshold;
}

/**
 * Kiểm tra 1 tài khoản có "dấu vết lịch sử" cần giữ lại vĩnh viễn hay không.
 * Xóa cứng một tài khoản có dấu vết sẽ làm mồ côi dữ liệu báo cáo/audit đã
 * tồn tại từ trước, nên các trường hợp dưới đây TUYỆT ĐỐI không xóa dù đã
 * khóa đủ lâu:
 *
 * - Đã từng có `ExamCandidate` (từng được gán vào ít nhất 1 kỳ thi nào, dù
 *   có thực sự làm bài hay không) — đi qua `Employee.userId` vì
 *   `ExamCandidate` tham chiếu `employeeId`, không tham chiếu thẳng `userId`.
 * - Đã từng là actor của bất kỳ `AuditLog` nào (tài khoản từng thực hiện
 *   thao tác nghiệp vụ được ghi log — thường gặp ở admin/examiner/leader).
 */
async function hasHistoricalFootprint(user, employee) {
  if (employee) {
    const examCandidateCount = await ExamCandidate.countDocuments({ employeeId: employee._id });
    if (examCandidateCount > 0) return true;
  }
  const auditCount = await AuditLog.countDocuments({ actorUserId: user._id });
  if (auditCount > 0) return true;
  return false;
}

/**
 * Quét toàn bộ tài khoản đủ điều kiện xóa cứng:
 *  - Đang bị khóa (`isActive: false`).
 *  - Có `lockedAt` (tài khoản bị khóa TỪ TRƯỚC KHI tính năng này triển khai
 *    sẽ không có `lockedAt` -> KHÔNG bao giờ bị xóa tự động, để tránh xóa
 *    nhầm hàng loạt tài khoản cũ không rõ chính xác thời điểm khóa thật;
 *    admin cần rà soát/khóa lại thủ công 1 lần để các tài khoản này có mốc
 *    `lockedAt` rồi mới được job này tính tới).
 *  - `lockedAt` <= ngưỡng 6 tháng trước thời điểm chạy.
 *  - Không có dấu vết lịch sử (xem hasHistoricalFootprint).
 *
 * Xóa cứng cả `User` lẫn `Employee` liên kết (nếu có). Ghi 1 audit log tổng
 * hợp cho cả lượt chạy (không ghi riêng từng user) để không làm phình audit
 * log khi số lượng xóa lớn.
 *
 * Trả về { purgedCount, purgedUsernames, skippedWithHistoryCount }.
 */
export async function purgeExpiredLockedAccounts() {
  const threshold = lockedBeforeThreshold();

  const candidates = await User.find({
    isActive: false,
    lockedAt: { $ne: null, $lte: threshold },
  });

  const purgedUsernames = [];
  let skippedWithHistoryCount = 0;

  for (const user of candidates) {
    const employee = await Employee.findOne({ userId: user._id });
    const hasHistory = await hasHistoricalFootprint(user, employee);

    if (hasHistory) {
      skippedWithHistoryCount += 1;
      continue;
    }

    if (employee) {
      await Employee.deleteOne({ _id: employee._id });
    }
    await User.deleteOne({ _id: user._id });
    purgedUsernames.push(user.username);
  }

  if (purgedUsernames.length > 0 || skippedWithHistoryCount > 0) {
    await writeAudit({
      actorUserId: null, // job hệ thống tự động, không phải hành động của user cụ thể
      action: 'ACCOUNT_PURGE_AUTO',
      resourceType: 'User',
      metadata: {
        purgedCount: purgedUsernames.length,
        purgedUsernames,
        skippedWithHistoryCount,
        lockMonths: PURGE_LOCK_MONTHS,
      },
    }).catch(() => {
      /* audit lỗi không được chặn job xóa */
    });
  }

  return {
    purgedCount: purgedUsernames.length,
    purgedUsernames,
    skippedWithHistoryCount,
  };
}

export { PURGE_LOCK_MONTHS, lockedBeforeThreshold };