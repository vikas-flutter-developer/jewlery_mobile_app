import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { Customer, CustomerReferral, Notification, Sale } from "../../models/index.js";
import { randomUUID } from "crypto";

// Mock Fallback Storage
let mockReferrals: any[] = [];
let mockRules = {
  rewardType: "POINTS", // "POINTS" or "AMOUNT"
  rewardValue: 100 // 100 points or Rs 100 cash reward
};

// Helper for unique notification IDs
const generateNotificationId = () => `NOTIF-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

// Send notifications via Notification center
async function sendReferralNotification(
  type: string,
  title: string,
  message: string,
  orderOrRefId: string,
  emails: string[] = []
) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: generateNotificationId(),
        type,
        title,
        message,
        category: "ReferralRewards",
        severity: "INFO",
        channels: ["IN_APP", "EMAIL"],
        recipientEmails: emails,
        relatedEntityId: orderOrRefId,
        reference: orderOrRefId,
        sendAt: new Date(),
        status: "PENDING"
      });
    }
  } catch (err) {
    console.error("[Referral Notification] Error:", err);
  }
}

// Log audit activities
async function logReferralAudit(action: string, refId: string, details: string, email: string) {
  console.log(`[Referral Audit] Action: ${action} | RefId: ${refId} | Details: ${details} | User: ${email}`);
}

/**
 * POST /api/referrals/generate-code
 */
export const generateReferralCode = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user as any;
    
    // Find customer by phone or user email/id link
    let customer: any;
    if (isDbConnected()) {
      customer = await Customer.findOne({ phone: user.phone || user.email });
      if (!customer && user.role === "CUSTOMER") {
        customer = await Customer.findOne({ email: user.email });
      }
    } else {
      customer = { _id: "cust_mock_ref", name: user.email, phone: user.phone || "9999999999", referredBy: "" };
    }


    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found for user account" });
    }

    // Use phone number suffix or random generator for referral code
    const baseCode = customer.name ? customer.name.substring(0, 4).toUpperCase() : "REF";
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referralCode = `${baseCode}-${rand}`;

    if (isDbConnected()) {
      customer.referredBy = customer.referredBy || referralCode; // save code to customer referredBy schema context if needed
      await Customer.findByIdAndUpdate(customer._id, { referredBy: customer.referredBy });
    }

    return res.status(200).json({ success: true, referralCode });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate referral code" });
  }
};

/**
 * POST /api/referrals/register
 * Body: referralCode, referredCustomerPhone
 */
export const registerReferral = async (req: AuthRequest, res: Response) => {
  try {
    const { referralCode, referredCustomerPhone } = req.body;
    const actor = req.user!;

    if (!referralCode || !referredCustomerPhone) {
      return res.status(400).json({ error: "Referral code and referred customer phone are required" });
    }

    let referrer: any;
    let referred: any;

    if (isDbConnected()) {
      // Find referrer by matching code
      referrer = await Customer.findOne({ referredBy: referralCode });
      referred = await Customer.findOne({ phone: referredCustomerPhone });
    } else {
      referrer = { _id: "mock_referrer_id", phone: "9876543210", email: "referrer@example.com" };
      referred = { _id: "mock_referred_id", phone: referredCustomerPhone, email: "referred@example.com", createdAt: new Date() };
    }

    if (!referrer) {
      return res.status(404).json({ error: "Invalid referral code. Referrer not found." });
    }

    if (!referred) {
      return res.status(404).json({ error: "Referred customer phone number not registered as profile yet." });
    }

    // Prevent Self-Referral
    if (referrer._id.toString() === referred._id.toString()) {
      return res.status(400).json({ error: "Self-referral is strictly prohibited" });
    }

    // Check duplicate referral (referred customer cannot be referred multiple times)
    let duplicateCheck: any;
    if (isDbConnected()) {
      duplicateCheck = await CustomerReferral.findOne({ referredCustomerId: referred._id });
    } else {
      duplicateCheck = mockReferrals.find(r => r.referredCustomerId === referred._id);
    }

    if (duplicateCheck) {
      return res.status(400).json({ error: "This customer has already been referred" });
    }

    // Verify if qualifying purchase already exists before referral setup
    let preExistingSalesCount = 0;
    if (isDbConnected()) {
      preExistingSalesCount = await Sale.countDocuments({ customerId: referred._id });
    }
    if (preExistingSalesCount > 0) {
      return res.status(400).json({ error: "Referral cannot be registered after customer has already made a purchase" });
    }

    const referralData = {
      referrerCustomerId: referrer._id,
      referredCustomerId: referred._id,
      referralCode,
      referralStatus: "PENDING",
      rewardType: mockRules.rewardType,
      rewardValue: mockRules.rewardValue,
      rewardStatus: "PENDING"
    };

    let referralRecord: any;
    if (isDbConnected()) {
      referralRecord = new CustomerReferral(referralData);
      await referralRecord.save();
    } else {
      referralRecord = { ...referralData, _id: `ref_mock_${Date.now()}` };
      mockReferrals.push(referralRecord);
    }

    await logReferralAudit("Referral Registered", referralRecord._id, `Referrer: ${referrer._id} referred ${referred._id}`, actor.email);

    // Notify Referrer and Store Admin
    await sendReferralNotification(
      "REFERRAL_REGISTERED",
      "New Referral Registered",
      `Customer with phone ${referredCustomerPhone} registered using your referral code. Reward is pending their first purchase.`,
      referralRecord._id,
      [referrer.email || ""]
    );

    return res.status(201).json({ success: true, data: referralRecord });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to register referral" });
  }
};

/**
 * GET /api/referrals/my-referrals
 */
export const getMyReferrals = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user as any;
    let customer: any;

    if (isDbConnected()) {
      customer = await Customer.findOne({ phone: user.phone || user.email });
      if (!customer && user.role === "CUSTOMER") {
        customer = await Customer.findOne({ email: user.email });
      }
    } else {
      customer = { _id: "mock_referrer_id" };
    }

    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    let list: any[] = [];
    if (isDbConnected()) {
      list = await CustomerReferral.find({ referrerCustomerId: customer._id })
        .populate("referredCustomerId", "name phone customerSince")
        .lean();
    } else {
      list = mockReferrals.filter(r => r.referrerCustomerId === customer._id);
    }

    return res.json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch referrals" });
  }
};

/**
 * GET /api/referrals/my-rewards
 */
export const getMyRewards = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user as any;
    let customer: any;

    if (isDbConnected()) {
      customer = await Customer.findOne({ phone: user.phone || user.email });
      if (!customer && user.role === "CUSTOMER") {
        customer = await Customer.findOne({ email: user.email });
      }
    } else {
      customer = { _id: "mock_referrer_id" };
    }

    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    let list: any[] = [];
    if (isDbConnected()) {
      list = await CustomerReferral.find({ 
        referrerCustomerId: customer._id, 
        referralStatus: { $in: ["QUALIFIED", "REWARDED"] } 
      })
      .populate("referredCustomerId", "name phone")
      .lean();
    } else {
      list = mockReferrals.filter(r => r.referrerCustomerId === customer._id && ["QUALIFIED", "REWARDED"].includes(r.referralStatus));
    }

    return res.json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch rewards history" });
  }
};

/**
 * GET /api/referrals/summary
 */
export const getReferralSummary = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user as any;
    let customer: any;

    if (isDbConnected()) {
      customer = await Customer.findOne({ phone: user.phone || user.email });
      if (!customer && user.role === "CUSTOMER") {
        customer = await Customer.findOne({ email: user.email });
      }
    } else {
      customer = { _id: "mock_referrer_id", referredBy: "MOCKCODE" };
    }

    let referrals: any[] = [];
    if (isDbConnected() && customer) {
      referrals = await CustomerReferral.find({ referrerCustomerId: customer._id }).lean();
    } else {
      referrals = mockReferrals.filter(r => r.referrerCustomerId === "mock_referrer_id");
    }

    const totalReferrals = referrals.length;
    const qualifiedReferrals = referrals.filter(r => r.referralStatus === "QUALIFIED" || r.referralStatus === "REWARDED").length;
    const rewardsEarned = referrals
      .filter(r => r.rewardStatus === "ISSUED" || r.rewardStatus === "REDEEMED")
      .reduce((sum, r) => sum + (r.rewardValue || 0), 0);

    const pendingRewards = referrals
      .filter(r => r.referralStatus === "PENDING")
      .reduce((sum, r) => sum + (r.rewardValue || 0), 0);

    return res.json({
      success: true,
      data: {
        referralCode: customer ? customer.referredBy || "NOT_GENERATED" : "NOT_GENERATED",
        totalReferrals,
        qualifiedReferrals,
        rewardsEarned,
        pendingRewards
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to query referrals summary" });
  }
};

/**
 * POST /api/referrals/reward
 * Manual trigger for Admin to process/complete rewards
 */
export const processReferralReward = async (req: AuthRequest, res: Response) => {
  try {
    const { referralId } = req.body;
    const user = req.user!;

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    let referral: any;
    if (isDbConnected()) {
      referral = await CustomerReferral.findById(referralId);
    } else {
      referral = mockReferrals.find(r => r._id === referralId);
    }

    if (!referral) {
      return res.status(404).json({ error: "Referral record not found" });
    }

    referral.referralStatus = "REWARDED";
    referral.rewardStatus = "ISSUED";

    if (isDbConnected()) {
      await referral.save();
      // Credit loyalty points to referrer
      const referrerCust = await Customer.findById(referral.referrerCustomerId);
      if (referrerCust && referral.rewardType === "POINTS") {
        referrerCust.loyaltyPoints = (referrerCust.loyaltyPoints || 0) + (referral.rewardValue || 0);
        await referrerCust.save();
      }
    } else {
      mockReferrals = mockReferrals.map(r => r._id === referralId ? referral : r);
    }

    await logReferralAudit("Referral Reward Processed", referralId, `Reward of ${referral.rewardValue} issued`, user.email);

    return res.json({ success: true, data: referral });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to process reward" });
  }
};

/**
 * Helper to process rewards automatically after qualifying sales
 */
export const handlePostSaleReferralReward = async (sale: any) => {
  try {
    if (!sale || !sale.customerId) return;

    if (isDbConnected()) {
      // Check if referred customer has a pending referral
      const referral = await CustomerReferral.findOne({
        referredCustomerId: sale.customerId,
        referralStatus: "PENDING"
      });

      if (referral) {
        // Mark as qualified
        referral.referralStatus = "QUALIFIED";
        referral.rewardStatus = "ISSUED";
        referral.qualifyingSaleId = sale._id;
        await referral.save();

        // Increment loyalty points of referrer
        const referrer = await Customer.findById(referral.referrerCustomerId);
        if (referrer) {
          if (referral.rewardType === "POINTS") {
            referrer.loyaltyPoints = (referrer.loyaltyPoints || 0) + (referral.rewardValue || 0);
          } else {
            // Support cash reward amount by crediting advanceBalance
            referrer.advanceBalance = (referrer.advanceBalance || 0) + (referral.rewardValue || 0);
          }
          await referrer.save();

          // Send Alert Notification
          await sendReferralNotification(
            "REFERRAL_REWARD_EARNED",
            "Referral Reward Earned",
            `Congratulations! You earned a reward of ${referral.rewardValue} ${referral.rewardType} because your referred customer completed their first purchase.`,
            referral._id,
            [referrer.email || ""]
          );
        }
      }
    }
  } catch (err) {
    console.error("[Referral Reward Processing] Auto reward failed:", err);
  }
};
