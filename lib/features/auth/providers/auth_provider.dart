import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/database/local_db.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';

class AuthState {
  final bool isLoading;
  final bool isInitializing;
  final bool isAuthenticated;
  final String? token;
  final Map<String, dynamic>? user;
  final String? error;

  AuthState({
    this.isLoading = false,
    this.isInitializing = false,
    this.isAuthenticated = false,
    this.token,
    this.user,
    this.error,
  });

  AuthState copyWith({
    bool? isLoading,
    bool? isInitializing,
    bool? isAuthenticated,
    String? token,
    Map<String, dynamic>? user,
    String? error,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      isInitializing: isInitializing ?? this.isInitializing,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      token: token ?? this.token,
      user: user ?? this.user,
      error: error ?? this.error,
    );
  }

  // Get user role safely
  String? get role => user?['role'];
  String? get email => user?['email'];
  String? get name => user?['name'];
  String? get tenantId => user?['tenantId'];
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(AuthState(isLoading: true, isInitializing: true)) {
    api.onUnauthorized = () {
      state = AuthState(isAuthenticated: false, isLoading: false, isInitializing: false);
    };
    _loadSession();
  }

  // Load cached session on app boot
  Future<void> _loadSession() async {
    try {
      final token = await LocalDb.getToken();
      final profile = LocalDb.getProfile();

      if (token != null && profile != null) {
        state = AuthState(
          isAuthenticated: true,
          token: token,
          user: profile,
          isLoading: false,
          isInitializing: false,
        );
        // Verify session validity with backend in the background
        _verifySession();
      } else {
        state = AuthState(isLoading: false, isInitializing: false);
      }
    } catch (e) {
      state = AuthState(isLoading: false, isInitializing: false, error: e.toString());
    }
  }

  // Verify token validation in background
  Future<void> _verifySession() async {
    try {
      final res = await api.get(ApiEndpoints.checkSession);
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data as Map<String, dynamic>;
        if (data['valid'] == true) {
          // Token is valid, proceed
          return;
        }
      }
      // Invalid session -> log out
      logout();
    } catch (_) {
      // If network is offline, keep cached session for offline access
    }
  }

  // Regular login (Staff/Admin)
  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        ApiEndpoints.login,
        data: {'email': email, 'password': password},
      );

      if (res.statusCode == 200 && res.data != null) {
        final responseData = res.data as Map<String, dynamic>;
        final data = responseData['data'] as Map<String, dynamic>;
        final token = data['token'] as String;
        
        final userProfile = {
          'id': data['userId'] ?? data['_id'],
          'email': data['email'],
          'name': data['name'],
          'role': data['role'],
          'tenantId': data['tenantId'],
        };

        await LocalDb.saveToken(token);
        await LocalDb.saveProfile(userProfile);

        state = AuthState(
          isAuthenticated: true,
          token: token,
          user: userProfile,
          isLoading: false,
        );
        return true;
      } else {
        state = state.copyWith(isLoading: false, error: 'Login failed');
        return false;
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Network or credentials error');
      return false;
    }
  }

  // OTP Request for B2C Customers
  Future<bool> requestCustomerOtp(String phone) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        ApiEndpoints.customerOtpRequest,
        data: {'phone': phone},
      );
      state = state.copyWith(isLoading: false);
      return res.statusCode == 200 || res.statusCode == 201;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to request OTP');
      return false;
    }
  }

  // OTP Verification for B2C Customers
  Future<bool> verifyCustomerOtp(String phone, String otp) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        ApiEndpoints.customerOtpVerify,
        data: {'phone': phone, 'code': otp},
      );

      if (res.statusCode == 200 && res.data != null) {
        final responseData = res.data as Map<String, dynamic>;
        final data = responseData['data'] as Map<String, dynamic>;
        final token = data['token'] as String;
        final customer = data['customer'] as Map<String, dynamic>? ?? {};

        final userProfile = {
          'id': customer['id'] ?? customer['_id'] ?? data['userId'] ?? data['_id'],
          'email': customer['email'] ?? data['email'],
          'name': customer['name'] ?? data['name'],
          'phone': customer['phone'] ?? data['phone'] ?? phone,
          'role': customer['role'] ?? data['role'] ?? 'customer',
          'tenantId': customer['tenantId'] ?? data['tenantId'],
        };

        await LocalDb.saveToken(token);
        await LocalDb.saveProfile(userProfile);

        state = AuthState(
          isAuthenticated: true,
          token: token,
          user: userProfile,
          isLoading: false,
        );
        return true;
      } else {
        state = state.copyWith(isLoading: false, error: 'Invalid OTP');
        return false;
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'OTP verification failed');
      return false;
    }
  }

  // Logout process
  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    try {
      if (state.token != null) {
        await api.post(ApiEndpoints.logout);
      }
    } catch (_) {}
    await LocalDb.clearAll();
    state = AuthState(isAuthenticated: false, isLoading: false, isInitializing: false);
  }

  Future<void> updateLocalProfile(Map<String, dynamic> updatedProfile) async {
    await LocalDb.saveProfile(updatedProfile);
    state = state.copyWith(user: updatedProfile);
  }
}

// Global Auth State Provider
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
