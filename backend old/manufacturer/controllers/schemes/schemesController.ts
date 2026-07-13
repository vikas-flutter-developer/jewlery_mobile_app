import { Request, Response } from "express";
import {
  ManufacturerSchemeDefinition,
  ManufacturerSchemeEnrollment,
  ManufacturerInstallment,
} from "../../models/index.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const generateId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// ─── Scheme Definitions ──────────────────────────────────────────────────────

export const getManufacturerSchemeDefinitions = async (_req: Request, res: Response) => {
  try {
    const definitions = await ManufacturerSchemeDefinition.find().lean();
    return res.json({ success: true, data: definitions });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer scheme definitions");
  }
};

export const createManufacturerSchemeDefinition = async (req: Request, res: Response) => {
  try {
    const definition = new ManufacturerSchemeDefinition({
      name: normalizeString(req.body.name),
      type: normalizeString(req.body.type, "GOLD_SAVING"),
      monthlyAmount: Number(req.body.monthlyAmount) || 0,
      totalInstallments: Number(req.body.totalInstallments) || 0,
      bonusAmount: Number(req.body.bonusAmount) || 0,
      goldWeightBased: !!req.body.goldWeightBased,
      description: normalizeString(req.body.description),
      status: normalizeString(req.body.status, "ACTIVE"),
    });
    await definition.save();
    return res.status(201).json({ success: true, data: definition, message: "Manufacturer scheme definition created" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer scheme definition");
  }
};

export const updateManufacturerSchemeDefinition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = {
      name: normalizeString(req.body.name),
      type: normalizeString(req.body.type, "GOLD_SAVING"),
      monthlyAmount: Number(req.body.monthlyAmount) || 0,
      totalInstallments: Number(req.body.totalInstallments) || 0,
      bonusAmount: Number(req.body.bonusAmount) || 0,
      goldWeightBased: !!req.body.goldWeightBased,
      description: normalizeString(req.body.description),
      status: normalizeString(req.body.status, "ACTIVE"),
    };
    const definition = await ManufacturerSchemeDefinition.findByIdAndUpdate(id, updateData, { new: true });
    if (!definition) {
      return res.status(404).json({ success: false, error: "Manufacturer scheme definition not found" });
    }
    return res.json({ success: true, data: definition, message: "Manufacturer scheme definition updated" });
  } catch (error) {
    return respondError(res, error, "Failed to update manufacturer scheme definition");
  }
};

// ─── Scheme Enrollments ──────────────────────────────────────────────────────

export const getManufacturerSchemeEnrollments = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    let filter = {};
    if (query) {
      const regex = new RegExp(String(query), "i");
      filter = { $or: [{ customerName: regex }, { customerPhone: regex }, { schemeName: regex }] };
    }
    const enrollments = await ManufacturerSchemeEnrollment.find(filter).lean();
    return res.json({ success: true, data: enrollments });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer scheme enrollments");
  }
};

