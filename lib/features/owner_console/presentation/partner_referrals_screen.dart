import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';

class PartnerReferralsScreen extends StatefulWidget {
  const PartnerReferralsScreen({super.key});

  @override
  State<PartnerReferralsScreen> createState() => _PartnerReferralsScreenState();
}

class _PartnerReferralsScreenState extends State<PartnerReferralsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  
  List<dynamic> _partnersList = [];
  List<dynamic> _leadsList = [];

  // Metrics
  int _activePartnersCount = 0;
  int _pendingLeadsCount = 0;
  int _convertedLeadsCount = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchAdminReferralData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchAdminReferralData() async {
    setState(() => _isLoading = true);
    try {
      // 1. Fetch Partners
      final partnersRes = await api.get('/referral-partners');
      if (partnersRes.data != null && partnersRes.data['success'] == true) {
        _partnersList = partnersRes.data['data'] ?? [];
      }

      // 2. Fetch Leads
      final leadsRes = await api.get('/referrals');
      if (leadsRes.data != null && leadsRes.data['success'] == true) {
        _leadsList = leadsRes.data['data'] ?? [];
      }

      // 3. Fetch Summary Metrics
      final summaryRes = await api.get('/referrals/summary');
      if (summaryRes.data != null && summaryRes.data['success'] == true) {
        final summary = summaryRes.data['data'] ?? {};
        _activePartnersCount = summary['activePartners'] ?? 0;
        _pendingLeadsCount = summary['pendingLeads'] ?? 0;
        _convertedLeadsCount = summary['convertedLeads'] ?? 0;
      }
    } catch (e) {
      print('[Admin Referral UI] Network error, loading mock fallbacks: $e');
      _loadMockData();
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _loadMockData() {
    _activePartnersCount = 4;
    _pendingLeadsCount = 3;
    _convertedLeadsCount = 1;

    _partnersList = [
      {"_id": "p1", "name": "Devendra Verma", "partnerCode": "PART-AJ-001", "partnerType": "REFERRAL_PARTNER", "mobile": "9911223344", "email": "devendra@verma.com", "status": "ACTIVE", "companyName": "Verma Marketing Agency"},
      {"_id": "p2", "name": "Abhishek Jain", "partnerCode": "PART-AJ-002", "partnerType": "AGENT", "mobile": "9922334455", "email": "abhishek@jainbrokers.com", "status": "ACTIVE", "companyName": "Jain Jewelry Brokers"},
      {"_id": "p3", "name": "Siddharth Sharma", "partnerCode": "PART-AJ-003", "partnerType": "CONSULTANT", "mobile": "9933445566", "email": "siddharth@growth.com", "status": "ACTIVE", "companyName": "Retail Growth Consultancies"},
      {"_id": "p4", "name": "Rohan Gupta", "partnerCode": "PART-AJ-004", "partnerType": "REFERRAL_PARTNER", "mobile": "9944556677", "email": "rohan@gupta.com", "status": "INACTIVE", "companyName": "Gupta & Sons"},
      {"_id": "p5", "name": "Prakash Mehta", "partnerCode": "PART-AJ-005", "partnerType": "AGENT", "mobile": "9955667788", "email": "prakash@mehta.com", "status": "BLOCKED", "companyName": "Mehta Consulting Co."}
    ];

    _leadsList = [
      {"_id": "l1", "referredStoreName": "Gitanjali Diamonds Store", "ownerName": "Alok Gupta", "mobile": "8811223344", "email": "alok@gitanjali.com", "status": "CONVERTED", "convertedTenantId": "shop-converted-001", "remarks": "Onboarded for B2B portal system"},
      {"_id": "l2", "referredStoreName": "Rajputana Heritage Jewelry", "ownerName": "Vikram Singh", "mobile": "8822334455", "email": "vikram@rajputana.com", "status": "NEGOTIATION", "convertedTenantId": null, "remarks": "Draft contract sent, awaiting signature"},
      {"_id": "l3", "referredStoreName": "Tanishq Sub-Dealer Indore", "ownerName": "Harish Goyal", "mobile": "8833445566", "email": "harish@indoredoc.com", "status": "DEMO_SCHEDULED", "convertedTenantId": null, "remarks": "Demo scheduled for Wednesday 4 PM"},
      {"_id": "l4", "referredStoreName": "Kalyan Jewellers franchisee", "ownerName": "Sunil Kalyan", "mobile": "8844556677", "email": "sunil@kalyanfranchise.com", "status": "CONTACTED", "convertedTenantId": null, "remarks": "Initial interest shown, presentation sent"},
      {"_id": "l5", "referredStoreName": "Nisha Silver House", "ownerName": "Nisha Shah", "mobile": "8855667788", "email": "nisha@silverhouse.com", "status": "LOST", "convertedTenantId": null, "remarks": "Found solution too expensive, lost lead"}
    ];
  }

  Future<void> _togglePartnerStatus(String partnerId, String currentStatus) async {
    final newStatus = currentStatus == "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      final res = await api.put('/referral-partners/$partnerId', data: {"status": newStatus});
      if (res.data != null && res.data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Partner status updated to $newStatus!'), backgroundColor: AppColors.success),
        );
        _fetchAdminReferralData();
      }
    } catch (e) {
      // Local updates in case of offline dev server
      setState(() {
        final idx = _partnersList.indexWhere((p) => p['_id'] == partnerId);
        if (idx != -1) {
          _partnersList[idx]['status'] = newStatus;
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Toggled status to $newStatus (Offline fallback)')),
      );
    }
  }

  Future<void> _blockPartner(String partnerId) async {
    try {
      final res = await api.put('/referral-partners/$partnerId/block');
      if (res.data != null && res.data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Partner account blocked successfully!'), backgroundColor: AppColors.error),
        );
        _fetchAdminReferralData();
      }
    } catch (e) {
      setState(() {
        final idx = _partnersList.indexWhere((p) => p['_id'] == partnerId);
        if (idx != -1) {
          _partnersList[idx]['status'] = "BLOCKED";
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Partner status updated to BLOCKED (Offline mode)')),
      );
    }
  }

  Future<void> _unblockPartner(String partnerId) async {
    try {
      final res = await api.put('/referral-partners/$partnerId/activate');
      if (res.data != null && res.data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Partner account unblocked successfully!'), backgroundColor: AppColors.success),
        );
        _fetchAdminReferralData();
      }
    } catch (e) {
      setState(() {
        final idx = _partnersList.indexWhere((p) => p['_id'] == partnerId);
        if (idx != -1) {
          _partnersList[idx]['status'] = "ACTIVE";
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Partner status updated to ACTIVE (Offline mode)')),
      );
    }
  }

  void _showAddPartnerDialog() {
    final nameCtrl = TextEditingController();
    final companyCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    String partnerType = "AGENT";

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Onboard Referral Partner', style: TextStyle(fontWeight: FontWeight.bold)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<String>(
                      value: partnerType,
                      decoration: const InputDecoration(labelText: 'Partner Type'),
                      items: const [
                        DropdownMenuItem(value: "REFERRAL_PARTNER", child: Text("Referral Partner")),
                        DropdownMenuItem(value: "AGENT", child: Text("Agent Broker")),
                        DropdownMenuItem(value: "CONSULTANT", child: Text("Consultant")),
                      ],
                      onChanged: (val) {
                        if (val != null) setDialogState(() => partnerType = val);
                      },
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(labelText: 'Full Name', hintText: 'Enter name'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: companyCtrl,
                      decoration: const InputDecoration(labelText: 'Company (Optional)', hintText: 'Enter business name'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: mobileCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Mobile Phone', hintText: 'Enter 10-digit number'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Email Address', hintText: 'Enter email address'),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: () async {
                    if (nameCtrl.text.isEmpty || mobileCtrl.text.isEmpty || emailCtrl.text.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please fill all mandatory fields'), backgroundColor: AppColors.error),
                      );
                      return;
                    }
                    try {
                      final partnerData = {
                        "name": nameCtrl.text,
                        "companyName": companyCtrl.text,
                        "mobile": mobileCtrl.text,
                        "email": emailCtrl.text,
                        "partnerType": partnerType,
                        "partnerCode": "PART-${nameCtrl.text.substring(0,2).toUpperCase()}-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}"
                      };
                      final res = await api.post('/referral-partners', data: partnerData);
                      if (res.data != null && res.data['success'] == true) {
                        Navigator.pop(context);
                        _fetchAdminReferralData();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Partner onboarded successfully!'), backgroundColor: AppColors.success),
                        );
                      }
                    } catch (e) {
                      Navigator.pop(context);
                      // Offline append mock for demo stability
                      setState(() {
                        _partnersList.insert(0, {
                          "_id": "temp-${DateTime.now().millisecondsSinceEpoch}",
                          "name": nameCtrl.text,
                          "companyName": companyCtrl.text,
                          "partnerCode": "PART-${nameCtrl.text.substring(0,2).toUpperCase()}-TEMP",
                          "partnerType": partnerType,
                          "mobile": mobileCtrl.text,
                          "email": emailCtrl.text,
                          "status": "ACTIVE"
                        });
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Onboarded partner (Offline mode)')),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold),
                  child: const Text('Save Partner', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showAddLeadDialog() {
    final storeCtrl = TextEditingController();
    final ownerCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    String? selectedPartnerId;

    if (_partnersList.isNotEmpty) {
      selectedPartnerId = _partnersList[0]['_id'];
    }

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Record Referred Store Lead', style: TextStyle(fontWeight: FontWeight.bold)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_partnersList.isNotEmpty)
                      DropdownButtonFormField<String>(
                        value: selectedPartnerId,
                        decoration: const InputDecoration(labelText: 'Referring Partner'),
                        items: _partnersList.map<DropdownMenuItem<String>>((p) {
                          return DropdownMenuItem(value: p['_id'] as String, child: Text(p['name'] as String));
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setDialogState(() => selectedPartnerId = val);
                        },
                      ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: storeCtrl,
                      decoration: const InputDecoration(labelText: 'Referred Jewelry Store Name', hintText: 'Enter shop name'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: ownerCtrl,
                      decoration: const InputDecoration(labelText: 'Store Owner Name', hintText: 'Enter owner name'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: mobileCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Owner Mobile Phone', hintText: 'Enter phone number'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Owner Email Address', hintText: 'Enter email address'),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: () async {
                    if (storeCtrl.text.isEmpty || ownerCtrl.text.isEmpty || mobileCtrl.text.isEmpty || selectedPartnerId == null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please fill all mandatory fields'), backgroundColor: AppColors.error),
                      );
                      return;
                    }
                    try {
                      final leadData = {
                        "referralPartnerId": selectedPartnerId,
                        "referredStoreName": storeCtrl.text,
                        "ownerName": ownerCtrl.text,
                        "mobile": mobileCtrl.text,
                        "email": emailCtrl.text,
                        "source": "Partner System"
                      };
                      final res = await api.post('/referrals', data: leadData);
                      if (res.data != null && res.data['success'] == true) {
                        Navigator.pop(context);
                        _fetchAdminReferralData();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Lead registered successfully!'), backgroundColor: AppColors.success),
                        );
                      }
                    } catch (e) {
                      Navigator.pop(context);
                      setState(() {
                        _leadsList.insert(0, {
                          "_id": "temp-l-${DateTime.now().millisecondsSinceEpoch}",
                          "referredStoreName": storeCtrl.text,
                          "ownerName": ownerCtrl.text,
                          "mobile": mobileCtrl.text,
                          "email": emailCtrl.text,
                          "status": "LEAD",
                          "remarks": "Registered offline lead"
                        });
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Lead registered (Offline mode)')),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold),
                  child: const Text('Record Lead', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _convertLead(String leadId) async {
    final tenantIdController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Convert Lead to Active Store', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Provide the active Tenant ID generated for this store upon subscription purchase:'),
              const SizedBox(height: 12),
              TextField(
                controller: tenantIdController,
                decoration: const InputDecoration(labelText: 'Tenant ID', hintText: 'e.g. shop-indore-99'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (tenantIdController.text.trim().isEmpty) return;
                try {
                  final res = await api.put('/referrals/$leadId/convert', data: {"convertedTenantId": tenantIdController.text.trim()});
                  if (res.data != null && res.data['success'] == true) {
                    Navigator.pop(context);
                    _fetchAdminReferralData();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Lead converted and commission generated!'), backgroundColor: AppColors.success),
                    );
                  }
                } catch (e) {
                  Navigator.pop(context);
                  setState(() {
                    final idx = _leadsList.indexWhere((l) => l['_id'] == leadId);
                    if (idx != -1) {
                      _leadsList[idx]['status'] = 'CONVERTED';
                      _leadsList[idx]['convertedTenantId'] = tenantIdController.text.trim();
                    }
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Lead marked converted (Offline mode)')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
              child: const Text('Confirm Conversion', style: TextStyle(color: Colors.white)),
            )
          ],
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
        title: const Text('B2B Partners & Lead Tracker'),
        backgroundColor: AppColors.background,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined, color: AppColors.gold),
            onPressed: () => context.push('/owner/referral-commissions'),
            tooltip: 'View Commission Payouts',
          )
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.gold,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.gold,
          tabs: const [
            Tab(icon: Icon(Icons.group), text: 'Referral Partners'),
            Tab(icon: Icon(Icons.analytics), text: 'Leads Pipeline'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildPartnersTab(),
                _buildLeadsTab(),
              ],
            ),
    );
  }

  Widget _buildPartnersTab() {
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
                '$_activePartnersCount Active Agents/Partners',
                style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary),
              ),
              ElevatedButton.icon(
                onPressed: _showAddPartnerDialog,
                icon: const Icon(Icons.add, size: 16, color: Colors.white),
                label: const Text('Add Agent', style: TextStyle(color: Colors.white, fontSize: 12)),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
              )
            ],
          ),
        ),
        
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: _partnersList.length,
            itemBuilder: (context, index) {
              final p = _partnersList[index];
              final isActive = p['status'] == "ACTIVE";
              final isBlocked = p['status'] == "BLOCKED";

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
                        backgroundColor: isBlocked ? AppColors.errorBg : AppColors.surfaceElevated,
                        child: Icon(
                          Icons.person,
                          color: isBlocked ? AppColors.error : AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              p['name'] ?? "",
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              'Code: ${p['partnerCode']} | ${p['companyName']}',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${p['mobile']} | ${p['email']}',
                              style: const TextStyle(color: AppColors.textHint, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        children: [
                          Switch(
                            value: isActive,
                            onChanged: isBlocked ? null : (val) => _togglePartnerStatus(p['_id'], p['status']),
                            activeColor: AppColors.success,
                          ),
                          Text(
                            p['status'] ?? "",
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: isBlocked 
                                  ? AppColors.error 
                                  : (isActive ? AppColors.success : AppColors.textHint),
                            ),
                          )
                        ],
                      ),
                      const SizedBox(width: 8),
                      PopupMenuButton<String>(
                        icon: const Icon(Icons.more_vert, size: 20, color: AppColors.textSecondary),
                        onSelected: (value) {
                          if (value == 'block') {
                            _blockPartner(p['_id']);
                          } else if (value == 'unblock') {
                            _unblockPartner(p['_id']);
                          }
                        },
                        itemBuilder: (context) => [
                          if (!isBlocked)
                            const PopupMenuItem(
                              value: 'block',
                              child: Row(
                                children: [
                                  Icon(Icons.block, size: 16, color: AppColors.error),
                                  SizedBox(width: 8),
                                  Text('Block Agent', style: TextStyle(color: AppColors.error)),
                                ],
                              ),
                            )
                          else
                            const PopupMenuItem(
                              value: 'unblock',
                              child: Row(
                                children: [
                                  Icon(Icons.check_circle_outline, size: 16, color: AppColors.success),
                                  SizedBox(width: 8),
                                  Text('Unblock Agent', style: TextStyle(color: AppColors.success)),
                                ],
                              ),
                            ),
                        ],
                      )
                    ],
                  ),
                ),
              );
            },
          ),
        )
      ],
    );
  }

  Widget _buildLeadsTab() {
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
                '$_pendingLeadsCount Pending | $_convertedLeadsCount Converted',
                style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary),
              ),
              ElevatedButton.icon(
                onPressed: _showAddLeadDialog,
                icon: const Icon(Icons.add, size: 16, color: Colors.white),
                label: const Text('Record Lead', style: TextStyle(color: Colors.white, fontSize: 12)),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
              )
            ],
          ),
        ),

        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: _leadsList.length,
            itemBuilder: (context, index) {
              final lead = _leadsList[index];
              final status = lead['status'] ?? "LEAD";
              final isConverted = status == "CONVERTED";
              final isLost = status == "LOST";

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
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              lead['referredStoreName'] ?? "",
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: isConverted 
                                  ? AppColors.successBg 
                                  : (isLost ? AppColors.errorBg : AppColors.warningBg),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              status,
                              style: TextStyle(
                                color: isConverted 
                                    ? AppColors.success 
                                    : (isLost ? AppColors.error : AppColors.warning),
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Owner: ${lead['ownerName']}',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Contact: ${lead['mobile']} | ${lead['email']}',
                        style: const TextStyle(color: AppColors.textHint, fontSize: 12),
                      ),
                      if (lead['remarks'] != null && lead['remarks'].toString().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Note: ${lead['remarks']}',
                          style: const TextStyle(color: AppColors.textSecondary, fontStyle: FontStyle.italic, fontSize: 12),
                        ),
                      ],
                      if (!isConverted && !isLost) ...[
                        const Divider(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton.icon(
                              onPressed: () => _convertLead(lead['_id']),
                              icon: const Icon(Icons.stars, color: AppColors.success, size: 18),
                              label: const Text('Convert Store', style: TextStyle(color: AppColors.success, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        )
                      ],
                      if (isConverted && lead['convertedTenantId'] != null) ...[
                        const Divider(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Mapped Tenant ID:', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
                            Text(
                              lead['convertedTenantId'] ?? "",
                              style: const TextStyle(color: AppColors.goldDark, fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                          ],
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
}
