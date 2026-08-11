import { asyncHandler } from '../utils/async-handler.js';
import { auditService } from '../services/audit.service.js';

export const auditController = {
  getAuditLogs: asyncHandler(async (req, res) => {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
    };
    const data = await auditService.getAuditLogs(filters);
    res.json({
      success: true,
      data: data.items,
      pagination: data.pagination,
    });
  }),
};
