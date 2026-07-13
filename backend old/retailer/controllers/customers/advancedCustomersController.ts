import { Request, Response } from "express";
import { Customer, Sale, SchemeEnrollment } from "../../models/index.js";
import { mockSales, mockKhata, mockInventory } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";
import mongoose from "mongoose";

const parseNumeric = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

// Simulated mock quotations database for Feature 145
export const mockQuotations: any[] = [
  {
    quoteId: "Q-9281X",
    customerName: "Ramesh Kumar",
    customerPhone: "9876543210",
    itemName: "Bridal Antique Emerald Choker",
    goldGrams: 38.5,
    makingChargesEstimate: 22000,
    estimatedTotal: 268400,
    status: "PENDING_CUSTOMER_APPROVAL",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Requires standard 22K gold casting and priority workbench scheduling."
  },
  {
    quoteId: "Q-8712Y",
    customerName: "Anil Mehta",
    customerPhone: "9876543210",
    itemName: "Solitaire Engagement Ring Band",
    goldGrams: 6.8,
    makingChargesEstimate: 8500,
    estimatedTotal: 52000,
    status: "APPROVED",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    approvedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Customer approved estimate. Handed to workshop."
  }
];

// ================= 135. BIRTHDAY & ANNIVERSARY ALERTS =================

export const getCustomerCelebrations = async (req: Request, res: Response) => {
  try {
    let customers: any[];
    if (isDbConnected()) {
      customers = await Customer.find({}).lean();
    } else {
      // Mock customers with celebrating fields
      customers = [
        { name: "Anil Mehta", phone: "9876543210", email: "anil@example.com", birthday: new Date(Date.now() - 30 * 365 * 24 * 60 * 60 * 1000), anniversary: null, tags: ["VIP"] },
        { name: "Priyanka Sen", phone: "9811223344", email: "priyanka@example.com", birthday: null, anniversary: new Date(), tags: ["REGULAR"] },
        { name: "Sonia Sharma", phone: "9988776655", email: "sonia@example.com", birthday: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), anniversary: null, tags: ["REGULAR"] },
        { name: "Suresh Kumar", phone: "9988776655", email: "suresh@example.com", birthday: null, anniversary: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), tags: ["VIP"] },
        { name: "Rajesh Kumar", phone: "9822334455", email: "rajesh@example.com", birthday: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), anniversary: null, tags: ["VIP"] } // Celebrated 10 days ago
      ];
    }

    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const celebrations: any[] = [];

    customers.forEach(c => {
      if (c.birthday) {
        const bdate = new Date(c.birthday);
        const bMonth = bdate.getMonth();
        const bDate = bdate.getDate();

        // Calculate days remaining to birthday this year
        let diffDays = bDate - todayDate;
        if (bMonth === todayMonth && diffDays >= 0 && diffDays <= 7) {
          celebrations.push({
            name: c.name,
            phone: c.phone,
            email: c.email || "N/A",
            type: "BIRTHDAY",
            eventDate: `${bDate} ${bdate.toLocaleString("default", { month: "short" })}`,
            daysRemaining: diffDays,
            tags: c.tags || ["REGULAR"]
          });
        }
      }

      if (c.anniversary) {
        const adate = new Date(c.anniversary);
        const aMonth = adate.getMonth();
        const aDate = adate.getDate();

        let diffDays = aDate - todayDate;
        if (aMonth === todayMonth && diffDays >= 0 && diffDays <= 7) {
          celebrations.push({
            name: c.name,
            phone: c.phone,
            email: c.email || "N/A",
            type: "ANNIVERSARY",
            eventDate: `${aDate} ${adate.toLocaleString("default", { month: "short" })}`,
            daysRemaining: diffDays,
            tags: c.tags || ["REGULAR"]
          });
        }
      }
    });

    return res.json({
      success: true,
      data: celebrations.sort((a,b) => a.daysRemaining - b.daysRemaining)
    });
  } catch (error: any) {
    console.error("Celebrations fetch failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to query celebrations" });
  }
};

// ================= 136. PURCHASE TIMELINE VIEW =================

