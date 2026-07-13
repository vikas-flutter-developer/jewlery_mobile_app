import express from "express";
import {
  createOldGoldPurchase,
  listOldGoldStock,
  createOldGoldDeduction,
  issueOldGoldToKarikar,
  createMeltingLog,
  getOldGoldPurchases,
  getMeltingLogs,
} from "../controllers/oldgold/oldGoldController.js";

const router = express.Router();

router.post("/purchases", createOldGoldPurchase);
router.get("/purchases", getOldGoldPurchases);
router.get("/stock", listOldGoldStock);
router.post("/deduct", createOldGoldDeduction);
router.post("/issue", issueOldGoldToKarikar);
router.post("/melting", createMeltingLog);
router.get("/melting", getMeltingLogs);

export default router;


