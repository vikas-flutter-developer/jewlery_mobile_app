import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';

class KarikarState {
  final bool isLoading;
  final String? error;
  final Map<String, dynamic>? dashboardData;
  final Map<String, dynamic>? selfServiceData;
  final List<dynamic> notifications;
  final List<dynamic> wastageReconciliations;
  final List<dynamic> wageLedgers;
  final List<dynamic> sessions;
  final Map<String, dynamic>? profile;

  KarikarState({
    this.isLoading = false,
    this.error,
    this.dashboardData,
    this.selfServiceData,
    this.notifications = const [],
    this.wastageReconciliations = const [],
    this.wageLedgers = const [],
    this.sessions = const [],
    this.profile,
  });

  KarikarState copyWith({
    bool? isLoading,
    String? error,
    Map<String, dynamic>? dashboardData,
    Map<String, dynamic>? selfServiceData,
    List<dynamic>? notifications,
    List<dynamic>? wastageReconciliations,
    List<dynamic>? wageLedgers,
    List<dynamic>? sessions,
    Map<String, dynamic>? profile,
  }) {
    return KarikarState(
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      dashboardData: dashboardData ?? this.dashboardData,
      selfServiceData: selfServiceData ?? this.selfServiceData,
      notifications: notifications ?? this.notifications,
      wastageReconciliations: wastageReconciliations ?? this.wastageReconciliations,
      wageLedgers: wageLedgers ?? this.wageLedgers,
      sessions: sessions ?? this.sessions,
      profile: profile ?? this.profile,
    );
  }

  // Helper getters
  double get goldStock => (selfServiceData?['goldStock'] ?? 0).toDouble();
  double get ledgerBalance => (selfServiceData?['ledgerBalance'] ?? 0).toDouble();
  List<dynamic> get jobCards => selfServiceData?['jobCards'] ?? const [];
  List<dynamic> get metalReturns => selfServiceData?['metalReturns'] ?? const [];
}

class KarikarNotifier extends StateNotifier<KarikarState> {
  final ApiClient api;

  KarikarNotifier(this.api) : super(KarikarState());

  // Load all initial data for the logged-in Karigar
  Future<void> loadInitialData(String karikarId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await Future.wait([
        fetchDashboard(),
        fetchSelfService(karikarId),
        fetchNotifications(),
        fetchWastageReconciliations(),
        fetchWageLedgers(),
        fetchSessions(),
        fetchProfile(),
      ]);
      state = state.copyWith(isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  // Fetch dashboard stats
  Future<void> fetchDashboard() async {
    try {
      final res = await api.get(ApiEndpoints.karikarDashboard);
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data as Map<String, dynamic>;
        state = state.copyWith(dashboardData: data['data']);
      }
    } catch (e) {
      print('[Karikar Provider] Fetch dashboard error: $e');
    }
  }

  // Fetch self service data
  Future<void> fetchSelfService(String karikarId) async {
    try {
      final res = await api.get('/karikars/$karikarId/self-service');
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data as Map<String, dynamic>;
        state = state.copyWith(selfServiceData: data['data']);
      }
    } catch (e) {
      print('[Karikar Provider] Fetch self-service error: $e');
    }
  }

  // Fetch Notifications
  Future<void> fetchNotifications() async {
    try {
      final res = await api.get('/karikar/notifications');
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data as Map<String, dynamic>;
        state = state.copyWith(notifications: data['data'] ?? []);
      }
    } catch (e) {
      print('[Karikar Provider] Fetch notifications error: $e');
    }
  }

  // Mark all notifications as read
  Future<bool> markNotificationsRead() async {
    try {
      final res = await api.post('/karikar/notifications/read');
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchNotifications();
        return true;
      }
      return false;
    } catch (e) {
      print('[Karikar Provider] Mark notifications read error: $e');
      return false;
    }
  }

  // Fetch wastage reconciliations
  Future<void> fetchWastageReconciliations() async {
    try {
      final res = await api.get('/karikar/wastage-reconciliations');
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data as Map<String, dynamic>;
        state = state.copyWith(wastageReconciliations: data['data'] ?? []);
      }
    } catch (e) {
      print('[Karikar Provider] Fetch wastage reconciliations error: $e');
    }
  }

  // Fetch wage ledgers
  Future<void> fetchWageLedgers() async {
    try {
      final res = await api.get('/karikar/wage-ledgers');
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data as Map<String, dynamic>;
        state = state.copyWith(wageLedgers: data['data'] ?? []);
      }
    } catch (e) {
      print('[Karikar Provider] Fetch wage ledgers error: $e');
    }
  }

  // Fetch login sessions
  Future<void> fetchSessions() async {
    try {
      final res = await api.get('/karikar/sessions');
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data as Map<String, dynamic>;
        state = state.copyWith(sessions: data['data'] ?? []);
      }
    } catch (e) {
      print('[Karikar Provider] Fetch sessions error: $e');
    }
  }

  // Fetch Profile
  Future<void> fetchProfile() async {
    try {
      final res = await api.get('/karikar/profile');
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data as Map<String, dynamic>;
        state = state.copyWith(profile: data['data']);
      }
    } catch (e) {
      print('[Karikar Provider] Fetch profile error: $e');
    }
  }

  // Update profile details
  Future<bool> updateProfile(Map<String, dynamic> fields) async {
    try {
      final res = await api.put('/karikar/profile', data: fields);
      if (res.statusCode == 200) {
        await fetchProfile();
        return true;
      }
      return false;
    } catch (e) {
      print('[Karikar Provider] Update profile error: $e');
      return false;
    }
  }

  // Change password
  Future<bool> changePassword(String oldPassword, String newPassword) async {
    try {
      final res = await api.put(
        '/karikar/change-password',
        data: {
          'oldPassword': oldPassword,
          'newPassword': newPassword,
        },
      );
      return res.statusCode == 200;
    } catch (e) {
      print('[Karikar Provider] Change password error: $e');
      return false;
    }
  }

  // Action: Return gold/metal
  Future<bool> returnMetal({
    required double weight,
    required String purity,
    required String note,
    required String karikarId,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        ApiEndpoints.karikarMetalReturns,
        data: {
          'weight': weight,
          'purity': purity,
          'note': note,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await loadInitialData(karikarId);
        return true;
      }
      state = state.copyWith(isLoading: false);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // Action: Claim wastage/wastage reconciliation
  Future<bool> claimWastage({
    required double requestedWeight,
    required String purity,
    required double scrapWeight,
    required double estimatedWastage,
    required double actualWastage,
    required double calculatedLoss,
    required String notes,
    required String karikarId,
    String? jobId,
    String? orderId,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final Map<String, dynamic> requestData = {
        'requestedWeight': requestedWeight,
        'purity': purity,
        'scrapWeight': scrapWeight,
        'estimatedWastage': estimatedWastage,
        'actualWastage': actualWastage,
        'calculatedLoss': calculatedLoss,
        'notes': notes,
      };
      if (jobId != null) requestData['jobId'] = jobId;
      if (orderId != null) requestData['orderId'] = orderId;

      final res = await api.post(
        ApiEndpoints.karikarWastage,
        data: requestData,
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await loadInitialData(karikarId);
        return true;
      }
      state = state.copyWith(isLoading: false);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }
}

final karikarProvider = StateNotifierProvider<KarikarNotifier, KarikarState>((ref) {
  return KarikarNotifier(ApiClient());
});
