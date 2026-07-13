import express from "express";
import { createRate, getRates, getRateHistory, syncRates } from "../controllers/rates/ratesController.js";
import { getLiveRates, deleteRate, importIbjaRates } from "../controllers/rates/liveRatesController.js";

const router = express.Router();
router.get("/live", getLiveRates);
router.post("/import", importIbjaRates);
router.get("/history", getRateHistory);
router.get("/", getRates);
router.post("/", createRate);
router.post("/sync", syncRates);
router.delete("/:metal", deleteRate);
export default router;


