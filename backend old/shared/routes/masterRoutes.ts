import express from "express";
import { createOrUpdatePurity } from "../controllers/master/purityController.js";

const router = express.Router();

router.post("/purity", createOrUpdatePurity);

export default router;


