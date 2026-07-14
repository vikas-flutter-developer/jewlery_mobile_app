import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

class AdminState {
  final bool isLoading;
  final String? error;
  final List<dynamic> branches;
  final Map<String, dynamic>? activeBranch;
  final List<dynamic> rates;
  final List<dynamic> transfers;
  final List<dynamic> goldLoans;
  final List<dynamic> staff;
  final List<dynamic> orders;
  final List<dynamic> inventory;
  final List<dynamic> gemstones;
  final Map<String, dynamic>? selectedKarikarDetails;

  // New settings & compliance cache properties
  final List<dynamic> printers;
  final List<dynamic> paymentGateways;
  final Map<String, dynamic>? tenantBranding;
  final List<dynamic> taxProfiles;
  final List<dynamic> messagingConfigs;
  final List<dynamic> userActionLogs;
  final Map<String, dynamic>? gstDashboard;
  final Map<String, dynamic>? tcsSummary;
  final List<dynamic> tcsTransactions;
  final List<dynamic> huidExceptions;
  final List<dynamic> bisLicences;

  AdminState({
    this.isLoading = false,
    this.error,
    this.branches = const [],
    this.activeBranch,
    this.rates = const [],
    this.transfers = const [],
    this.goldLoans = const [],
    this.staff = const [],
    this.orders = const [],
    this.inventory = const [],
    this.gemstones = const [],
    this.selectedKarikarDetails,
    this.printers = const [],
    this.paymentGateways = const [],
    this.tenantBranding,
    this.taxProfiles = const [],
    this.messagingConfigs = const [],
    this.userActionLogs = const [],
    this.gstDashboard,
    this.tcsSummary,
    this.tcsTransactions = const [],
    this.huidExceptions = const [],
    this.bisLicences = const [],
  });

  AdminState copyWith({
    bool? isLoading,
    String? error,
    List<dynamic>? branches,
    Map<String, dynamic>? activeBranch,
    List<dynamic>? rates,
    List<dynamic>? transfers,
    List<dynamic>? goldLoans,
    List<dynamic>? staff,
    List<dynamic>? orders,
    List<dynamic>? inventory,
    List<dynamic>? gemstones,
    Map<String, dynamic>? selectedKarikarDetails,
    List<dynamic>? printers,
    List<dynamic>? paymentGateways,
    Map<String, dynamic>? tenantBranding,
    List<dynamic>? taxProfiles,
    List<dynamic>? messagingConfigs,
    List<dynamic>? userActionLogs,
    Map<String, dynamic>? gstDashboard,
    Map<String, dynamic>? tcsSummary,
    List<dynamic>? tcsTransactions,
    List<dynamic>? huidExceptions,
    List<dynamic>? bisLicences,
  }) {
    return AdminState(
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      branches: branches ?? this.branches,
      activeBranch: activeBranch ?? this.activeBranch,
      rates: rates ?? this.rates,
      transfers: transfers ?? this.transfers,
      goldLoans: goldLoans ?? this.goldLoans,
      staff: staff ?? this.staff,
      orders: orders ?? this.orders,
      inventory: inventory ?? this.inventory,
      gemstones: gemstones ?? this.gemstones,
      selectedKarikarDetails: selectedKarikarDetails ?? this.selectedKarikarDetails,
      printers: printers ?? this.printers,
      paymentGateways: paymentGateways ?? this.paymentGateways,
      tenantBranding: tenantBranding ?? this.tenantBranding,
      taxProfiles: taxProfiles ?? this.taxProfiles,
      messagingConfigs: messagingConfigs ?? this.messagingConfigs,
      userActionLogs: userActionLogs ?? this.userActionLogs,
      gstDashboard: gstDashboard ?? this.gstDashboard,
      tcsSummary: tcsSummary ?? this.tcsSummary,
      tcsTransactions: tcsTransactions ?? this.tcsTransactions,
      huidExceptions: huidExceptions ?? this.huidExceptions,
      bisLicences: bisLicences ?? this.bisLicences,
    );
  }
}

