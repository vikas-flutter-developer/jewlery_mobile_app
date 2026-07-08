import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';

class CustomerState {
  final bool isLoading;
  final String? error;
  final List<dynamic> availableSchemes;
  final List<dynamic> customerEnrollments;
  final List<dynamic> customOrders;
  final List<dynamic> checkouts;

  CustomerState({
    this.isLoading = false,
    this.error,
    this.availableSchemes = const [],
    this.customerEnrollments = const [],
    this.customOrders = const [],
    this.checkouts = const [],
  });

  CustomerState copyWith({
    bool? isLoading,
    String? error,
    List<dynamic>? availableSchemes,
    List<dynamic>? customerEnrollments,
    List<dynamic>? customOrders,
    List<dynamic>? checkouts,
  }) {
    return CustomerState(
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      availableSchemes: availableSchemes ?? this.availableSchemes,
      customerEnrollments: customerEnrollments ?? this.customerEnrollments,
      customOrders: customOrders ?? this.customOrders,
      checkouts: checkouts ?? this.checkouts,
    );
  }
}

class CustomerNotifier extends StateNotifier<CustomerState> {
  CustomerNotifier() : super(CustomerState());

  // Fetch schemes directory catalog
  Future<void> fetchAvailableSchemes() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.get(ApiEndpoints.availableSchemes);
      if (res.statusCode == 200 && res.data != null) {
        final responseData = res.data as Map<String, dynamic>;
        final list = responseData['data'] as List<dynamic>;
        state = state.copyWith(availableSchemes: list, isLoading: false);
      } else {
        state = state.copyWith(isLoading: false, error: 'Failed to load schemes catalog');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  // Fetch customer schemes enrollments
  Future<void> fetchCustomerEnrollments(String phone) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.get('${ApiEndpoints.customerSchemes}?phone=$phone');
      if (res.statusCode == 200 && res.data != null) {
        final responseData = res.data as Map<String, dynamic>;
        final list = responseData['data'] as List<dynamic>;
        state = state.copyWith(customerEnrollments: list, isLoading: false);
      } else {
        state = state.copyWith(isLoading: false, error: 'Failed to load enrollments');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  // Pay monthly due installment
  Future<bool> payInstallment(String enrollmentId, double amount, String phone) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        ApiEndpoints.payInstallment,
        data: {
          'enrollmentId': enrollmentId,
          'amount': amount,
          'paymentMethod': 'UPI Gateway (Simulated)',
        },
      );
      if (res.statusCode == 200) {
        // Refresh enrollments after payment
        await fetchCustomerEnrollments(phone);
        return true;
      } else {
        state = state.copyWith(isLoading: false, error: 'Payment failed');
        return false;
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // Submit Bespoke Custom Design Request
  Future<bool> submitBespokeOrder({
    required String name,
    required String phone,
    required String metalType,
    required String carat,
    required String customDescription,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        ApiEndpoints.customOrders,
        data: {
          'customerName': name,
          'customerPhone': phone,
          'metalType': metalType,
          'carat': carat,
          'customDescription': customDescription,
        },
      );
      if (res.statusCode == 201 || res.statusCode == 200) {
        await fetchCustomOrders(phone);
        return true;
      } else {
        state = state.copyWith(isLoading: false, error: 'Failed to submit bespoke design');
        return false;
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // Fetch bespoke custom designs list
  Future<void> fetchCustomOrders(String phone) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.get('${ApiEndpoints.customOrders}?phone=$phone');
      if (res.statusCode == 200 && res.data != null) {
        final responseData = res.data as Map<String, dynamic>;
        final list = responseData['data'] as List<dynamic>;
        state = state.copyWith(customOrders: list, isLoading: false);
      } else {
        state = state.copyWith(isLoading: false, error: 'Failed to load bespoke orders');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  // Create self-checkout cart request
  Future<bool> createSelfCheckout({
    required String name,
    required String phone,
    required List<Map<String, dynamic>> items,
    required double subtotal,
    required double payable,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        ApiEndpoints.checkouts,
        data: {
          'customerName': name,
          'customerPhone': phone,
          'items': items,
          'subtotal': subtotal,
          'payable': payable,
          'status': 'PAID_ONLINE',
          'paymentMethod': 'UPI Gateway (Self-Checkout)',
          'transactionId': 'TXN-${DateTime.now().millisecondsSinceEpoch}',
        },
      );
      if (res.statusCode == 201 || res.statusCode == 200) {
        await fetchCheckouts(phone);
        return true;
      } else {
        state = state.copyWith(isLoading: false, error: 'Failed to register checkout');
        return false;
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // Fetch self-checkouts list
  Future<void> fetchCheckouts(String phone) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.get('/portal/checkouts?phone=$phone');
      if (res.statusCode == 200 && res.data != null) {
        final responseData = res.data as Map<String, dynamic>;
        final list = responseData['data'] as List<dynamic>;
        state = state.copyWith(checkouts: list, isLoading: false);
      } else {
        state = state.copyWith(isLoading: false, error: 'Failed to load checkouts');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

// Global Customer Portal State Provider
final customerProvider = StateNotifierProvider<CustomerNotifier, CustomerState>((ref) {
  return CustomerNotifier();
});
