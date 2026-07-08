import express from "express";
import jwt from "jsonwebtoken";
import { deleteRate } from "./retailer/controllers/rates/liveRatesController.js";

const JWT_SECRET = process.env.JWT_SECRET || "aurajewel_secret_key_2026";

// ── Shared / cross-role routes ──────────────────────────────────────────────
import authRoutes from "./shared/routes/authRoutes.js";
import healthRoutes from "./shared/routes/healthRoutes.js";
import usersRoutes from "./shared/routes/usersRoutes.js";
import debugRoutes from "./shared/routes/debugRoutes.js";
import masterRoutes from "./shared/routes/masterRoutes.js";
import uploadRoutes from "./shared/routes/uploadRoutes.js";
import settingsRoutes from "./shared/routes/settingsRoutes.js";
import auditRoutes from "./shared/routes/auditRoutes.js";
import tasksRoutes from "./shared/routes/tasksRoutes.js";
import securityRoutes from "./shared/routes/securityRoutes.js";
import karikarRoutes from "./shared/routes/karikarRoutes.js";
import dedicatedKarikarRoutes from "./karikar/routes/karikarRoutes.js";

// ── Super-Admin routes ──────────────────────────────────────────────────────
import superAdminRoutes from "./superadmin/routes/index.js";

// ── Manufacturer role routes ────────────────────────────────────────────────
import manufacturerRoutes from "./manufacturer/routes/index.js";

// ── Retailer role routes ────────────────────────────────────────────────────
import retailerRoutes from "./retailer/routes/index.js";
// Explicitly import retailer barcode routes for the /retailer/* alias mount
import retailerBarcodesRoutes from "./retailer/routes/barcodesRoutes.js";

// ── Customer role routes ────────────────────────────────────────────────────
import customerRoutes from "./customer/routes/index.js";
import jobsRoutes from "./routes/jobsRoutes.js";
import { getPublicOrderTracking } from "./retailer/controllers/orders/orderTrackingController.js";

const getJwtSecret = () => process.env.JWT_SECRET || "aurajewel_secret_key_2026";

const router = express.Router();

// Public unauthenticated tracking route
router.get("/public/order-tracking/:token", getPublicOrderTracking);

// Transparent path rewriting middleware for Manufacturer store users

router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded: any = jwt.verify(token, getJwtSecret());
      if (decoded && (decoded.storeType === "MANUFACTURER" || decoded.role === "ADMIN")) {
        // Exempt prefixes that should not be rewritten
        const exemptPrefixes = [
          "/auth",
          "/health",
          "/users",
          "/tasks",
          "/debug",
          "/master",
          "/upload",
          "/settings",
          "/audit-logs",
          "/security",
          "/super-admin",
          "/manufacturer",
          "/verify",
          "/portal",
          "/notifications",
          "/accounts",
          "/loyalty",
          "/ledger",
          "/catalog",
          "/crm",
          "/webhooks",
          "/customers",
          "/retailer",
          "/karikar",
          "/karikars"
        ];
        
        const hasExemptPrefix = exemptPrefixes.some(prefix => req.path.startsWith(prefix));
        if (!hasExemptPrefix) {
          console.log(`[Path Rewrite] Rewriting Manufacturer request ${req.method} ${req.url} -> /manufacturer${req.url}`);
          req.url = `/manufacturer${req.url}`;
        }
      }
    } catch (err: any) {
      console.error("[Path Rewrite Error] Token verification failed:", err.message || err);
    }
  }
  next();
});

// ────────────────────────────────────────────────────────────────────────────
// SHARED / SYSTEM routes
// ────────────────────────────────────────────────────────────────────────────
router.use("/auth", authRoutes);
router.use("/health", healthRoutes);
router.use("/users", usersRoutes);
router.use("/tasks", tasksRoutes);
router.use("/debug", debugRoutes);
router.use("/master", masterRoutes);
router.use("/upload", uploadRoutes);
router.use("/settings", settingsRoutes);
router.use("/audit-logs", auditRoutes);
router.use("/security", securityRoutes);

// ────────────────────────────────────────────────────────────────────────────
// SHARED KARIKAR routes (for both KARIKAR role and ADMIN users)
// ────────────────────────────────────────────────────────────────────────────
router.use("/karikars", karikarRoutes);
router.use("/karikar", dedicatedKarikarRoutes);

// ────────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN routes  (DB: super_admin)
// ────────────────────────────────────────────────────────────────────────────
router.use("/super-admin", superAdminRoutes);

// ────────────────────────────────────────────────────────────────────────────
// MANUFACTURER routes  (DB: manufacturer)
// ────────────────────────────────────────────────────────────────────────────
router.use("/manufacturer", manufacturerRoutes);

// ────────────────────────────────────────────────────────────────────────────
// RETAILER routes  (DB: retailer)
// ────────────────────────────────────────────────────────────────────────────
router.use(retailerRoutes);
// ── Explicit /retailer/barcodes alias ────────────────────────────────────────
// Because retailerRoutes is already mounted at root (no prefix), re-using
// the same Router instance at '/retailer' does not work reliably in Express.
// We import the barcodesRoutes sub-router directly and mount it at the
// explicit /retailer/barcodes path so the frontend can call it without
// risking path-rewriting to /manufacturer.
router.use('/retailer/barcodes', retailerBarcodesRoutes);
// Fallback direct DELETE route for rates to ensure deletes work regardless of router ordering
router.delete("/rates/:metal", deleteRate);

// ────────────────────────────────────────────────────────────────────────────
// CUSTOMER routes  (DB: customer)
// ────────────────────────────────────────────────────────────────────────────
router.use(customerRoutes);
// Job Card APIs
router.use('/jobs', jobsRoutes);

export default router;
