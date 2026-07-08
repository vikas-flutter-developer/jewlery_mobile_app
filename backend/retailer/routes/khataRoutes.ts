import express from "express";
import { createKhata, getKhata, updateKhata } from "../controllers/khata/khataController.js";

const router = express.Router();
router.get("/", getKhata);
router.post("/", createKhata);
router.put("/:id", updateKhata);
export default router;