class AdminNotifier extends StateNotifier<AdminState> {
  final ApiClient api;

  AdminNotifier(this.api) : super(AdminState()) {
    loadInitialData();
  }

  // Load all initial console logs on admin boot
  Future<void> loadInitialData() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await fetchBranches();
      await Future.wait([
        fetchRates(),
        fetchTransfers(),
        fetchGoldLoans(),
        fetchStaffRoster(),
        fetchOrders(),
        fetchInventory(),
        fetchGemstones(),
      ]);
      state = state.copyWith(isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  // 1. Fetch available store & manufacturing branches
  Future<void> fetchBranches() async {
    try {
      final res = await api.get('/branches');
      if (res.statusCode == 200 && res.data != null) {
        final rawData = res.data;
        List<dynamic> list = [];
        if (rawData is Map && rawData['data'] != null) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData is List) {
          list = rawData;
        }

        // Set active branch to MAIN or the first one if not set
        Map<String, dynamic>? initialActive;
        if (list.isNotEmpty) {
          initialActive = list.firstWhere(
            (b) => b['branchId'] == 'MAIN',
            orElse: () => list.first,
          ) as Map<String, dynamic>?;
        }

        state = state.copyWith(branches: list, activeBranch: initialActive);
      }
    } catch (e) {
      print('[Admin Provider] Fetch branches error: $e');
    }
  }

  // 2. Switch dynamic branch context switcher
  void switchBranch(Map<String, dynamic> branch) {
    state = state.copyWith(activeBranch: branch);
    // Reload branch specific subpages context if needed
  }

