import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  VendorRateContract as VendorRateContractModel,
  Notification as NotificationModel
} from "../../models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/db.js";

// Helper to log user action audits
const logContractAction = async (tenantId: string, actor: string, action: string, details: string) => {
  try {
    if (isDbConnected()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "VendorRateContract",
        entityId: tenantId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write contract audit log:", err);
  }
};

// Helper to send notifications
const triggerContractNotification = async (tenantId: string, title: string, message: string, severity: "INFO" | "WARNING" | "CRITICAL") => {
  try {
    if (isDbConnected()) {
      await NotificationModel.create({
        notificationId: `NOTIF-CON-${Date.now()}`,
        tenantId,
        storeId: tenantId,
        type: "VENDOR_ALERT",
        title,
        message,
        category: "VendorContracts",
        severity,
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING"
      });
    }
  } catch (err) {
    console.error("Failed to send contract notification:", err);
  }
};

const isAuthorized = (req: AuthRequest) => {
  const allowed = ["ADMIN", "SUPER_ADMIN", "PURCHASE_MANAGER", "RETAILER", "STORE_MANAGER"];
  return allowed.includes(req.user?.role || "");
};

// Auto expire contracts that are past their effectiveTo date
const runAutoExpiryCheck = async (tenantId: string) => {
  try {
    if (isDbConnected()) {
      const now = new Date();
      // Find all active contracts that have passed their expiration date
      const expiredContracts = await VendorRateContractModel.find({
        tenantId,
        status: "ACTIVE",
        effectiveTo: { $lt: now }
      });

      for (const contract of expiredContracts) {
        contract.status = "EXPIRED";
        await contract.save();
        await logContractAction(tenantId, "SYSTEM", "CONTRACT_EXPIRED", `Contract ${contract.contractNumber} has auto-expired.`);
        await triggerContractNotification(tenantId, "Vendor Contract Expired", `Contract ${contract.contractNumber} for metal ${contract.metalType} has expired.`, "WARNING");
      }
    }
  } catch (err) {
    console.error("Failed to run auto-expiry checks:", err);
  }
};

// ─── GET /api/vendor-contracts ────────────────────────────────────────
export const getContracts = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    await runAutoExpiryCheck(tenantId);

    const { search, metalType, status, page = 1, limit = 10 } = req.query;
    const query: any = { tenantId };

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      query.contractNumber = searchRegex;
    }

    if (metalType) query.metalType = metalType;
    if (status) query.status = status;

    const skipIndex = (Number(page) - 1) * Number(limit);
    const total = await VendorRateContractModel.countDocuments(query);
    const contracts = await VendorRateContractModel.find(query)
      .populate("vendorId", "name code mobile")
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit))
      .lean();

    return res.json({
      success: true,
      data: contracts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/vendor-contracts/:id ────────────────────────────────────
export const getContractById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const contract = await VendorRateContractModel.findOne({ _id: id, tenantId })
      .populate("vendorId", "name code mobile")
      .lean();
    if (!contract) {
      return res.status(404).json({ success: false, error: "Vendor rate contract profile not found" });
    }
    return res.json({ success: true, data: contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/vendor-contracts ───────────────────────────────────────
export const createContract = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage vendor rate contracts" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { vendorId, metalType, effectiveFrom, effectiveTo, remarks } = req.body;

    if (!vendorId || !metalType || !effectiveFrom || !effectiveTo) {
      return res.status(400).json({ success: false, error: "vendorId, metalType, effectiveFrom, and effectiveTo are required fields" });
    }

    const fromDate = new Date(effectiveFrom);
    const toDate = new Date(effectiveTo);

    if (fromDate >= toDate) {
      return res.status(400).json({ success: false, error: "effectiveFrom date must be earlier than effectiveTo date" });
    }

    // Auto-generate Contract Number
    const contractNumber = `VCON-${Math.floor(100000 + Math.random() * 900000)}`;

    const contract = await VendorRateContractModel.create({
      tenantId,
      contractNumber,
      vendorId,
      metalType,
      effectiveFrom: fromDate,
      effectiveTo: toDate,
      status: "DRAFT",
      remarks: remarks ? remarks.trim() : "",
      createdBy: req.user?.email || "unknown"
    });

    await logContractAction(tenantId, String(req.user?.email), "CONTRACT_CREATED", `Created vendor contract draft: ${contractNumber}`);

    return res.status(201).json({ success: true, data: contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/vendor-contracts/:id ────────────────────────────────────
export const updateContract = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage vendor rate contracts" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const { metalType, effectiveFrom, effectiveTo, remarks } = req.body;

    const contract = await VendorRateContractModel.findOne({ _id: id, tenantId });
    if (!contract) {
      return res.status(404).json({ success: false, error: "Vendor rate contract profile not found" });
    }

    if (contract.status !== "DRAFT") {
      return res.status(400).json({ success: false, error: "Only DRAFT contracts can be modified" });
    }

    if (effectiveFrom || effectiveTo) {
      const fromDate = effectiveFrom ? new Date(effectiveFrom) : contract.effectiveFrom;
      const toDate = effectiveTo ? new Date(effectiveTo) : contract.effectiveTo;

      if (fromDate >= toDate) {
        return res.status(400).json({ success: false, error: "effectiveFrom date must be earlier than effectiveTo date" });
      }

      contract.effectiveFrom = fromDate;
      contract.effectiveTo = toDate;
    }

    if (metalType !== undefined) contract.metalType = metalType;
    if (remarks !== undefined) contract.remarks = remarks ? remarks.trim() : "";

    await contract.save();

    await logContractAction(tenantId, String(req.user?.email), "CONTRACT_UPDATED", `Updated vendor contract details: ${contract.contractNumber}`);

    return res.json({ success: true, data: contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/vendor-contracts/:id/activate ───────────────────────────
export const activateContract = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage vendor rate contracts" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";

    const contract = await VendorRateContractModel.findOne({ _id: id, tenantId });
    if (!contract) {
      return res.status(404).json({ success: false, error: "Vendor rate contract profile not found" });
    }

    if (contract.status !== "DRAFT" && contract.status !== "EXPIRED") {
      return res.status(400).json({ success: false, error: `Cannot activate a contract in ${contract.status} status` });
    }

    // Check overlapping ACTIVE contracts for same Vendor + Metal Type during the same date range
    const overlapping = await VendorRateContractModel.findOne({
      tenantId,
      vendorId: contract.vendorId,
      metalType: contract.metalType,
      status: "ACTIVE",
      effectiveFrom: { $lte: contract.effectiveTo },
      effectiveTo: { $gte: contract.effectiveFrom }
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        error: `Cannot activate contract. There is an overlapping active contract: ${overlapping.contractNumber}`
      });
    }

    contract.status = "ACTIVE";
    await contract.save();

    await logContractAction(tenantId, String(req.user?.email), "CONTRACT_ACTIVATED", `Activated vendor contract: ${contract.contractNumber}`);
    await triggerContractNotification(tenantId, "Vendor Contract Activated", `Contract ${contract.contractNumber} is now active.`, "INFO");

    return res.json({ success: true, data: contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/vendor-contracts/:id/cancel ─────────────────────────────
export const cancelContract = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage vendor rate contracts" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";

    const contract = await VendorRateContractModel.findOne({ _id: id, tenantId });
    if (!contract) {
      return res.status(404).json({ success: false, error: "Vendor rate contract profile not found" });
    }

    contract.status = "CANCELLED";
    await contract.save();

    await logContractAction(tenantId, String(req.user?.email), "CONTRACT_CANCELLED", `Cancelled vendor contract: ${contract.contractNumber}`);
    await triggerContractNotification(tenantId, "Vendor Contract Cancelled", `Contract ${contract.contractNumber} has been cancelled.`, "WARNING");

    return res.json({ success: true, data: contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/vendor-contracts/summary ────────────────────────────────
export const getContractsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    await runAutoExpiryCheck(tenantId);

    const now = new Date();
    const expiringSoonDate = new Date();
    expiringSoonDate.setDate(expiringSoonDate.getDate() + 30);

    const [total, active, expired, expiringSoonList] = await Promise.all([
      VendorRateContractModel.countDocuments({ tenantId }),
      VendorRateContractModel.countDocuments({ tenantId, status: "ACTIVE" }),
      VendorRateContractModel.countDocuments({ tenantId, status: "EXPIRED" }),
      VendorRateContractModel.find({
        tenantId,
        status: "ACTIVE",
        effectiveTo: { $gte: now, $lte: expiringSoonDate }
      })
    ]);

    // Alert generation delegated to ContractExpiryService (avoids duplicate notifications on every GET).
    return res.json({
      success: true,
      data: {
        total,
        active,
        expired,
        expiringSoon: expiringSoonList.length
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/vendor-contracts/:id/status ──────────────────────────────
export const updateContractStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage vendor rate contracts" });
    }

    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user?.tenantId || "default-shop";

    if (!["DRAFT", "ACTIVE", "EXPIRED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status value" });
    }

    const contract = await VendorRateContractModel.findOne({ _id: id, tenantId });
    if (!contract) {
      return res.status(404).json({ success: false, error: "Vendor rate contract profile not found" });
    }

    contract.status = status;
    await contract.save();

    await logContractAction(tenantId, String(req.user?.email), "CONTRACT_STATUS_UPDATED", `Updated vendor contract status to ${status} for ${contract.contractNumber}`);

    return res.json({ success: true, data: contract });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
