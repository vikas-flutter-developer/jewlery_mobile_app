/**
 * storeSubController.ts
 * Thin HTTP layer for store subscription lifecycle endpoints:
 *   GET  /super-admin/stores/:id/payments
 *   PUT  /super-admin/stores/:id/plan
 *   POST /super-admin/stores/:id/suspend
 *   POST /super-admin/stores/:id/reactivate
 *   POST /super-admin/stores/:id/trial
 */
import { Response } from "express";
import { asyncHandler } from "../../../lib/errorHandler.js";
import { storeSubService } from "../services/storeSubService.js";
import { ApiResponse, parsePagination } from "../../lib/apiResponse.js";
import { AuthRequest } from "../../../lib/authUtils.js";

/** GET /super-admin/stores/:id/payments */
export const getStorePayments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id: storeId } = req.params;
  const { page, limit } = parsePagination(req.query as any);
  const { data, pagination } = await storeSubService.getPaymentHistory(storeId, page, limit);
  return ApiResponse.paginated(res, data, pagination);
});

/** GET /super-admin/stores/:id/subscription */
export const getStoreSubscription = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id: storeId } = req.params;
  const sub = await storeSubService.getSubscription(storeId);
  if (!sub) return ApiResponse.notFound(res, "No subscription found for this store");
  return ApiResponse.success(res, sub);
});

/** PUT /super-admin/stores/:id/plan */
export const assignPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const actor = req.user?.email || "super-admin";
  const ip = req.ip;
  const { id: storeId } = req.params;
  const { planId, amount, method, referenceId, gateway, notes, invoiceId, invoiceNumber } = req.body;

  if (!planId) return ApiResponse.badRequest(res, "planId is required");

  const result = await storeSubService.assignPlan(
    storeId,
    planId,
    { amount, method, referenceId, gateway, notes, invoiceId, invoiceNumber },
    actor,
    ip
  );
  return ApiResponse.created(res, result);
});

/** POST /super-admin/stores/:id/suspend */
export const suspendStore = asyncHandler(async (req: AuthRequest, res: Response) => {
  const actor = req.user?.email || "super-admin";
  const ip = req.ip;
  const { id: storeId } = req.params;
  const { reason } = req.body;

  const updated = await storeSubService.suspendStore(storeId, reason || "Suspended by super admin", actor, ip);
  return ApiResponse.success(res, { message: "Store suspended", subscription: updated });
});

/** POST /super-admin/stores/:id/reactivate */
export const reactivateStore = asyncHandler(async (req: AuthRequest, res: Response) => {
  const actor = req.user?.email || "super-admin";
  const ip = req.ip;
  const { id: storeId } = req.params;

  const updated = await storeSubService.reactivateStore(storeId, actor, ip);
  return ApiResponse.success(res, { message: "Store reactivated", subscription: updated });
});

/** POST /super-admin/stores/:id/trial */
export const startTrial = asyncHandler(async (req: AuthRequest, res: Response) => {
  const actor = req.user?.email || "super-admin";
  const ip = req.ip;
  const { id: storeId } = req.params;
  const { planId, trialDays } = req.body;

  if (!planId) return ApiResponse.badRequest(res, "planId is required");

  const sub = await storeSubService.startTrial(storeId, planId, trialDays ?? 14, actor, ip);
  return ApiResponse.created(res, { message: "Trial started", subscription: sub });
});
