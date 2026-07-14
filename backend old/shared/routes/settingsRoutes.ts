import express from "express";
import { getSettings, updateSettings } from "../controllers/settings/settingsController.js";
import {
  getInvoiceSeries,
  updateInvoiceSeries,
  getInvoiceProfileHandler,
  updateInvoiceProfileHandler,
} from "../../retailer/controllers/invoice/invoiceController.js";
import {
  createRule,
  updateRule,
  getRules,
  getRuleById,
  deleteRule,
  calculateMakingCharge
} from "../../retailer/controllers/settings/makingChargeRulesController.js";
import {
  createFinancialYear,
  updateFinancialYear,
  getFinancialYears,
  getFinancialYearById,
  activateFinancialYear,
  closeFinancialYear,
  getCurrentFinancialYearAPI
} from "../../retailer/controllers/settings/financialYearController.js";
import {
  createTaxProfile,
  updateTaxProfile,
  getTaxProfiles,
  getTaxProfileById,
  deleteTaxProfile,
  getDefaultTaxProfile
} from "../../retailer/controllers/settings/taxProfileController.js";
import {
  createMessagingConfig,
  updateMessagingConfig,
  getMessagingConfigs,
  getMessagingConfigById,
  deleteMessagingConfig,
  testMessagingConfig
} from "../../retailer/controllers/settings/messagingConfigurationController.js";
import {
  createPaymentGateway,
  updatePaymentGateway,
  getPaymentGateways,
  getPaymentGatewayById,
  deletePaymentGateway,
  testPaymentGateway,
  setDefaultPaymentGateway,
  togglePaymentGatewayStatus
} from "../../retailer/controllers/settings/paymentGatewayConfigurationController.js";
import {
  createPrinter,
  updatePrinter,
  getPrinters,
  getPrinterById,
  deletePrinter,
  testPrinter,
  setDefaultPrinter
} from "../../retailer/controllers/settings/printerConfigurationController.js";
import { authMiddleware } from "../../lib/authUtils.js";


const router = express.Router();

router.get("/", getSettings);
router.put("/", updateSettings);

// ── Invoice Engine settings ──────────────────────────────────────────────────
// GET  /settings/invoice-series          – current series config & last sequence
// PUT  /settings/invoice-series          – update prefix / padLength / reset
// GET  /settings/invoice-profile         – shop profile used on invoices
// PUT  /settings/invoice-profile         – update shop profile
router.get("/invoice-series", getInvoiceSeries);
router.put("/invoice-series", updateInvoiceSeries);
router.get("/invoice-profile", getInvoiceProfileHandler);
router.put("/invoice-profile", updateInvoiceProfileHandler);

// ── Making Charge Rules settings ──────────────────────────────────────────────
router.post("/making-charge-rules", authMiddleware, createRule);
router.put("/making-charge-rules/:id", authMiddleware, updateRule);
router.get("/making-charge-rules", authMiddleware, getRules);
router.get("/making-charge-rules/:id", authMiddleware, getRuleById);
router.delete("/making-charge-rules/:id", authMiddleware, deleteRule);
router.post("/making-charge-rules/calculate", authMiddleware, calculateMakingCharge);

// ── Financial Year Management settings ─────────────────────────────────────────
router.post("/financial-years", authMiddleware, createFinancialYear);
router.get("/financial-years", authMiddleware, getFinancialYears);
router.get("/financial-years/current", authMiddleware, getCurrentFinancialYearAPI);
router.get("/financial-years/:id", authMiddleware, getFinancialYearById);
router.put("/financial-years/:id", authMiddleware, updateFinancialYear);
router.put("/financial-years/:id/activate", authMiddleware, activateFinancialYear);
router.put("/financial-years/:id/close", authMiddleware, closeFinancialYear);

// ── Tax Profile Management settings ────────────────────────────────────────────
router.post("/tax-profiles", authMiddleware, createTaxProfile);
router.get("/tax-profiles", authMiddleware, getTaxProfiles);
router.get("/tax-profiles/default", authMiddleware, getDefaultTaxProfile);
router.get("/tax-profiles/:id", authMiddleware, getTaxProfileById);
router.put("/tax-profiles/:id", authMiddleware, updateTaxProfile);
router.delete("/tax-profiles/:id", authMiddleware, deleteTaxProfile);

// ── Messaging Configuration Management settings ─────────────────────────────────
router.post("/messaging", authMiddleware, createMessagingConfig);
router.get("/messaging", authMiddleware, getMessagingConfigs);
router.post("/messaging/test", authMiddleware, testMessagingConfig);
router.get("/messaging/:id", authMiddleware, getMessagingConfigById);
router.put("/messaging/:id", authMiddleware, updateMessagingConfig);
router.delete("/messaging/:id", authMiddleware, deleteMessagingConfig);

