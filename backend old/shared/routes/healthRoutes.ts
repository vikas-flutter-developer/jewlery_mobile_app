import express from "express";
import { getHealth, getCollections } from "../controllers/health/healthController.js";

const router = express.Router();
router.get("/", getHealth);
router.get("/collections", getCollections);
export default router;


