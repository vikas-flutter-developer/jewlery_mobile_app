import { ClientSession } from "mongoose";
import { FinanceAuditLog } from "../../models/index.js";
import {
  FinanceActionType,
  FinanceEntityType,
} from "../../../models/FinanceAuditLog.js";
import { generateTransactionId } from "../../services/financial/financialEngineService.js";

export type AuditContext = {
  userId?: string;
  userName?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type CreateAuditLogInput = {
  actionType: FinanceActionType;
  entityType: FinanceEntityType;
  entityId: string;
  previousData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  context?: AuditContext;
};

export const financeAuditLogRepository = {
  async create(input: CreateAuditLogInput, session?: ClientSession | null) {
    const auditId = generateTransactionId("AUD");
    const docs = await FinanceAuditLog.create(
      [
        {
          auditId,
          actionType: input.actionType,
          entityType: input.entityType,
          entityId: input.entityId,
          userId: input.context?.userId,
          userName: input.context?.userName,
          role: input.context?.role,
          previousData: input.previousData ?? null,
          newData: input.newData ?? null,
          ipAddress: input.context?.ipAddress,
          userAgent: input.context?.userAgent,
          timestamp: new Date(),
        },
      ],
      session ? { session } : undefined
    );
    return docs[0];
  },

  async findWithFilters(filters: {
    actionType?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const query: Record<string, unknown> = {};
    if (filters.actionType) query.actionType = filters.actionType;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.userId) query.userId = filters.userId;
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) (query.timestamp as any).$gte = filters.startDate;
      if (filters.endDate) (query.timestamp as any).$lte = filters.endDate;
    }

    const page = Math.max(filters.page || 1, 1);
    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FinanceAuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      FinanceAuditLog.countDocuments(query),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  },

  async findByEntityId(entityId: string, page = 1, limit = 20) {
    return this.findWithFilters({ entityId, page, limit });
  },
};
