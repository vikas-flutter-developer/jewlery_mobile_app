import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { Customer, SchemeEnrollment, Order, PortalCheckout, CustomerAccount, LedgerHistory, CustomerLoyaltyPoints, SchemeDefinition, Installment } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { 
  getAllFallbackEnrollments, 
  updateFallbackEnrollment, 
  addFallbackEnrollment 
} from "../../../lib/fallbackStore.js";

const checkoutsPath = path.resolve(process.cwd(), "backend", "data", "portalCheckouts.json");
const customOrdersPath = path.resolve(process.cwd(), "backend", "data", "customOrders.json");

const readJsonFile = (filePath: string, fallback: any[]) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}`, err);
  }
  return fallback;
};

const writeJsonFile = (filePath: string, data: any[]) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`Error writing ${filePath}`, err);
  }
};

// Fallback in-memory stores when MongoDB is disconnected
export const mockPortalCustomers: any[] = [
  {
    _id: "cust_portal_1",
    name: "Raj Kumar",
    phone: "9999999999",
    email: "raj@example.com",
    address: "102, Diamond Towers, Mumbai",
    pan: "ABCDE1234F",
    kycStatus: "VERIFIED",
    loyaltyPoints: 1250,
    totalPurchases: 450000,
  }
];

export const mockPortalSchemes: any[] = [
  {
    enrollmentId: "SCH-ENR-709A",
    customerId: "cust_portal_1",
    customerName: "Raj Kumar",
    customerPhone: "9999999999",
    schemeName: "Aura Suvarna Vriddhi Savings Scheme",
    schemeType: "GOLD_SAVING",
    monthlyAmount: 5000,
    totalInstallments: 11,
    completedInstallments: 5,
    paidAmount: 25000,
    goldAccumulated: 4.12,
    status: "ACTIVE",
    nextDueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    installments: [
      { installmentId: "INST-1", amount: 5000, dueDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), paidAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), status: "PAID", paymentMethod: "UPI", transactionId: "TXN-90281", goldGramsAccumulated: 0.81 },
      { installmentId: "INST-2", amount: 5000, dueDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), paidAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), status: "PAID", paymentMethod: "NetBanking", transactionId: "TXN-90282", goldGramsAccumulated: 0.82 },
      { installmentId: "INST-3", amount: 5000, dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), paidAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), status: "PAID", paymentMethod: "UPI", transactionId: "TXN-90283", goldGramsAccumulated: 0.83 },
      { installmentId: "INST-4", amount: 5000, dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), status: "PAID", paymentMethod: "Card", transactionId: "TXN-90284", goldGramsAccumulated: 0.84 },
      { installmentId: "INST-5", amount: 5000, dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), status: "PAID", paymentMethod: "UPI", transactionId: "TXN-90285", goldGramsAccumulated: 0.82 }
    ]
  }
];

export const mockSchemeDefinitions: any[] = [
  {
    _id: "def_vriddhi",
    name: "Aura Suvarna Vriddhi Savings Scheme",
    type: "GOLD_SAVING",
    monthlyAmount: 5000,
    totalInstallments: 11,
    bonusAmount: 5000,
    goldWeightBased: true,
    description: "Pay 11 installments, get 1 installment as bonus. Accumulate gold weight monthly at live rates.",
    status: "ACTIVE"
  },
  {
    _id: "def_dhanavarsha",
    name: "Aura Dhanavarsha Gold Chit",
    type: "CHIT_FUND",
    monthlyAmount: 10000,
    totalInstallments: 10,
    bonusAmount: 10000,
    goldWeightBased: false,
    description: "Flat cash discount benefit scheme. Pay 10 installments, get 1 installment free on maturity purchase.",
    status: "ACTIVE"
  }
];

export const getAvailableSchemes = async (req: Request, res: Response) => {
  try {
    let schemes: any[];
    if (isDbConnected()) {
      schemes = await SchemeDefinition.find({ status: "ACTIVE" }).lean();
    } else {
      schemes = mockSchemeDefinitions;
    }
    return res.json({ success: true, data: schemes });
  } catch (error: any) {
    console.error("Failed to get available schemes", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch schemes." });
  }
};

export const mockCustomOrders: any[] = readJsonFile(customOrdersPath, [
  {
    orderId: "Bespoke-101",
    customerName: "Raj Kumar",
    customerContact: "9999999999",
    metalType: "GOLD",
    carat: "22K",
    customDescription: "Traditional Kerala Style Jhumka Earrings with ruby details.",
    status: "In Production",
    designApproval: "APPROVED",
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  }
]);

// ================= OTP AUTHENTICATION =================

export const requestOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: "Phone number is required." });
    }

    const cleanPhone = String(phone).trim();
    let customer: any;

    if (isDbConnected()) {
      customer = await Customer.findOne({ phone: cleanPhone });
      if (!customer) {
        // Auto-register customer for frictionless self-service portal access
        customer = await Customer.create({
          name: "Portal Customer",
          phone: cleanPhone,
          loyaltyPoints: 100,
          kycStatus: "PENDING",
          tags: ["PORTAL_USER"]
        });
      }
    } else {
      customer = mockPortalCustomers.find(c => c.phone === cleanPhone);
      if (!customer) {
        customer = {
          _id: `cust_${Date.now()}`,
          name: "Portal Guest Customer",
          phone: cleanPhone,
          email: "",
          address: "",
          pan: "N/A",
          kycStatus: "PENDING",
          loyaltyPoints: 100,
          totalPurchases: 0
        };
        mockPortalCustomers.push(customer);
      }
    }

    // Generate mock OTP code (always 123456 for simulated SMS gateway verification)
    return res.status(200).json({
      success: true,
      message: `Simulated OTP code '123456' sent successfully via SMS gateway to ${cleanPhone}!`,
      code: "123456" // Returned so frontend can display/simulate autofill
    });
  } catch (error: any) {
    console.error("Portal request OTP failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to request OTP" });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, error: "Phone and verification OTP code are required." });
    }

    if (code !== "123456") {
      return res.status(400).json({ success: false, error: "Invalid verification code entered." });
    }

    const cleanPhone = String(phone).trim();
    let customer: any;

    if (isDbConnected()) {
      customer = await Customer.findOne({ phone: cleanPhone }).lean();
    } else {
      customer = mockPortalCustomers.find(c => c.phone === cleanPhone);
    }

    if (!customer) {
      return res.status(404).json({ success: false, error: "Account could not be established." });
    }

    // Auto-create or update CustomerAccount record so it appears in MongoDB Atlas
    if (isDbConnected()) {
      try {
        await CustomerAccount.findOneAndUpdate(
          { phone: cleanPhone },
          {
            phone: cleanPhone,
            name: customer.name || "Portal Customer",
            customerId: customer._id?.toString() || cleanPhone,
            status: "ACTIVE",
            lastLogin: new Date(),
          },
          { upsert: true, new: true }
        );

        // Auto-create or update CustomerLoyaltyPoints
        await CustomerLoyaltyPoints.findOneAndUpdate(
          { customerPhone: cleanPhone },
          {
            $setOnInsert: {
              customerId: customer._id?.toString() || cleanPhone,
              points: customer.loyaltyPoints || 100,
              history: [
                { pointsAdded: customer.loyaltyPoints || 100, reason: "Welcome Reward Points", date: new Date() }
              ]
            }
          },
          { upsert: true, new: true }
        );
      } catch (acctErr) {
        console.error("Failed to upsert CustomerAccount/Loyalty on login", acctErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Customer verified and authenticated successfully!",
      data: {
        token: `portal_jwt_${Date.now()}`,
        customer
      }
    });
  } catch (error: any) {
    console.error("Portal verify OTP failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to verify OTP" });
  }
};

// ================= SAVINGS SCHEMES LEDGERS =================

export const getCustomerSchemes = async (req: Request, res: Response) => {
  try {
    const { phone } = req.query;
    const cleanPhone = phone ? String(phone).trim() : "";
    let enrollments: any[];

    if (isDbConnected()) {
      const filter = cleanPhone ? { customerPhone: cleanPhone } : {};
      enrollments = await SchemeEnrollment.find(filter).populate('schemeId').lean();
    } else {
      const allEnrollments = await getAllFallbackEnrollments();
      let matched = allEnrollments;
      if (cleanPhone) {
        matched = allEnrollments.filter(e => e.customerPhone === cleanPhone);
      }

      // If we don't have any enrollments for this phone number and it's the mock phone, seed it to fallbackStore
      if (cleanPhone === "9999999999" && matched.length === 0) {
        for (const scheme of mockPortalSchemes) {
          if (!allEnrollments.some(e => e.enrollmentId === scheme.enrollmentId)) {
            await addFallbackEnrollment(scheme);
          }
        }
        const updated = await getAllFallbackEnrollments();
        matched = cleanPhone ? updated.filter(e => e.customerPhone === cleanPhone) : updated;
      }
      enrollments = matched;
    }

    return res.json({
      success: true,
      data: enrollments
    });
  } catch (error: any) {
    console.error("Portal get customer schemes failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch savings schemes." });
  }
};

export const paySchemeInstallment = async (req: Request, res: Response) => {
  try {
    const { enrollmentId, paymentMethod, amount } = req.body;
    if (!enrollmentId || !amount) {
      return res.status(400).json({ success: false, error: "enrollmentId and amount are required." });
    }

    let enrollment: any;

    if (isDbConnected()) {
      enrollment = await SchemeEnrollment.findOne({ enrollmentId });
    } else {
      const allEnrollments = await getAllFallbackEnrollments();
      enrollment = allEnrollments.find(e => e.enrollmentId === enrollmentId);
    }

    if (!enrollment) {
      return res.status(404).json({ success: false, error: "Scheme enrollment record not found." });
    }

    // Process payment and increment scheme chit ledger
    const paidAmt = Number(amount);
    
    // Auto accumulate gold: standard gold price fallback ~ ₹6200/g
    const goldPurityRate = 6200;
    const goldAccum = Number((paidAmt / goldPurityRate).toFixed(3));

    const newInstallment = {
      installmentId: `INST-${enrollment.completedInstallments + 1}`,
      amount: paidAmt,
      dueDate: new Date(enrollment.nextDueDate || Date.now()).toISOString(),
      paidAt: new Date().toISOString(),
      status: "PAID",
      paymentMethod: paymentMethod || "Razorpay UPI",
      transactionId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      goldGramsAccumulated: goldAccum,
      notes: "Online installment payment processed successfully."
    };

    enrollment.completedInstallments += 1;
    enrollment.paidAmount += paidAmt;
    enrollment.goldAccumulated = Number((enrollment.goldAccumulated + goldAccum).toFixed(3));
    enrollment.nextDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    if (enrollment.completedInstallments >= enrollment.totalInstallments) {
      enrollment.status = "MATURED";
      enrollment.maturedDate = new Date().toISOString();
    }

    if (!enrollment.installments) enrollment.installments = [];
    enrollment.installments.push(newInstallment);

    if (isDbConnected()) {
      await enrollment.save();

      // Save to installments collection
      try {
        const installmentDoc = new Installment({
          installmentId: newInstallment.installmentId,
          enrollmentId: enrollment.enrollmentId,
          customerId: enrollment.customerId,
          customerPhone: enrollment.customerPhone,
          amount: newInstallment.amount,
          paidAt: newInstallment.paidAt,
          status: "PAID",
          paymentMethod: newInstallment.paymentMethod,
          transactionId: newInstallment.transactionId,
          goldGramsAccumulated: newInstallment.goldGramsAccumulated || 0,
          notes: newInstallment.notes,
        });
        await installmentDoc.save();
      } catch (instErr) {
        console.error("Failed to save installment document", instErr);
      }

      // Auto-append ledger entry for scheme payment in MongoDB Atlas
      try {
        await LedgerHistory.create({
          transactionId: newInstallment.transactionId,
          customerId: enrollment.customerId?.toString() || enrollment.customerPhone,
          customerPhone: enrollment.customerPhone,
          category: "SCHEME_EMI",
          title: `Scheme Installment #${enrollment.completedInstallments}`,
          description: `Monthly installment for ${enrollment.schemeName || "savings scheme"}`,
          amount: paidAmt,
          goldGrams: goldAccum,
          paymentMethod: newInstallment.paymentMethod,
          status: "CLEARED",
          date: new Date(),
        });
      } catch (ledgerErr) {
        console.error("Failed to append ledger entry for scheme payment", ledgerErr);
      }
    } else {
      await updateFallbackEnrollment(enrollment);
    }

    return res.status(200).json({
      success: true,
      message: "Chit savings installment paid successfully! Passbook updated.",
      data: enrollment
    });
  } catch (error: any) {
    console.error("Portal pay installment failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to make payment." });
  }
};

