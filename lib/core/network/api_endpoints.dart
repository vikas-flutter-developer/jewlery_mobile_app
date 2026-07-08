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
}