  // 3. Fetch gold/silver markup rates config
  Future<void> fetchRates() async {
    try {
      final res = await api.get('/rates');
      if (res.statusCode == 200 && res.data != null) {
        final rawData = res.data;
        List<dynamic> list = [];
        if (rawData is Map && rawData['data'] != null) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData is List) {
          list = rawData;
        }
        state = state.copyWith(rates: list);
      }
    } catch (e) {
      print('[Admin Provider] Fetch rates error: $e');
    }
  }

  // 4. Update base markup rate of metal
  Future<bool> updateRate(String metal, double price) async {
    try {
      final res = await api.put('/rates/$metal', data: {'rate': price});
      if (res.statusCode == 200) {
        await fetchRates();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Update rate error: $e');
      return false;
    }
  }

  // 5. Sync live market exchange pricing with IBJA feed ticker
  Future<bool> syncLiveRates() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post('/rates/import');
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchRates();
        state = state.copyWith(isLoading: false);
        return true;
      }
      state = state.copyWith(isLoading: false);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // 6. Fetch inter-branch stock manifests
  Future<void> fetchTransfers() async {
    try {
      final res = await api.get('/branches/transfers');
      if (res.statusCode == 200 && res.data != null) {
        final rawData = res.data;
        List<dynamic> list = [];
        if (rawData is Map && rawData['data'] != null) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData is List) {
          list = rawData;
        }
        state = state.copyWith(transfers: list);
      }
    } catch (e) {
      print('[Admin Provider] Fetch transfers error: $e');
    }
  }

  // 7. Dispatch new stock transfer to showroom
  Future<bool> createBranchTransfer(String targetBranchId, List<Map<String, dynamic>> items) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        '/branches/transfers',
        data: {
          'sourceBranch': state.activeBranch?['branchId'] ?? 'MAIN',
          'targetBranch': targetBranchId,
          'items': items,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchTransfers();
        state = state.copyWith(isLoading: false);
        return true;
      }
      state = state.copyWith(isLoading: false);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // 8. Sign off outgoing transfer dispatch
  Future<bool> approveTransfer(String transferId) async {
    try {
      final res = await api.put('/branches/transfers/$transferId/approve');
      if (res.statusCode == 200) {
        await fetchTransfers();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Approve transfer error: $e');
      return false;
    }
  }

  // 9. Reject transfer request
  Future<bool> rejectTransfer(String transferId) async {
    try {
      final res = await api.put('/branches/transfers/$transferId/reject');
      if (res.statusCode == 200) {
        await fetchTransfers();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Reject transfer error: $e');
      return false;
    }
  }

  // 10. Acknowledge incoming transfer receipt at showroom
  Future<bool> receiveTransfer(String transferId) async {
    try {
      final res = await api.put('/branches/transfers/$transferId/receive');
      if (res.statusCode == 200) {
        await fetchTransfers();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Receive transfer error: $e');
      return false;
    }
  }

  // 11. Fetch active pawn loans
  Future<void> fetchGoldLoans() async {
    try {
      final res = await api.get('/compliance/gold-loans');
      if (res.statusCode == 200 && res.data != null) {
        final rawData = res.data;
        List<dynamic> list = [];
        if (rawData is Map && rawData['data'] != null) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData is List) {
          list = rawData;
        }
        state = state.copyWith(goldLoans: list);
      }
    } catch (e) {
      print('[Admin Provider] Fetch gold loans error: $e');
    }
  }

  // 12. Create RBI regulated gold loan pawn agreement
  Future<bool> createGoldLoan({
    required String name,
    required String phone,
    required double grossWeight,
    required double netWeight,
    required double goldPurity,
    required double loanAmount,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        '/compliance/gold-loans',
        data: {
          'customerName': name,
          'customerPhone': phone,
          'grossWeight': grossWeight,
          'netWeight': netWeight,
          'goldPurity': goldPurity,
          'loanAmount': loanAmount,
          'interestRate': 12.0, // Default annual rate
          'tenureMonths': 12,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchGoldLoans();
        state = state.copyWith(isLoading: false);
        return true;
      }
      state = state.copyWith(isLoading: false);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // 13. Repay part of pawn gold loan contract
  Future<bool> repayGoldLoan(String loanId, double repayAmount) async {
    try {
      final res = await api.put('/compliance/gold-loans/$loanId/repay', data: {
        'repaymentAmount': repayAmount,
      });
      if (res.statusCode == 200) {
        await fetchGoldLoans();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Repay loan error: $e');
      return false;
    }
  }

  // 14. Fetch showroom employee roster
  Future<void> fetchStaffRoster() async {
    try {
      final res = await api.get('/users');
      if (res.statusCode == 200 && res.data != null) {
        final rawData = res.data;
        List<dynamic> list = [];
        if (rawData is Map && rawData['data'] != null) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData is List) {
          list = rawData;
        }
        state = state.copyWith(staff: list);
      }
    } catch (e) {
      print('[Admin Provider] Fetch staff roster error: $e');
    }
  }

  // 15. Assign shift schedules to employees
  Future<bool> updateStaffSchedule(String userId, String startTime, String endTime) async {
    try {
      final res = await api.put('/users/$userId/schedule', data: {
        'shiftStart': startTime,
        'shiftEnd': endTime,
        'weeklyOff': 'Sunday',
      });
      if (res.statusCode == 200) {
        await fetchStaffRoster();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Update schedule error: $e');
      return false;
    }
  }

  // 15b. Onboard a new staff member or artisan (Karigar)
  Future<bool> createStaffMember({
    required String name,
    required String email,
    required String password,
    required String role,
    required String phone,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final activeBranchCode = state.activeBranch?['code'] ?? 'MAIN';
      final tenantId = state.activeBranch?['tenantId'] ?? 'shop-1779518126045-txlhr';
      
      final res = await api.post(
        '/users',
        data: {
          'name': name,
          'email': email,
          'password': password,
          'role': role,
          'phone': phone,
          'branchId': activeBranchCode,
          'tenantId': tenantId,
        },
      );

      if (res.statusCode == 200 || res.statusCode == 201) {
        if (role == 'KARIKAR') {
          // If role is KARIKAR, also seed the artisan metal account
          await api.post(
            '/karikars',
            data: {
              'name': name,
              'phone': phone,
              'skilled': 'Goldsmith',
              'status': 'ACTIVE',
            },
          );
        }
        await fetchStaffRoster();
        state = state.copyWith(isLoading: false);
        return true;
      }
      state = state.copyWith(isLoading: false);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // 16. Fetch manufacturing production orders
  Future<void> fetchOrders() async {
    try {
      final res = await api.get('/retailer-orders');
      if (res.statusCode == 200 && res.data != null) {
        final rawData = res.data;
        List<dynamic> list = [];
        if (rawData is Map && rawData['data'] != null) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData is List) {
          list = rawData;
        }
        state = state.copyWith(orders: list);
      }
    } catch (e) {
      print('[Admin Provider] Fetch orders error: $e');
    }
  }

  // 17. Create production orders from raw metal requests
  Future<bool> createProductionOrder({
    required String clientName,
    required String clientPhone,
    required String productType,
    required double weightGrams,
    required String purity,
    double? diamondCarat,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        '/retailer-orders',
        data: {
          'customerName': clientName,
          'customerPhone': clientPhone,
          'jewelryType': productType,
          'weight': weightGrams,
          'purity': purity,
          'diamondCarat': diamondCarat ?? 0.0,
          'status': 'Pending Assignment',
          'manufacturerId': state.activeBranch?['tenantId'] ?? 'shop-1779518126045-txlhr',
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchOrders();
        state = state.copyWith(isLoading: false);
        return true;
      }
      state = state.copyWith(isLoading: false);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // 18. Assign Work Order to specific Karigar (Artisan workshop allocation)
  Future<bool> assignWorkOrderToKarigar({
    required String orderId,
    required String karigarId,
    required String karigarName,
    required double grossWeight,
    required double alloyWeight,
    required String dueDate,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.put(
        '/retailer-orders/$orderId',
        data: {
          'status': 'In Production',
          'karikarId': karigarId,
          'karikarName': karigarName,
          'issuedGrossWeight': grossWeight,
          'issuedAlloy': alloyWeight,
          'dueDate': dueDate,
        },
      );
      if (res.statusCode == 200) {
        await fetchOrders();
        await fetchStaffRoster(); // Reload staff/karikars to update goldStock metrics
        state = state.copyWith(isLoading: false);
        return true;
      }
      state = state.copyWith(isLoading: false);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // 19. Fetch raw metal vaults balances
  Future<void> fetchInventory() async {
    try {
      final res = await api.get('/inventory');
      if (res.statusCode == 200 && res.data != null) {
        final rawData = res.data;
        List<dynamic> list = [];
        if (rawData is Map && rawData['data'] != null) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData is List) {
          list = rawData;
        }
        state = state.copyWith(inventory: list);
      }
    } catch (e) {
      print('[Admin Provider] Fetch inventory error: $e');
    }
  }

  // 20. Fetch gemstone parcels
  Future<void> fetchGemstones() async {
    try {
      final res = await api.get('/gemstones/parcels');
      if (res.statusCode == 200 && res.data != null) {
        final rawData = res.data;
        List<dynamic> list = [];
        if (rawData is Map && rawData['data'] != null) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData is List) {
          list = rawData;
        }
        state = state.copyWith(gemstones: list);
      }
    } catch (e) {
      print('[Admin Provider] Fetch gemstones error: $e');
    }
  }

  // 21. Sourced Gemstones Inward Entry
  Future<bool> inwardGemstoneParcel({
    required String parcelName,
    required String gemstoneType,
    required double totalWeightCarats,
    required int totalQuantity,
    required double unitCost,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        '/gemstones/parcels',
        data: {
          'parcelName': parcelName,
          'gemstoneType': gemstoneType,
          'totalWeight': totalWeightCarats,
          'totalQuantity': totalQuantity,
          'costPerCarat': unitCost,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchGemstones();
        state = state.copyWith(isLoading: false);
        return true;
      }
      state = state.copyWith(isLoading: false);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // 22. Record end-of-day register closing denominations
  Future<bool> saveCashClosingDenominations(Map<String, int> counts, double expectedAmount, double actualAmount) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        '/reports/daily-closing/denomination',
        data: {
          'denominations': counts,
          'expectedAmount': expectedAmount,
          'actualAmount': actualAmount,
          'discrepancy': actualAmount - expectedAmount,
          'closingTime': DateTime.now().toIso8601String(),
        },
      );
      state = state.copyWith(isLoading: false);
      return res.statusCode == 200 || res.statusCode == 201;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  // 23. Fetch details for a specific Karigar (Artisan metal/job history)
  Future<void> fetchKarikarDetails(String karikarId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.get('/karikars/$karikarId/self-service');
      if (res.statusCode == 200 && res.data != null) {
        final data = res.data as Map<String, dynamic>;
        state = state.copyWith(isLoading: false, selectedKarikarDetails: data['data']);
      } else {
        state = state.copyWith(isLoading: false, error: 'Failed to fetch details');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  // --- Dynamic Configuration Settings ---
  // Printers
  Future<void> fetchPrinters() async {
    try {
      final res = await api.get('/settings/printers');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(printers: res.data['data'] as List<dynamic>? ?? res.data as List<dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch printers error: $e');
    }
  }

  Future<bool> savePrinter(Map<String, dynamic> data, {String? id}) async {
    try {
      final res = id != null
          ? await api.put('/settings/printers/$id', data: data)
          : await api.post('/settings/printers', data: data);
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchPrinters();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Save printer error: $e');
      return false;
    }
  }

  Future<bool> deletePrinter(String id) async {
    try {
      final res = await api.delete('/settings/printers/$id');
      if (res.statusCode == 200) {
        await fetchPrinters();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Delete printer error: $e');
      return false;
    }
  }

  Future<bool> testPrinter(Map<String, dynamic> data) async {
    try {
      final res = await api.post('/settings/printers/test', data: data);
      return res.statusCode == 200;
    } catch (e) {
      print('[Admin Provider] Test printer error: $e');
      return false;
    }
  }

  Future<bool> setDefaultPrinter(String id) async {
    try {
      final res = await api.post('/settings/printers/set-default', data: {'printerId': id});
      if (res.statusCode == 200) {
        await fetchPrinters();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Set default printer error: $e');
      return false;
    }
  }

  // Payment Gateways
  Future<void> fetchPaymentGateways() async {
    try {
      final res = await api.get('/settings/payment-gateways');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(paymentGateways: res.data['data'] as List<dynamic>? ?? res.data as List<dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch payment gateways error: $e');
    }
  }

  Future<bool> savePaymentGateway(Map<String, dynamic> data, {String? id}) async {
    try {
      final res = id != null
          ? await api.put('/settings/payment-gateways/$id', data: data)
          : await api.post('/settings/payment-gateways', data: data);
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchPaymentGateways();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Save payment gateway error: $e');
      return false;
    }
  }

  Future<bool> deletePaymentGateway(String id) async {
    try {
      final res = await api.delete('/settings/payment-gateways/$id');
      if (res.statusCode == 200) {
        await fetchPaymentGateways();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Delete payment gateway error: $e');
      return false;
    }
  }

  Future<bool> testPaymentGateway(Map<String, dynamic> data) async {
    try {
      final res = await api.post('/settings/payment-gateways/test', data: data);
      return res.statusCode == 200;
    } catch (e) {
      print('[Admin Provider] Test payment gateway error: $e');
      return false;
    }
  }

  Future<bool> setDefaultPaymentGateway(String id) async {
    try {
      final res = await api.patch('/settings/payment-gateways/$id/set-default');
      if (res.statusCode == 200) {
        await fetchPaymentGateways();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Set default payment gateway error: $e');
      return false;
    }
  }

  Future<bool> togglePaymentGatewayStatus(String id) async {
    try {
      final res = await api.patch('/settings/payment-gateways/$id/toggle-status');
      if (res.statusCode == 200) {
        await fetchPaymentGateways();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Toggle payment gateway error: $e');
      return false;
    }
  }

  // Messaging Configuration
  Future<void> fetchMessagingConfigs() async {
    try {
      final res = await api.get('/settings/messaging');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(messagingConfigs: res.data['data'] as List<dynamic>? ?? res.data as List<dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch messaging configs error: $e');
    }
  }

  Future<bool> saveMessagingConfig(Map<String, dynamic> data, {String? id}) async {
    try {
      final res = id != null
          ? await api.put('/settings/messaging/$id', data: data)
          : await api.post('/settings/messaging', data: data);
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchMessagingConfigs();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Save messaging config error: $e');
      return false;
    }
  }

  Future<bool> deleteMessagingConfig(String id) async {
    try {
      final res = await api.delete('/settings/messaging/$id');
      if (res.statusCode == 200) {
        await fetchMessagingConfigs();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Delete messaging config error: $e');
      return false;
    }
  }

  Future<bool> testMessagingConfig(Map<String, dynamic> data) async {
    try {
      final res = await api.post('/settings/messaging/test', data: data);
      return res.statusCode == 200;
    } catch (e) {
      print('[Admin Provider] Test messaging config error: $e');
      return false;
    }
  }

  // Tax Profiles
  Future<void> fetchTaxProfiles() async {
    try {
      final res = await api.get('/settings/tax-profiles');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(taxProfiles: res.data['data'] as List<dynamic>? ?? res.data as List<dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch tax profiles error: $e');
    }
  }

  Future<bool> saveTaxProfile(Map<String, dynamic> data, {String? id}) async {
    try {
      final res = id != null
          ? await api.put('/settings/tax-profiles/$id', data: data)
          : await api.post('/settings/tax-profiles', data: data);
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchTaxProfiles();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Save tax profile error: $e');
      return false;
    }
  }

  Future<bool> deleteTaxProfile(String id) async {
    try {
      final res = await api.delete('/settings/tax-profiles/$id');
      if (res.statusCode == 200) {
        await fetchTaxProfiles();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Delete tax profile error: $e');
      return false;
    }
  }

  // Tenant Branding
  Future<void> fetchBranding() async {
    try {
      final res = await api.get('/settings/tenant-branding');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(tenantBranding: res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch branding error: $e');
    }
  }

  Future<bool> updateBranding(Map<String, dynamic> data) async {
    try {
      final res = await api.put('/settings/tenant-branding', data: data);
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchBranding();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Update branding error: $e');
      return false;
    }
  }

  // --- Compliance & Regulatory Verification ---
  // BIS License
  Future<void> fetchBisLicences() async {
    try {
      final res = await api.get('/settings/bis-licence');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(bisLicences: res.data['data'] as List<dynamic>? ?? res.data as List<dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch BIS licences error: $e');
    }
  }

  Future<bool> saveBisLicence(Map<String, dynamic> data, {String? id}) async {
    try {
      final res = id != null
          ? await api.put('/settings/bis-licence/$id', data: data)
          : await api.post('/settings/bis-licence', data: data);
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchBisLicences();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Save BIS licence error: $e');
      return false;
    }
  }

  Future<bool> activateBisLicence(String id) async {
    try {
      final res = await api.put('/settings/bis-licence/$id/activate');
      if (res.statusCode == 200) {
        await fetchBisLicences();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Activate BIS licence error: $e');
      return false;
    }
  }

  Future<bool> suspendBisLicence(String id) async {
    try {
      final res = await api.put('/settings/bis-licence/$id/suspend');
      if (res.statusCode == 200) {
        await fetchBisLicences();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Suspend BIS licence error: $e');
      return false;
    }
  }

  // PAN Authentication
  Future<Map<String, dynamic>> validatePanNumber(String pan, {String? customerId}) async {
    try {
      final res = await api.post('/pan/validate', data: {
        'panNumber': pan,
        if (customerId != null) 'customerId': customerId,
      });
      if (res.statusCode == 200 && res.data != null) {
        return res.data as Map<String, dynamic>;
      }
      return {'success': false, 'error': 'Validation request failed.'};
    } catch (e) {
      print('[Admin Provider] Validate PAN error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>?> verifyPanNumber(String customerId, String pan, String status) async {
    try {
      final res = await api.post('/pan/verify', data: {
        'customerId': customerId,
        'panNumber': pan,
        'status': status,
      });
      if (res.statusCode == 200 && res.data != null && res.data['success'] == true) {
        return res.data['data'] as Map<String, dynamic>?;
      }
      return null;
    } catch (e) {
      print('[Admin Provider] Verify PAN error: $e');
      return null;
    }
  }

  // TCS Tax collected at source
  Future<void> fetchTcsSummary() async {
    try {
      final res = await api.get('/tcs/summary');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(tcsSummary: res.data as Map<String, dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch TCS summary error: $e');
    }
  }

  Future<void> fetchTcsTransactions() async {
    try {
      final res = await api.get('/tcs/transactions');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(tcsTransactions: res.data['data'] as List<dynamic>? ?? res.data as List<dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch TCS transactions error: $e');
    }
  }

  Future<bool> updateTcsStatus(String id, String status, String remarks) async {
    try {
      final res = await api.put('/tcs/transactions/$id', data: {
        'status': status,
        'remarks': remarks,
      });
      if (res.statusCode == 200) {
        await fetchTcsTransactions();
        await fetchTcsSummary();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Update TCS status error: $e');
      return false;
    }
  }

  // GST & HUID compliance
  Future<void> fetchGstDashboard() async {
    try {
      final res = await api.get('/compliance/gst/dashboard');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(gstDashboard: res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch GST Dashboard error: $e');
    }
  }

  Future<void> fetchHuidExceptions() async {
    try {
      final res = await api.get('/compliance/huid/exceptions');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(huidExceptions: res.data['data'] as List<dynamic>? ?? res.data as List<dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch HUID exceptions error: $e');
    }
  }

  Future<Map<String, dynamic>> validateHuid(String uidCode) async {
    try {
      final res = await api.post('/compliance/huid/validate', data: {'uidCode': uidCode});
      if (res.statusCode == 200 && res.data != null) {
        return res.data as Map<String, dynamic>;
      }
      return {'success': false, 'error': 'Validation request failed.'};
    } catch (e) {
      print('[Admin Provider] Validate HUID error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  // --- Administrative User Action Controls ---
  Future<bool> blockUser(String userId, String reason) async {
    try {
      final res = await api.put('/users/$userId/block', data: {'reason': reason});
      if (res.statusCode == 200) {
        await fetchStaffRoster();
        await fetchUserActionLogs();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Block user error: $e');
      return false;
    }
  }

  Future<bool> activateUser(String userId) async {
    try {
      final res = await api.put('/users/$userId/activate');
      if (res.statusCode == 200) {
        await fetchStaffRoster();
        await fetchUserActionLogs();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Activate user error: $e');
      return false;
    }
  }

  Future<bool> deactivateUser(String userId) async {
    try {
      final res = await api.put('/users/$userId/deactivate');
      if (res.statusCode == 200) {
        await fetchStaffRoster();
        await fetchUserActionLogs();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Deactivate user error: $e');
      return false;
    }
  }

  Future<bool> forcePasswordReset(String userId) async {
    try {
      final res = await api.put('/users/$userId/force-password-reset');
      if (res.statusCode == 200) {
        await fetchStaffRoster();
        await fetchUserActionLogs();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Force password reset error: $e');
      return false;
    }
  }

  Future<bool> logoutAllSessions(String userId) async {
    try {
      final res = await api.put('/users/$userId/logout-all-sessions');
      if (res.statusCode == 200) {
        await fetchStaffRoster();
        await fetchUserActionLogs();
        return true;
      }
      return false;
    } catch (e) {
      print('[Admin Provider] Logout all sessions error: $e');
      return false;
    }
  }

  Future<void> fetchUserActionLogs() async {
    try {
      final res = await api.get('/users/actions-history');
      if (res.statusCode == 200 && res.data != null) {
        state = state.copyWith(userActionLogs: res.data['data'] as List<dynamic>? ?? res.data as List<dynamic>);
      }
    } catch (e) {
      print('[Admin Provider] Fetch action history error: $e');
    }
  }
}

final adminProvider = StateNotifierProvider<AdminNotifier, AdminState>((ref) {
  return AdminNotifier(ApiClient());
});