// ================= CUSTOM BESPOKE ORDERS =================

export const submitCustomOrder = async (req: Request, res: Response) => {
  try {
    const { customerName, customerPhone, metalType, carat, customDescription, designMoodboard } = req.body;
    if (!customerName || !customerPhone || !customDescription) {
      return res.status(400).json({ success: false, error: "customerName, customerPhone, and customDescription are required." });
    }

    const cleanPhone = String(customerPhone).trim();
    const newOrder = {
      customerName: String(customerName).trim(),
      customerPhone: cleanPhone,
      customerContact: cleanPhone,
      isCustom: true,
      status: "Received",
      metalType: metalType || "GOLD",
      carat: carat || "22K",
      customDescription: String(customDescription).trim(),
      designMoodboard: designMoodboard || [],
      designApproval: "PENDING",
      createdAt: new Date().toISOString()
    };

    let savedOrder: any;
    if (isDbConnected()) {
      savedOrder = await Order.create(newOrder);
    } else {
      savedOrder = { 
        _id: `bespoke_${Date.now()}`,
        orderId: `Bespoke-${Math.floor(100 + Math.random() * 900)}`,
        ...newOrder 
      };
      mockCustomOrders.push(savedOrder);
      writeJsonFile(customOrdersPath, mockCustomOrders);
    }

    return res.status(201).json({
      success: true,
      message: "Custom design request received! AuraJewel design desk will review shortly.",
      data: savedOrder
    });
  } catch (error: any) {
    console.error("Portal submit custom order failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to submit custom bespoke request." });
  }
};

