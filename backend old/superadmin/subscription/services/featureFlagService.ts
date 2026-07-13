/**
 * featureFlagService.ts
 * Business logic for FeatureFlag management.
 */
import { featureFlagRepository, UpsertFlagDto } from "../repositories/featureFlagRepository.js";
import { auditLog } from "./planService.js";

export const featureFlagService = {
  /**
   * List all feature flags, optionally filter by scope.
   */
  async listFlags(scope?: string) {
    return featureFlagRepository.findAll(scope);
  },

  /**
   * Upsert a single feature flag.
   * Validates the key format and writes an audit log.
   */
  async upsertFlag(dto: UpsertFlagDto, actor: string, ip?: string) {
    if (!dto.key || !dto.key.trim()) {
      throw { statusCode: 400, message: "Feature flag key must not be empty" };
    }
    if (typeof dto.value !== "boolean") {
      throw { statusCode: 400, message: "Feature flag value must be a boolean" };
    }
    if (dto.scope && !["GLOBAL", "PLAN", "STORE"].includes(dto.scope.toUpperCase())) {
      throw { statusCode: 400, message: "scope must be one of: GLOBAL, PLAN, STORE" };
    }

    const flag = await featureFlagRepository.upsert({ ...dto, updatedBy: actor });

    await auditLog(
      actor,
      "feature_flag.upsert",
      "feature_flag",
      dto.key,
      `Set flag "${dto.key}" = ${dto.value} (scope: ${dto.scope || "GLOBAL"})`,
      ip
    );

    return flag;
  },

  /**
   * Bulk upsert multiple flags at once (PUT /super-admin/feature-flags).
   * Validates each DTO before writing any.
   */
  async bulkUpsertFlags(dtos: UpsertFlagDto[], actor: string, ip?: string) {
    if (!Array.isArray(dtos) || dtos.length === 0) {
      throw { statusCode: 400, message: "Provide a non-empty array of feature flag objects" };
    }

    // Validate all first
    for (const dto of dtos) {
      if (!dto.key?.trim()) throw { statusCode: 400, message: `Each flag must have a key. Found entry without key.` };
      if (typeof dto.value !== "boolean") {
        throw { statusCode: 400, message: `Flag "${dto.key}" value must be a boolean` };
      }
    }

    const results = await featureFlagRepository.bulkUpsert(
      dtos.map((d) => ({ ...d, updatedBy: actor }))
    );

    await auditLog(
      actor,
      "feature_flag.bulk_upsert",
      "feature_flag",
      "bulk",
      `Bulk updated ${dtos.length} feature flag(s): ${dtos.map((d) => d.key).join(", ")}`,
      ip
    );

    return results;
  },

  /**
   * Check if a specific flag is enabled for a store/plan context.
   * Resolution order: STORE override → PLAN override → GLOBAL
   */
  async isFlagEnabled(
    key: string,
    context: { storeId?: string; planId?: string } = {}
  ): Promise<boolean> {
    // 1. Store-level override
    if (context.storeId) {
      const storeFlag = await featureFlagRepository.findByKey(`${key}__store__${context.storeId}`);
      if (storeFlag) return storeFlag.value;

      const storeFlags = await featureFlagRepository.findByStore(context.storeId);
      const match = storeFlags.find((f: any) => f.key === key);
      if (match) return match.value;
    }

    // 2. Plan-level override
    if (context.planId) {
      const planFlags = await featureFlagRepository.findByPlan(context.planId);
      const match = planFlags.find((f: any) => f.key === key);
      if (match) return match.value;
    }

    // 3. Global
    const global = await featureFlagRepository.findByKey(key);
    return global ? global.value : false;
  },
};
