import { Request, Response } from "express";

export const receiveWebhook = async (req: Request, res: Response) => {
  try {
    const provider = String(req.params.provider || "unknown").toUpperCase();
    const event = req.body || {};
    console.log(`[webhooks] ${provider} event received`, JSON.stringify(event, null, 2));

    return res.status(200).json({
      success: true,
      message: `Webhook event received for ${provider}`,
      provider,
      event,
    });
  } catch (error: any) {
    console.error("Webhook processing failed", error);
    return res.status(500).json({ success: false, error: error.message || "Webhook processing failed" });
  }
};


