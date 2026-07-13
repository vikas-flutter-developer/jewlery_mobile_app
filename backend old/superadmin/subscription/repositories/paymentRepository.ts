/**
 * paymentRepository.ts
 * Data-access layer for PaymentHistory documents.
 * PaymentHistory records are immutable once created (append-only ledger).
 */
import mongoose from "mongoose";
import { SuperAdminPaymentHistory as Payment } from "../../models/index.js";
import { buildPaginationMeta } from "../../lib/apiResponse.js";

export interface CreatePaymentDto {
  storeId: string;
  planId: string | mongoose.Types.ObjectId;
  planSlug: string;
  planName: string;
  subscriptionId?: string | mongoose.Types.ObjectId | null;
  amount: number;
  currency?: string;
  method: string;
  status?: string;
  referenceId?: string;
  gateway?: string;
  gatewayResponse?: any;
  invoiceId?: string;
  invoiceNumber?: string;
  paidAt?: Date | null;
  notes?: string;
  recordedBy?: string;
  metadata?: Record<string, any>;
}

export const paymentRepository = {
  /** Get paginated payment history for a store */
  async findByStoreId(storeId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Payment.find({ storeId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments({ storeId }),
    ]);
    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  /** Find a single payment by _id */
  async findById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Payment.findById(id).lean();
  },

  /** Find by referenceId (UPI txn, Razorpay order, cheque number, etc.) */
  async findByReferenceId(referenceId: string) {
    return Payment.findOne({ referenceId }).lean();
  },

  /** Create a new payment record (append-only) */
  async create(dto: CreatePaymentDto) {
    return Payment.create(dto);
  },

  /** Update payment status only (for async gateway callbacks) */
  async updateStatus(
    id: string,
    status: string,
    extra: { paidAt?: Date; failedAt?: Date; refundedAt?: Date; gatewayResponse?: any } = {}
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Payment.findByIdAndUpdate(id, { $set: { status, ...extra } }, { new: true }).lean();
  },

  /** Aggregate total revenue for a store */
  async totalRevenueByStore(storeId: string) {
    const result = await Payment.aggregate([
      { $match: { storeId, status: "SUCCESS" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return result[0]?.total ?? 0;
  },

  /** Count payments (optional filter) */
  async count(filter: Record<string, any> = {}) {
    return Payment.countDocuments(filter);
  },
};