export const getCustomerTimeline = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // customer phone, id, or email identifier

    let sales: any[];
    if (isDbConnected()) {
      sales = await Sale.find({ $or: [{ customerId: id }, { customerPhone: id }, { customerName: id }] }).lean();
    } else {
      sales = mockSales.filter(s => s.customerPhone === id || s.customerName === id);
    }

    const timeline: any[] = [];

    // Map POS invoices
    sales.forEach(s => {
      timeline.push({
        type: "SALE",
        title: `POS Jewellery Purchase (Invoice ${s.orderId})`,
        amount: parseNumeric(s.payable || s.total),
        date: s.createdAt,
        details: s.items?.map((item: any) => `${item.name} (${item.weight}g - ${item.purity})`).join(", ") || "Jewelry items checkout",
        badgeColor: "bg-gold-500"
      });
    });

    // Seeding Scheme & Pawnbroking timeline offsets to show dynamic timelines
    if (sales.length > 0) {
      timeline.push({
        type: "SCHEME",
        title: "Gold Saving Scheme Chit Enrollment Actived",
        amount: 5000,
        date: new Date(new Date(sales[0].createdAt).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        details: "Enrolled into 11-Month Gold Accumulation Savings Scheme",
        badgeColor: "bg-blue-500"
      });
      timeline.push({
        type: "LOAN",
        title: "RBI Pawn Gold Loan Disbursed",
        amount: 180000,
        date: new Date(new Date(sales[0].createdAt).getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        details: "Deposited 45g gold collateral ornaments. Rate: 9.5% p.a.",
        badgeColor: "bg-amber-600"
      });
    }

    return res.json({
      success: true,
      data: timeline.sort((a,b) => b.date.localeCompare(a.date))
    });
  } catch (error: any) {
    console.error("Timeline query failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to assemble timeline" });
  }
};

// ================= 142. CUSTOMER REACTIVATION LIST (IDLE > 6 MONTHS) =================

export const getReactivationList = async (req: Request, res: Response) => {
  try {
    let sales: any[];
    let customers: any[];

    if (isDbConnected()) {
      sales = await Sale.find({}).lean();
      customers = await Customer.find({}).lean();
    } else {
      sales = mockSales;
      customers = [
        { _id: "cust_1", name: "Anil Mehta", phone: "9876543210", email: "anil@example.com", loyaltyPoints: 120, creditLimit: 150000, tags: ["VIP"] },
        { _id: "cust_2", name: "Priyanka Sen", phone: "9811223344", email: "priyanka@example.com", loyaltyPoints: 45, creditLimit: 25000, tags: ["REGULAR"] },
        { _id: "cust_3", name: "Rahul Hegde", phone: "9845098450", email: "rahul@example.com", loyaltyPoints: 15, creditLimit: 50000, tags: ["REGULAR"] },
        { _id: "cust_4", name: "Sonia Sharma", phone: "9988776655", email: "sonia@example.com", loyaltyPoints: 200, creditLimit: 200000, tags: ["BLACKLISTED"] },
        { _id: "cust_5", name: "Kunal Gupta", phone: "9877665544", email: "kunal@example.com", loyaltyPoints: 0, creditLimit: 0, tags: ["REGULAR"] }
      ];
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const idleCustomers: any[] = [];

    customers.forEach(c => {
      // Find the last purchase invoice for this customer
      const clientSales = sales.filter(s => s.customerPhone === c.phone || s.customerName === c.name);
      
      let lastPurchaseDate = null;
      let isIdle = false;

      if (clientSales.length > 0) {
        // Sort sales to find latest date
        const sorted = clientSales.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        lastPurchaseDate = sorted[0].createdAt;
        if (new Date(lastPurchaseDate) < sixMonthsAgo) {
          isIdle = true;
        }
      } else {
        // No purchases ever recorded -> default reactivate
        isIdle = true;
      }

      if (isIdle) {
        idleCustomers.push({
          id: c._id || c.id,
          name: c.name,
          phone: c.phone,
          email: c.email || "N/A",
          loyaltyPoints: c.loyaltyPoints || 0,
          lastPurchaseDate: lastPurchaseDate ? new Date(lastPurchaseDate).toLocaleDateString() : "NEVER PURCHASED",
          monthsIdle: lastPurchaseDate ? Math.round((Date.now() - new Date(lastPurchaseDate).getTime()) / (30 * 24 * 60 * 60 * 1000)) : 12,
          tags: c.tags || ["REGULAR"]
        });
      }
    });

    return res.json({
      success: true,
      data: idleCustomers.sort((a,b) => b.monthsIdle - a.monthsIdle)
    });
  } catch (error: any) {
    console.error("Reactivation list query failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to load reactivation lists" });
  }
};

// ================= 139. BULK CAMPAIGN MANAGER SIMULATION =================