// ── Payment Gateway Configuration Management settings ────────────────────────────
router.post("/payment-gateways", authMiddleware, createPaymentGateway);
router.get("/payment-gateways", authMiddleware, getPaymentGateways);
router.post("/payment-gateways/test", authMiddleware, testPaymentGateway);
router.get("/payment-gateways/:id", authMiddleware, getPaymentGatewayById);
router.put("/payment-gateways/:id", authMiddleware, updatePaymentGateway);
router.delete("/payment-gateways/:id", authMiddleware, deletePaymentGateway);
router.patch("/payment-gateways/:id/set-default", authMiddleware, setDefaultPaymentGateway);
router.patch("/payment-gateways/:id/toggle-status", authMiddleware, togglePaymentGatewayStatus);

// ── Printer Configuration Management settings ────────────────────────────────────
router.post("/printers", authMiddleware, createPrinter);
router.get("/printers", authMiddleware, getPrinters);
router.post("/printers/test", authMiddleware, testPrinter);
router.post("/printers/set-default", authMiddleware, setDefaultPrinter);
router.get("/printers/:id", authMiddleware, getPrinterById);
router.put("/printers/:id", authMiddleware, updatePrinter);
router.delete("/printers/:id", authMiddleware, deletePrinter);

// ── Tenant Branding Engine ───────────────────────────────────────────────────────
import {
  getTenantBranding,
  createTenantBranding,
  updateTenantBranding,
  uploadBrandingLogo,
  uploadBrandingFavicon
} from "../controllers/settings/tenantBrandingController.js";

router.post("/tenant-branding", authMiddleware, createTenantBranding);
router.put("/tenant-branding", authMiddleware, updateTenantBranding);
router.get("/tenant-branding", authMiddleware, getTenantBranding);
router.post("/tenant-branding/logo", authMiddleware, uploadBrandingLogo);
router.post("/tenant-branding/favicon", authMiddleware, uploadBrandingFavicon);

// ── Tenant Theme Management ──────────────────────────────────────────────────────
import {
  getTenantTheme,
  createTenantTheme,
  updateTenantTheme,
  uploadLoginBanner,
  uploadLoginBackground
} from "../controllers/settings/themeController.js";

router.get("/theme", getTenantTheme);
router.post("/theme", authMiddleware, createTenantTheme);
router.put("/theme", authMiddleware, updateTenantTheme);
router.post("/theme/login-banner", authMiddleware, uploadLoginBanner);
router.post("/theme/login-background", authMiddleware, uploadLoginBackground);

// ── Tenant Custom Domain Mapping ──────────────────────────────────────────────────
import {
  getTenantDomains,
  getTenantDomainById,
  createTenantDomain,
  updateTenantDomain,
  verifyDomain,
  checkSSL,
  deleteDomain
} from "../controllers/settings/domainController.js";

router.get("/domains", authMiddleware, getTenantDomains);
router.get("/domains/:id", authMiddleware, getTenantDomainById);
router.post("/domains", authMiddleware, createTenantDomain);
router.put("/domains/:id", authMiddleware, updateTenantDomain);
router.post("/domains/:id/verify", authMiddleware, verifyDomain);
router.post("/domains/:id/check-ssl", authMiddleware, checkSSL);
router.delete("/domains/:id", authMiddleware, deleteDomain);

// ── Tenant White Label Email Templates ─────────────────────────────────────────────
import {
  getTenantEmailTemplates,
  getTenantEmailTemplateById,
  createTenantEmailTemplate,
  updateTenantEmailTemplate,
  previewEmailTemplate,
  deleteEmailTemplate
} from "../controllers/settings/emailTemplateController.js";

router.get("/email-templates", authMiddleware, getTenantEmailTemplates);
router.get("/email-templates/:id", authMiddleware, getTenantEmailTemplateById);
router.post("/email-templates", authMiddleware, createTenantEmailTemplate);
router.put("/email-templates/:id", authMiddleware, updateTenantEmailTemplate);
router.post("/email-templates/preview", authMiddleware, previewEmailTemplate);
router.delete("/email-templates/:id", authMiddleware, deleteEmailTemplate);

// ── Tenant White Label Mobile/App Settings ─────────────────────────────────────────
import {
  getTenantAppSettings,
  createTenantAppSettings,
  updateTenantAppSettings,
  uploadAppIcon,
  uploadAppSplash,
  getPwaManifest
} from "../controllers/settings/appSettingsController.js";

router.get("/app-settings", authMiddleware, getTenantAppSettings);
router.post("/app-settings", authMiddleware, createTenantAppSettings);
router.put("/app-settings", authMiddleware, updateTenantAppSettings);
router.post("/app-settings/icon", authMiddleware, uploadAppIcon);
router.post("/app-settings/splash", authMiddleware, uploadAppSplash);
router.get("/app-settings/manifest", getPwaManifest); // Public unauthenticated route

export default router;


