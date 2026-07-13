import { Request, Response } from "express";
import { SchemeDefinition, SchemeEnrollment } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { 
  getAllFallbackSchemes, 
  addFallbackScheme, 
  getAllFallbackEnrollments, 
  addFallbackEnrollment, 
  updateFallbackEnrollment 
} from "../../../lib/fallbackStore.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const toPositiveNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const toInteger = (value: unknown, fallback = 1) => {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const generateEnrollmentId = () => `ENR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const makeDueDate = (monthsFromNow: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsFromNow);
  return date.toISOString();
};

// Feature 96: Gold saving scheme creation
export const createScheme = async (req: Request, res: Response) => {
  try {
    const { name, type, monthlyAmount, totalInstallments, bonusAmount, goldWeightBased, description } = req.body;
    
    const parsedName = normalizeString(name);
    const parsedType = type === "CHIT_FUND" ? "CHIT_FUND" : "GOLD_SAVING";
    const parsedMonthlyAmount = toPositiveNumber(monthlyAmount, 0);
    const parsedTotalInstallments = toInteger(totalInstallments, 12);
    const parsedBonusAmount = toPositiveNumber(bonusAmount, 0);
    const parsedGoldWeightBased = !!goldWeightBased;
    const parsedDescription = normalizeString(description);

    if (!parsedName || parsedMonthlyAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Scheme name and monthlyAmount (greater than 0) are required",
      });
    }

    const schemeData = {
      name: parsedName,
      type: parsedType,
      monthlyAmount: parsedMonthlyAmount,
      totalInstallments: parsedTotalInstallments,
      bonusAmount: parsedBonusAmount,
      goldWeightBased: parsedGoldWeightBased,
      description: parsedDescription,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };

    let createdScheme: any;
    if (isDbConnected()) {
      createdScheme = await SchemeDefinition.create(schemeData);
    } else {
      createdScheme = { _id: `scheme_${Date.now()}`, ...schemeData };
      await addFallbackScheme(createdScheme);
    }

    return res.status(201).json({
      success: true,
      data: createdScheme,
    });
  } catch (error: any) {
    console.error("Failed to create scheme definition", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to create scheme definition",
    });
  }
};

export const getSchemes = async (req: Request, res: Response) => {
  try {
    let list: any[];
    if (isDbConnected()) {
      list = await SchemeDefinition.find({}).lean();
    } else {
      list = await getAllFallbackSchemes();
    }

    return res.json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    console.error("Failed to get schemes definitions", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to get schemes definitions",
    });
  }
};