export const getCustomOrders = async (req: Request, res: Response) => {
  try {
    const { phone } = req.query;
    let orders: any[];

    const cleanPhone = phone ? String(phone).trim() : "";
    const hasPhone = cleanPhone && cleanPhone !== "" && cleanPhone !== "null" && cleanPhone !== "undefined";

    if (isDbConnected()) {
      const filter = hasPhone ? { customerPhone: cleanPhone, isCustom: true } : { isCustom: true };
      orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    } else {
      if (hasPhone) {
        orders = mockCustomOrders.filter(o => o.customerContact === cleanPhone || o.customerPhone === cleanPhone);
      } else {
        orders = mockCustomOrders;
      }
    }

    return res.json({
      success: true,
      data: orders
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ================= SELF CHECKOUTS & COUNTER REQUESTS =================

export const mockPortalCheckouts: any[] = readJsonFile(checkoutsPath, []);

export const createPortalCheckout = async (req: Request, res: Response) => {
  try {
    const { 
      customerName, 
      customerPhone, 
      items, 
      subtotal, 
      discount, 
      giftWrap, 
      insurance, 
      tax, 
      payable, 
      status, 
      paymentMethod, 
      transactionId 
    } = req.body;

    if (!customerPhone || !payable) {
      return res.status(400).json({ success: false, error: "customerPhone and payable details are required." });
    }

    const cleanPhone = String(customerPhone).trim();
    const checkoutId = `CHKT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCheckout = {
      checkoutId,
      customerName: String(customerName || "Portal Customer").trim(),
      customerPhone: cleanPhone,
      items: items || [],
      subtotal: Number(subtotal || 0),
      discount: Number(discount || 0),
      giftWrap: !!giftWrap,
      insurance: !!insurance,
      tax: Number(tax || 0),
      payable: Number(payable || 0),
      status: status || "PENDING_PAYMENT", 
      paymentMethod: paymentMethod || "Counter Cash",
      transactionId: transactionId || "",
      createdAt: new Date()
    };

    let savedCheckout: any;
    if (isDbConnected()) {
      savedCheckout = await (PortalCheckout as any).create(newCheckout);
      
      // Auto-create ledger entry and award loyalty points on payment
      if (status === "PAID_ONLINE") {
        try {
          await LedgerHistory.create({
            transactionId: newCheckout.transactionId || `TXN-PORTAL-${Date.now()}`,
            customerId: cleanPhone,
            customerPhone: cleanPhone,
            category: "STORE_PURCHASE",
            title: `Portal Self-Purchase`,
            description: `Self-checkout payment for ${newCheckout.items?.length || 0} items`,
            amount: newCheckout.payable,
            goldGrams: newCheckout.items?.reduce((acc: number, item: any) => acc + Number(item.weight || 0), 0) || 0,
            paymentMethod: newCheckout.paymentMethod,
            status: "CLEARED",
            date: new Date()
          });

          // Reward points: 1 point per 100 Rs spent
          const pointsEarned = Math.floor(newCheckout.payable / 100);
          if (pointsEarned > 0) {
            await CustomerLoyaltyPoints.findOneAndUpdate(
              { customerPhone: cleanPhone },
              {
                $inc: { points: pointsEarned },
                $push: {
                  history: {
                    pointsAdded: pointsEarned,
                    reason: `Reward points for purchase ${newCheckout.checkoutId}`,
                    date: new Date()
                  }
                },
                $setOnInsert: { customerId: cleanPhone }
              },
              { upsert: true, new: true }
            );
          }
        } catch (postPayErr) {
          console.error("Failed to process ledger/loyalty for PAID_ONLINE checkout", postPayErr);
        }
      }
    } else {
      savedCheckout = { 
        _id: `chkt_${Date.now()}`,
        ...newCheckout 
      };
      mockPortalCheckouts.push(savedCheckout);
      writeJsonFile(checkoutsPath, mockPortalCheckouts);
    }

    return res.status(201).json({
      success: true,
      message: "Checkout request registered successfully!",
      data: savedCheckout
    });
  } catch (error: any) {
    console.error("Portal create checkout failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to submit checkout request." });
  }
};

export const getPortalCheckouts = async (req: Request, res: Response) => {
  try {
    const { phone } = req.query;
    let checkouts: any[];

    const cleanPhone = phone ? String(phone).trim() : "";
    const hasPhone = cleanPhone && cleanPhone !== "" && cleanPhone !== "null" && cleanPhone !== "undefined";

    if (isDbConnected()) {
      const filter = hasPhone ? { customerPhone: cleanPhone } : {};
      checkouts = await (PortalCheckout as any).find(filter).sort({ createdAt: -1 }).lean();
    } else {
      if (hasPhone) {
        checkouts = mockPortalCheckouts.filter(c => c.customerPhone === cleanPhone);
      } else {
        checkouts = mockPortalCheckouts;
      }
      checkouts = [...checkouts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return res.json({
      success: true,
      data: checkouts
    });
  } catch (error: any) {
    console.error("Portal get checkouts failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch checkout requests." });
  }
};

export const approvePortalCheckoutPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let checkout: any;

    if (isDbConnected()) {
      checkout = await (PortalCheckout as any).findById(id);
      if (!checkout) {
        checkout = await (PortalCheckout as any).findOne({ checkoutId: id });
      }
    } else {
      checkout = mockPortalCheckouts.find(c => c._id === id || c.checkoutId === id);
    }

    if (!checkout) {
      return res.status(404).json({ success: false, error: "Checkout record not found." });
    }

    checkout.status = "PAID_COUNTER";
    checkout.paymentMethod = "Counter Cash/POS Verified";
    
    // Resolve branchCode from user if available
    const userBranchId = (req as any).user?.branchId;
    let branchCode = "MAIN";

    if (isDbConnected()) {
      if (userBranchId) {
        try {
          const { default: Branch } = await import("../../../models/Branch.js");
          const branch = await Branch.findOne({ $or: [{ _id: userBranchId }, { code: userBranchId }] } as any);
          if (branch && branch.code) {
            branchCode = branch.code;
          } else if (branch && branch.name) {
            branchCode = branch.name;
          }
        } catch (branchErr) {
          console.error("Failed to fetch branch for code", branchErr);
        }
      }

      await checkout.save();
      const { Sale } = await import("../../../models/index.js");
      const createdSale = await Sale.create({

        orderId: checkout.checkoutId,
        customerName: checkout.customerName,
        customerPhone: checkout.customerPhone,
        items: checkout.items,
        subtotal: checkout.subtotal,
        discount: checkout.discount,
        tax: checkout.tax,
        total: checkout.payable,
        paymentMethod: "Counter Cash/POS Approved",
        status: "COMPLETED",
        branchCode,
        createdAt: new Date()
      });

      try {
        const { handlePostSaleReferralReward } = await import("../../../retailer/controllers/referrals/referralsController.js");
        await handlePostSaleReferralReward(createdSale);
      } catch (refErr) {
        console.error("Failed to process referral reward:", refErr);
      }


      // Auto-create ledger entry and award loyalty points
      try {
        await LedgerHistory.create({
          transactionId: checkout.transactionId || `TXN-POS-${Date.now()}`,
          customerId: checkout.customerPhone,
          customerPhone: checkout.customerPhone,
          category: "STORE_PURCHASE",
          title: `Counter Purchase Approved`,
          description: `Store checkout approved at counter for ${checkout.items?.length || 0} items`,
          amount: checkout.payable,
          goldGrams: checkout.items?.reduce((acc: number, item: any) => acc + Number(item.weight || 0), 0) || 0,
          paymentMethod: checkout.paymentMethod,
          status: "CLEARED",
          date: new Date()
        });

        const pointsEarned = Math.floor(checkout.payable / 100);
        if (pointsEarned > 0) {
          await CustomerLoyaltyPoints.findOneAndUpdate(
            { customerPhone: checkout.customerPhone },
            {
              $inc: { points: pointsEarned },
              $push: {
                history: {
                  pointsAdded: pointsEarned,
                  reason: `Reward points for counter purchase ${checkout.checkoutId}`,
                  date: new Date()
                }
              },
              $setOnInsert: { customerId: checkout.customerPhone }
            },
            { upsert: true, new: true }
          );
        }
      } catch (postPayErr) {
        console.error("Failed to process ledger/loyalty for counter checkout", postPayErr);
      }
    } else {
      const { mockSales } = await import("../../../data/mockData.js");
      mockSales.push({
        _id: `sale_${Date.now()}`,
        orderId: checkout.checkoutId,
        customerName: checkout.customerName,
        customerPhone: checkout.customerPhone,
        items: checkout.items,
        subtotal: checkout.subtotal,
        discount: checkout.discount,
        tax: checkout.tax,
        total: checkout.payable,
        paymentMethod: "Counter Cash/POS Approved",
        status: "COMPLETED",
        branchCode: userBranchId || "MAIN",
        createdAt: new Date().toISOString()
      });
      writeJsonFile(checkoutsPath, mockPortalCheckouts);
    }

    return res.status(200).json({
      success: true,
      message: "Payment successfully received! Cashier terminal and sales database updated.",
      data: checkout
    });
  } catch (error: any) {
    console.error("Portal approve checkout payment failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to approve payment." });
  }
};


