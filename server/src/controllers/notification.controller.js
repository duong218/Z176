import { notificationService } from '../services/notification.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/api-error.js';

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    const data = await notificationService.listForUser(req.auth.userId);
    res.json({ success: true, message: 'OK', data });
  }),

  unreadCount: asyncHandler(async (req, res) => {
    const count = await notificationService.countUnread(req.auth.userId);
    res.json({ success: true, message: 'OK', data: { count } });
  }),

  markRead: asyncHandler(async (req, res) => {
    const data = await notificationService.markAsRead(req.params.id, req.auth.userId);
    if (!data) {
      throw new ApiError(404, 'Không tìm thấy thông báo', 'NOTIFICATION_NOT_FOUND');
    }
    res.json({ success: true, message: 'Đã đánh dấu đã đọc', data });
  }),

  markAllRead: asyncHandler(async (req, res) => {
    await notificationService.markAllAsRead(req.auth.userId);
    res.json({ success: true, message: 'Đã đánh dấu tất cả đã đọc' });
  }),
};