// Feature 97: Customer enrollment into schemes
export const enrollInScheme = async (req: Request, res: Response) => {
  try {
    const { customerId, customerName, customerPhone, schemeId, schemeName, schemeType, monthlyAmount, totalInstallments } = req.body;

    const parsedCustomerId = normalizeString(customerId);
    const parsedCustomerName = normalizeString(customerName);
    const parsedCustomerPhone = normalizeString(customerPhone);
    const parsedSchemeName = normalizeString(schemeName);
    const parsedSchemeType = normalizeString(schemeType, "GOLD_SAVING");
    const parsedMonthlyAmount = toPositiveNumber(monthlyAmount, 0);
    const parsedTotalInstallments = toInteger(totalInstallments, 12);

    if (!parsedCustomerId || !parsedCustomerName || !parsedCustomerPhone || parsedMonthlyAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "customerId, customerName, customerPhone, and monthlyAmount are required",
      });
    }

    // Auto-generate installments checklist
    const installmentsList = [];
    for (let i = 1; i <= parsedTotalInstallments; i++) {
      installmentsList.push({
        installmentId: `INST-${i}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        amount: parsedMonthlyAmount,
        dueDate: makeDueDate(i),
        status: "PENDING",
      });
    }

    const enrollmentData = {
      enrollmentId: generateEnrollmentId(),
      customerId: parsedCustomerId,
      customerName: parsedCustomerName,
      customerPhone: parsedCustomerPhone,
      schemeId: schemeId || undefined,
      schemeName: parsedSchemeName,
      schemeType: parsedSchemeType,
      monthlyAmount: parsedMonthlyAmount,
      totalInstallments: parsedTotalInstallments,
      completedInstallments: 0,
      paidAmount: 0,
      goldAccumulated: 0,
      status: "ACTIVE",
      installments: installmentsList,
      nextDueDate: installmentsList[0]?.dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let createdEnrollment: any;
    if (isDbConnected()) {
      createdEnrollment = await SchemeEnrollment.create(enrollmentData);
    } else {
      createdEnrollment = { _id: `enr_${Date.now()}`, ...enrollmentData };
      await addFallbackEnrollment(createdEnrollment);
    }

    return res.status(201).json({
      success: true,
      message: "Customer successfully enrolled in scheme",
      data: createdEnrollment,
    });
  } catch (error: any) {
    console.error("Failed to enroll customer in scheme", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to enroll customer in scheme",
    });
  }
};

export const getEnrollments = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    let list: any[];

    if (isDbConnected()) {
      let filter = {};
      if (query) {
        const regex = new RegExp(String(query), "i");
        filter = {
          $or: [
            { customerName: regex },
            { customerPhone: regex },
            { schemeName: regex }
          ]
        };
      }
      list = await SchemeEnrollment.find(filter).lean();
    } else {
      list = await getAllFallbackEnrollments();
      if (query) {
        const q = String(query).toLowerCase();
        list = list.filter(e => 
          e.customerName.toLowerCase().includes(q) ||
          e.customerPhone.includes(q) ||
          e.schemeName.toLowerCase().includes(q)
        );
      }
    }

    return res.json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    console.error("Failed to get enrollments", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to get enrollments",
    });
  }
};

// Feature 98: Monthly installment collection & receipt
export const recordInstallment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // enrollmentId
    const { installmentId, paymentMethod, transactionId, notes, goldRate } = req.body;

    if (!installmentId) {
      return res.status(400).json({
        success: false,
        error: "installmentId is required",
      });
    }

    let enrollment: any;
    if (isDbConnected()) {
      enrollment = await SchemeEnrollment.findOne({ enrollmentId: id });
    } else {
      const list = await getAllFallbackEnrollments();
      enrollment = list.find(e => e.enrollmentId === id);
    }

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: "Scheme enrollment not found",
      });
    }

    const instIndex = enrollment.installments.findIndex((i: any) => i.installmentId === installmentId);
    if (instIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Installment index not found in this enrollment",
      });
    }

    const inst = enrollment.installments[instIndex];
    if (inst.status === "PAID") {
      return res.status(400).json({
        success: false,
        error: "This installment is already paid",
      });
    }

    // Mark as PAID
    inst.status = "PAID";
    inst.paidAt = new Date().toISOString();
    inst.paymentMethod = normalizeString(paymentMethod, "CASH");
    inst.transactionId = normalizeString(transactionId, "");
    inst.notes = normalizeString(notes, "");

    // Calculate Gold Accumulated if gold scheme
    if (enrollment.schemeType === "GOLD_SAVING" && goldRate > 0) {
      inst.goldGramsAccumulated = Number((inst.amount / goldRate).toFixed(4));
      enrollment.goldAccumulated = Number((enrollment.goldAccumulated + inst.goldGramsAccumulated).toFixed(4));
    }

    // Update enrollment aggregate fields
    enrollment.completedInstallments += 1;
    enrollment.paidAmount += inst.amount;
    enrollment.updatedAt = new Date().toISOString();

    // Check Maturity
    if (enrollment.completedInstallments >= enrollment.totalInstallments) {
      enrollment.status = "MATURED";
      enrollment.maturedDate = new Date().toISOString();
      enrollment.nextDueDate = undefined;
    } else {
      // Set next pending installment due date
      const nextPending = enrollment.installments.find((i: any) => i.status === "PENDING");
      enrollment.nextDueDate = nextPending ? nextPending.dueDate : undefined;
    }

    // Save
    if (isDbConnected()) {
      await enrollment.save();
    } else {
      await updateFallbackEnrollment(enrollment);
    }

    return res.status(200).json({
      success: true,
      message: "Installment payment recorded successfully",
      data: enrollment,
    });
  } catch (error: any) {
    console.error("Failed to record installment payment", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to record installment payment",
    });
  }
};

// Feature 99: Scheme maturity tracking & alert
export const getMaturityList = async (req: Request, res: Response) => {
  try {
    let list: any[];
    if (isDbConnected()) {
      list = await SchemeEnrollment.find({ status: "MATURED" }).lean();
    } else {
      const all = await getAllFallbackEnrollments();
      list = all.filter(e => e.status === "MATURED");
    }

    return res.json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    console.error("Failed to get matured schemes list", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to get matured schemes list",
    });
  }
};

// Feature 101: Defaulter list
export const getDefaulters = async (req: Request, res: Response) => {
  try {
    let list: any[];
    const now = new Date();

    if (isDbConnected()) {
      list = await SchemeEnrollment.find({
        status: "ACTIVE",
        nextDueDate: { $lt: now }
      }).lean();
    } else {
      const all = await getAllFallbackEnrollments();
      list = all.filter(e => {
        if (e.status !== "ACTIVE" || !e.nextDueDate) return false;
        return new Date(e.nextDueDate) < now;
      });
    }

    return res.json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    console.error("Failed to get defaulter list", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to get defaulter list",
    });
  }
};

// Feature 100: Scheme redemption at purchase
export const redeemScheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // enrollmentId
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        error: "invoiceId is required for scheme redemption",
      });
    }

    let enrollment: any;
    if (isDbConnected()) {
      enrollment = await SchemeEnrollment.findOne({ enrollmentId: id });
    } else {
      const list = await getAllFallbackEnrollments();
      enrollment = list.find(e => e.enrollmentId === id);
    }

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        error: "Scheme enrollment not found",
      });
    }

    // Redemption can be done on matured or active schemes (early maturity / custom conditions)
    if (enrollment.status === "REDEEMED") {
      return res.status(400).json({
        success: false,
        error: "This scheme has already been redeemed",
      });
    }

    enrollment.status = "REDEEMED";
    enrollment.redeemedDate = new Date().toISOString();
    enrollment.redeemedInvoiceId = normalizeString(invoiceId);
    enrollment.updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      await enrollment.save();
    } else {
      await updateFallbackEnrollment(enrollment);
    }

    return res.json({
      success: true,
      message: "Scheme successfully marked as REDEEMED",
      data: enrollment,
    });
  } catch (error: any) {
    console.error("Failed to redeem scheme", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to redeem scheme",
    });
  }
};


