import express from "express";
import { login, getProfile, oauthCallback, verifyOtp, getApiKey, logout, requestPasswordReset, resetPassword, listSessions, revokeSessionEndpoint, changePassword } from "../controllers/auth/authController.js";
import { authMiddleware, AuthRequest } from "../../lib/authUtils.js";
import { Response } from "express";

const router = express.Router();

router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.post("/oauth-callback", oauthCallback);
router.get("/me", authMiddleware, getProfile);
router.get("/api-key", authMiddleware, getApiKey);
router.post("/verify-otp", verifyOtp);
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.post("/change-password", authMiddleware, changePassword);
router.get("/sessions", authMiddleware, listSessions);
router.post("/sessions/revoke", authMiddleware, revokeSessionEndpoint);

/**
 * GET /auth/check-session
 * Lightweight session validation endpoint polled by the frontend.
 * Runs the full authMiddleware (JWT verify + store status check).
 * Returns 200 {valid: true} if the session is still valid.
 * Returns 401 with a message if the store was deleted, suspended, or expired.
 */
router.get("/check-session", authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ valid: true, role: req.user?.role, tenantId: req.user?.tenantId });
});

export default router;






