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
}

final adminProvider = StateNotifierProvider<AdminNotifier, AdminState>((ref) {
  return AdminNotifier(ApiClient());
});
