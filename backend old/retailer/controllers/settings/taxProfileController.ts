import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { TaxProfile, Notification, Invoice, Sale, CostEstimate } from "../../models/index.js";
import { financeAuditService, buildAuditContextFromRequest } from "../../services/financial/financeAuditService.js";
import { isDbConnected } from "../../../lib/serverState.js";

function getTenantId(req: AuthRequest): string {
  return req.user?.tenantId || "default-shop";
}

async function sendTaxProfileNotification(tenantId: string, type: string, title: string, message: string) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: `NOTIF-TP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        tenantId,
        type,
        title,
        message,
        category: "TaxProfile",
        severity: "INFO",
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error("[TaxProfile Notification] Failed:", err);
  }
}

/**
 * POST /api/settings/tax-profiles
 */
export const createTaxProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { profileName, taxType, cgst, sgst, igst, cess, hsnCode, isDefault, isActive } = req.body;

    if (!profileName || !hsnCode) {
      return res.status(400).json({ success: false, error: "Missing required fields: profileName and hsnCode." });
    }

    if (isDbConnected()) {
      // Check for duplicate name under this tenant
      const duplicate = await TaxProfile.findOne({ tenantId, profileName });
      if (duplicate) {
        return res.status(400).json({ success: false, error: "A tax profile with this name already exists." });
      }

      if (isDefault) {
        // Unset previous defaults
        await TaxProfile.updateMany({ tenantId, isDefault: true }, { $set: { isDefault: false } });
      }

      // Check if this is the first profile, make it default if not specified
      const count = await TaxProfile.countDocuments({ tenantId });
      const finalIsDefault = count === 0 ? true : !!isDefault;

      const newProfile = await TaxProfile.create({
        profileName,
        taxType: taxType || "GST",
        cgst: Number(cgst || 0),
        sgst: Number(sgst || 0),
        igst: Number(igst || 0),
        cess: Number(cess || 0),
        hsnCode,
        isDefault: finalIsDefault,
        isActive: isActive !== false,
        tenantId,
      });

      // Audit Log
      const auditCtx = buildAuditContextFromRequest(req);
      await financeAuditService.log({
        actionType: "TAX_PROFILE_CREATED",
        entityType: "TAX_PROFILE",
        entityId: String(newProfile._id),
        newData: newProfile.toObject(),
        context: auditCtx
      });

      // Notification
      await sendTaxProfileNotification(tenantId, "TAX_PROFILE_CREATED", "Tax Profile Created", `Tax profile ${profileName} has been created.`);

      return res.status(201).json({ success: true, data: newProfile });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to create tax profile." });
  }
};

/**
 * PUT /api/settings/tax-profiles/:id
 */
export const updateTaxProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { profileName, taxType, cgst, sgst, igst, cess, hsnCode, isDefault, isActive } = req.body;

    if (isDbConnected()) {
      const profile = await TaxProfile.findOne({ _id: id, tenantId });
      if (!profile) {
        return res.status(404).json({ success: false, error: "Tax Profile not found." });
      }

      const previousData = profile.toObject();

      if (profileName) {
        const duplicate = await TaxProfile.findOne({ tenantId, profileName, _id: { $ne: id } });
        if (duplicate) {
          return res.status(400).json({ success: false, error: "Another tax profile with this name already exists." });
        }
        profile.profileName = profileName;
      }

      if (taxType !== undefined) profile.taxType = taxType;
      if (cgst !== undefined) profile.cgst = Number(cgst);
      if (sgst !== undefined) profile.sgst = Number(sgst);
      if (igst !== undefined) profile.igst = Number(igst);
      if (cess !== undefined) profile.cess = Number(cess);
      if (hsnCode !== undefined) profile.hsnCode = hsnCode;

      let defaultChanged = false;
      if (isDefault !== undefined) {
        if (isDefault) {
          await TaxProfile.updateMany({ tenantId, isDefault: true, _id: { $ne: id } }, { $set: { isDefault: false } });
          profile.isDefault = true;
          defaultChanged = !previousData.isDefault;
        } else {
          // If trying to unset default, make sure there is at least another profile we can make default,
          // or prevent unsetting if this is the only default.
          if (profile.isDefault) {
            return res.status(400).json({ success: false, error: "Cannot unset default status. Set another profile as default instead." });
          }
        }
      }

      let activated = false;
      if (isActive !== undefined) {
        if (!isActive && profile.isDefault) {
          return res.status(400).json({ success: false, error: "Cannot deactivate the default tax profile." });
        }
        profile.isActive = !!isActive;
        if (profile.isActive && !previousData.isActive) {
          activated = true;
        }
      }

      await profile.save();

      // Audit Log
      const auditCtx = buildAuditContextFromRequest(req);
      await financeAuditService.log({
        actionType: defaultChanged ? "TAX_PROFILE_DEFAULT_CHANGED" : activated ? "TAX_PROFILE_ACTIVATED" : "TAX_PROFILE_UPDATED",
        entityType: "TAX_PROFILE",
        entityId: String(profile._id),
        previousData,
        newData: profile.toObject(),
        context: auditCtx
      });

      // Notification
      await sendTaxProfileNotification(tenantId, "TAX_PROFILE_UPDATED", "Tax Profile Updated", `Tax profile ${profile.profileName} has been updated.`);

      return res.json({ success: true, data: profile });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to update tax profile." });
  }
};

/**
 * GET /api/settings/tax-profiles
 */
export const getTaxProfiles = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"))));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { tenantId };

    if (req.query.search) {
      const searchRegex = new RegExp(String(req.query.search), "i");
      query.$or = [
        { profileName: searchRegex },
        { hsnCode: searchRegex }
      ];
    }

    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === "true";
    }

    if (req.query.isDefault !== undefined) {
      query.isDefault = req.query.isDefault === "true";
    }

    if (isDbConnected()) {
      const [items, total] = await Promise.all([
        TaxProfile.find(query).sort({ isDefault: -1, profileName: 1 }).skip(skip).limit(limit).lean(),
        TaxProfile.countDocuments(query)
      ]);

      return res.json({
        success: true,
        data: items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to list tax profiles." });
  }
};

/**
 * GET /api/settings/tax-profiles/default
 */
export const getDefaultTaxProfile = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (isDbConnected()) {
      let defaultProfile = await TaxProfile.findOne({ tenantId, isDefault: true, isActive: true }).lean();
      if (!defaultProfile) {
        // Fallback to any active profile
        defaultProfile = await TaxProfile.findOne({ tenantId, isActive: true }).lean();
      }
      return res.json({ success: true, data: defaultProfile });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to get default tax profile." });
  }
};

/**
 * GET /api/settings/tax-profiles/:id
 */
export const getTaxProfileById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (isDbConnected()) {
      const profile = await TaxProfile.findOne({ _id: id, tenantId }).lean();
      if (!profile) {
        return res.status(404).json({ success: false, error: "Tax profile not found." });
      }
      return res.json({ success: true, data: profile });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to retrieve tax profile." });
  }
};

/**
 * DELETE /api/settings/tax-profiles/:id
 */
export const deleteTaxProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (isDbConnected()) {
      const profile = await TaxProfile.findOne({ _id: id, tenantId });
      if (!profile) {
        return res.status(404).json({ success: false, error: "Tax Profile not found." });
      }

      if (profile.isDefault) {
        return res.status(400).json({ success: false, error: "Cannot delete the default tax profile." });
      }

      if (profile.isActive) {
        return res.status(400).json({ success: false, error: "Cannot delete an active tax profile. Please deactivate it first." });
      }

      // Check if profile is in use: e.g. HSN Code referenced in invoices
      const inUseInvoice = await Invoice.findOne({ tenantId, "items.hsnCode": profile.hsnCode });
      if (inUseInvoice) {
        return res.status(400).json({ success: false, error: "Cannot delete tax profile. The HSN code is referenced in historical invoices." });
      }

      const previousData = profile.toObject();
      await profile.deleteOne();

      // Audit Log
      const auditCtx = buildAuditContextFromRequest(req);
      await financeAuditService.log({
        actionType: "TAX_PROFILE_DELETED",
        entityType: "TAX_PROFILE",
        entityId: id,
        previousData,
        context: auditCtx
      });

      return res.json({ success: true, message: "Tax Profile deleted successfully." });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to delete tax profile." });
  }
};