export const createManufacturerSchemeEnrollment = async (req: Request, res: Response) => {
  try {
    const { customerId, customerName, customerPhone, schemeId, schemeName, schemeType, monthlyAmount, totalInstallments } = req.body;

    const parsedCustomerId = normalizeString(customerId);
    const parsedCustomerName = normalizeString(customerName);
    const parsedCustomerPhone = normalizeString(customerPhone);
    const parsedSchemeName = normalizeString(schemeName);
    const parsedSchemeType = normalizeString(schemeType, "GOLD_SAVING");
    const parsedMonthlyAmount = Number(monthlyAmount) || 0;
    const parsedTotalInstallments = Number(totalInstallments) || 12;

    if (!parsedCustomerId || !parsedCustomerName || !parsedCustomerPhone || parsedMonthlyAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "customerId, customerName, customerPhone, and monthlyAmount are required",
      });
    }

    const makeDueDate = (monthsFromNow: number) => {
      const date = new Date();
      date.setMonth(date.getMonth() + monthsFromNow);
      return date.toISOString();
    };

    const installmentsList = [];
    for (let i = 1; i <= parsedTotalInstallments; i++) {
      installmentsList.push({
        installmentId: `INST-${i}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        amount: parsedMonthlyAmount,
        dueDate: makeDueDate(i),
        status: "PENDING",
      });
    }

    const enrollment = new ManufacturerSchemeEnrollment({
      enrollmentId: generateId("ENR"),
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
      maturityDate: installmentsList[installmentsList.length - 1]?.dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await enrollment.save();
    return res.status(201).json({ success: true, message: "Customer successfully enrolled in scheme", data: enrollment });
  } catch (error) {
    return respondError(res, error, "Failed to create scheme enrollment");
  }
};

export const recordManufacturerSchemeInstallment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { installmentId, paymentMethod, transactionId, notes, goldRate } = req.body;

    if (!installmentId) {
      return res.status(400).json({ success: false, error: "installmentId is required" });
    }

    const enrollment = await ManufacturerSchemeEnrollment.findOne({ enrollmentId: id });
    if (!enrollment) {
      return res.status(404).json({ success: false, error: "Scheme enrollment not found" });
    }

    const instIndex = enrollment.installments.findIndex((i: any) => i.installmentId === installmentId);
    if (instIndex === -1) {
      return res.status(404).json({ success: false, error: "Installment index not found in this enrollment" });
    }

    const inst = enrollment.installments[instIndex];
    if (inst.status === "PAID") {
      return res.status(400).json({ success: false, error: "This installment is already paid" });
    }

    inst.status = "PAID";
    inst.paidAt = new Date().toISOString();
    inst.paymentMethod = normalizeString(paymentMethod, "CASH");
    inst.transactionId = normalizeString(transactionId, "");
    inst.notes = normalizeString(notes, "");

    const rate = Number(goldRate) || 0;
    if (enrollment.schemeType === "GOLD_SAVING" && rate > 0) {
      inst.goldGramsAccumulated = Number((inst.amount / rate).toFixed(4));
      enrollment.goldAccumulated = Number((enrollment.goldAccumulated + inst.goldGramsAccumulated).toFixed(4));
    }

    enrollment.completedInstallments += 1;
    enrollment.paidAmount += inst.amount;
    enrollment.updatedAt = new Date().toISOString();

    if (enrollment.completedInstallments >= enrollment.totalInstallments) {
      enrollment.status = "MATURED";
      enrollment.maturedDate = new Date().toISOString();
      enrollment.nextDueDate = undefined;
    } else {
      const nextPending = enrollment.installments.find((i: any) => i.status === "PENDING");
      enrollment.nextDueDate = nextPending ? nextPending.dueDate : undefined;
    }

    await enrollment.save();

    const installmentDoc = new ManufacturerInstallment({
      installmentId: inst.installmentId,
      enrollmentId: enrollment.enrollmentId,
      customerId: enrollment.customerId,
      customerPhone: enrollment.customerPhone,
      amount: inst.amount,
      paidAt: inst.paidAt,
      status: "PAID",
      paymentMethod: inst.paymentMethod,
      transactionId: inst.transactionId,
      goldGramsAccumulated: inst.goldGramsAccumulated || 0,
      notes: inst.notes,
    });
    await installmentDoc.save();

    return res.status(200).json({ success: true, message: "Installment payment recorded successfully", data: enrollment });
  } catch (error) {
    return respondError(res, error, "Failed to record installment payment");
  }
};

export const getManufacturerSchemeMaturityList = async (_req: Request, res: Response) => {
  try {
    const list = await ManufacturerSchemeEnrollment.find({ status: { $in: ["ACTIVE", "MATURED"] } }).lean();
    return res.json({ success: true, data: list });
  } catch (error) {
    return respondError(res, error, "Failed to get matured schemes list");
  }
};

export const getManufacturerSchemeDefaulters = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const list = await ManufacturerSchemeEnrollment.find({ status: "ACTIVE", nextDueDate: { $lt: now } }).lean();
    return res.json({ success: true, data: list });
  } catch (error) {
    return respondError(res, error, "Failed to get defaulter list");
  }
};

export const redeemManufacturerScheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ success: false, error: "invoiceId is required for scheme redemption" });
    }

    const enrollment = await ManufacturerSchemeEnrollment.findOne({ enrollmentId: id });
    if (!enrollment) {
      return res.status(404).json({ success: false, error: "Scheme enrollment not found" });
    }

    if (enrollment.status === "REDEEMED") {
      return res.status(400).json({ success: false, error: "This scheme has already been redeemed" });
    }

    enrollment.status = "REDEEMED";
    enrollment.redeemedDate = new Date().toISOString();
    enrollment.redeemedInvoiceId = normalizeString(invoiceId);
    enrollment.updatedAt = new Date().toISOString();

    await enrollment.save();
    return res.json({ success: true, message: "Scheme successfully marked as REDEEMED", data: enrollment });
  } catch (error) {
    return respondError(res, error, "Failed to redeem scheme");
  }
};
