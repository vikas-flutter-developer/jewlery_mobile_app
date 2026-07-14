import 'dart:io';

class ApiEndpoints {
  // Use loopback 10.0.2.2 for Android emulator to talk to host's localhost, otherwise localhost
  static String get baseUrl {
    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:3000/api';
      }
    } catch (_) {}
    return 'http://localhost:3000/api';
  }

  // Auth endpoints
  static const String login = '/auth/login';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
  static const String checkSession = '/auth/check-session';
  static const String verifyOtp = '/auth/verify-otp';
  static const String requestResetPassword = '/auth/request-password-reset';
  static const String resetPassword = '/auth/reset-password';
  static const String sessions = '/auth/sessions';
  static const String revokeSession = '/auth/sessions/revoke';

  // Customer Portal endpoints
  static const String customerOtpRequest = '/portal/auth/otp';
  static const String customerOtpVerify = '/portal/auth/verify';
  static const String customerSchemes = '/portal/customer-schemes';
  static const String availableSchemes = '/portal/schemes';
  static const String payInstallment = '/portal/pay-installment';
  static const String customOrders = '/portal/custom-order';
  static const String checkouts = '/portal/checkout';

  // Inventory & Rates endpoints
  static const String rates = '/rates';
  static const String liveRates = '/rates/live';
  
  // Karikar self-service endpoints
  static const String karikarDashboard = '/karikar/dashboard';
  static const String karikarProfile = '/karikar/profile';
  static const String karikarMetalReturns = '/karikar/metal-returns';
  static const String karikarWastage = '/karikar/wastage-reconciliations';
  static const String karikarWageLedger = '/karikar/wage-ledgers';

  // POS & Billing endpoints
  static const String posEstimate = '/pos/estimate';
  static const String posInvoices = '/pos/invoices';
  static const String posEmiPlans = '/pos/emi-plans';

  // Admin & Back-office endpoints
  static const String purchaseOrders = '/purchase-orders';
  static const String oldGoldMelting = '/oldgold/melting';
  static const String complianceGoldLoans = '/compliance/gold-loans';
  static const String complianceForm60 = '/compliance/form60';
  static const String offers = '/offers';
  static const String auditLogs = '/audit-logs';

  // TCS Compliance Endpoints
  static const String calculateTcs = '/tcs/calculate';
  static const String tcsTransactions = '/tcs/transactions';
  static const String tcsSummary = '/tcs/summary';
  static const String tcsReport = '/tcs/report';

  // PAN Compliance Endpoints
  static const String validatePan = '/pan/validate';
  static const String verifyPan = '/pan/verify';
  static const String getPan = '/pan';

  // HUID & GST Compliance Endpoints
  static const String complianceHuidDashboard = '/compliance/huid/dashboard';
  static const String complianceHuidProducts = '/compliance/huid/products';
  static const String complianceHuidSummary = '/compliance/huid/summary';
  static const String complianceHuidExceptions = '/compliance/huid/exceptions';
  static const String complianceHuidValidate = '/compliance/huid/validate';

  static const String complianceGstDashboard = '/compliance/gst/dashboard';
  static const String complianceGstSummary = '/compliance/gst/summary';
  static const String complianceGstLiabilities = '/compliance/gst/liabilities';
  static const String complianceGstExceptions = '/compliance/gst/exceptions';
  static const String complianceGstFilingStatus = '/compliance/gst/filing-status';

  // BIS Licence Settings Endpoints
  static const String bisLicence = '/settings/bis-licence';

  // Store Settings (Dynamic Configurations) Endpoints
  static const String tenantBranding = '/settings/tenant-branding';
  static const String messagingConfig = '/settings/messaging';
  static const String paymentGateway = '/settings/payment-gateways';
  static const String printers = '/settings/printers';
  static const String taxProfiles = '/settings/tax-profiles';

  // Administrative User Action Endpoints
  static const String userActionsHistory = '/users/actions-history';

  // Referral & Lead System
  static const String referrals = '/referrals';
  static const String referralPartners = '/referral-partners';
  static const String referralCommissions = '/referral-commissions';
  static const String referralPayouts = '/referral-payouts';

  // Vendor Contracts & Pricing Rules
  static const String vendorContracts = '/vendor-contracts';
  static const String vendorContractRules = '/vendor-contract-rules';
}

