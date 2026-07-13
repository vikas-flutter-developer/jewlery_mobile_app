import express from "express";
import { sendWhatsappTemplate, sendWhatsappBusinessMessage, sendInvoiceEmail, getAlerts, getNotifications, markNotificationRead, getNotificationPreferences, updateNotificationPreferences } from "../controllers/notifications/notificationsController.js";

const router = express.Router();

router.get('/alerts', getAlerts);
router.get('/', getNotifications);
router.post("/whatsapp/template", sendWhatsappTemplate);
router.post("/whatsapp/business", sendWhatsappBusinessMessage);
router.post("/email/invoice", sendInvoiceEmail);
router.put('/:id/read', markNotificationRead);
router.get('/preferences', getNotificationPreferences);
router.put('/preferences', updateNotificationPreferences);

export default router;


