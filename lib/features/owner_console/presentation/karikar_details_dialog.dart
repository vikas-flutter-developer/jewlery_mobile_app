import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/admin_provider.dart';

class KarikarDetailsDialog extends ConsumerWidget {
  final Map<String, dynamic> staffMember;

  const KarikarDetailsDialog({
    super.key,
    required this.staffMember,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final adminState = ref.watch(adminProvider);
    final details = adminState.selectedKarikarDetails;
    
    final name = staffMember['name'] ?? 'Artisan';
    final email = staffMember['email'] ?? '';
    final phone = staffMember['phone'] ?? '';

    // Handle loading state
    if (adminState.isLoading && details == null) {
      return const AlertDialog(
        backgroundColor: Color(0xFFF9F6F0),
        content: SizedBox(
          height: 100,
          child: Center(
            child: CircularProgressIndicator(color: AppTheme.goldDark),
          ),
        ),
      );
    }

    final karikarObj = details?['karikar'] ?? {};
    final jobCards = details?['jobCards'] as List<dynamic>? ?? [];
    final metalReturns = details?['metalReturns'] as List<dynamic>? ?? [];
    final goldStock = (details?['goldStock'] ?? karikarObj['goldStock'] ?? 0).toDouble();
    final ledgerBalance = (details?['ledgerBalance'] ?? karikarObj['ledgerBalance'] ?? 0).toDouble();

    // Stats calculations
    final activeJobs = jobCards.where((j) => (j['status'] ?? '').toString().toUpperCase() != 'RECEIVED').toList();
    final completedJobs = jobCards.where((j) => (j['status'] ?? '').toString().toUpperCase() == 'RECEIVED').toList();

    return Dialog(
      backgroundColor: const Color(0xFFF9F6F0),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 600),
        child: DefaultTabController(
          length: 3,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header profile card
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.goldMetallic.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.engineering,
                        color: AppTheme.goldDark,
                        size: 32,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name.toUpperCase(),
                            style: const TextStyle(
                              color: AppTheme.goldDark,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.0,
                              fontFamily: 'serif',
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Specialist Goldsmith | Phone: $phone',
                            style: const TextStyle(color: Colors.black54, fontSize: 11),
                          ),
                          Text(
                            email,
                            style: const TextStyle(color: Colors.black38, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.black45),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),

              // Outstanding scorecards
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFECE6DF)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'GOLD IN HAND',
                              style: TextStyle(color: AppTheme.goldDark, fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${goldStock.toStringAsFixed(3)} g',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontSize: 14),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFECE6DF)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'WAGE LEDGER',
                              style: TextStyle(color: AppTheme.goldDark, fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '₹${ledgerBalance.toStringAsFixed(2)}',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontSize: 14),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // TabBar definition
              const TabBar(
                indicatorColor: AppTheme.goldDark,
                labelColor: AppTheme.goldDark,
                unselectedLabelColor: Colors.black38,
                labelStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: 0.5),
                tabs: [
                  Tab(text: 'ACTIVE JOBS'),
                  Tab(text: 'RETURNS LOG'),
                  Tab(text: 'WAGE SESSIONS'),
                ],
              ),

              // Tab views
              Container(
                height: 300,
                color: Colors.white.withValues(alpha: 0.4),
                child: TabBarView(
                  children: [
                    // Active jobs list
                    _buildActiveJobsTab(activeJobs, completedJobs),

                    // Returns historical logs list
                    _buildReturnsTab(metalReturns),

                    // Wage settlements/ledgers list
                    _buildSettlementsTab(details?['settlements'] as List<dynamic>? ?? []),
                  ],
                ),
              ),

              // Bottom control actions
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: Color(0xFFECE6DF))),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('CLOSE', style: TextStyle(color: Colors.black54, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActiveJobsTab(List<dynamic> active, List<dynamic> completed) {
    if (active.isEmpty && completed.isEmpty) {
      return const Center(
        child: Text('No job cards assigned to this artisan', style: TextStyle(color: Colors.black38, fontSize: 12)),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (active.isNotEmpty) ...[
          const Text('CURRENT ASSIGNMENTS', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black45, fontSize: 9, letterSpacing: 0.5)),
          const SizedBox(height: 8),
          ...active.map((j) => _buildJobRow(j, isActive: true)),
          const SizedBox(height: 16),
        ],
        if (completed.isNotEmpty) ...[
          const Text('COMPLETED HISTORY', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black45, fontSize: 9, letterSpacing: 0.5)),
          const SizedBox(height: 8),
          ...completed.map((j) => _buildJobRow(j, isActive: false)),
        ],
      ],
    );
  }

