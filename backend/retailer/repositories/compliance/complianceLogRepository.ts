import { ClientSession } from "mongoose";
import { ComplianceLog } from "../../models/index.js";
import { ComplianceActionType, ComplianceStatus } from "../../../models/ComplianceLog.js";

export type CreateComplianceLogInput = {
  actionType: ComplianceActionType;
  status: ComplianceStatus;
  entityType: "INVOICE" | "SALE" | "INVENTORY" | "CUSTOMER";
  entityId: string;
  message: string;
  details?: Record<string, unknown>;
  invoiceTotal?: number;
  customerPan?: string;
  tcsAmount?: number;
  userId?: string;
};

export const complianceLogRepository = {
  async create(logId: string, input: CreateComplianceLogInput, session?: ClientSession | null) {
    const docs = await ComplianceLog.create(
      [
        {
          logId,
          ...input,
          timestamp: new Date(),
        },
      ],
      session ? { session } : undefined
    );
    return docs[0];
  },

  async findWithFilters(filters: {
    actionType?: string;
    status?: string;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const query: Record<string, unknown> = {};
    if (filters.actionType) query.actionType = filters.actionType;
    if (filters.status) query.status = filters.status;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) (query.timestamp as any).$gte = filters.startDate;
      if (filters.endDate) (query.timestamp as any).$lte = filters.endDate;
    }

    const page = Math.max(filters.page || 1, 1);
    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ComplianceLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      ComplianceLog.countDocuments(query),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  },

  async findByEntityId(entityId: string, page = 1, limit = 20) {
    return this.findWithFilters({ entityId, page, limit });
  },
};
