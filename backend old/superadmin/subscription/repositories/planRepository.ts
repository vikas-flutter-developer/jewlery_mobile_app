/**
 * planRepository.ts
 * Data-access layer for SubscriptionPlan documents.
 * No business logic — only CRUD + query operations.
 */
import mongoose from "mongoose";
import { SuperAdminSubscriptionPlan as Plan } from "../../models/index.js";

export interface CreatePlanDto {
  name: string;
  slug: string;
  description?: string;
  price: number;
  durationMonths: number;
  features?: string[];
  maxUsers?: number;
  maxBranches?: number;
  isActive?: boolean;
  isTrial?: boolean;
  trialDays?: number;
  sortOrder?: number;
  metadata?: Record<string, any>;
}

export interface UpdatePlanDto extends Partial<CreatePlanDto> {}

export const planRepository = {
  /** Retrieve all plans, optionally filtered by active status */
  async findAll(onlyActive = false) {
    const filter = onlyActive ? { isActive: true } : {};
    return Plan.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();
  },

  /** Find a single plan by MongoDB _id */
  async findById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Plan.findById(id).lean();
  },

  /** Find a single plan by its unique slug */
  async findBySlug(slug: string) {
    return Plan.findOne({ slug: slug.toLowerCase().trim() }).lean();
  },

  /** Create a new plan */
  async create(dto: CreatePlanDto) {
    return Plan.create({
      ...dto,
      slug: dto.slug.toLowerCase().trim(),
    });
  },

  /** Update plan fields by _id */
  async update(id: string, dto: UpdatePlanDto) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    if (dto.slug) dto.slug = dto.slug.toLowerCase().trim();
    return Plan.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true }).lean();
  },

  /** Soft-delete by deactivating, or hard delete */
  async delete(id: string, hard = false) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    if (hard) {
      return Plan.findByIdAndDelete(id).lean();
    }
    return Plan.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }).lean();
  },

  /** Count all plans */
  async count(filter: Record<string, any> = {}) {
    return Plan.countDocuments(filter);
  },
};
