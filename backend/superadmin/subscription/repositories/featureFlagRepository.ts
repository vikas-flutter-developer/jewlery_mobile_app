/**
 * featureFlagRepository.ts
 * Data-access layer for FeatureFlag documents.
 * Also syncs boolean GLOBAL flags to platformStore.json for backward compatibility.
 */
import { SuperAdminFeatureFlag as Flag } from "../../models/index.js";
import { readPlatformStore, writePlatformStore } from "../../../lib/platformStore.js";

export interface UpsertFlagDto {
  key: string;
  label?: string;
  description?: string;
  value: boolean;
  scope?: "GLOBAL" | "PLAN" | "STORE";
  targetPlanId?: string | null;
  targetStoreId?: string | null;
  updatedBy?: string;
  metadata?: Record<string, any>;
}

export const featureFlagRepository = {
  /** Get all feature flags, optional scope filter */
  async findAll(scope?: string) {
    const filter: Record<string, any> = {};
    if (scope) filter.scope = scope.toUpperCase();
    return Flag.find(filter).sort({ key: 1 }).lean();
  },

  /** Find a flag by its key */
  async findByKey(key: string) {
    return Flag.findOne({ key: key.trim() }).lean();
  },

  /** Find all flags for a specific plan */
  async findByPlan(planId: string) {
    return Flag.find({ targetPlanId: planId, scope: "PLAN" }).lean();
  },

  /** Find all flags for a specific store */
  async findByStore(storeId: string) {
    return Flag.find({ targetStoreId: storeId, scope: "STORE" }).lean();
  },

  /**
   * Upsert (create or update) a single feature flag.
   * Automatically syncs GLOBAL boolean flags to platformStore.json.
   */
  async upsert(dto: UpsertFlagDto) {
    const { key, ...rest } = dto;
    const flag = await Flag.findOneAndUpdate(
      { key: key.trim() },
      { $set: { key: key.trim(), ...rest } },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    // Sync GLOBAL flags to platformStore.json for backward compat
    if (flag && (flag.scope === "GLOBAL" || !flag.scope)) {
      await featureFlagRepository._syncToPlatformStore(key, dto.value);
    }

    return flag;
  },

  /**
   * Bulk upsert — used by PUT /super-admin/feature-flags
   */
  async bulkUpsert(dtos: UpsertFlagDto[]) {
    const results = await Promise.all(dtos.map((dto) => featureFlagRepository.upsert(dto)));
    return results;
  },

  /** Hard delete a flag by key */
  async deleteByKey(key: string) {
    return Flag.findOneAndDelete({ key: key.trim() }).lean();
  },

  /**
   * Internal: sync a GLOBAL flag's boolean value into platformStore.json
   * so existing code using readPlatformStore().featureFlags still works.
   */
  async _syncToPlatformStore(key: string, value: boolean) {
    try {
      const doc = await readPlatformStore();
      (doc.featureFlags as any)[key] = value;
      await writePlatformStore(doc);
    } catch (err) {
      console.error(`[FeatureFlagRepo] Failed to sync flag "${key}" to platformStore:`, err);
    }
  },
};
