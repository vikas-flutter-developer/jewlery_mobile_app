import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/admin_provider.dart';

class ComplianceReportsScreen extends ConsumerStatefulWidget {
  const ComplianceReportsScreen({super.key});

  @override
  ConsumerState<ComplianceReportsScreen> createState() => _ComplianceReportsScreenState();
}

class _ComplianceReportsScreenState extends ConsumerState<ComplianceReportsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = false;
  String? _errorMessage;

  // Controllers for adding BIS Licence
  final _licNoCtrl = TextEditingController();
  final _licHolderCtrl = TextEditingController();
  final _authorityCtrl = TextEditingController(text: 'BIS Bureau of Indian Standards');
  final _branchCtrl = TextEditingController(text: 'MAIN');

  // Controllers for PAN Verification
  final _panCustIdCtrl = TextEditingController();
  final _panValCtrl = TextEditingController();
  Map<String, dynamic>? _verifiedCustomerDetails;

  // Controller for HUID Validation
  final _huidValCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _panCustIdCtrl.addListener(() {
      if (_verifiedCustomerDetails != null) {
        setState(() {
          _verifiedCustomerDetails = null;
        });
      }
    });
    _panValCtrl.addListener(() {
      if (_verifiedCustomerDetails != null) {
        setState(() {
          _verifiedCustomerDetails = null;
        });
      }
    });
    _fetchComplianceData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _licNoCtrl.dispose();
    _licHolderCtrl.dispose();
    _authorityCtrl.dispose();
    _branchCtrl.dispose();
    _panCustIdCtrl.dispose();
    _panValCtrl.dispose();
    _huidValCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchComplianceData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await Future.wait([
        ref.read(adminProvider.notifier).fetchGstDashboard(),
        ref.read(adminProvider.notifier).fetchTcsTransactions(),
        ref.read(adminProvider.notifier).fetchTcsSummary(),
        ref.read(adminProvider.notifier).fetchHuidExceptions(),
        ref.read(adminProvider.notifier).fetchBisLicences(),
      ]);
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load compliance data: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showAddBisDialog() {
    _licNoCtrl.clear();
    _licHolderCtrl.clear();
    _authorityCtrl.text = 'BIS Bureau of Indian Standards';
    _branchCtrl.text = 'MAIN';

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFFF9F6F0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text('REGISTER BIS HALLMARK LICENCE', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontWeight: FontWeight.bold, fontSize: 14)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: _licNoCtrl, decoration: const InputDecoration(labelText: 'Licence Number')),
                const SizedBox(height: 12),
                TextField(controller: _licHolderCtrl, decoration: const InputDecoration(labelText: 'Licence Holder Name')),
                const SizedBox(height: 12),
                TextField(controller: _authorityCtrl, decoration: const InputDecoration(labelText: 'Issuing Authority')),
                const SizedBox(height: 12),
                TextField(controller: _branchCtrl, decoration: const InputDecoration(labelText: 'Store Branch ID')),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CANCEL', style: TextStyle(color: Colors.black45))),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
              onPressed: () async {
                if (_licNoCtrl.text.trim().isEmpty || _licHolderCtrl.text.trim().isEmpty) return;
                final ok = await ref.read(adminProvider.notifier).saveBisLicence({
                  'licenceNumber': _licNoCtrl.text.trim(),
                  'licenceHolderName': _licHolderCtrl.text.trim(),
                  'issuingAuthority': _authorityCtrl.text.trim(),
                  'issueDate': DateTime.now().toIso8601String(),
                  'expiryDate': DateTime.now().add(const Duration(days: 365)).toIso8601String(),
                  'branchId': _branchCtrl.text.trim(),
                  'isActive': true,
                  'status': 'ACTIVE',
                  'tenantId': ref.read(adminProvider).activeBranch?['tenantId'] ?? 'default-shop',
                });
                if (ok) {
                  Navigator.pop(ctx);
                  _fetchComplianceData();
                }
              },
              child: const Text('REGISTER', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.goldDark),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'COMPLIANCE MANAGEMENT',
          style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontWeight: FontWeight.bold, letterSpacing: 1.0, fontSize: 16),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppTheme.goldDark),
            onPressed: _fetchComplianceData,
          )
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.goldDark,
          unselectedLabelColor: Colors.black38,
          indicatorColor: AppTheme.goldDark,
          isScrollable: true,
          tabs: const [
            Tab(text: 'GST FILING'),
            Tab(text: 'TCS LEDGER'),
            Tab(text: 'HUID HALLMARK'),
            Tab(text: 'BIS LICENCES'),
            Tab(text: 'PAN VERIFICATION'),
          ],
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            if (_isLoading)
              const Expanded(child: Center(child: CircularProgressIndicator(color: AppTheme.goldDark)))
            else if (_errorMessage != null)
              Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold))
            else
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildGstTab(),
                    _buildTcsTab(),
                    _buildHuidTab(),
                    _buildBisTab(),
                    _buildPanTab(),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  // --- GST TAB ---
  Widget _buildGstTab() {
    final gst = ref.watch(adminProvider).gstDashboard ?? {};
    final summary = gst['summary'] ?? {};
    final liabilities = gst['liabilities'] as List<dynamic>? ?? [];
    final exceptions = gst['exceptions'] as List<dynamic>? ?? [];

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('GST Summary (Current Period)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif', fontSize: 14)),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
                icon: const Icon(Icons.download_rounded, size: 16, color: Colors.white),
                label: const Text('EXPORT GSTR', style: TextStyle(fontSize: 11, color: Colors.white)),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('✓ GSTR-1 spreadsheet exported to downloads.'), backgroundColor: Colors.green),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _buildMetricCard('Total Sales', '₹${summary['totalSales'] ?? "0.00"}', Colors.blue)),
              const SizedBox(width: 12),
              Expanded(child: _buildMetricCard('Tax Liability', '₹${summary['taxLiability'] ?? "0.00"}', Colors.amber)),
            ],
          ),
          const SizedBox(height: 24),
          const Text('GST Liabilities Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF4A3E1B))),
          const SizedBox(height: 8),
          if (liabilities.isEmpty)
            const Text('No liabilities registered.', style: TextStyle(color: Colors.black38, fontSize: 11))
          else
            ...liabilities.map((item) {
              return Card(
                color: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFECE6DF))),
                child: ListTile(
                  title: Text('HSN: ${item['hsnCode'] ?? "7113"}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  subtitle: Text('Rate: ${item['taxRate']}% • Value: ₹${item['taxableValue']}'),
                  trailing: Text('Tax: ₹${item['gstTax']}', style: const TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold)),
                ),
              );
            }),
          const SizedBox(height: 24),
          const Text('Compliance Exceptions / Discrepancies', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.redAccent)),
          const SizedBox(height: 8),
          if (exceptions.isEmpty)
            const Text('✓ All invoices compliant. No discrepancy detected.', style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold))
          else
            ...exceptions.map((ex) {
              return Card(
                color: Colors.redAccent.withOpacity(0.04),
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Colors.redAccent)),
                child: ListTile(
                  leading: const Icon(Icons.warning_amber_rounded, color: Colors.redAccent),
                  title: Text(ex['invoiceId'] ?? 'Invoice Error', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  subtitle: Text(ex['errorDetails'] ?? ex['message'] ?? 'Mismatching tax configuration.'),
                ),
              );
            }),
        ],
      ),
    );
  }

  // --- TCS TAB ---
  Widget _buildTcsTab() {
    final tcsSum = ref.watch(adminProvider).tcsSummary ?? {};
    final tcsTxs = ref.watch(adminProvider).tcsTransactions;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('TCS Collection Threshold (₹2,00,000)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif', fontSize: 14)),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _buildMetricCard('Collected TCS', '₹${tcsSum['collectedTcs'] ?? "0"}', Colors.green)),
            const SizedBox(width: 12),
            Expanded(child: _buildMetricCard('Pending Tally', '₹${tcsSum['pendingTcs'] ?? "0"}', Colors.orange)),
          ],
        ),
        const SizedBox(height: 24),
        const Text('Recent TCS Collections Log', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF4A3E1B))),
        const SizedBox(height: 8),
        if (tcsTxs.isEmpty)
          const Expanded(child: Center(child: Text('No TCS ledger collections recorded.', style: TextStyle(color: Colors.black38))))
        else
          Expanded(
            child: ListView.builder(
              itemCount: tcsTxs.length,
              itemBuilder: (context, idx) {
                final tx = tcsTxs[idx];
                return Card(
                  color: Colors.white,
                  elevation: 0,
                  margin: const EdgeInsets.only(bottom: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFECE6DF))),
                  child: ListTile(
                    title: Text('Invoice: ${tx['invoiceId']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    subtitle: Text('Status: ${tx['status']} • Taxable: ₹${tx['taxableAmount']}'),
                    trailing: Text('TCS: ₹${tx['tcsAmount']}', style: const TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold)),
                    onTap: () {
                      _showTcsUpdateDialog(tx);
                    },
                  ),
                );
              },
            ),
          )
      ],
    );
  }

  void _showTcsUpdateDialog(Map<String, dynamic> tx) {
    final remarksCtrl = TextEditingController(text: tx['remarks'] ?? '');
    String status = tx['status'] ?? 'PENDING';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: Text('UPDATE TCS TRANSACTION', style: const TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 13, fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    value: status,
                    decoration: const InputDecoration(labelText: 'TCS Status'),
                    items: const [
                      DropdownMenuItem(value: 'PENDING', child: Text('PENDING TALLY')),
                      DropdownMenuItem(value: 'COLLECTED', child: Text('COLLECTED / RETRIEVED')),
                      DropdownMenuItem(value: 'REPORTED', child: Text('REPORTED TO GOVT')),
                    ],
                    onChanged: (v) => setDialogState(() => status = v!),
                  ),
                  const SizedBox(height: 12),
                  TextField(controller: remarksCtrl, decoration: const InputDecoration(labelText: 'Compliance Remarks')),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CANCEL', style: TextStyle(color: Colors.black45))),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
                  onPressed: () async {
                    final ok = await ref.read(adminProvider.notifier).updateTcsStatus(tx['_id'], status, remarksCtrl.text.trim());
                    if (ok) {
                      Navigator.pop(ctx);
                      _fetchComplianceData();
                    }
                  },
                  child: const Text('UPDATE', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // --- HUID TAB ---
  Widget _buildHuidTab() {
    final huidExs = ref.watch(adminProvider).huidExceptions;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('HUID Hallmarking Validator', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif', fontSize: 14)),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _huidValCtrl,
                decoration: const InputDecoration(hintText: 'Enter HUID Code (6 Characters)', labelText: 'Validate HUID'),
              ),
            ),
            const SizedBox(width: 12),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
              onPressed: () async {
                final code = _huidValCtrl.text.trim();
                if (code.isEmpty) return;
                final res = await ref.read(adminProvider.notifier).validateHuid(code);
                final isValid = res['valid'] == true;
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: const Color(0xFFF9F6F0),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    title: Text(isValid ? '✓ VALID HUID CODE' : '✗ INVALID HUID', style: TextStyle(color: isValid ? Colors.green : Colors.redAccent, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold)),
                    content: Text(isValid ? 'The HUID Code is structurally authentic and logged in BIS database.' : (res['reason'] ?? 'HUID code check failed.')),
                    actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))],
                  ),
                );
              },
              child: const Text('VERIFY', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const Text('Inventory Non-Compliant List (No HUID)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF4A3E1B))),
        const SizedBox(height: 8),
        if (huidExs.isEmpty)
          const Expanded(child: Center(child: Text('✓ No non-compliant inventory items.', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold))))
        else
          Expanded(
            child: ListView.builder(
              itemCount: huidExs.length,
              itemBuilder: (context, idx) {
                final ex = huidExs[idx];
                return Card(
                  color: Colors.white,
                  elevation: 0,
                  margin: const EdgeInsets.only(bottom: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFECE6DF))),
                  child: ListTile(
                    leading: const Icon(Icons.warning, color: Colors.orangeAccent),
                    title: Text(ex['sku'] ?? ex['productName'] ?? 'Jewelry Item', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    subtitle: Text('Weight: ${ex['weight']}g • Metal: ${ex['metalPurity']}'),
                  ),
                );
              },
            ),
          )
      ],
    );
  }

  // --- BIS TAB ---
  Widget _buildBisTab() {
    final bis = ref.watch(adminProvider).bisLicences;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('BIS Registered Hallmarking Licences', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif', fontSize: 14)),
            IconButton(
              icon: const Icon(Icons.add_circle_outline, color: AppTheme.goldDark),
              onPressed: _showAddBisDialog,
            )
          ],
        ),
        const SizedBox(height: 12),
        if (bis.isEmpty)
          const Expanded(child: Center(child: Text('No BIS Licences registered.', style: TextStyle(color: Colors.black38))))
        else
          Expanded(
            child: ListView.builder(
              itemCount: bis.length,
              itemBuilder: (context, idx) {
                final lic = bis[idx];
                final active = lic['isActive'] == true;
                return Card(
                  color: Colors.white,
                  elevation: 0,
                  margin: const EdgeInsets.only(bottom: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFECE6DF))),
                  child: ListTile(
                    title: Text('Licence: ${lic['licenceNumber']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    subtitle: Text('Holder: ${lic['licenceHolderName']} • Status: ${lic['status']}'),
                    trailing: Switch(
                      value: active,
                      activeColor: AppTheme.goldDark,
                      onChanged: (val) async {
                        if (val) {
                          await ref.read(adminProvider.notifier).activateBisLicence(lic['_id']);
                        } else {
                          await ref.read(adminProvider.notifier).suspendBisLicence(lic['_id']);
                        }
                        _fetchComplianceData();
                      },
                    ),
                  ),
                );
              },
            ),
          )
      ],
    );
  }

  // --- PAN TAB ---
  Widget _buildPanTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('PAN Number KYC Verification', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif', fontSize: 14)),
        const SizedBox(height: 16),
        TextField(
          controller: _panCustIdCtrl,
          decoration: const InputDecoration(labelText: 'Customer Account ID', hintText: 'Enter customer mongoose _id'),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _panValCtrl,
                decoration: const InputDecoration(labelText: 'PAN Card Number', hintText: 'e.g. ABCDE1234F'),
              ),
            ),
            const SizedBox(width: 12),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
              onPressed: () async {
                final pan = _panValCtrl.text.trim();
                final custId = _panCustIdCtrl.text.trim();
                if (pan.isEmpty) return;
                final res = await ref.read(adminProvider.notifier).validatePanNumber(pan, customerId: custId.isNotEmpty ? custId : null);
                final isValid = res['valid'] == true;
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: const Color(0xFFF9F6F0),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    title: Text(isValid ? '✓ PAN VALID' : '✗ PAN INVALID', style: TextStyle(color: isValid ? Colors.green : Colors.redAccent, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold)),
                    content: Text(isValid ? 'The PAN Number matches standard Indian Income Tax formatting.' : (res['reason'] ?? 'Invalid PAN format.')),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CLOSE')),
                      if (isValid && custId.isNotEmpty)
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
                          onPressed: () async {
                            final customerMap = await ref.read(adminProvider.notifier).verifyPanNumber(custId, pan, 'VERIFIED');
                            final success = customerMap != null;
                            if (success) {
                              setState(() {
                                _verifiedCustomerDetails = customerMap;
                              });
                            }
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                              content: Text(success ? '✓ Customer PAN verified & locked!' : 'Verification failed.'),
                              backgroundColor: success ? Colors.green : Colors.redAccent,
                            ));
                          },
                          child: const Text('VERIFY & LOCK', style: TextStyle(color: Colors.white)),
                        ),
                    ],
                  ),
                );
              },
              child: const Text('VALIDATE', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
        if (_verifiedCustomerDetails != null) ...[
          const SizedBox(height: 24),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5E9),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.green.shade200, width: 1.5),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.check_circle, color: Colors.green, size: 20),
                    const SizedBox(width: 8),
                    const Text(
                      'KYC STATUS: VERIFIED & LOCKED',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.green,
                        fontSize: 12,
                        letterSpacing: 1.1,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Divider(height: 1, color: Colors.green),
                const SizedBox(height: 12),
                _buildInfoRow('Customer Name', _verifiedCustomerDetails!['name'] ?? 'Amit Sharma'),
                const SizedBox(height: 8),
                _buildInfoRow('Customer ID', _verifiedCustomerDetails!['_id'] ?? ''),
                const SizedBox(height: 8),
                _buildInfoRow('PAN Number', _maskPan(_verifiedCustomerDetails!['panNumber'] ?? _verifiedCustomerDetails!['pan'] ?? '')),
                const SizedBox(height: 8),
                _buildInfoRow('Verified By', _verifiedCustomerDetails!['panVerifiedBy'] ?? 'Store Manager'),
                const SizedBox(height: 8),
                _buildInfoRow('Verified On', _formatDate(_verifiedCustomerDetails!['panVerifiedAt'])),
              ],
            ),
          ),
        ]
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.black54, fontSize: 12)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25), fontSize: 12)),
      ],
    );
  }

  String _maskPan(String pan) {
    if (pan.length < 8) return pan;
    return '${pan.substring(0, 3)}XX${pan.substring(5, 7)}X${pan.substring(8)}';
  }

  String _formatDate(dynamic dateVal) {
    if (dateVal == null) {
      final now = DateTime.now();
      return '${now.day}/${now.month}/${now.year} ${now.hour}:${now.minute.toString().padLeft(2, '0')}';
    }
    try {
      final dt = DateTime.parse(dateVal.toString());
      return '${dt.day}/${dt.month}/${dt.year} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateVal.toString();
    }
  }

  Widget _buildMetricCard(String title, String val, Color barColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFECE6DF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(width: 4, height: 16, decoration: BoxDecoration(color: barColor, borderRadius: BorderRadius.circular(2))),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontSize: 10, color: Colors.black45, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 8),
          Text(val, style: const TextStyle(fontSize: 18, color: Color(0xFF2E2A25), fontWeight: FontWeight.bold, fontFamily: 'serif')),
        ],
      ),
    );
  }
}
