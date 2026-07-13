/**
 * storeSubRepository.ts
 * Data-access layer for StoreSubscription documents.
 * No business logic — only CRUD + query operations.
 */
import mongoose from "mongoose";
import { SuperAdminStoreSubscription as StoreSub } from "../../models/index.js";

export interface CreateStoreSubDto {
  storeId: string;
  planId: string | mongoose.Types.ObjectId;
  planSlug: string;
  planName: string;
  status?: string;
  startDate: Date;
  endDate: Date;
  trialEndsAt?: Date | null;
  autoRenew?: boolean;
  assignedBy?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateStoreSubDto extends Partial<Omit<CreateStoreSubDto, "storeId">> {
  suspendedAt?: Date | null;
  suspendReason?: string;
  reactivatedAt?: Date | null;
  cancelledAt?: Date | null;
  lastRenewedAt?: Date | null;
}

export const storeSubRepository = {
  /** Get the latest subscription for a store */
  async findByStoreId(storeId: string) {
    return StoreSub.findOne({ storeId }).sort({ createdAt: -1 }).lean();
  },

  /** Get all subscriptions for a store (history) */
  async findAllByStoreId(storeId: string) {
    return StoreSub.find({ storeId }).sort({ createdAt: -1 }).lean();
  },

  /** Find by MongoDB _id */
  async findById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return StoreSub.findById(id).lean();
  },

  /** Find subscriptions expiring within N days (for cron jobs / dashboards) */
  async findExpiringSoon(withinDays = 7) {
    const now = new Date();
    const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    return StoreSub.find({
      status: { $in: ["ACTIVE", "TRIAL"] },
      endDate: { $gte: now, $lte: threshold },
    }).lean();
  },

  /** Find subscriptions that are past their endDate but still ACTIVE/TRIAL */
  async findExpired() {
    return StoreSub.find({
      status: { $in: ["ACTIVE", "TRIAL"] },
      endDate: { $lt: new Date() },
    }).lean();
  },

  /** Create a new StoreSubscription document */
  async create(dto: CreateStoreSubDto) {
    return StoreSub.create(dto);
  },

  /** Update a StoreSubscription by _id */
  async update(id: string, dto: UpdateStoreSubDto) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return StoreSub.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true }).lean();
  },

  /** Update the latest subscription for a storeId */
  async updateLatestForStore(storeId: string, dto: UpdateStoreSubDto) {
    const latest = await StoreSub.findOne({ storeId }).sort({ createdAt: -1 });
    if (!latest) return null;
    Object.assign(latest, dto);
    return latest.save();
  },

  /** Count total subscriptions (optional filter) */
  async count(filter: Record<string, any> = {}) {
    return StoreSub.countDocuments(filter);
  },
};
