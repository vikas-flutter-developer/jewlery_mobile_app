import express from "express";
import { 
  getRetailerSubscriptions, 
  createRetailerSubscription, 
  updateRetailerSubscription 
} from "../controllers/subscriptions/subscriptionController.js";
import { authMiddleware, roleMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

router.get("/", authMiddleware, getRetailerSubscriptions);
router.post("/", authMiddleware, roleMiddleware(["ADMIN", "RETAILER"]), createRetailerSubscription);
router.put("/:id", authMiddleware, roleMiddleware(["ADMIN", "RETAILER"]), updateRetailerSubscription);

export default router;
