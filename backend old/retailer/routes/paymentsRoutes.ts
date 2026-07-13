import express from "express";
import { createPaymentOrder, verifyPayment, createPayUOrder, verifyPayUPayment } from "../controllers/payments/paymentsController.js";

const router = express.Router();
router.post("/create-order", createPaymentOrder);
router.post("/verify", verifyPayment);
router.post("/payu/create-order", createPayUOrder);
router.post("/payu/verify", verifyPayUPayment);
export default router;


