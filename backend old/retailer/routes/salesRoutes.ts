import express from "express";
import { createSale, getSales } from "../controllers/sales/salesController.js";

const router = express.Router();
router.get("/", getSales);
router.post("/", createSale);
export default router;


