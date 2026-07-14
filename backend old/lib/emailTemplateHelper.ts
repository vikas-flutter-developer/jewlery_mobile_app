import { TenantEmailTemplate as TenantEmailTemplateModel } from "../retailer/models/index.js";

export const wrapWithEmailTemplate = async (
  tenantId: string,
  templateType: "INVOICE" | "OTP" | "NOTIFICATION",
  originalHtmlBody: string,
  fallbackSenderName = "AuraJewel"
) => {
  let logoUrl = "";
  let senderName = fallbackSenderName;
  let footerText = "";
  
  try {
    const template = await TenantEmailTemplateModel.findOne({ tenantId, templateType, isActive: true }).lean();
    if (template) {
      logoUrl = template.logoUrl || "";
      senderName = template.senderName || fallbackSenderName;
      footerText = template.footerText || "";
    }
  } catch (err) {
    console.error("Failed to load email template for wrapping:", err);
  }

  const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
  <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px;">
    ${logoUrl ? `<img src="${logoUrl}" alt="${senderName}" style="max-height: 60px; object-fit: contain;" />` : `<h2 style="margin: 0; color: #0f172a; font-family: serif; font-style: italic;">${senderName}</h2>`}
  </div>
  <div style="color: #334155; line-height: 1.6; font-size: 14px;">
    ${originalHtmlBody}
  </div>
  <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8;">
    <p style="margin: 0 0 5px 0; font-weight: bold;">Sent by ${senderName}</p>
    ${footerText ? `<p style="margin: 0; white-space: pre-line;">${footerText}</p>` : ''}
  </div>
</div>
  `.trim();

  return { html, senderName };
};
