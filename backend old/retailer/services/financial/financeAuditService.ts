import { financeAuditLogRepository, AuditContext, CreateAuditLogInput } from "../../repositories/financial/financeAuditLogRepository.js";
import { ClientSession } from "mongoose";

export type { AuditContext };

export const financeAuditService = {
  async log(input: CreateAuditLogInput, session?: ClientSession | null) {
    return financeAuditLogRepository.create(input, session);
  },

  async getAuditLogs(filters: Parameters<typeof financeAuditLogRepository.findWithFilters>[0]) {
    return financeAuditLogRepository.findWithFilters(filters);
  },

  async getAuditLogsByEntityId(entityId: string, page = 1, limit = 20) {
    return financeAuditLogRepository.findByEntityId(entityId, page, limit);
  },
};

export const buildAuditContextFromRequest = (req: {
  user?: { id?: string; email?: string; role?: string };
  ip?: string;
  headers?: Record<string, unknown>;
}): AuditContext => ({
  userId: req.user?.id,
  userName: req.user?.email,
  role: req.user?.role,
  ipAddress: req.ip,
  userAgent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
});
