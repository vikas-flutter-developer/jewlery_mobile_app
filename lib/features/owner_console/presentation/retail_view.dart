import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/admin_provider.dart';

class RetailView extends ConsumerStatefulWidget {
  const RetailView({super.key});

  @override
  ConsumerState<RetailView> createState() => _RetailViewState();
}

class _RetailViewState extends ConsumerState<RetailView> {
  final _loanNameController = TextEditingController();
  final _loanPhoneController = TextEditingController();
  final _loanWeightController = TextEditingController();
  final _loanAmountController = TextEditingController();
  double _loanPurity = 22.0;

  @override
  void dispose() {
    _loanNameController.dispose();
    _loanPhoneController.dispose();
    _loanWeightController.dispose();
    _loanAmountController.dispose();
    super.dispose();
  }

  void _showGoldLoanDialog() {
    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text(
                'NEW GOLD LOAN CONTRACT',
                style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1.0),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: _loanNameController,
                      decoration: const InputDecoration(labelText: 'Customer Name', prefixIcon: Icon(Icons.person_outline)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _loanPhoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Customer Phone', prefixIcon: Icon(Icons.phone_outlined)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _loanWeightController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Gold Net Weight (Grams)', prefixIcon: Icon(Icons.scale_outlined)),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Text('Gold Purity:  ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black54)),
                        ...[18, 22, 24].map((purity) {
                          final isSel = _loanPurity == purity.toDouble();
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              label: Text('${purity}K'),
                              selected: isSel,
                              selectedColor: AppTheme.goldDark,
                              labelStyle: TextStyle(color: isSel ? Colors.white : Colors.black87, fontWeight: FontWeight.bold, fontSize: 11),
                              onSelected: (val) {
                                if (val) {
                                  setDialogState(() {
                                    _loanPurity = purity.toDouble();
                                  });
                                }
                              },
                            ),
                          );
                        }),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _loanAmountController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Requested Loan Amount (₹)', prefixIcon: Icon(Icons.currency_rupee_outlined)),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('CANCEL', style: TextStyle(color: Colors.black45, fontWeight: FontWeight.bold)),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final name = _loanNameController.text.trim();
                    final phone = _loanPhoneController.text.trim();
                    final weight = double.tryParse(_loanWeightController.text) ?? 0.0;
                    final amount = double.tryParse(_loanAmountController.text) ?? 0.0;

