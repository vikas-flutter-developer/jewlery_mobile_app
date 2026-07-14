import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { Inventory as RetailerInventory } from "../../../retailer/models/index.js";
import { ManufacturerInventory } from "../../../manufacturer/models/index.js";
import { BISLicence as RetailerBISLicence } from "../../../retailer/models/index.js";
import DefaultInventory from "../../../models/Inventory.js";
import DefaultBISLicence from "../../../models/BISLicence.js";

const getInventoryModel = (req: any) => {
  const storeType = req.user?.storeType || (req.user?.role === "ADMIN" ? "MANUFACTURER" : "RETAILER");
  if (storeType === "MANUFACTURER") return ManufacturerInventory;
  return RetailerInventory;
};

const getBisLicenceModel = (req: any) => {
  return RetailerBISLicence;
};

export const getHuidDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const InventoryModel = getInventoryModel(req);
    const totalHuidProducts = await InventoryModel.countDocuments();
    const compliantProducts = await InventoryModel.countDocuments({ huidStatus: "COMPLIANT" });
    const pendingCompliance = await InventoryModel.countDocuments({ huidStatus: "PENDING" });
    
    const missingHuid = await InventoryModel.countDocuments({
      $or: [
        { huidStatus: "MISSING_HUID" },
        { huidNumber: { $exists: false } },
        { huidNumber: "" }
      ]
    });
    
    const invalidHuid = await InventoryModel.countDocuments({ huidStatus: "INVALID" });
    const compliancePercentage = totalHuidProducts > 0 ? Math.round((compliantProducts / totalHuidProducts) * 100) : 0;

    return res.json({
      success: true,
      data: {
        totalHuidProducts,
        compliantProducts,
        pendingCompliance,
        missingHuid,
        invalidHuid,
        compliancePercentage
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getHuidProducts = async (req: AuthRequest, res: Response) => {
  try {
    const InventoryModel = getInventoryModel(req);
    const { page = 1, limit = 10, search = "", status = "", branchId = "", metal = "" } = req.query;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
        { huidNumber: { $regex: search, $options: "i" } }
      ];
    }
    if (status) {
      query.huidStatus = status;
    }
    if (branchId) {
      query.branchId = branchId;
    }
    if (metal) {
      query.metal = metal;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const items = await InventoryModel.find(query)
      .populate("bisLicenceId")
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await InventoryModel.countDocuments(query);

    return res.json({
      success: true,
      data: items,
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

export const getHuidSummary = async (req: AuthRequest, res: Response) => {
  try {
    const InventoryModel = getInventoryModel(req);
    const summary = await InventoryModel.aggregate([
      {
        $group: {
          _id: "$branchId",
          total: { $sum: 1 },
          compliant: {
            $sum: { $cond: [{ $eq: ["$huidStatus", "COMPLIANT"] }, 1, 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$huidStatus", "PENDING"] }, 1, 0] }
          },
          missing: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$huidStatus", "MISSING_HUID"] },
                    { $not: ["$huidNumber"] },
                    { $eq: ["$huidNumber", ""] }
                  ]
                },
                1,
                0
              ]
            }
          },
          invalid: {
            $sum: { $cond: [{ $eq: ["$huidStatus", "INVALID"] }, 1, 0] }
          }
        }
      }
    ]);

    return res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getHuidExceptions = async (req: AuthRequest, res: Response) => {
  try {
    const InventoryModel = getInventoryModel(req);
    const exceptions = await InventoryModel.find({
      $or: [
        { huidStatus: { $ne: "COMPLIANT" } },
        { huidNumber: { $exists: false } },
        { huidNumber: "" }
      ]
    })
      .populate("bisLicenceId")
      .sort({ createdAt: -1 })
      .lean();

    const mappedExceptions = exceptions.map((ex: any) => ({
      ...ex,
      weight: ex.weight ?? ex.grossWeight ?? ex.netWeight ?? 0,
      metalPurity: ex.metalPurity ?? `${ex.metal || ex.type || "GOLD"} ${ex.purity || ""}`.trim()
    }));

    return res.json({
      success: true,
      data: mappedExceptions
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const validateHuid = async (req: AuthRequest, res: Response) => {
  try {
    const { bisLicenceNumber } = req.body;
    const huidNumber = req.body.huidNumber || req.body.uidCode;
    if (!huidNumber) {
      return res.status(400).json({ success: false, error: "HUID number is required" });
    }

    const HUID_REGEX = /^[A-Z0-9]{6}$/i;
    if (!HUID_REGEX.test(huidNumber)) {
      return res.json({
        success: true,
        isValid: false,
        valid: false,
        error: "Invalid format. HUID must be exactly 6 alphanumeric characters.",
        reason: "Invalid format. HUID must be exactly 6 alphanumeric characters."
      });
    }

    const InventoryModel = getInventoryModel(req);
    const { excludeItemId } = req.body;
    const duplicateQuery: any = { huidNumber: huidNumber.trim() };
    if (excludeItemId) {
      duplicateQuery._id = { $ne: excludeItemId };
    }
    const duplicate = await InventoryModel.findOne(duplicateQuery);
    if (duplicate) {
      return res.json({
        success: true,
        isValid: false,
        valid: false,
        error: `Duplicate HUID. Already assigned to product barcode: ${duplicate.barcode}`,
        reason: `Duplicate HUID. Already assigned to product barcode: ${duplicate.barcode}`
      });
    }

    let licenceDetails = null;
    if (bisLicenceNumber) {
      const BisLicenceModel = getBisLicenceModel(req);
      const licence = await BisLicenceModel.findOne({ licenceNumber: bisLicenceNumber.trim() });
      if (!licence) {
        return res.json({
          success: true,
          isValid: false,
          valid: false,
          error: "BIS Licence not found.",
          reason: "BIS Licence not found."
        });
      }
      if (licence.status !== "ACTIVE") {
        return res.json({
          success: true,
          isValid: false,
          valid: false,
          error: `BIS Licence is non-active (Status: ${licence.status})`,
          reason: `BIS Licence is non-active (Status: ${licence.status})`
        });
      }
      if (new Date(licence.expiryDate) < new Date()) {
        return res.json({
          success: true,
          isValid: false,
          valid: false,
          error: "BIS Licence has expired.",
          reason: "BIS Licence has expired."
        });
      }
      licenceDetails = licence;
    }

    return res.json({
      success: true,
      isValid: true,
      valid: true,
      details: licenceDetails
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
