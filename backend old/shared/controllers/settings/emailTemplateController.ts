import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { TenantEmailTemplate as TenantEmailTemplateModel } from "../../../retailer/models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/db.js";

// Helper to log user action audits
const logTemplateAction = async (tenantId: string, actor: string, action: string, details: string) => {
  try {
    if (isDbConnected()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "TenantEmailTemplate",
        entityId: tenantId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write email template audit log:", err);
  }
};

const isAuthorized = (req: AuthRequest) => {
  return req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN";
};

// ─── GET /api/settings/email-templates ────────────────────────────────
export const getTenantEmailTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const templates = await TenantEmailTemplateModel.find({ tenantId }).lean();
    return res.json({ success: true, data: templates });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/settings/email-templates/:id ────────────────────────────
export const getTenantEmailTemplateById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const template = await TenantEmailTemplateModel.findOne({ _id: id, tenantId }).lean();
    if (!template) {
      return res.status(404).json({ success: false, error: "Email template not found" });
    }
    return res.json({ success: true, data: template });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/email-templates ───────────────────────────────
export const createTenantEmailTemplate = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage email templates" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { templateType, senderName, logoUrl, footerText, isActive } = req.body;

    if (!templateType || !senderName) {
      return res.status(400).json({ success: false, error: "templateType and senderName are required" });
    }

    const activeVal = isActive !== undefined ? isActive : true;

    // Enforce one active template per type per tenant rule
    if (activeVal) {
      await TenantEmailTemplateModel.updateMany({ tenantId, templateType }, { isActive: false });
    }

    const template = await TenantEmailTemplateModel.create({
      tenantId,
      templateType,
      senderName,
      logoUrl: logoUrl || "",
      footerText: footerText || "",
      isActive: activeVal
    });

    await logTemplateAction(tenantId, String(req.user?.email), "CREATE_TEMPLATE", `Created email template of type: ${templateType}`);

    return res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/settings/email-templates/:id ────────────────────────────
export const updateTenantEmailTemplate = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage email templates" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const { templateType, senderName, logoUrl, footerText, isActive } = req.body;

    const template = await TenantEmailTemplateModel.findOne({ _id: id, tenantId });
    if (!template) {
      return res.status(404).json({ success: false, error: "Email template not found" });
    }

    const activeVal = isActive !== undefined ? isActive : template.isActive;
    const finalType = templateType || template.templateType;

    // Enforce one active template per type per tenant rule
    if (activeVal) {
      await TenantEmailTemplateModel.updateMany({ tenantId, templateType: finalType }, { isActive: false });
    }

    if (templateType !== undefined) template.templateType = templateType;
    if (senderName !== undefined) template.senderName = senderName;
    if (logoUrl !== undefined) template.logoUrl = logoUrl;
    if (footerText !== undefined) template.footerText = footerText;
    template.isActive = activeVal;

    await template.save();

    await logTemplateAction(tenantId, String(req.user?.email), "UPDATE_TEMPLATE", `Updated email template of type: ${finalType}`);

    return res.json({ success: true, data: template });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/email-templates/preview ───────────────────────
export const previewEmailTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const { templateType, senderName, logoUrl, footerText } = req.body;

    const displaySender = senderName || "AuraJewel";
    const displayLogo = logoUrl || "";
    const displayFooter = footerText || "";

    let mockBody = "";
    if (templateType === "OTP") {
      mockBody = `<p>Your verification code is <strong>123456</strong>. It expires in 5 minutes.</p>`;
    } else if (templateType === "INVOICE") {
      mockBody = `
        <h3 style="color: #0f172a; margin-top: 0;">Invoice #INV-2026-001</h3>
        <p>Dear Customer, your invoice is ready for review. Find details summarized below:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 15px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #e2e8f0; text-align: left;">
              <th style="padding: 6px 0;">Item Description</th>
              <th style="padding: 6px 0; text-align: right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0;">22kt Gold Ring (4.2g)</td>
              <td style="padding: 8px 0; text-align: right;">₹32,450.00</td>
            </tr>
          </tbody>
        </table>
        <p>Please log in to your portal to download the complete PDF receipt.</p>
      `;
    } else {
      mockBody = `
        <h3 style="color: #0f172a; margin-top: 0;">Account Alert notification</h3>
        <p>Your subscription details have been updated successfully. Active status: <strong>Enabled</strong>.</p>
      `;
    }

    const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
  <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px;">
    ${displayLogo ? `<img src="${displayLogo}" alt="${displaySender}" style="max-height: 60px; object-fit: contain;" />` : `<h2 style="margin: 0; color: #0f172a; font-family: serif; font-style: italic;">${displaySender}</h2>`}
  </div>
  <div style="color: #334155; line-height: 1.6; font-size: 14px;">
    ${mockBody}
  </div>
  <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8;">
    <p style="margin: 0 0 5px 0; font-weight: bold;">Sent by ${displaySender}</p>
    ${displayFooter ? `<p style="margin: 0; white-space: pre-line;">${displayFooter}</p>` : ''}
  </div>
</div>
    `.trim();

    await logTemplateAction(tenantId, String(req.user?.email), "EMAIL_PREVIEW_GENERATED", `Generated preview for email template: ${templateType}`);

    return res.json({ success: true, html });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── DELETE /api/settings/email-templates/:id ─────────────────────────
export const deleteEmailTemplate = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage email templates" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";

    const template = await TenantEmailTemplateModel.findOne({ _id: id, tenantId });
    if (!template) {
      return res.status(404).json({ success: false, error: "Email template not found" });
    }

    await TenantEmailTemplateModel.deleteOne({ _id: id });

    await logTemplateAction(tenantId, String(req.user?.email), "DELETE_TEMPLATE", `Deleted template of type: ${template.templateType}`);

    return res.json({ success: true, message: "Email template deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
