import { Response } from "express";
import { randomUUID } from "crypto";
import { AuthRequest } from "../../../lib/authUtils.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { CostEstimate, CostEstimateAuditLog, Notification, Order } from "../../models/index.js";
import { getClientIp } from "../../../lib/authUtils.js";
import { generateCostEstimatePdf } from "../../services/orders/costEstimatePdfService.js";
import { resolveMakingCharge } from "../../../lib/chargeEngine.js";

const VALID_ESTIMATE_STATUS = ["DRAFT", "SUBMITTED", "APPROVED", "DECLINED"];
const ESTIMATE_ROLES = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "DESIGNER"];
const VIEW_ROLES = [...ESTIMATE_ROLES, "MANUFACTURER", "CUSTOMER"];
const CUSTOMER_APPROVAL_ROLES = ["CUSTOMER", "ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER"];

const generateAuditId = () => `CEA-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
const generateNotificationId = () => `CEV-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

async function appendEstimateAuditLog(
  orderId: string,
  designId: string,
  estimateId: string,
  action: string,
  userId: string,
  userEmail: string | undefined,
  userRole: string | undefined,
  details: string
) {
  try {
    await CostEstimateAuditLog.create({
      logId: generateAuditId(),
      orderId,
      designId,
      estimateId,
      action,
      userId,
      userEmail: userEmail || "",
      userRole: userRole || "",
      details,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[CostEstimateAuditLog] Failed to write audit log:", error);
  }
}

async function sendEstimateNotification(
  type: string,
  title: string,
  message: string,
  orderId: string
) {
  try {
    await Notification.create({
      notificationId: generateNotificationId(),
      type,
      title,
      message,
      category: "Cost Estimate",
      severity: "INFO",
      channels: ["IN_APP"],
      relatedEntityId: orderId,
      reference: orderId,
      sendAt: new Date(),
      status: "PENDING",
    });
  } catch (error) {
    console.error("[CostEstimateNotification] Failed to create notification:", error);
  }
}

function computeTax(metalCost: number, stoneCost: number, makingCharges: number, gstPercent: number) {
  return Math.round((metalCost + stoneCost + makingCharges) * gstPercent / 100);
}

function getOrderCustomerIdentifier(order: any) {
  return order.customerId || order.customerEmail || order.customerContact || "Walk-in";
}

export const createCostEstimate = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId } = req.params;
    const {
      metalCost = 0,
      stoneCost = 0,
      makingCharges = null, // Check if explicitly overridden
      gstPercent = 3,
      notes = "",
      lineItems = [],
      status,
    } = req.body;
    const user = req.user!;

    if (!ESTIMATE_ROLES.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to create cost estimates" });
    }

    if (!orderId || !designId) {
      return res.status(400).json({ success: false, error: "orderId and designId are required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const closedStatuses = ["DELIVERED", "CANCELLED", "COMPLETED"];
    if (closedStatuses.includes(String(order.status).toUpperCase())) {
      return res.status(400).json({ success: false, error: "Cannot create estimate on a closed or completed order" });
    }

    // Auto-resolve making charge based on the design/order characteristics
    const metalType = (order.metal || "GOLD").toUpperCase();
    const resolvedMakingCharge = await resolveMakingCharge({
      metalType,
      category: order.category || "",
      subCategory: order.subCategory || "",
      purity: order.purity || "",
      weight: Number(order.weight || 0),
      quantity: Number(order.quantity || 1),
      productValue: Number(metalCost) + Number(stoneCost),
      customerId: order.customerId,
      branchId: order.branchId || "MAIN",
    });

    let finalMakingCharge = resolvedMakingCharge.chargeAmount;
    let isOverride = false;

    // Allow manual override only for authorized users
    if (makingCharges !== null) {
      const parsedUserOverride = Number(makingCharges);
      if (parsedUserOverride !== resolvedMakingCharge.chargeAmount) {
        if (!["ADMIN", "SUPER_ADMIN", "STORE_MANAGER"].includes(user.role)) {
          return res.status(403).json({ success: false, error: "Unauthorized to override auto-calculated making charges" });
        }
        finalMakingCharge = parsedUserOverride;
        isOverride = true;
      }
    }

    const latestEstimate = await CostEstimate.findOne({ orderId, designId }).sort({ estimateNumber: -1 });
    const estimateNumber = latestEstimate ? latestEstimate.estimateNumber + 1 : 1;
    const estimateId = `EST-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const normalizedStatus = typeof status === "string" && VALID_ESTIMATE_STATUS.includes(status) ? status : "SUBMITTED";

    const metalCostNum = Number(metalCost || 0);
    const stoneCostNum = Number(stoneCost || 0);
    const makingChargesNum = Number(finalMakingCharge || 0);
    const gstPercentNum = Number(gstPercent || 3);
    const tax = computeTax(metalCostNum, stoneCostNum, makingChargesNum, gstPercentNum);
    const total = metalCostNum + stoneCostNum + makingChargesNum + tax;

    const estimate = await CostEstimate.create({
      estimateId,
      orderId,
      designId,
      estimateNumber,
      previousEstimateId: latestEstimate ? latestEstimate.estimateId : null,
      createdBy: user.id,
      createdByEmail: user.email || "",
      createdByRole: user.role,
      status: normalizedStatus,
      metalCost: metalCostNum,
      stoneCost: stoneCostNum,
      makingCharges: makingChargesNum,
      gstPercent: gstPercentNum,
      tax,
      total,
      notes: String(notes || "").trim(),
      lineItems: Array.isArray(lineItems) ? lineItems.map((item: any) => ({
        description: String(item?.description || ""),
        quantity: Number(item?.quantity || 1),
        unitPrice: Number(item?.unitPrice || 0),
        amount: Number(item?.amount || 0),
      })) : [],
    });

    if (normalizedStatus !== "DRAFT") {
      order.costEstimate = {
        metalCost: metalCostNum,
        stoneCost: stoneCostNum,
        makingCharges: makingChargesNum,
        tax,
        total,
      };
      await order.save();
    }

    const action = normalizedStatus === "DRAFT" ? "ESTIMATE_CREATE" : "ESTIMATE_SUBMIT";
    let auditMsg = `Estimate #${estimateNumber} created with status ${normalizedStatus}. Metal: ${metalCostNum}, Stone: ${stoneCostNum}, Making: ${makingChargesNum}, Tax: ${tax}, Total: ${total}. IP: ${getClientIp(req)}`;
    if (isOverride) {
      auditMsg += ` [OVERRIDE: Auto making charge of ₹${resolvedMakingCharge.chargeAmount} manually overridden to ₹${makingChargesNum} by ${user.role}]`;
    }

    await appendEstimateAuditLog(
      orderId,
      designId,
      estimate.estimateId,
      action,
      user.id,
      user.email,
      user.role,
      auditMsg
    );

    await sendEstimateNotification(
      normalizedStatus === "DRAFT" ? "ESTIMATE_DRAFT_CREATED" : "ESTIMATE_SUBMITTED",
      normalizedStatus === "DRAFT" ? "Draft Cost Estimate Created" : "Cost Estimate Submitted",
      `${user.role} created a cost estimate for order ${orderId}. Total: ₹${total.toLocaleString("en-IN")}.`,
      orderId
    );

    return res.status(201).json({ success: true, data: estimate });
  } catch (error: any) {
    console.error("[CostEstimate] createCostEstimate error:", error);
    return res.status(500).json({ success: false, error: "Failed to create cost estimate" });
  }
};

export const getCostEstimates = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId } = req.params;
    const user = req.user!;

    if (!VIEW_ROLES.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to view cost estimates" });
    }

    if (!orderId || !designId) {
      return res.status(400).json({ success: false, error: "orderId and designId are required" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (user.role === "CUSTOMER") {
      const orderCustomer = getOrderCustomerIdentifier(order);
      if (orderCustomer && orderCustomer !== user.id && orderCustomer !== user.email) {
        return res.status(403).json({ success: false, error: "Access denied: this is not your order" });
      }
    }

    const estimates = await CostEstimate.find({ orderId, designId }).sort({ estimateNumber: -1 }).lean();
    return res.json({ success: true, data: estimates });
  } catch (error: any) {
    console.error("[CostEstimate] getCostEstimates error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch cost estimates" });
  }
};

export const getCostEstimateById = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId, estimateId } = req.params;
    const user = req.user!;

    if (!VIEW_ROLES.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to view cost estimates" });
    }

    if (!orderId || !designId || !estimateId) {
      return res.status(400).json({ success: false, error: "orderId, designId and estimateId are required" });
    }

    const estimate = await CostEstimate.findOne({ estimateId, orderId, designId }).lean();
    if (!estimate) {
      return res.status(404).json({ success: false, error: "Estimate not found" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (user.role === "CUSTOMER") {
      const orderCustomer = getOrderCustomerIdentifier(order);
      if (orderCustomer && orderCustomer !== user.id && orderCustomer !== user.email) {
        return res.status(403).json({ success: false, error: "Access denied: this is not your order" });
      }
    }

    return res.json({ success: true, data: estimate });
  } catch (error: any) {
    console.error("[CostEstimate] getCostEstimateById error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch cost estimate" });
  }
};

