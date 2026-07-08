/**
 * subscriptionRoutes.ts
 * Registers all SaaS Subscription Module endpoints under the super-admin router.
 *
 * All routes are protected by authMiddleware + roleMiddleware(['SUPER_ADMIN']).
 *
 * Plan endpoints
 *   GET    /super-admin/plans               → list all plans
 *   GET    /super-admin/plans/:id           → get a plan by id
 *   POST   /super-admin/plans               → create a plan
 *   PUT    /super-admin/plans/:id           → update a plan
 *   DELETE /super-admin/plans/:id           → deactivate (or hard delete) a plan
 *
 * Store subscription endpoints
 *   GET    /super-admin/stores/:id/subscription  → current subscription
 *   GET    /super-admin/stores/:id/payments      → paginated payment history
 *   PUT    /super-admin/stores/:id/plan          → assign plan to store
 *   POST   /super-admin/stores/:id/suspend       → suspend store
 *   POST   /super-admin/stores/:id/reactivate    → reactivate store
 *   POST   /super-admin/stores/:id/trial         → start trial
 *
 * Feature flag endpoints
 *   GET    /super-admin/feature-flags        → list feature flags
 *   PUT    /super-admin/feature-flags        → upsert (single or bulk)
 */
import express from "express";
import { authMiddleware, roleMiddleware } from "../../../lib/authUtils.js";

// Controllers
import { listPlans, getPlan, createPlan, updatePlan, deletePlan } from "../controllers/planController.js";
import {
  getStoreSubscription,
  getStorePayments,
  assignPlan,
  suspendStore,
  reactivateStore,
  startTrial,
} from "../controllers/storeSubController.js";
import { listFlags, upsertFlags } from "../controllers/featureFlagController.js";

const router = express.Router();

// All subscription module routes require SUPER_ADMIN role
const guard = [authMiddleware, roleMiddleware(["SUPER_ADMIN"])];

// ── Subscription Plans ────────────────────────────────────────────────────────
router.get("/plans", ...guard, listPlans);
router.get("/plans/:id", ...guard, getPlan);
router.post("/plans", ...guard, createPlan);
router.put("/plans/:id", ...guard, updatePlan);
router.delete("/plans/:id", ...guard, deletePlan);

// ── Store Subscription Lifecycle ──────────────────────────────────────────────
router.get("/stores/:id/subscription", ...guard, getStoreSubscription);
router.get("/stores/:id/payments", ...guard, getStorePayments);
router.put("/stores/:id/plan", ...guard, assignPlan);
router.post("/stores/:id/suspend", ...guard, suspendStore);
router.post("/stores/:id/reactivate", ...guard, reactivateStore);
router.post("/stores/:id/trial", ...guard, startTrial);

// ── Feature Flags ─────────────────────────────────────────────────────────────
router.get("/feature-flags", ...guard, listFlags);
router.put("/feature-flags", ...guard, upsertFlags);

export default router;
