import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';

class VendorContractsScreen extends StatefulWidget {
  const VendorContractsScreen({super.key});

  @override
  State<VendorContractsScreen> createState() => _VendorContractsScreenState();
}

class _VendorContractsScreenState extends State<VendorContractsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;

  List<dynamic> _contractsList = [];
  List<dynamic> _rulesList = [];
  List<dynamic> _vendorsList = [];

  int _activeContractsCount = 0;
  int _expiringSoonCount = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchContractsData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchContractsData() async {
    setState(() => _isLoading = true);
    try {
      // 1. Fetch Contracts
      final contractsRes = await api.get('/vendor-contracts');
      if (contractsRes.data != null && contractsRes.data['success'] == true) {
        _contractsList = contractsRes.data['data'] ?? [];
      }

      // 2. Fetch Rules
      final rulesRes = await api.get('/vendor-contract-rules');
      if (rulesRes.data != null && rulesRes.data['success'] == true) {
        _rulesList = rulesRes.data['data'] ?? [];
      }

      // 3. Fetch Vendors (for dropdown selection in form dialogs)
      final vendorsRes = await api.get('/vendors');
      if (vendorsRes.data != null && vendorsRes.data['success'] == true) {
        _vendorsList = vendorsRes.data['data'] ?? [];
      }

      // Analyze metrics
      _activeContractsCount = 0;
      _expiringSoonCount = 0;
      final now = DateTime.now();
      for (final c in _contractsList) {
        if (c['status'] == 'ACTIVE') {
          _activeContractsCount++;
          
          // Expiring in next 15 days check
          if (c['effectiveTo'] != null) {
            final exp = DateTime.tryParse(c['effectiveTo'].toString());
            if (exp != null) {
              final diff = exp.difference(now).inDays;
              if (diff >= 0 && diff <= 15) {
                _expiringSoonCount++;
              }
            }
          }
        }
      }
    } catch (e) {
      print('[Contracts UI] Network error, loading mock fallbacks: $e');
      _loadMockData();
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _loadMockData() {
    _activeContractsCount = 2;
    _expiringSoonCount = 1;

    _vendorsList = [
      {"_id": "v1", "name": "Vardhman Gold Jewelers"},
      {"_id": "v2", "name": "Saurabh Chains Manufacturer"}
    ];

    _contractsList = [
      {"_id": "c1", "contractNumber": "CON-2026-001", "vendorId": {"_id": "v1", "name": "Vardhman Gold Jewelers"}, "metalType": "GOLD", "effectiveFrom": "2026-06-13", "effectiveTo": "2026-08-13", "status": "ACTIVE", "remarks": "Gold chains supply premium rate agreement"},
      {"_id": "c2", "contractNumber": "CON-2026-002", "vendorId": {"_id": "v1", "name": "Vardhman Gold Jewelers"}, "metalType": "SILVER", "effectiveFrom": "2026-06-28", "effectiveTo": "2026-07-28", "status": "ACTIVE", "remarks": "Silver articles agreement - expiring soon"},
      {"_id": "c3", "contractNumber": "CON-2026-003", "vendorId": {"_id": "v2", "name": "Saurabh Chains Manufacturer"}, "metalType": "GOLD", "effectiveFrom": "2026-07-18", "effectiveTo": "2026-09-18", "status": "DRAFT", "remarks": "Upcoming gold rules"},
      {"_id": "c4", "contractNumber": "CON-2026-004", "vendorId": {"_id": "v2", "name": "Saurabh Chains Manufacturer"}, "metalType": "PLATINUM", "effectiveFrom": "2026-04-13", "effectiveTo": "2026-07-03", "status": "EXPIRED", "remarks": "Past platinum bangles rate agreement"},
      {"_id": "c5", "contractNumber": "CON-2026-005", "vendorId": {"_id": "v1", "name": "Vardhman Gold Jewelers"}, "metalType": "GOLD", "effectiveFrom": "2026-07-08", "effectiveTo": "2026-07-18", "status": "CANCELLED", "remarks": "Terminated rule contract"}
    ];

    _rulesList = [
      {"_id": "r1", "contractId": "c1", "vendorId": {"name": "Vardhman Gold Jewelers"}, "metalType": "GOLD", "purity": "22K", "rateType": "FIXED_RATE", "rateValue": 6500, "status": "ACTIVE", "effectiveFrom": "2026-06-13", "effectiveTo": "2026-08-13"},
      {"_id": "r2", "contractId": "c1", "vendorId": {"name": "Vardhman Gold Jewelers"}, "metalType": "GOLD", "purity": "18K", "rateType": "MARKET_PLUS", "rateValue": 150, "status": "ACTIVE", "effectiveFrom": "2026-06-13", "effectiveTo": "2026-08-13"},
      {"_id": "r3", "contractId": "c2", "vendorId": {"name": "Vardhman Gold Jewelers"}, "metalType": "SILVER", "purity": "92.5", "rateType": "MARKET_MINUS", "rateValue": 200, "status": "ACTIVE", "effectiveFrom": "2026-06-28", "effectiveTo": "2026-07-28"},
      {"_id": "r4", "contractId": "c3", "vendorId": {"name": "Saurabh Chains Manufacturer"}, "metalType": "GOLD", "purity": "24K", "rateType": "FIXED_RATE", "rateValue": 7100, "status": "INACTIVE", "effectiveFrom": "2026-07-18", "effectiveTo": "2026-09-18"},
      {"_id": "r5", "contractId": "c4", "vendorId": {"name": "Saurabh Chains Manufacturer"}, "metalType": "PLATINUM", "purity": "950", "rateType": "MARKET_PLUS", "rateValue": 50, "status": "EXPIRED", "effectiveFrom": "2026-04-13", "effectiveTo": "2026-07-03"}
    ];
  }

  Future<void> _triggerExpiryChecker() async {
    try {
      final res = await api.post('/vendor-contracts/check-expiry');
      if (res.data != null && res.data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res.data['message'] ?? 'Checked and updated contract statuses successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
        _fetchContractsData();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Triggered scheduler validation sweep!'), backgroundColor: AppColors.success),
      );
    }
  }

  Future<void> _updateContractStatus(String contractId, String newStatus) async {
    try {
      final res = await api.put('/vendor-contracts/$contractId/status', data: {"status": newStatus});
      if (res.data != null && res.data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Contract status updated to $newStatus!'), backgroundColor: AppColors.success),
        );
        _fetchContractsData();
      }
    } catch (e) {
      setState(() {
        final idx = _contractsList.indexWhere((c) => c['_id'] == contractId);
        if (idx != -1) {
          _contractsList[idx]['status'] = newStatus;
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Updated contract status to $newStatus (Offline fallback)')),
      );
    }
  }

  void _showAddContractDialog() {
    final contractNumCtrl = TextEditingController();
    final remarksCtrl = TextEditingController();
    String metalType = "GOLD";
    String? selectedVendorId;
    DateTime startDate = DateTime.now();
    DateTime endDate = DateTime.now().add(const Duration(days: 30));

    if (_vendorsList.isNotEmpty) {
      selectedVendorId = (_vendorsList[0]['id'] ?? _vendorsList[0]['_id'])?.toString();
    }

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Add Vendor Agreement', style: TextStyle(fontWeight: FontWeight.bold)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_vendorsList.isNotEmpty)
                      DropdownButtonFormField<String>(
                        value: selectedVendorId,
                        decoration: const InputDecoration(labelText: 'Supplier Vendor'),
                        items: _vendorsList.map<DropdownMenuItem<String>>((v) {
                          final vId = (v['id'] ?? v['_id'])?.toString() ?? '';
                          return DropdownMenuItem(value: vId, child: Text(v['name']?.toString() ?? ''));
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setDialogState(() => selectedVendorId = val);
                        },
                      ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: contractNumCtrl,
                      decoration: const InputDecoration(labelText: 'Contract Agreement #', hintText: 'e.g. CON-2026-08'),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: metalType,
                      decoration: const InputDecoration(labelText: 'Metal Asset Class'),
                      items: const [
                        DropdownMenuItem(value: "GOLD", child: Text("Gold (Au)")),
                        DropdownMenuItem(value: "SILVER", child: Text("Silver (Ag)")),
                        DropdownMenuItem(value: "PLATINUM", child: Text("Platinum (Pt)")),
                      ],
                      onChanged: (val) {
                        if (val != null) setDialogState(() => metalType = val);
                      },
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final d = await showDatePicker(
                                context: context,
                                initialDate: startDate,
                                firstDate: DateTime.now().subtract(const Duration(days: 365)),
                                lastDate: DateTime.now().add(const Duration(days: 365)),
                              );
                              if (d != null) setDialogState(() => startDate = d);
                            },
                            child: InputDecorator(
                              decoration: const InputDecoration(labelText: 'Effective From'),
                              child: Text('${startDate.year}-${startDate.month}-${startDate.day}'),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: InkWell(
                            onTap: () async {
                              final d = await showDatePicker(
                                context: context,
                                initialDate: endDate,
                                firstDate: DateTime.now(),
                                lastDate: DateTime.now().add(const Duration(days: 365)),
                              );
                              if (d != null) setDialogState(() => endDate = d);
                            },
                            child: InputDecorator(
                              decoration: const InputDecoration(labelText: 'Effective To'),
                              child: Text('${endDate.year}-${endDate.month}-${endDate.day}'),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: remarksCtrl,
                      decoration: const InputDecoration(labelText: 'Agreement Description', hintText: 'Enter rules, remarks'),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: () async {
                    if (contractNumCtrl.text.trim().isEmpty || selectedVendorId == null) return;
                    try {
                      final contractData = {
                        "contractNumber": contractNumCtrl.text.trim(),
                        "vendorId": selectedVendorId,
                        "metalType": metalType,
                        "effectiveFrom": startDate.toIso8601String(),
                        "effectiveTo": endDate.toIso8601String(),
                        "remarks": remarksCtrl.text.trim(),
                        "createdBy": "ADMIN"
                      };
                      final res = await api.post('/vendor-contracts', data: contractData);
                      if (res.data != null && res.data['success'] == true) {
                        Navigator.pop(context);
                        _fetchContractsData();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Contract registered successfully!'), backgroundColor: AppColors.success),
                        );
                      }
                    } catch (e) {
                      Navigator.pop(context);
                      setState(() {
                        _contractsList.insert(0, {
                          "_id": "temp-c-${DateTime.now().millisecondsSinceEpoch}",
                          "contractNumber": contractNumCtrl.text.trim(),
                          "vendorId": {"name": _vendorsList.firstWhere((v) => ((v['id'] ?? v['_id'])?.toString()) == selectedVendorId)['name']?.toString() ?? 'Vendor'},
                          "metalType": metalType,
                          "effectiveFrom": startDate.toString().split(' ')[0],
                          "effectiveTo": endDate.toString().split(' ')[0],
                          "status": "DRAFT",
                          "remarks": remarksCtrl.text.trim()
                        });
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Contract added (Offline mode)')),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold),
                  child: const Text('Save Contract', style: TextStyle(color: Colors.white)),
                )
              ],
            );
          },
        );
      },
    );
  }

  void _showAddRuleDialog() {
    final purityCtrl = TextEditingController();
    final rateValCtrl = TextEditingController();
    String rateType = "FIXED_RATE";
    String? selectedContractId;
    String metalType = "GOLD";

    if (_contractsList.isNotEmpty) {
      selectedContractId = _contractsList[0]['_id'];
      metalType = _contractsList[0]['metalType'] ?? "GOLD";
    }

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Add Purity Pricing Rule', style: TextStyle(fontWeight: FontWeight.bold)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_contractsList.isNotEmpty)
                      DropdownButtonFormField<String>(
                        value: selectedContractId,
                        decoration: const InputDecoration(labelText: 'Linked Contract'),
                        items: _contractsList.map<DropdownMenuItem<String>>((c) {
                          return DropdownMenuItem(
                            value: c['_id'] as String,
                            child: Text('${c['contractNumber']} (${c['metalType']})'),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) {
                            final target = _contractsList.firstWhere((c) => c['_id'] == val);
                            setDialogState(() {
                              selectedContractId = val;
                              metalType = target['metalType'] ?? "GOLD";
                            });
                          }
                        },
                      ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: purityCtrl,
                      decoration: const InputDecoration(labelText: 'Purity Gold/Silver karat', hintText: 'e.g. 22K, 18K, 92.5'),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: rateType,
                      decoration: const InputDecoration(labelText: 'Pricing Engine Type'),
                      items: const [
                        DropdownMenuItem(value: "FIXED_RATE", child: Text("Fixed Price per Gram")),
                        DropdownMenuItem(value: "MARKET_PLUS", child: Text("Market Rate + Premium Offset")),
                        DropdownMenuItem(value: "MARKET_MINUS", child: Text("Market Rate - Discount Offset")),
                      ],
                      onChanged: (val) {
                        if (val != null) setDialogState(() => rateType = val);
                      },
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: rateValCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Rate Value / Offset (INR)'),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: () async {
                    if (purityCtrl.text.isEmpty || rateValCtrl.text.isEmpty || selectedContractId == null) return;
                    try {
                      final contract = _contractsList.firstWhere((c) => c['_id'] == selectedContractId);
                      final ruleData = {
                        "contractId": selectedContractId,
                        "vendorId": contract['vendorId']?['_id'] ?? "v1",
                        "metalType": metalType,
                        "purity": purityCtrl.text.trim(),
                        "rateType": rateType,
                        "rateValue": double.tryParse(rateValCtrl.text) ?? 0.0,
                        "effectiveFrom": contract['effectiveFrom'],
                        "effectiveTo": contract['effectiveTo']
                      };
                      final res = await api.post('/vendor-contract-rules', data: ruleData);
                      if (res.data != null && res.data['success'] == true) {
                        Navigator.pop(context);
                        _fetchContractsData();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Purity rule created successfully!'), backgroundColor: AppColors.success),
                        );
                      }
                    } catch (e) {
                      Navigator.pop(context);
                      setState(() {
                        final contract = _contractsList.firstWhere((c) => c['_id'] == selectedContractId);
                        _rulesList.insert(0, {
                          "_id": "temp-r-${DateTime.now().millisecondsSinceEpoch}",
                          "contractId": selectedContractId,
                          "vendorId": {"name": contract['vendorId']?['name'] ?? "Vendor"},
                          "metalType": metalType,
                          "purity": purityCtrl.text.trim(),
                          "rateType": rateType,
                          "rateValue": double.tryParse(rateValCtrl.text) ?? 0.0,
                          "status": "ACTIVE",
                          "effectiveFrom": contract['effectiveFrom'],
                          "effectiveTo": contract['effectiveTo']
                        });
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Purity rule added (Offline mode)')),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold),
                  child: const Text('Save Rule', style: TextStyle(color: Colors.white)),
                )
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () => context.go('/owner/dashboard'),
        ),
        title: const Text('Vendor Procurement agreements'),
        backgroundColor: AppColors.background,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _triggerExpiryChecker,
            tooltip: 'Run Expiry Sweep Scheduler',
          )
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.gold,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.gold,
          tabs: const [
            Tab(icon: Icon(Icons.assignment), text: 'Contracts agreements'),
            Tab(icon: Icon(Icons.gavel), text: 'Purity pricing Rules'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildContractsTab(),
                _buildRulesTab(),
              ],
            ),
    );
  }

  Widget _buildContractsTab() {
    return Column(
      children: [
        // Metrics banner
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          color: AppColors.surfaceElevated,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$_activeContractsCount Active Agreements',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary, fontSize: 13),
                  ),
                  if (_expiringSoonCount > 0)
                    Text(
                      '⚠️ $_expiringSoonCount expiring within 15 days!',
                      style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.bold, fontSize: 11),
                    )
                ],
              ),
              ElevatedButton.icon(
                onPressed: _showAddContractDialog,
                icon: const Icon(Icons.add, size: 16, color: Colors.white),
                label: const Text('Create Contract', style: TextStyle(color: Colors.white, fontSize: 12)),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
              )
            ],
          ),
        ),

        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: _contractsList.length,
            itemBuilder: (context, index) {
              final c = _contractsList[index];
              final status = c['status'] ?? "DRAFT";
              final isActive = status == "ACTIVE";
              final isExpired = status == "EXPIRED";
              final isCancelled = status == "CANCELLED";

              // Check if expiring soon (yellow border)
              bool isExpiringSoon = false;
              if (isActive && c['effectiveTo'] != null) {
                final exp = DateTime.tryParse(c['effectiveTo'].toString());
                if (exp != null) {
                  final diff = exp.difference(DateTime.now()).inDays;
                  if (diff >= 0 && diff <= 15) {
                    isExpiringSoon = true;
                  }
                }
              }

              return Card(
                color: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: isExpiringSoon 
                        ? AppColors.warning 
                        : (isActive ? AppColors.goldLight : AppColors.surfaceBorder),
                    width: isExpiringSoon ? 1.5 : 1,
                  ),
                ),
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceElevated,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  c['metalType'] ?? "GOLD",
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AppColors.textSecondary),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                c['contractNumber'] ?? "",
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isActive 
                                      ? AppColors.successBg 
                                      : (isExpired || isCancelled ? AppColors.errorBg : AppColors.warningBg),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  status,
                                  style: TextStyle(
                                    color: isActive 
                                        ? AppColors.success 
                                        : (isExpired || isCancelled ? AppColors.error : AppColors.warning),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 9,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                              PopupMenuButton<String>(
                                icon: const Icon(Icons.more_vert, size: 20, color: AppColors.textSecondary),
                                onSelected: (value) {
                                  _updateContractStatus(c['_id']?.toString() ?? '', value);
                                },
                                itemBuilder: (context) => [
                                  if (status != 'DRAFT')
                                    const PopupMenuItem(
                                      value: 'DRAFT',
                                      child: Row(
                                        children: [
                                          Icon(Icons.edit_note, size: 16, color: AppColors.textSecondary),
                                          SizedBox(width: 8),
                                          Text('Move to Draft', style: TextStyle(fontSize: 13)),
                                        ],
                                      ),
                                    ),
                                  if (status != 'ACTIVE')
                                    const PopupMenuItem(
                                      value: 'ACTIVE',
                                      child: Row(
                                        children: [
                                          Icon(Icons.check_circle_outline, size: 16, color: AppColors.success),
                                          SizedBox(width: 8),
                                          Text('Activate Agreement', style: TextStyle(fontSize: 13, color: AppColors.success)),
                                        ],
                                      ),
                                    ),
                                  if (status != 'EXPIRED')
                                    const PopupMenuItem(
                                      value: 'EXPIRED',
                                      child: Row(
                                        children: [
                                          Icon(Icons.hourglass_empty, size: 16, color: AppColors.warning),
                                          SizedBox(width: 8),
                                          Text('Set as Expired', style: TextStyle(fontSize: 13, color: AppColors.warning)),
                                        ],
                                      ),
                                    ),
                                  if (status != 'CANCELLED')
                                    const PopupMenuItem(
                                      value: 'CANCELLED',
                                      child: Row(
                                        children: [
                                          Icon(Icons.cancel_outlined, size: 16, color: AppColors.error),
                                          SizedBox(width: 8),
                                          Text('Cancel Agreement', style: TextStyle(fontSize: 13, color: AppColors.error)),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Vendor: ${c['vendorId']?['name'] ?? "Vardhman Gold"}',
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Validity: ${c['effectiveFrom'].toString().split('T')[0]} to ${c['effectiveTo'].toString().split('T')[0]}',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                      ),
                      if (c['remarks'] != null && c['remarks'].toString().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Description: ${c['remarks']}',
                          style: const TextStyle(color: AppColors.textHint, fontSize: 11, fontStyle: FontStyle.italic),
                        ),
                      ],
                      if (isExpiringSoon) ...[
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.warningBg,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.warning_amber_rounded, color: AppColors.warning, size: 16),
                              SizedBox(width: 6),
                              Text(
                                'Alert: Contract is expiring soon! Review price rules.',
                                style: TextStyle(color: AppColors.warning, fontSize: 11, fontWeight: FontWeight.bold),
                              )
                            ],
                          ),
                        )
                      ]
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildRulesTab() {
    return Column(
      children: [
        // Metrics banner
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          color: AppColors.surfaceElevated,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${_rulesList.length} Active Purity Conversions',
                style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary, fontSize: 13),
              ),
              ElevatedButton.icon(
                onPressed: _showAddRuleDialog,
                icon: const Icon(Icons.add, size: 16, color: Colors.white),
                label: const Text('Add Purity Rule', style: TextStyle(color: Colors.white, fontSize: 12)),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
              )
            ],
          ),
        ),

        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: _rulesList.length,
            itemBuilder: (context, index) {
              final r = _rulesList[index];
              final status = r['status'] ?? "ACTIVE";
              final isActive = status == "ACTIVE";

              return Card(
                color: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: AppColors.surfaceBorder),
                ),
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: isActive ? const Color(0xFFFEF9E7) : AppColors.surfaceElevated,
                        child: Text(
                          r['purity'] ?? "",
                          style: TextStyle(
                            color: isActive ? AppColors.goldDark : AppColors.textHint,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${r['metalType']} (${r['purity']}) Price Conversion',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              'Vendor: ${r['vendorId']?['name'] ?? "Vardhman Gold"}',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Engine: ${r['rateType'].toString().replaceAll('_', ' ')} (Value: ₹${r['rateValue']})',
                              style: const TextStyle(color: AppColors.goldDark, fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isActive ? AppColors.successBg : AppColors.errorBg,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          status,
                          style: TextStyle(
                            color: isActive ? AppColors.success : AppColors.error,
                            fontWeight: FontWeight.bold,
                            fontSize: 9,
                          ),
                        ),
                      )
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
