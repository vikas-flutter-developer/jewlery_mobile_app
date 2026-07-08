import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/karikar_provider.dart';

class KarikarDashboard extends ConsumerStatefulWidget {
  const KarikarDashboard({super.key});

  @override
  ConsumerState<KarikarDashboard> createState() => _KarikarDashboardState();
}

class _KarikarDashboardState extends ConsumerState<KarikarDashboard> {
  int _currentTabIndex = 0;

  // Controllers for return gold & wastage
  final _returnWeightCtrl = TextEditingController();
  final _returnNoteCtrl = TextEditingController();
  String _selectedReturnPurity = '22K';

  final _wastageReqWeightCtrl = TextEditingController();
  final _wastageScrapWeightCtrl = TextEditingController();
  final _wastageEstWastageCtrl = TextEditingController();
  final _wastageActualWastageCtrl = TextEditingController();
  final _wastageNotesCtrl = TextEditingController();
  String _selectedWastagePurity = '22K';
  String? _selectedWastageJobId;

  // Controllers for profile & password
  final _oldPasswordCtrl = TextEditingController();
  final _newPasswordCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _emergencyContactCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final authState = ref.read(authProvider);
      final userId = authState.user?['id'] ?? authState.user?['_id'];
      if (userId != null) {
        ref.read(karikarProvider.notifier).loadInitialData(userId.toString());
      }
    });
  }

  @override
  void dispose() {
    _returnWeightCtrl.dispose();
    _returnNoteCtrl.dispose();
    _wastageReqWeightCtrl.dispose();
    _wastageScrapWeightCtrl.dispose();
    _wastageEstWastageCtrl.dispose();
    _wastageActualWastageCtrl.dispose();
    _wastageNotesCtrl.dispose();
    _oldPasswordCtrl.dispose();
    _newPasswordCtrl.dispose();
    _addressCtrl.dispose();
    _emergencyContactCtrl.dispose();
    super.dispose();
  }

  void _showReturnGoldDialog(String userId) {
    _returnWeightCtrl.clear();
    _returnNoteCtrl.clear();
    _selectedReturnPurity = '22K';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text(
                'RETURN METAL TO SHOWROOM',
                style: TextStyle(
                  color: AppTheme.goldDark,
                  fontFamily: 'serif',
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Record outgoing metal return to clear pending stock weight balance.',
                      style: TextStyle(color: Colors.black38, fontSize: 11),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _returnWeightCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Returned Gold Weight (Grams)',
                        prefixIcon: Icon(Icons.scale_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedReturnPurity,
                      decoration: const InputDecoration(labelText: 'Gold Purity'),
                      items: ['18K', '22K', '24K'].map((purity) {
                        return DropdownMenuItem<String>(value: purity, child: Text(purity));
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            _selectedReturnPurity = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _returnNoteCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Transaction Note / Reference',
                        prefixIcon: Icon(Icons.note_alt_outlined),
                      ),
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
                    final weight = double.tryParse(_returnWeightCtrl.text) ?? 0.0;
                    final note = _returnNoteCtrl.text.trim();

                    if (weight <= 0) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Please enter a valid weight'), backgroundColor: Colors.redAccent),
                      );
                      return;
                    }

                    final success = await ref.read(karikarProvider.notifier).returnMetal(
                          weight: weight,
                          purity: _selectedReturnPurity,
                          note: note.isEmpty ? 'Returned gold stock' : note,
                          karikarId: userId,
                        );

                    if (success) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Metal Return Recorded Successfully!'), backgroundColor: AppTheme.goldDark),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
                  child: const Text('SUBMIT RETURN', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showClaimWastageDialog(String userId, List<dynamic> jobs) {
    _wastageReqWeightCtrl.clear();
    _wastageScrapWeightCtrl.clear();
    _wastageEstWastageCtrl.clear();
    _wastageActualWastageCtrl.clear();
    _wastageNotesCtrl.clear();
    _selectedWastagePurity = '22K';
    _selectedWastageJobId = jobs.isNotEmpty ? (jobs.first['_id'] ?? jobs.first['id'] ?? jobs.first['orderId']).toString() : null;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text(
                'CLAIM WASTAGE RECONCILIATION',
                style: TextStyle(
                  color: AppTheme.goldDark,
                  fontFamily: 'serif',
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Request wastage reconciliation audit for completed artisan tasks.',
                      style: TextStyle(color: Colors.black38, fontSize: 11),
                    ),
                    const SizedBox(height: 16),
                    if (jobs.isNotEmpty) ...[
                      DropdownButtonFormField<String>(
                        value: _selectedWastageJobId,
                        decoration: const InputDecoration(labelText: 'Associate Work Order'),
                        items: jobs.map<DropdownMenuItem<String>>((job) {
                          final label = 'Order #${job['orderId'] ?? job['_id']} (${job['jewelryType'] ?? "Jewelry"})';
                          return DropdownMenuItem<String>(
                            value: (job['_id'] ?? job['id'] ?? job['orderId']).toString(),
                            child: Text(label, style: const TextStyle(fontSize: 12)),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setDialogState(() {
                            _selectedWastageJobId = val;
                          });
                        },
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextField(
                      controller: _wastageReqWeightCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Issued Metal Weight (Grams)',
                        prefixIcon: Icon(Icons.scale_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedWastagePurity,
                      decoration: const InputDecoration(labelText: 'Gold Purity'),
                      items: ['18K', '22K', '24K'].map((purity) {
                        return DropdownMenuItem<String>(value: purity, child: Text(purity));
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            _selectedWastagePurity = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _wastageScrapWeightCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Scrap Returned Weight (Grams)',
                        prefixIcon: Icon(Icons.recycling_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _wastageEstWastageCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Estimated Allowed Wastage (Grams)',
                        prefixIcon: Icon(Icons.percent_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _wastageActualWastageCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Actual Loss/Wastage (Grams)',
                        prefixIcon: Icon(Icons.trending_down_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _wastageNotesCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Artisan Notes',
                        prefixIcon: Icon(Icons.description_outlined),
                      ),
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
                    final reqWeight = double.tryParse(_wastageReqWeightCtrl.text) ?? 0.0;
                    final scrapWeight = double.tryParse(_wastageScrapWeightCtrl.text) ?? 0.0;
                    final estWastage = double.tryParse(_wastageEstWastageCtrl.text) ?? 0.0;
                    final actualWastage = double.tryParse(_wastageActualWastageCtrl.text) ?? 0.0;
                    final notes = _wastageNotesCtrl.text.trim();

                    if (reqWeight <= 0) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Please enter valid issued weight'), backgroundColor: Colors.redAccent),
                      );
                      return;
                    }

                    // Find orderId/jobId association
                    String? jobId = _selectedWastageJobId;
                    String? orderId;
                    if (jobId != null && jobs.isNotEmpty) {
                      final targetJob = jobs.firstWhere(
                        (j) => (j['_id'] ?? j['id'] ?? j['orderId']).toString() == jobId,
                        orElse: () => null,
                      );
                      if (targetJob != null) {
                        orderId = (targetJob['orderId'] ?? targetJob['_id']).toString();
                      }
                    }

                    final success = await ref.read(karikarProvider.notifier).claimWastage(
                          requestedWeight: reqWeight,
                          purity: _selectedWastagePurity,
                          scrapWeight: scrapWeight,
                          estimatedWastage: estWastage,
                          actualWastage: actualWastage,
                          calculatedLoss: actualWastage - estWastage,
                          notes: notes,
                          karikarId: userId,
                          jobId: jobId,
                          orderId: orderId,
                        );

                    if (success) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Wastage Reconciliation Claim Submitted!'), backgroundColor: AppTheme.goldDark),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
                  child: const Text('SUBMIT CLAIM', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showChangePasswordDialog() {
    _oldPasswordCtrl.clear();
    _newPasswordCtrl.clear();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFFF9F6F0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text(
            'CHANGE ACCOUNT PASSWORD',
            style: TextStyle(
              color: AppTheme.goldDark,
              fontFamily: 'serif',
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.0,
            ),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _oldPasswordCtrl,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Old Password', prefixIcon: Icon(Icons.lock_outline)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _newPasswordCtrl,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'New Password', prefixIcon: Icon(Icons.lock_reset_outlined)),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('CANCEL', style: TextStyle(color: Colors.black45, fontWeight: FontWeight.bold)),
            ),
            ElevatedButton(
              onPressed: () async {
                final oldP = _oldPasswordCtrl.text.trim();
                final newP = _newPasswordCtrl.text.trim();
                if (oldP.isEmpty || newP.isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Please fill all fields'), backgroundColor: Colors.redAccent),
                  );
                  return;
                }

                final success = await ref.read(karikarProvider.notifier).changePassword(oldP, newP);
                if (success) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Password updated successfully!'), backgroundColor: AppTheme.goldDark),
                  );
                } else {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Failed to update password.'), backgroundColor: Colors.redAccent),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
              child: const Text('UPDATE PASSWORD', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _showEditProfileDialog(Map<String, dynamic>? profile) {
    _addressCtrl.text = profile?['address'] ?? '';
    _emergencyContactCtrl.text = profile?['emergencyContact'] ?? '';

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFFF9F6F0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text(
            'UPDATE CONTACT DETAILS',
            style: TextStyle(
              color: AppTheme.goldDark,
              fontFamily: 'serif',
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.0,
            ),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _emergencyContactCtrl,
                decoration: const InputDecoration(labelText: 'Emergency Contact Number', prefixIcon: Icon(Icons.phone_outlined)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _addressCtrl,
                decoration: const InputDecoration(labelText: 'Workshop / Residential Address', prefixIcon: Icon(Icons.map_outlined)),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('CANCEL', style: TextStyle(color: Colors.black45, fontWeight: FontWeight.bold)),
            ),
            ElevatedButton(
              onPressed: () async {
                final success = await ref.read(karikarProvider.notifier).updateProfile({
                  'emergencyContact': _emergencyContactCtrl.text.trim(),
                  'address': _addressCtrl.text.trim(),
                });
                if (success) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Profile updated successfully!'), backgroundColor: AppTheme.goldDark),
                  );
                } else {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Failed to update profile details.'), backgroundColor: Colors.redAccent),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
              child: const Text('SAVE DETAILS', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final karikarState = ref.watch(karikarProvider);

    final userId = (authState.user?['id'] ?? authState.user?['_id'] ?? '').toString();
    final name = authState.user?['name'] ?? 'Artisan';

    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'ARTISAN WORKSHOP',
              style: TextStyle(
                color: AppTheme.goldDark,
                fontFamily: 'serif',
                fontSize: 16,
                fontWeight: FontWeight.bold,
                letterSpacing: 2.0,
              ),
            ),
            Text(
              'ARTISAN: ${name.toUpperCase()}',
              style: const TextStyle(color: Colors.black38, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1.0),
            ),
          ],
        ),
        actions: [
          // Notifications Drawer Badge
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: AppTheme.goldDark),
                onPressed: () {
                  _showNotificationsBottomSheet(karikarState.notifications);
                },
              ),
              if (karikarState.notifications.isNotEmpty)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(color: Colors.redAccent, shape: BoxShape.circle),
                    child: Text(
                      '${karikarState.notifications.length}',
                      style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppTheme.goldDark),
            tooltip: 'Sign Out',
            onPressed: () {
              ref.read(authProvider.notifier).logout();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          if (userId.isNotEmpty) {
            await ref.read(karikarProvider.notifier).loadInitialData(userId);
          }
        },
        color: AppTheme.goldDark,
        child: karikarState.isLoading && karikarState.jobCards.isEmpty
            ? const Center(child: CircularProgressIndicator(color: AppTheme.goldDark))
            : IndexedStack(
                index: _currentTabIndex,
                children: [
                  _buildWorkshopTab(userId, karikarState),
                  _buildHistoryTab(karikarState),
                  _buildProfileTab(karikarState),
                ],
              ),
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Color(0xFFECE6DF), width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentTabIndex,
          backgroundColor: const Color(0xFFF9F6F0),
          selectedItemColor: AppTheme.goldDark,
          unselectedItemColor: Colors.black38,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: 0.5),
          unselectedLabelStyle: const TextStyle(fontSize: 10),
          onTap: (index) {
            setState(() {
              _currentTabIndex = index;
            });
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.engineering_outlined),
              activeIcon: Icon(Icons.engineering),
              label: 'Workshop',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.history_outlined),
              activeIcon: Icon(Icons.history),
              label: 'History Logs',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline_rounded),
              activeIcon: Icon(Icons.person_rounded),
              label: 'My Account',
            ),
          ],
        ),
      ),
    );
  }

  // TAB 1: Main Workshop dashboard
  Widget _buildWorkshopTab(String userId, KarikarState state) {
    final goldBalance = state.goldStock;
    final ledgerBalance = state.ledgerBalance;
    final jobs = state.jobCards;
    
    // Filter active jobs on floor
    final activeJobs = jobs.where((job) {
      final status = (job['status'] ?? '').toString().toUpperCase();
      return status != 'RECEIVED' && status != 'COMPLETED' && status != 'CLOSED';
    }).toList();

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (state.error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: Colors.redAccent.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.redAccent.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.redAccent, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      state.error!,
                      style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Balance scorecards
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFECE6DF), width: 1.2),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'PENDING METAL',
                        style: TextStyle(color: AppTheme.goldDark, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1.0),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${goldBalance.toStringAsFixed(3)} g',
                        style: const TextStyle(color: Color(0xFF4A3E1B), fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'serif'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFECE6DF), width: 1.2),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'LEDGER BALANCE',
                        style: TextStyle(color: AppTheme.goldDark, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1.0),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '₹${ledgerBalance.toStringAsFixed(2)}',
                        style: const TextStyle(color: Color(0xFF4A3E1B), fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'serif'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),

          // Active Job Sheets section
          Row(
            children: [
              const Text('Active Job Sheets', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif')),
              const SizedBox(width: 8),
              Expanded(child: Container(height: 1, color: AppTheme.goldMetallic.withValues(alpha: 0.2))),
            ],
          ),
          const SizedBox(height: 16),

          if (activeJobs.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 40),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFECE6DF)),
              ),
              child: const Center(
                child: Column(
                  children: [
                    Icon(Icons.engineering_outlined, size: 36, color: Colors.black26),
                    SizedBox(height: 10),
                    Text('No active job orders assigned to you.', style: TextStyle(color: Colors.black38, fontSize: 13, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: activeJobs.length,
              itemBuilder: (ctx, idx) {
                final job = activeJobs[idx];
                final id = job['orderId'] ?? job['_id'] ?? 'N/A';
                final details = job['jewelryType'] ?? job['category'] ?? 'Jewelry Item';
                final purity = job['purity'] ?? job['issuedPurity'] ?? '22K';
                final weight = (job['issuedGoldWeight'] ?? job['weight'] ?? 0).toDouble();
                final date = job['dueDate'] ?? 'Soon';

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _buildJobCard(
                    jobNumber: id.toString(),
                    description: '$details ($purity)',
                    metaInfo: 'Issued: ${weight.toStringAsFixed(3)}g | Due: $date',
                  ),
                );
              },
            ),
          const SizedBox(height: 32),

          // Quick actions
          Row(
            children: [
              const Text('Artisan Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif')),
              const SizedBox(width: 8),
              Expanded(child: Container(height: 1, color: AppTheme.goldMetallic.withValues(alpha: 0.2))),
            ],
          ),
          const SizedBox(height: 16),

          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _showReturnGoldDialog(userId),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppTheme.goldDark,
                    side: const BorderSide(color: AppTheme.goldDark, width: 1.2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    elevation: 0,
                  ),
                  icon: const Icon(Icons.scale, size: 20),
                  label: const Text('Return Gold', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 0.5)),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _showClaimWastageDialog(userId, activeJobs),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.goldDark,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    elevation: 1,
                  ),
                  icon: const Icon(Icons.warning_amber_rounded, size: 20),
                  label: const Text('Claim Wastage', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 0.5)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // TAB 2: Historical logs
  Widget _buildHistoryTab(KarikarState state) {
    final jobs = state.jobCards;
    final completedJobs = jobs.where((job) {
      final status = (job['status'] ?? '').toString().toUpperCase();
      return status == 'RECEIVED' || status == 'COMPLETED' || status == 'CLOSED';
    }).toList();

    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          const TabBar(
            indicatorColor: AppTheme.goldDark,
            labelColor: AppTheme.goldDark,
            unselectedLabelColor: Colors.black38,
            labelStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 10, letterSpacing: 0.5),
            tabs: [
              Tab(text: 'METAL RETURNS', icon: Icon(Icons.scale_outlined, size: 18)),
              Tab(text: 'WASTAGE CLAIMS', icon: Icon(Icons.history_toggle_off_outlined, size: 18)),
              Tab(text: 'COMPLETED JOBS', icon: Icon(Icons.done_all_outlined, size: 18)),
            ],
          ),
          Expanded(
            child: Container(
              color: Colors.white.withValues(alpha: 0.3),
              child: TabBarView(
                children: [
                  _buildReturnsListView(state.metalReturns),
                  _buildWastageListView(state.wastageReconciliations),
                  _buildCompletedJobsListView(completedJobs),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // TAB 3: Profile view & password management
  Widget _buildProfileTab(KarikarState state) {
    final profile = state.profile ?? state.selfServiceData?['karikar'] ?? {};
    final skills = (profile['skills'] as List<dynamic>?)?.map((s) => s.toString()).toList() ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Profile header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFECE6DF)),
            ),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: AppTheme.goldMetallic.withValues(alpha: 0.1),
                  child: const Icon(Icons.person, size: 40, color: AppTheme.goldDark),
                ),
                const SizedBox(height: 12),
                Text(
                  (profile['name'] ?? 'Bhavesh Goldsmith').toString().toUpperCase(),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
                ),
                Text(
                  profile['specialization'] ?? 'Master Craftsman / Goldsmith',
                  style: const TextStyle(color: Colors.black45, fontSize: 11, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Detail cards
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFECE6DF)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Artisan Details', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.goldDark, letterSpacing: 0.5)),
                const SizedBox(height: 12),
                _buildProfileRow(Icons.email_outlined, 'Email', profile['email'] ?? 'bhavesh_karigar@gmail.com'),
                _buildProfileRow(Icons.phone_android_outlined, 'Phone', profile['phone'] ?? '+91-9000100021'),
                _buildProfileRow(Icons.contact_phone_outlined, 'Emergency Contact', profile['emergencyContact'] ?? 'Not specified'),
                _buildProfileRow(Icons.location_on_outlined, 'Address', profile['address'] ?? 'Main Factory HQ'),
                if (skills.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Certified Skills', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black38)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    children: skills.map((s) => Chip(
                      label: Text(s, style: const TextStyle(fontSize: 10, color: AppTheme.goldDark, fontWeight: FontWeight.bold)),
                      backgroundColor: AppTheme.goldLight.withValues(alpha: 0.1),
                      side: BorderSide.none,
                      padding: EdgeInsets.zero,
                    )).toList(),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Login session details
          if (state.sessions.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFECE6DF)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Active Device Sessions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.goldDark, letterSpacing: 0.5)),
                  const SizedBox(height: 10),
                  ...state.sessions.take(2).map((s) => Padding(
                    padding: const EdgeInsets.only(bottom: 6.0),
                    child: Row(
                      children: [
                        const Icon(Icons.devices_outlined, size: 16, color: Colors.black38),
                        const SizedBox(width: 8),
                        Text(
                          'IP: ${s['ip'] ?? "Localhost"} | Last Seen: ${s['lastSeenAt']?.split('T')[0] ?? "Today"}',
                          style: const TextStyle(fontSize: 11, color: Colors.black54),
                        ),
                      ],
                    ),
                  )),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Account settings
          ElevatedButton.icon(
            onPressed: () => _showEditProfileDialog(profile),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppTheme.goldDark,
              side: const BorderSide(color: AppTheme.goldDark, width: 1.2),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              padding: const EdgeInsets.symmetric(vertical: 14),
              elevation: 0,
            ),
            icon: const Icon(Icons.edit_note_outlined),
            label: const Text('Update Contact Info', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
          const SizedBox(height: 10),
          ElevatedButton.icon(
            onPressed: _showChangePasswordDialog,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Colors.redAccent,
              side: const BorderSide(color: Colors.redAccent, width: 1.2),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              padding: const EdgeInsets.symmetric(vertical: 14),
              elevation: 0,
            ),
            icon: const Icon(Icons.vpn_key_outlined),
            label: const Text('Change Password', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppTheme.goldDark),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, color: Colors.black38, fontWeight: FontWeight.bold)),
                Text(value, style: const TextStyle(fontSize: 13, color: Color(0xFF2E2A25), fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Returns list widget
  Widget _buildReturnsListView(List<dynamic> returns) {
    if (returns.isEmpty) {
      return const Center(child: Text('No metal returns log found.', style: TextStyle(color: Colors.black38, fontSize: 12)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: returns.length,
      itemBuilder: (ctx, idx) {
        final r = returns[idx];
        final wt = (r['weight'] ?? 0).toDouble();
        final purity = r['purity'] ?? '22K';
        final status = (r['status'] ?? 'COMPLETED').toString().toUpperCase();
        final note = r['note'] ?? 'Gold metal return';
        final date = r['returnedAt'] ?? r['createdAt'] ?? 'N/A';
        final displayDate = date.toString().contains('T') ? date.toString().split('T')[0] : date.toString();

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFECE6DF)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Returned Weight: ${wt.toStringAsFixed(3)}g ($purity)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 4),
                    Text('Ref: $note\nDate: $displayDate', style: const TextStyle(color: Colors.black45, fontSize: 11, height: 1.3)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: status == 'PENDING' ? Colors.orange.withValues(alpha: 0.08) : Colors.green.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status,
                  style: TextStyle(color: status == 'PENDING' ? Colors.orange : Colors.green, fontSize: 9, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // Wastage list widget
  Widget _buildWastageListView(List<dynamic> claims) {
    if (claims.isEmpty) {
      return const Center(child: Text('No wastage reconciliation claims.', style: TextStyle(color: Colors.black38, fontSize: 12)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: claims.length,
      itemBuilder: (ctx, idx) {
        final c = claims[idx];
        final issue = (c['requestedWeight'] ?? 0).toDouble();
        final actual = (c['actualWastage'] ?? 0).toDouble();
        final scrap = (c['scrapWeight'] ?? 0).toDouble();
        final status = (c['status'] ?? 'PENDING').toString().toUpperCase();
        final date = c['createdAt'] ?? 'N/A';
        final displayDate = date.toString().contains('T') ? date.toString().split('T')[0] : date.toString();

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFECE6DF)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Order #${c['orderId'] ?? "N/A"} Audit Claim', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 4),
                    Text(
                      'Issued: ${issue.toStringAsFixed(3)}g | Scrap: ${scrap.toStringAsFixed(3)}g\nActual Wastage Loss: ${actual.toStringAsFixed(3)}g\nDate: $displayDate',
                      style: const TextStyle(color: Colors.black45, fontSize: 11, height: 1.3),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: status == 'APPROVED' ? Colors.green.withValues(alpha: 0.08) : Colors.orange.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status,
                  style: TextStyle(color: status == 'APPROVED' ? Colors.green : Colors.orange, fontSize: 9, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // Completed jobs list widget
  Widget _buildCompletedJobsListView(List<dynamic> completed) {
    if (completed.isEmpty) {
      return const Center(child: Text('No completed jobs found.', style: TextStyle(color: Colors.black38, fontSize: 12)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: completed.length,
      itemBuilder: (ctx, idx) {
        final job = completed[idx];
        final id = job['orderId'] ?? job['_id'] ?? 'N/A';
        final details = job['jewelryType'] ?? job['category'] ?? 'Jewelry Item';
        final purity = job['purity'] ?? job['issuedPurity'] ?? '22K';
        final weight = (job['issuedGoldWeight'] ?? job['weight'] ?? 0).toDouble();

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFECE6DF)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.08), shape: BoxShape.circle),
                child: const Icon(Icons.verified_outlined, color: Colors.green, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Job Order #$id', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 2),
                    Text('$details ($purity) | Metal: ${weight.toStringAsFixed(3)}g', style: const TextStyle(color: Colors.black45, fontSize: 11)),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // Notifications Drawer bottom sheet
  void _showNotificationsBottomSheet(List<dynamic> notifications) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'NOTIFICATIONS',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.goldDark, letterSpacing: 1.0, fontFamily: 'serif'),
                      ),
                      if (notifications.isNotEmpty)
                        TextButton(
                          onPressed: () async {
                            final ok = await ref.read(karikarProvider.notifier).markNotificationsRead();
                            if (ok) {
                              setModalState(() {
                                notifications = [];
                              });
                              Navigator.pop(ctx);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Notifications Tallied!'), backgroundColor: AppTheme.goldDark),
                              );
                            }
                          },
                          child: const Text('MARK READ', style: TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold, fontSize: 12)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (notifications.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40.0),
                      child: Center(
                        child: Column(
                          children: [
                            Icon(Icons.notifications_off_outlined, color: Colors.black26, size: 36),
                            SizedBox(height: 8),
                            Text('You have no unread notifications.', style: TextStyle(color: Colors.black38, fontSize: 12)),
                          ],
                        ),
                      ),
                    )
                  else
                    Expanded(
                      child: ListView.builder(
                        itemCount: notifications.length,
                        itemBuilder: (context, idx) {
                          final n = notifications[idx];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFECE6DF)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.info_outline, color: AppTheme.goldDark, size: 18),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        n['message'] ?? 'Alert received.',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        n['createdAt']?.split('T')[0] ?? 'Today',
                                        style: const TextStyle(color: Colors.black38, fontSize: 9),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildJobCard({
    required String jobNumber,
    required String description,
    required String metaInfo,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFECE6DF), width: 1),
      ),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: AppTheme.goldMetallic.withValues(alpha: 0.08), shape: BoxShape.circle),
          child: const Icon(Icons.engineering_outlined, color: AppTheme.goldDark, size: 22),
        ),
        title: Text(
          'Job Order #$jobNumber',
          style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25), fontSize: 14),
        ),
        subtitle: Text(
          '$description\n$metaInfo',
          style: const TextStyle(color: Colors.black45, fontSize: 11, height: 1.4),
        ),
        isThreeLine: true,
      ),
    );
  }
}
