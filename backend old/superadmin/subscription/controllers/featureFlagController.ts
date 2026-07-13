/**
 * featureFlagController.ts
 * HTTP layer for feature flag endpoints:
 *   GET /super-admin/feature-flags
 *   PUT /super-admin/feature-flags
 */
import { Response } from "express";
import { asyncHandler } from "../../../lib/errorHandler.js";
import { featureFlagService } from "../services/featureFlagService.js";
import { ApiResponse } from "../../lib/apiResponse.js";
import { AuthRequest } from "../../../lib/authUtils.js";

/** GET /super-admin/feature-flags */
export const listFlags = asyncHandler(async (req: AuthRequest, res: Response) => {
  const scope = req.query.scope as string | undefined;
  const flags = await featureFlagService.listFlags(scope);
  return ApiResponse.success(res, flags);
});

/**
 * PUT /super-admin/feature-flags
 *
 * Accepts either:
 *   - A single flag object:  { key, label, value, scope?, ... }
 *   - An array of flags:    [{ key, label, value, scope? }, ...]
 */
export const upsertFlags = asyncHandler(async (req: AuthRequest, res: Response) => {
  const actor = req.user?.email || "super-admin";
  const ip = req.ip;
  const body = req.body;

  if (!body) return ApiResponse.badRequest(res, "Request body is required");

  if (Array.isArray(body)) {
    // Bulk upsert
    const results = await featureFlagService.bulkUpsertFlags(body, actor, ip);
    return ApiResponse.success(res, results);
  } else if (typeof body === "object") {
    // Single upsert
    const flag = await featureFlagService.upsertFlag(body, actor, ip);
    return ApiResponse.success(res, flag);
  } else {
    return ApiResponse.badRequest(res, "Body must be a feature flag object or an array of flag objects");
  }
});
