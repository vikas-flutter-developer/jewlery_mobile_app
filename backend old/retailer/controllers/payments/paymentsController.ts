import { Request, Response } from "express";
import { getRazorpayInstance } from "../../../lib/serverState.js";
import * as crypto from "crypto";

export const createPaymentOrder = async (req: Request, res: Response) => {
  try {
    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      return res.status(503).json({
        error: "Razorpay is not configured on server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.local and restart the server.",
      });
    }
    const { amount, currency } = req.body;
    const options = {
      amount: Math.round(amount * 100),
      currency: currency || "INR",
      receipt: `receipt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    res.status(500).json({ error: "Failed to create Razorpay order" });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpaySecret) {
      return res.status(503).json({
        error: "Razorpay verification is not configured on server. Set RAZORPAY_KEY_SECRET in backend/.env.local and restart the server.",
      });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ error: "Internal server error during verification" });
  }
};

export const createPayUOrder = async (req: Request, res: Response) => {
  try {
    const { amount, currency = "INR", customerName, customerEmail } = req.body;
    if (!amount || !customerName || !customerEmail) {
      return res.status(400).json({ error: "amount, customerName, and customerEmail are required" });
    }

    const orderId = `PAYU-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const order = {
      orderId,
      amount,
      currency,
      customerName,
      customerEmail,
      provider: "PayU",
      status: process.env.PAYU_ENABLED === "true" ? "PENDING" : "TEST_MODE",
      createdAt: new Date().toISOString(),
      redirectUrl: process.env.PAYU_REDIRECT_URL || "https://test.payu.in/_payment",
    };

    console.log("[payments] PayU order stub created", order);
    return res.json({ success: true, data: order });
  } catch (error: any) {
    console.error("PayU order creation failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to create PayU order" });
  }
};

export const verifyPayUPayment = async (req: Request, res: Response) => {
  try {
    const { txnId, status, hash } = req.body;
    if (!txnId || !status) {
      return res.status(400).json({ success: false, message: "txnId and status are required" });
    }

    if (process.env.PAYU_MERCHANT_KEY && process.env.PAYU_MERCHANT_SALT && hash) {
      // Basic stub signature check for PayU test mode.
      const expected = crypto
        .createHash("sha512")
        .update(`${process.env.PAYU_MERCHANT_KEY}|${txnId}|${status}|${process.env.PAYU_MERCHANT_SALT}`)
        .digest("hex");
      if (hash !== expected) {
        return res.status(400).json({ success: false, message: "Invalid PayU signature" });
      }
    }

    res.json({ success: true, message: "PayU payment verified", data: { txnId, status } });
  } catch (error: any) {
    console.error("PayU verification error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to verify PayU payment" });
  }
};