export const getLatestCostEstimate = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId } = req.params;
    const user = req.user!;

    if (!VIEW_ROLES.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to view cost estimates" });
    }

    if (!orderId || !designId) {
      return res.status(400).json({ success: false, error: "orderId and designId are required" });
    }

    const latest = await CostEstimate.findOne({ orderId, designId }).sort({ estimateNumber: -1 }).lean();
    if (!latest) {
      return res.status(404).json({ success: false, error: "No cost estimates found" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (user.role === "CUSTOMER") {
      const orderCustomer = getOrderCustomerIdentifier(order);
      if (orderCustomer && orderCustomer !== user.id && orderCustomer !== user.email) {
        return res.status(403).json({ success: false, error: "Access denied: this is not your order" });
      }
    }

    return res.json({ success: true, data: latest });
  } catch (error: any) {
    console.error("[CostEstimate] getLatestCostEstimate error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch latest cost estimate" });
  }
};

async function updateEstimateStatus(
  req: AuthRequest,
  res: Response,
  targetStatus: "APPROVED" | "DECLINED"
) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId, estimateId } = req.params;
    const user = req.user!;
    const { notes = "" } = req.body;

    if (!CUSTOMER_APPROVAL_ROLES.includes(user.role)) {
      return res.status(403).json({ success: false, error: `Unauthorized to ${targetStatus.toLowerCase()} estimates` });
    }

    if (!orderId || !designId || !estimateId) {
      return res.status(400).json({ success: false, error: "orderId, designId and estimateId are required" });
    }

    const estimate = await CostEstimate.findOne({ estimateId, orderId, designId });
    if (!estimate) {
      return res.status(404).json({ success: false, error: "Estimate not found" });
    }

    if (estimate.status !== "SUBMITTED") {
      return res.status(400).json({ success: false, error: `Only submitted estimates can be ${targetStatus.toLowerCase()}` });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (user.role === "CUSTOMER") {
      const orderCustomer = getOrderCustomerIdentifier(order);
      if (orderCustomer && orderCustomer !== user.id && orderCustomer !== user.email) {
        return res.status(403).json({ success: false, error: "Access denied: this is not your order" });
      }
    }

    estimate.status = targetStatus;
    await estimate.save();

    if (targetStatus === "APPROVED") {
      order.costEstimate = {
        metalCost: estimate.metalCost,
        stoneCost: estimate.stoneCost,
        makingCharges: estimate.makingCharges,
        tax: estimate.tax,
        total: estimate.total,
      };
      await order.save();
    }

    const action = targetStatus === "APPROVED" ? "ESTIMATE_APPROVE" : "ESTIMATE_DECLINE";
    await appendEstimateAuditLog(
      orderId,
      designId,
      estimateId,
      action,
      user.id,
      user.email,
      user.role,
      `${targetStatus} estimate ${estimateId}. Notes: ${String(notes || "")} IP: ${getClientIp(req)}`
    );

    await sendEstimateNotification(
      targetStatus === "APPROVED" ? "ESTIMATE_APPROVED" : "ESTIMATE_DECLINED",
      targetStatus === "APPROVED" ? "Cost Estimate Approved" : "Cost Estimate Declined",
      targetStatus === "APPROVED"
        ? `Estimate ${estimate.estimateId} has been approved.`
        : `Estimate ${estimate.estimateId} has been declined.`,
      orderId
    );

    return res.json({ success: true, data: estimate });
  } catch (error: any) {
    console.error(`[CostEstimate] ${targetStatus.toLowerCase()}Estimate error:`, error);
    return res.status(500).json({ success: false, error: `Failed to ${targetStatus.toLowerCase()} cost estimate` });
  }
}

