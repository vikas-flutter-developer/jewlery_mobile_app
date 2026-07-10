import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/database/database_service.dart';
import '../providers/admin_provider.dart';
import 'inventory_screen.dart';
import 'alloy_calculator_screen.dart';
import 'bom_manager_screen.dart';
import 'ledger_screen.dart';
import 'karigar_payroll_screen.dart';

class ManufacturingView extends ConsumerStatefulWidget {
  const ManufacturingView({super.key});

  @override
  ConsumerState<ManufacturingView> createState() => _ManufacturingViewState();
}

class _ManufacturingViewState extends ConsumerState<ManufacturingView> {
  final _customerNameCtrl = TextEditingController();
  final _customerPhoneCtrl = TextEditingController();
  final _weightCtrl = TextEditingController();
  final _alloyCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  
  String? _selectedKarigarId;
  String _selectedPurity = '22K';
  String _selectedCategory = 'Necklace';

  @override
  void dispose() {
    _customerNameCtrl.dispose();
    _customerPhoneCtrl.dispose();
    _weightCtrl.dispose();
    _alloyCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  void _showAssignJobDialog(Map<String, dynamic> order, List<dynamic> karikars) {
    if (karikars.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No Karigars available. Onboard a Karigar first.'), backgroundColor: Colors.redAccent),
      );
      return;
    }
    
    // Set initial values
    _selectedKarigarId = karikars.first['_id'] ?? karikars.first['id'];
    _weightCtrl.text = (order['weight'] ?? 10.0).toString();
    _alloyCtrl.text = '0.5';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text(
                'ASSIGN TO ARTISAN',
                style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Order: ${order['jewelryType'] ?? order['category'] ?? "Jewelry Item"} (${order['purity'] ?? "22K"})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black54),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedKarigarId,
                      decoration: const InputDecoration(labelText: 'Select Goldsmith (Karigar)'),
                      items: karikars.map<DropdownMenuItem<String>>((k) {
                        return DropdownMenuItem<String>(
                          value: (k['_id'] ?? k['id']).toString(),
                          child: Text(k['name'] ?? 'Artisan'),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setDialogState(() {
                          _selectedKarigarId = val;
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _weightCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Issued Gross Gold Weight (g)'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _alloyCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Added Copper/Silver Alloy (g)'),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('CANCEL', style: TextStyle(color: Colors.black45, fontWeight: FontWeight.bold)),
                ),
                ElevatedButton(
                  onPressed: () async {
                    if (_selectedKarigarId == null) return;
                    final gross = double.tryParse(_weightCtrl.text) ?? 0.0;
                    final alloy = double.tryParse(_alloyCtrl.text) ?? 0.0;
                    
                    final targetK = karikars.firstWhere((k) => (k['_id'] ?? k['id']).toString() == _selectedKarigarId);
                    final kName = targetK['name'] ?? 'Artisan';
                    
                    final success = await ref.read(adminProvider.notifier).assignWorkOrderToKarigar(
                      orderId: (order['_id'] ?? order['id']).toString(),
                      karigarId: _selectedKarigarId!,
                      karigarName: kName,
                      grossWeight: gross,
                      alloyWeight: alloy,
                      dueDate: DateTime.now().add(const Duration(days: 7)).toIso8601String().split('T')[0],
                    );

                    if (success) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Job Card Issued to Karigar successfully!'), backgroundColor: AppTheme.goldDark),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
                  child: const Text('ISSUE JOB CARD', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showNewOrderDialog() {
    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text(
                'NEW MANUFACTURING ORDER',
                style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: _customerNameCtrl,
                      decoration: const InputDecoration(labelText: 'Client Name', prefixIcon: Icon(Icons.person_outline)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _customerPhoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Client Phone', prefixIcon: Icon(Icons.phone_outlined)),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedCategory,
                      decoration: const InputDecoration(labelText: 'Category'),
                      items: ['Necklace', 'Ring', 'Bangles', 'Chain', 'Earrings'].map((cat) {
                        return DropdownMenuItem<String>(value: cat, child: Text(cat));
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            _selectedCategory = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _weightCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Estimated Gold Weight (g)', prefixIcon: Icon(Icons.scale_outlined)),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedPurity,
                      decoration: const InputDecoration(labelText: 'Purity (Karat)'),
                      items: ['18K', '22K', '24K'].map((karat) {
                        return DropdownMenuItem<String>(value: karat, child: Text(karat));
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            _selectedPurity = val;
                          });
                        }
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('CANCEL', style: TextStyle(color: Colors.black45, fontWeight: FontWeight.bold)),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final name = _customerNameCtrl.text.trim();
                    final phone = _customerPhoneCtrl.text.trim();
                    final weight = double.tryParse(_weightCtrl.text) ?? 0.0;

                    if (name.isEmpty || phone.isEmpty || weight <= 0) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Please fill all fields correctly'), backgroundColor: Colors.redAccent),
                      );
                      return;
                    }

                    final success = await ref.read(adminProvider.notifier).createProductionOrder(
                          clientName: name,
                          clientPhone: phone,
                          productType: _selectedCategory,
                          weightGrams: weight,
                          purity: _selectedPurity,
                        );

                    if (success) {
                      _customerNameCtrl.clear();
                      _customerPhoneCtrl.clear();
                      _weightCtrl.clear();
                      Navigator.pop(context);
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Manufacturing Order Registered Successfully!'), backgroundColor: AppTheme.goldDark),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
                  child: const Text('SUBMIT ORDER', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final adminState = ref.watch(adminProvider);
    // Roster of Karigars
    final activeBranchCode = adminState.activeBranch?['code'] ?? 'MAIN';
    final karikars = adminState.staff.where((s) => s['role'] == 'KARIKAR' && s['branchId'] == activeBranchCode).toList();

    // Vault inventories totals
    double goldVaultWeight = 450.0;
    double silverVaultWeight = 2500.0;
    double diamondsCarats = 14.5;
    
    for (final item in adminState.inventory) {
      final purity = item['purity'] as String?;
      final type = item['type'] as String?;
      final wt = (item['weight'] as num?)?.toDouble() ?? 0.0;
      if (type == 'DIAMOND') {
        diamondsCarats += (item['diamondCarat'] as num?)?.toDouble() ?? wt;
      } else if (purity != null && (purity.contains('K') || purity.contains('%'))) {
        goldVaultWeight += wt;
      } else {
        silverVaultWeight += wt;
      }
    }

    final pendingOrders = adminState.orders.where((o) => o['status'] == 'Pending Assignment' || o['status'] == 'Pending' || o['status'] == 'PENDING').toList();
    final activeJobs = adminState.orders.where((o) => o['status'] == 'In Production' || o['status'] == 'PROCESSING' || o['status'] == 'Processing').toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Manufacturing & Wholesale Utilities',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Color(0xFF4A3E1B),
            fontFamily: 'serif',
          ),
        ),
        const SizedBox(height: 12),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.05,
          children: [
            _buildUtilityCard(
              icon: Icons.inventory_2_outlined,
              label: 'Stock Inventory',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const InventoryScreen()),
                );
              },
            ),
            _buildUtilityCard(
              icon: Icons.calculate_outlined,
              label: 'Alloy Calculator',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const AlloyCalculatorScreen()),
                );
              },
            ),
            _buildUtilityCard(
              icon: Icons.architecture_rounded,
              label: 'BOM Recipes',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const BomManagerScreen()),
                );
              },
            ),
            _buildUtilityCard(
              icon: Icons.account_balance_wallet_outlined,
              label: 'Ledger & GST',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const LedgerScreen()),
                );
              },
            ),
            _buildUtilityCard(
              icon: Icons.payments_outlined,
              label: 'Karigar Payroll',
              onTap: _selectKarigarForPayroll,
            ),
          ],
        ),
        const SizedBox(height: 24),
        // Vault Metal Holdings Summary
        Row(
          children: [
            Expanded(
              child: _buildVaultCard(
                title: 'GOLD VAULT',
                value: '${goldVaultWeight.toStringAsFixed(1)} g',
                icon: Icons.auto_awesome,
                gradientColors: const [Color(0xFFFFFDF5), Color(0xFFFFF7DB), Color(0xFFF6E7B5)],
                textColor: const Color(0xFF755B13),
                progress: (goldVaultWeight / 1000.0).clamp(0.0, 1.0),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const InventoryScreen(initialMetalFilter: 'gold'),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildVaultCard(
                title: 'SILVER VAULT',
                value: '${silverVaultWeight.toStringAsFixed(0)} g',
                icon: Icons.circle,
                gradientColors: const [Color(0xFFFAFBFC), Color(0xFFF1F3F5), Color(0xFFE2E6EA)],
                textColor: const Color(0xFF4A5568),
                progress: (silverVaultWeight / 5000.0).clamp(0.0, 1.0),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const InventoryScreen(initialMetalFilter: 'silver'),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _buildVaultCard(
          title: 'LOOSE DIAMONDS',
          value: '${diamondsCarats.toStringAsFixed(2)} Carats',
          icon: Icons.diamond_outlined,
          gradientColors: const [Color(0xFFF5FBFE), Color(0xFFE3F2FD), Color(0xFFCBE5F7)],
          textColor: const Color(0xFF1565C0),
          progress: (diamondsCarats / 100.0).clamp(0.0, 1.0),
          fullWidth: true,
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const InventoryScreen(initialMetalFilter: 'diamonds'),
              ),
            );
          },
        ),
        
        const SizedBox(height: 28),

        // Orders Pending Goldsmith Assignment
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Pending Assignments',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            ElevatedButton.icon(
              onPressed: _showNewOrderDialog,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldDark,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              icon: const Icon(Icons.add, size: 14),
              label: const Text('NEW WORK ORDER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (pendingOrders.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: Text('No orders pending assignment', style: TextStyle(color: Colors.black38, fontSize: 12))),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: pendingOrders.length,
            itemBuilder: (ctx, idx) {
              final order = pendingOrders[idx];
              final itemType = order['jewelryType'] ?? order['category'] ?? (order['items'] != null && order['items'].isNotEmpty ? order['items'][0]['category'] : 'Jewelry');
              final purity = order['purity'] ?? order['carat'] ?? "22K";
              
              final Color accentColor = purity.contains('24')
                  ? const Color(0xFFD4AF37)
                  : purity.contains('18')
                      ? const Color(0xFFC5A059)
                      : AppTheme.goldDark;

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFECE6DF)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.015),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    decoration: BoxDecoration(
                      border: Border(
                        left: BorderSide(color: accentColor, width: 4.5),
                      ),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: accentColor.withValues(alpha: 0.08),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: accentColor.withValues(alpha: 0.2)),
                                    ),
                                    child: Text(
                                      purity,
                                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: accentColor),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    itemType,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF2E2A25)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  const Icon(Icons.scale_outlined, size: 13, color: Color(0xFF9E9284)),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${order['weight'] ?? 0}g Gold',
                                    style: const TextStyle(color: Color(0xFF5C5449), fontSize: 11, fontWeight: FontWeight.w600),
                                  ),
                                  const SizedBox(width: 14),
                                  const Icon(Icons.person_outline_rounded, size: 13, color: Color(0xFF9E9284)),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      order['customerName'] ?? "Retail Showroom",
                                      style: const TextStyle(color: Color(0xFF7C7265), fontSize: 11),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () => _showAssignJobDialog(order, karikars),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.goldDark,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                          child: const Text('ASSIGN', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        const SizedBox(height: 24),
        // Active Job Cards on Workshop floor
        const Text(
          'Artisan Production Tracking',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
        ),
        const SizedBox(height: 12),
        if (activeJobs.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: Text('No active job cards in production', style: TextStyle(color: Colors.black38, fontSize: 12))),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: activeJobs.length,
            itemBuilder: (ctx, idx) {
              final job = activeJobs[idx];
              final itemType = job['jewelryType'] ?? job['category'] ?? (job['items'] != null && job['items'].isNotEmpty ? job['items'][0]['category'] : 'Jewelry');
              final purity = job['purity'] ?? job['carat'] ?? "22K";
              final artisanName = job['karikarName'] ?? "Bhavesh Goldsmith";
              final initials = artisanName.isNotEmpty ? artisanName[0].toUpperCase() : 'A';

              final Color accentColor = purity.contains('24')
                  ? const Color(0xFFD4AF37)
                  : purity.contains('18')
                      ? const Color(0xFFC5A059)
                      : AppTheme.goldDark;

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFECE6DF)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.015),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    decoration: BoxDecoration(
                      border: Border(
                        left: BorderSide(color: accentColor, width: 4.5),
                      ),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: accentColor.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: accentColor.withValues(alpha: 0.2)),
                                  ),
                                  child: Text(
                                    purity,
                                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: accentColor),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  itemType,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF2E2A25)),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEAF5FA),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFB3E5FC)),
                              ),
                              child: const Text(
                                'IN PRODUCTION',
                                style: TextStyle(color: Color(0xFF0288D1), fontSize: 9, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(1.5),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: AppTheme.goldDark.withValues(alpha: 0.3), width: 1.5),
                              ),
                              child: CircleAvatar(
                                radius: 14,
                                backgroundColor: AppTheme.goldDark.withValues(alpha: 0.1),
                                child: Text(
                                  initials,
                                  style: const TextStyle(color: AppTheme.goldDark, fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    artisanName,
                                    style: const TextStyle(color: Color(0xFF2E2A25), fontSize: 12, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Gold Issued: ${job['weight'] ?? 0}g | Alloy: 0.5g',
                                    style: const TextStyle(color: Color(0xFF7C7265), fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                const Row(
                                  children: [
                                    Icon(Icons.calendar_today_outlined, size: 10, color: Colors.black38),
                                    SizedBox(width: 4),
                                    Text(
                                      'DUE DATE',
                                      style: TextStyle(color: Colors.black38, fontSize: 8, fontWeight: FontWeight.bold),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  job['dueDate'] ?? "In 7 Days",
                                  style: const TextStyle(color: Color(0xFFD32F2F), fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
      ],
    );
  }

  Widget _buildVaultCard({
    required String title,
    required String value,
    required IconData icon,
    required List<Color> gradientColors,
    required Color textColor,
    required double progress,
    bool fullWidth = false,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: MouseRegion(
        cursor: onTap != null ? SystemMouseCursors.click : SystemMouseCursors.basic,
        child: Container(
          width: fullWidth ? double.infinity : null,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: gradientColors,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: textColor.withValues(alpha: 0.12), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: textColor.withValues(alpha: 0.08),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.7),
                      shape: BoxShape.circle,
                      border: Border.all(color: textColor.withValues(alpha: 0.1), width: 1),
                    ),
                    child: Icon(icon, color: textColor, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 8.5, color: textColor.withValues(alpha: 0.8), letterSpacing: 1.2),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          value,
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: textColor, fontFamily: 'serif'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Vault Storage capacity: ${(progress * 100).toStringAsFixed(0)}%',
                    style: TextStyle(fontSize: 8.5, color: textColor.withValues(alpha: 0.7), fontWeight: FontWeight.w600),
                  ),
                  Text(
                    'Max limit',
                    style: TextStyle(fontSize: 8.5, color: textColor.withValues(alpha: 0.5)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  backgroundColor: Colors.white.withValues(alpha: 0.5),
                  color: textColor,
                  minHeight: 4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _selectKarigarForPayroll() async {
    final karigars = await DatabaseService.instance.getAllKarigar();
    if (!mounted) return;
    if (karigars.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No Karigars available.'), backgroundColor: Colors.redAccent),
      );
      return;
    }
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFFF9F6F0),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text(
          'Select Karigar for Payroll',
          style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: karigars.length,
            itemBuilder: (context, index) {
              final k = karigars[index];
              return ListTile(
                title: Text(k.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text(k.specialization),
                trailing: const Icon(Icons.chevron_right, size: 18),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(
                    this.context,
                    MaterialPageRoute(
                      builder: (context) => KarigarPayrollScreen(karigar: k),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildUtilityCard({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFECE6DF), width: 1.2),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF4A3E1B).withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFFDF5), Color(0xFFF7EAC4)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFD4AF37).withValues(alpha: 0.35), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFD4AF37).withValues(alpha: 0.08),
                    blurRadius: 8,
                    spreadRadius: 1,
                  ),
                ],
              ),
              child: Icon(icon, color: AppTheme.goldDark, size: 22),
            ),
            const SizedBox(height: 10),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.bold,
                color: Color(0xFF332F28),
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
