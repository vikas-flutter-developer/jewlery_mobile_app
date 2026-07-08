import express from "express";
import { getRetailerOrders, createRetailerOrder, updateRetailerOrderStatus, getManufacturersList } from "../controllers/retailerOrders/retailerOrdersController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

router.get("/", authMiddleware, getRetailerOrders);
router.get("/manufacturers", authMiddleware, getManufacturersList);
router.post("/", authMiddleware, createRetailerOrder);
router.put("/:id", authMiddleware, updateRetailerOrderStatus);

export default router;