                    if (name.isEmpty || phone.isEmpty || weight <= 0 || amount <= 0) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Please fill all fields correctly'), backgroundColor: Colors.redAccent),
                      );
                      return;
                    }

                    final success = await ref.read(adminProvider.notifier).createGoldLoan(
                          name: name,
                          phone: phone,
                          grossWeight: weight,
                          netWeight: weight,
                          goldPurity: _loanPurity,
                          loanAmount: amount,
                        );

                    if (success) {
                      _loanNameController.clear();
                      _loanPhoneController.clear();
                      _loanWeightController.clear();
                      _loanAmountController.clear();
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Gold Loan Contract Registered Successfully!'), backgroundColor: AppTheme.goldDark),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
                  child: const Text('SUBMIT CONTRACT', style: TextStyle(fontWeight: FontWeight.bold)),
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
    final activeBranch = adminState.activeBranch;
    final branchCode = activeBranch?['code'] ?? 'MAIN';

    // Filter transfers matching the active branch code
    final activeTransfers = adminState.transfers.where((t) {
      return t['fromBranchCode'] == branchCode || t['toBranchCode'] == branchCode;
    }).toList();

    // Filter gold loans
    final activeLoans = adminState.goldLoans;

    // Daily revenue calculation from sales
    double todaySalesTotal = 1245690.00;
    int invoicesCount = 24;
    if (branchCode == 'DELHI') {
      todaySalesTotal = 59740.00;
      invoicesCount = 1;
    } else if (branchCode == 'BLR') {
      todaySalesTotal = 149350.00;
      invoicesCount = 1;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Consolidated Revenue Card
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppTheme.goldMetallic.withValues(alpha: 0.35), width: 1.2),
            gradient: const LinearGradient(
              colors: [Color(0xFFFFFDF9), Color(0xFFF5EAC3)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: AppTheme.goldDark.withValues(alpha: 0.08),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'DAILY RETAIL SALES SUMMARY - $branchCode',
                    style: const TextStyle(
                      color: AppTheme.goldDark,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2.0,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.goldMetallic.withValues(alpha: 0.2)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.trending_up, color: Colors.green, size: 12),
                        SizedBox(width: 4),
                        Text('+14.2%', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                '₹${todaySalesTotal.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: Color(0xFF4A3E1B),
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                  fontFamily: 'serif',
                ),
              ),
              const SizedBox(height: 16),
              const Divider(color: Colors.black12, height: 1),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Cleared Invoices', style: TextStyle(color: Colors.black38, fontSize: 11)),
                      const SizedBox(height: 2),
                      Text('$invoicesCount Sales Completed', style: const TextStyle(color: Colors.black87, fontSize: 13, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('Showroom Gold Rate (22K)', style: TextStyle(color: Colors.black38, fontSize: 11)),
                      const SizedBox(height: 2),
                      Text(
                        '₹${(adminState.rates.firstWhere((r) => r['metal'] == 'GOLD_22K', orElse: () => {'rate': 7250})['rate'] ?? 7250).toString()} / g',
                        style: const TextStyle(color: AppTheme.goldDark, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 28),

        // Live rates management & sliders
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Showroom Daily Markups',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            IconButton(
              icon: const Icon(Icons.sync, color: AppTheme.goldDark),
              tooltip: 'Sync IBJA Rates',
              onPressed: () async {
                final ok = await ref.read(adminProvider.notifier).syncLiveRates();
                if (ok) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Rates successfully synced with IBJA Exchange feed!'), backgroundColor: AppTheme.goldDark),
                  );
                }
              },
            ),
          ],
        ),
        const SizedBox(height: 8),
        ...adminState.rates.map((rate) {
          final metal = rate['metal'] as String;
          final currentVal = (rate['rate'] as num).toDouble();
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFECE6DF)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  metal.replaceAll('_', ' '),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87),
                ),
                Row(
                  children: [
                    Text(
                      '₹${currentVal.toStringAsFixed(0)}',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.goldDark, fontSize: 13),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.edit, size: 16, color: Colors.black38),
                      onPressed: () {
                        // Toggle mini edit rates prompt
                        final controller = TextEditingController(text: currentVal.toStringAsFixed(0));
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            backgroundColor: const Color(0xFFF9F6F0),
                            title: Text('Edit base rate for $metal'),
                            content: TextField(
                              controller: controller,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(labelText: 'Rate (₹)'),
                            ),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CANCEL')),
                              TextButton(
                                onPressed: () async {
                                  final newVal = double.tryParse(controller.text) ?? 0.0;
                                  if (newVal > 0) {
                                    await ref.read(adminProvider.notifier).updateRate(metal, newVal);
                                    Navigator.pop(ctx);
                                  }
                                },
                                child: const Text('SAVE'),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ],
            ),
          );
        }),

        const SizedBox(height: 24),

        // Compliance & transfers manifests section
        const Text(
          'Showroom Dispatches & Transfers',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
        ),
        const SizedBox(height: 12),
        if (activeTransfers.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: Text('No transfers logs for this branch', style: TextStyle(color: Colors.black38, fontSize: 12))),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: activeTransfers.length,
            itemBuilder: (ctx, idx) {
              final t = activeTransfers[idx];
              final isOutgoing = t['fromBranchCode'] == branchCode;
              final status = t['status'] as String;

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
                        Row(
                          children: [
                            Icon(
                              isOutgoing ? Icons.arrow_upward : Icons.arrow_downward,
                              color: isOutgoing ? Colors.redAccent : Colors.green,
                              size: 16,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              isOutgoing ? 'OUTGOING DISPATCH' : 'INCOMING SHIPMENT',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                                color: isOutgoing ? Colors.redAccent : Colors.green,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: status == 'PENDING_APPROVAL'
                                ? Colors.orange.withValues(alpha: 0.1)
                                : status == 'APPROVED'
                                    ? Colors.blue.withValues(alpha: 0.1)
                                    : Colors.green.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            status,
                            style: TextStyle(
                              color: status == 'PENDING_APPROVAL'
                                  ? Colors.orange
                                  : status == 'APPROVED'
                                      ? Colors.blue
                                      : Colors.green,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Manifest: ${t['transferId']}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${isOutgoing ? "Sent to: ${t['toBranchCode']}" : "From: ${t['fromBranchCode']}"} | Notes: ${t['notes'] ?? ""}',
                      style: const TextStyle(color: Colors.black45, fontSize: 11),
                    ),
                    const SizedBox(height: 12),
                    // Action controls based on state
                    if (status == 'PENDING_APPROVAL' && isOutgoing)
                      ElevatedButton(
                        onPressed: () => ref.read(adminProvider.notifier).approveTransfer(t['transferId']),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.goldDark,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('APPROVE & DISPATCH', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                    if (status == 'APPROVED' && !isOutgoing)
                      ElevatedButton(
                        onPressed: () => ref.read(adminProvider.notifier).receiveTransfer(t['transferId']),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('CONFIRM RECEIPT IN STORE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                  ],
                ),
              );
            },
          ),

        const SizedBox(height: 24),

        // Active Pawn Gold Loans
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Gold Loans / Pawn Valuations',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            ElevatedButton.icon(
              onPressed: _showGoldLoanDialog,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldDark,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              icon: const Icon(Icons.add, size: 14),
              label: const Text('NEW CONTRACT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (activeLoans.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: Text('No gold loan contracts registered', style: TextStyle(color: Colors.black38, fontSize: 12))),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: activeLoans.length,
            itemBuilder: (ctx, idx) {
              final loan = activeLoans[idx];
              final status = loan['status'] as String;

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
                          loan['customerName'] ?? 'Walk-in Client',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: status == 'ACTIVE' ? Colors.green.withValues(alpha: 0.1) : Colors.black12,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            status,
                            style: TextStyle(
                              color: status == 'ACTIVE' ? Colors.green : Colors.black45,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Purity: ${loan['purity'] ?? "22K"} | Gold Weight: ${loan['weightGrams'] ?? 0}g',
                      style: const TextStyle(color: Colors.black54, fontSize: 12),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Principal Loan: ₹${loan['loanAmount'] ?? 0} | Evaluated Value: ₹${loan['evaluatedValue'] ?? 0}',
                      style: const TextStyle(color: Colors.black45, fontSize: 11),
                    ),
                    if (status == 'ACTIVE') ...[
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () {
                          final controller = TextEditingController();
                          showDialog(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              backgroundColor: const Color(0xFFF9F6F0),
                              title: const Text('Record Loan Repayment'),
                              content: TextField(
                                controller: controller,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(labelText: 'Repayment Amount (₹)'),
                              ),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CANCEL')),
                                TextButton(
                                  onPressed: () async {
                                    final amt = double.tryParse(controller.text) ?? 0.0;
                                    if (amt > 0) {
                                      await ref.read(adminProvider.notifier).repayGoldLoan(loan['loanId'], amt);
                                      Navigator.pop(ctx);
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Repayment logged successfully!'), backgroundColor: AppTheme.goldDark),
                                      );
                                    }
                                  },
                                  child: const Text('REPAY'),
                                ),
                              ],
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppTheme.goldDark,
                          side: const BorderSide(color: AppTheme.goldDark, width: 1.2),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('COLLECT REPAYMENT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}
