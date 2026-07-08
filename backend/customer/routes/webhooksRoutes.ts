import express from "express";
import { receiveWebhook } from "../controllers/webhooks/webhooksController.js";

const router = express.Router();
router.post("/:provider", receiveWebhook);

export default router;


