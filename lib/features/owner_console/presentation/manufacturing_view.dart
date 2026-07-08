import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/admin_provider.dart';

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
        // Vault Metal Holdings Summary
        Row(
          children: [
            Expanded(
              child: _buildVaultCard(
                title: 'GOLD VAULT',
                value: '${goldVaultWeight.toStringAsFixed(1)} g',
                icon: Icons.auto_awesome,
                color: const Color(0xFFF9F1D6),
                textColor: const Color(0xFF8C6D15),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildVaultCard(
                title: 'SILVER VAULT',
                value: '${silverVaultWeight.toStringAsFixed(0)} g',
                icon: Icons.circle,
                color: const Color(0xFFEFEFEF),
                textColor: const Color(0xFF666666),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _buildVaultCard(
          title: 'LOOSE DIAMONDS',
          value: '${diamondsCarats.toStringAsFixed(2)} Carats',
          icon: Icons.diamond_outlined,
          color: const Color(0xFFEAF5FA),
          textColor: const Color(0xFF1E82A8),
          fullWidth: true,
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
              
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFECE6DF)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$itemType (${order['purity'] ?? order['carat'] ?? "22K"})',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Estimated gold: ${order['weight'] ?? 0}g | Client: ${order['customerName'] ?? "Retail Showroom"}',
                            style: const TextStyle(color: Colors.black45, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => _showAssignJobDialog(order, karikars),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.goldDark,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('ASSIGN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ],
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

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFECE6DF)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '$itemType (${job['purity'] ?? job['carat'] ?? "22K"})',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.blue.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'IN PRODUCTION',
                            style: TextStyle(color: Colors.blueAccent, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Artisan: ${job['karikarName'] ?? "Bhavesh Goldsmith"}',
                      style: const TextStyle(color: Colors.black54, fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Gold Issued: ${job['weight'] ?? 0}g | Alloy: 0.5g | Due Date: ${job['dueDate'] ?? "In 7 Days"}',
                      style: const TextStyle(color: Colors.black45, fontSize: 11),
                    ),
                  ],
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
    required Color color,
    required Color textColor,
    bool fullWidth = false,
  }) {
    return Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: textColor.withValues(alpha: 0.2)),
        boxShadow: [
          BoxShadow(
            color: textColor.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.5),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: textColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 9, color: textColor, letterSpacing: 1.0),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: textColor.withValues(alpha: 0.9), fontFamily: 'serif'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