  Widget _buildJobRow(dynamic job, {required bool isActive}) {
    final status = (job['status'] ?? 'OPEN').toString().toUpperCase();
    final weight = (job['issuedGoldWeight'] ?? job['weight'] ?? 0).toDouble();
    final purity = job['purity'] ?? job['issuedPurity'] ?? '22K';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
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
                  'Order #${job['orderId'] ?? job['_id'] ?? 'N/A'}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black87),
                ),
                const SizedBox(height: 2),
                Text(
                  'Issued weight: ${weight.toStringAsFixed(3)}g ($purity) | Due: ${job['dueDate'] ?? "N/A"}',
                  style: const TextStyle(color: Colors.black45, fontSize: 10),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: isActive ? Colors.blue.withValues(alpha: 0.08) : Colors.green.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              status,
              style: TextStyle(
                color: isActive ? Colors.blue : Colors.green,
                fontSize: 8,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReturnsTab(List<dynamic> returns) {
    if (returns.isEmpty) {
      return const Center(
        child: Text('No metal return records found', style: TextStyle(color: Colors.black38, fontSize: 12)),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: returns.length,
      itemBuilder: (ctx, idx) {
        final r = returns[idx];
        final wt = (r['weight'] ?? 0).toDouble();
        final purity = r['purity'] ?? '22K';
        final status = (r['status'] ?? 'COMPLETED').toString().toUpperCase();
        final date = r['returnedAt'] ?? r['createdAt'] ?? 'N/A';
        final displayDate = date.toString().contains('T') ? date.toString().split('T')[0] : date.toString();

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
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
                      'Returned weight: ${wt.toStringAsFixed(3)}g ($purity)',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black87),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Date: $displayDate | Note: ${r['note'] ?? ""}',
                      style: const TextStyle(color: Colors.black45, fontSize: 10),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: status == 'PENDING' ? Colors.orange.withValues(alpha: 0.08) : Colors.green.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    color: status == 'PENDING' ? Colors.orange : Colors.green,
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSettlementsTab(List<dynamic> settlements) {
    if (settlements.isEmpty) {
      return const Center(
        child: Text('No wage transactions found', style: TextStyle(color: Colors.black38, fontSize: 12)),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: settlements.length,
      itemBuilder: (ctx, idx) {
        final s = settlements[idx];
        final amt = (s['amount'] ?? 0).toDouble();
        final type = (s['type'] ?? 'PAYMENT').toString().toUpperCase();
        final method = s['paymentMethod'] ?? 'CASH';
        final date = s['createdAt'] ?? 'N/A';
        final displayDate = date.toString().contains('T') ? date.toString().split('T')[0] : date.toString();

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
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
                      '₹${amt.toStringAsFixed(2)} | Method: $method',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black87),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Date: $displayDate | Note: ${s['note'] ?? ""}',
                      style: const TextStyle(color: Colors.black45, fontSize: 10),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: type == 'DEBIT' ? Colors.redAccent.withValues(alpha: 0.08) : Colors.green.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  type,
                  style: TextStyle(
                    color: type == 'DEBIT' ? Colors.redAccent : Colors.green,
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