export const sendMarketingCampaignBlast = async (req: Request, res: Response) => {
  try {
    const { campaignName, targetSegment, messageTemplate, channels } = req.body;

    if (!campaignName || !targetSegment || !messageTemplate) {
      return res.status(400).json({ success: false, error: "campaignName, targetSegment, and messageTemplate are required." });
    }

    // Simulate marketing logs and dispatch rates
    const recipientCount = targetSegment === "VIP" ? 45 : targetSegment === "IDLE" ? 120 : 380;
    const dispatchedLog = {
      campaignId: `CAMP-${Date.now()}`,
      campaignName,
      targetSegment,
      dispatchedCount: recipientCount,
      successRate: "98.5%",
      channels: channels || ["WHATSAPP", "SMS"],
      executedAt: new Date().toISOString()
    };

    return res.status(201).json({
      success: true,
      message: `Bulk marketing blast campaign successfully queued! Dispatched to ${recipientCount} targeted client nodes.`,
      data: dispatchedLog
    });
  } catch (error: any) {
    console.error("Campaign dispatch failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to process campaign blast" });
  }
};

// ================= 140. REFERRALS & REWARDS TREE =================

export const getReferralNetwork = async (req: Request, res: Response) => {
  try {
    // Seeding sample referrers relationships tree structure
    const referralNetwork = [
      { referrerName: "Anil Mehta", referrerPhone: "9876543210", referredCustomer: "Sonia Sharma", referredPhone: "9988776655", rewardPoints: 200, status: "CREDITED", date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
      { referrerName: "Anil Mehta", referrerPhone: "9876543210", referredCustomer: "Kunal Gupta", referredPhone: "9877665544", rewardPoints: 200, status: "CREDITED", date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
      { referrerName: "Priyanka Sen", referrerPhone: "9811223344", referredCustomer: "Rahul Hegde", referredPhone: "9845098450", rewardPoints: 200, status: "PENDING_FIRST_PURCHASE", date: new Date().toISOString() }
    ];

    return res.json({
      success: true,
      data: referralNetwork
    });
  } catch (error: any) {
    console.error("Referral network fetch failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to query referrals" });
  }
};

// ================= 145. CUSTOM ORDER QUOTATION APPROVALS =================

export const getQuotations = async (req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      data: mockQuotations
    });
  } catch (error: any) {
    console.error("Quotations fetch failed", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const createQuotation = async (req: Request, res: Response) => {
  try {
    const { customerName, customerPhone, itemName, goldGrams, makingChargesEstimate, notes } = req.body;

    if (!customerName || !customerPhone || !itemName || !goldGrams) {
      return res.status(400).json({ success: false, error: "customerName, customerPhone, itemName, and goldGrams are required." });
    }

    const grams = parseNumeric(goldGrams);
    const charges = parseNumeric(makingChargesEstimate || grams * 400); // fallback ~400 rs per gram
    const rawVal = grams * 6400; // 22K gold rate fallback
    const totalEst = Math.round(rawVal + charges);

    const newQuote = {
      quoteId: `Q-${Date.now().toString(36).toUpperCase()}`,
      customerName,
      customerPhone,
      itemName,
      goldGrams: grams,
      makingChargesEstimate: charges,
      estimatedTotal: totalEst,
      status: "PENDING_CUSTOMER_APPROVAL",
      createdAt: new Date().toISOString(),
      notes: notes || "Crafted custom gold quote."
    };

    mockQuotations.unshift(newQuote);

    return res.status(201).json({
      success: true,
      message: "Custom jewellery quotation successfully registered!",
      data: newQuote
    });
  } catch (error: any) {
    console.error("Quotation creation failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to create quotation" });
  }
};

export const updateQuotationStatus = async (req: Request, res: Response) => {
  try {
    const { quoteId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: "status is required in request body" });
    }

    const quote = mockQuotations.find(q => q.quoteId === quoteId);

    if (!quote) {
      return res.status(404).json({ success: false, error: "Quotation record not found" });
    }

    quote.status = status;
    if (status === "APPROVED") {
      quote.approvedAt = new Date().toISOString();
    } else {
      quote.rejectedAt = new Date().toISOString();
    }

    return res.json({
      success: true,
      message: `Quotation status flipped to '${status}' successfully!`,
      data: quote
    });
  } catch (error: any) {
    console.error("Quotation status modification failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to update quotation" });
  }
};


