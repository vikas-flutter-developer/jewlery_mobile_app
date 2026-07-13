/**
 * planController.ts
 * Thin HTTP layer for SubscriptionPlan endpoints.
 * Parses req → calls planService → returns standardized ApiResponse.
 */
import { Request, Response } from "express";
import { asyncHandler } from "../../../lib/errorHandler.js";
import { planService } from "../services/planService.js";
import { ApiResponse } from "../../lib/apiResponse.js";
import { AuthRequest } from "../../../lib/authUtils.js";

/** GET /super-admin/plans */
export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const onlyActive = req.query.active === "true";
  const plans = await planService.listPlans(onlyActive);
  return ApiResponse.success(res, plans);
});

/** GET /super-admin/plans/:id */
export const getPlan = asyncHandler(async (req: Request, res: Response) => {
  const plan = await planService.getPlan(req.params.id);
  return ApiResponse.success(res, plan);
});

/** POST /super-admin/plans */
export const createPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const actor = req.user?.email || "super-admin";
  const ip = req.ip;
  const {
    name,
    slug,
    description,
    price,
    durationMonths,
    features,
    maxUsers,
    maxBranches,
    isActive,
    isTrial,
    trialDays,
    sortOrder,
    metadata,
  } = req.body;

  if (!name || !slug || price === undefined || !durationMonths) {
    return ApiResponse.badRequest(res, "name, slug, price, and durationMonths are required");
  }

  const plan = await planService.createPlan(
    { name, slug, description, price, durationMonths, features, maxUsers, maxBranches, isActive, isTrial, trialDays, sortOrder, metadata },
    actor,
    ip
  );
  return ApiResponse.created(res, plan);
});

/** PUT /super-admin/plans/:id */
export const updatePlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const actor = req.user?.email || "super-admin";
  const ip = req.ip;
  const { id } = req.params;

  const updated = await planService.updatePlan(id, req.body, actor, ip);
  return ApiResponse.success(res, updated);
});

/** DELETE /super-admin/plans/:id */
export const deletePlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const actor = req.user?.email || "super-admin";
  const ip = req.ip;
  const { id } = req.params;
  const hard = req.query.hard === "true";

  await planService.deletePlan(id, hard, actor, ip);
  return ApiResponse.success(res, {
    message: hard ? "Plan permanently deleted" : "Plan deactivated",
    id,
  });
});