export const approveCostEstimate = async (req: AuthRequest, res: Response) =>
  updateEstimateStatus(req, res, "APPROVED");

export const declineCostEstimate = async (req: AuthRequest, res: Response) =>
  updateEstimateStatus(req, res, "DECLINED");

export const downloadCostEstimatePdf = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId, estimateId } = req.params;
    const user = req.user!;

    if (!VIEW_ROLES.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to download cost estimate PDF" });
    }

    if (!orderId || !designId || !estimateId) {
      return res.status(400).json({ success: false, error: "orderId, designId and estimateId are required" });
    }

    const estimate = await CostEstimate.findOne({ estimateId, orderId, designId }).lean();
    if (!estimate) {
      return res.status(404).json({ success: false, error: "Estimate not found" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (user.role === "CUSTOMER") {
      const orderCustomer = getOrderCustomerIdentifier(order);
      if (orderCustomer && orderCustomer !== user.id && orderCustomer !== user.email) {
        return res.status(403).json({ success: false, error: "Access denied: this is not your order" });
      }
    }

    const pdfBuffer = await generateCostEstimatePdf({ order, estimate });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="estimate-${estimate.estimateId}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[CostEstimate] downloadCostEstimatePdf error:", error);
    return res.status(500).json({ success: false, error: "Failed to generate estimate PDF" });
  }
};
