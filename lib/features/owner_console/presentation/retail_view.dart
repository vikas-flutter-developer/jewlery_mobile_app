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
        // Consolidated Revenue Card (Premium Gold Card Variant)
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFD4AF37).withValues(alpha: 0.5), width: 1.5),
            gradient: const LinearGradient(
              colors: [Color(0xFFFFF7DB), Color(0xFFF3E5AB), Color(0xFFD4AF37)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF996515).withValues(alpha: 0.15),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                spreadRadius: -2,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Color(0xFF4A3B12),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'REVENUE SUMMARY • $branchCode',
                        style: TextStyle(
                          color: const Color(0xFF4A3B12).withValues(alpha: 0.7),
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2.0,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4A3B12).withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF4A3B12).withValues(alpha: 0.15)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.trending_up, color: Color(0xFF1B5E20), size: 12),
                        SizedBox(width: 4),
                        Text('+14.2%', style: TextStyle(color: Color(0xFF1B5E20), fontSize: 10, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '₹${todaySalesTotal.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: Color(0xFF2C220E),
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                          fontFamily: 'serif',
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'TODAY\'S GROSS SALES',
                        style: TextStyle(
                          color: const Color(0xFF4A3B12).withValues(alpha: 0.5),
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ],
                  ),
                  // Elegant Sparkline Graph (styled in deep gold/bronze)
                  SizedBox(
                    width: 90,
                    height: 36,
                    child: CustomPaint(
                      painter: SparklinePainter(
                        const [1.0, 1.3, 1.1, 1.5, 1.4, 1.8, 2.1],
                        lineColor: const Color(0xFF4A3B12),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                height: 1,
                color: const Color(0xFF4A3B12).withValues(alpha: 0.12),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'INVOICES',
                        style: TextStyle(color: const Color(0xFF4A3B12).withValues(alpha: 0.5), fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.receipt_long_outlined, color: Color(0xFF4A3B12), size: 14),
                          const SizedBox(width: 4),
                          Text(
                            '$invoicesCount Sales Completed',
                            style: const TextStyle(color: Color(0xFF2C220E), fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'SHOWROOM RATE (22K)',
                        style: TextStyle(color: const Color(0xFF4A3B12).withValues(alpha: 0.5), fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '₹${(adminState.rates.firstWhere((r) => r['metal'] == 'GOLD_22K', orElse: () => {'rate': 7250})['rate'] ?? 7250).toString()} / g',
                        style: const TextStyle(color: Color(0xFF4A3B12), fontSize: 12, fontWeight: FontWeight.bold),
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
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFECE6DF)),
              ),
              child: IconButton(
                icon: const Icon(Icons.sync, color: AppTheme.goldDark, size: 18),
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
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...adminState.rates.map((rate) {
          final metal = rate['metal'] as String;
          final currentVal = (rate['rate'] as num).toDouble();
          
          final isSilver = metal.contains('SILVER');
          final isPlatinum = metal.contains('PLATINUM');
          final metalColor = isSilver ? const Color(0xFF90A4AE) : (isPlatinum ? const Color(0xFF78909C) : AppTheme.goldMetallic);
          
          String sub = "Pure 99.9% Gold Standard";
          if (metal == 'GOLD_22K') sub = "Standard 22 Karat Jewelry Gold";
          if (metal == 'GOLD_18K') sub = "Fine 18 Karat Design Gold";
          if (metal == 'SILVER') sub = "Pure 99.9% Sterling Silver";
          
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFECE6DF)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.01),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: Container(
                decoration: BoxDecoration(
                  border: Border(
                    left: BorderSide(color: metalColor, width: 5.0),
                  ),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            metal.replaceAll('_', ' '),
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87, letterSpacing: 0.2),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            sub,
                            style: const TextStyle(fontSize: 10, color: Colors.black38),
                          ),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        Text(
                          '₹${currentVal.toStringAsFixed(0)}',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.goldDark, fontSize: 14, fontFamily: 'serif'),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          width: 32,
                          height: 32,
                          decoration: const BoxDecoration(
                            color: Color(0xFFF9F6F0),
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            icon: const Icon(Icons.edit, size: 14, color: AppTheme.goldDark),
                            padding: EdgeInsets.zero,
                            onPressed: () {
                              final controller = TextEditingController(text: currentVal.toStringAsFixed(0));
                              showDialog(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  backgroundColor: const Color(0xFFF9F6F0),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                  title: Text('Edit rate for ${metal.replaceAll('_', ' ')}', style: const TextStyle(fontFamily: 'serif', fontSize: 15, fontWeight: FontWeight.bold)),
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
                                      child: const Text('SAVE', style: TextStyle(fontWeight: FontWeight.bold)),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
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

              final statusColor = status == 'PENDING_APPROVAL'
                  ? const Color(0xFFED6C02)
                  : status == 'APPROVED'
                      ? const Color(0xFF0288D1)
                      : const Color(0xFF2E7D32);

              final statusBg = statusColor.withOpacity(0.08);

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFECE6DF)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.01),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: isOutgoing ? const Color(0xFFFFEBEE) : const Color(0xFFE8F5E9),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                isOutgoing ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                                color: isOutgoing ? const Color(0xFFD32F2F) : const Color(0xFF2E7D32),
                                size: 14,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              isOutgoing ? 'OUTGOING DISPATCH' : 'INCOMING SHIPMENT',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                                color: isOutgoing ? const Color(0xFFD32F2F) : const Color(0xFF2E7D32),
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: statusBg,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: statusColor.withOpacity(0.2)),
                          ),
                          child: Text(
                            status,
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Manifest: ${t['transferId']}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.sync_alt, size: 12, color: Colors.black26),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '${isOutgoing ? "Sent to: ${t['toBranchCode']}" : "From: ${t['fromBranchCode']}"} | Notes: ${t['notes'] ?? "Stock distribution"}',
                            style: const TextStyle(color: Colors.black45, fontSize: 11),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Action controls based on state
                    if (status == 'PENDING_APPROVAL' && isOutgoing)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => ref.read(adminProvider.notifier).approveTransfer(t['transferId']),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.goldDark,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Text('APPROVE & DISPATCH', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    if (status == 'APPROVED' && !isOutgoing)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => ref.read(adminProvider.notifier).receiveTransfer(t['transferId']),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2E7D32),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Text('CONFIRM RECEIPT IN STORE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
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
              
              final loanAmount = (loan['loanAmount'] as num?)?.toDouble() ?? 0.0;
              final evaluatedValue = (loan['evaluatedValue'] as num?)?.toDouble() ?? (loanAmount * 1.35);
              final ltv = evaluatedValue > 0 ? (loanAmount / evaluatedValue) * 100 : 0.0;

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFECE6DF)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.01),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
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
                          loan['customerName'] ?? 'Walk-in Client',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: status == 'ACTIVE' ? const Color(0xFFE8F5E9) : const Color(0xFFF5F5F5),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: status == 'ACTIVE' ? const Color(0xFFC8E6C9) : const Color(0xFFE0E0E0)),
                          ),
                          child: Text(
                            status,
                            style: TextStyle(
                              color: status == 'ACTIVE' ? const Color(0xFF2E7D32) : Colors.black54,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF8E1),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: const Color(0xFFFFECB3)),
                          ),
                          child: Text(
                            'Purity: ${loan['purity'] ?? "22K"}',
                            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppTheme.goldDark),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Gold Weight: ${loan['weightGrams'] ?? 0}g',
                          style: const TextStyle(color: Colors.black54, fontSize: 11, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Principal Loan', style: TextStyle(color: Colors.black38, fontSize: 9)),
                            const SizedBox(height: 2),
                            Text('₹${loanAmount.toStringAsFixed(0)}', style: const TextStyle(color: Colors.black87, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'serif')),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text('Evaluated Value', style: TextStyle(color: Colors.black38, fontSize: 9)),
                            const SizedBox(height: 2),
                            Text('₹${evaluatedValue.toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.goldDark, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'serif')),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Loan-to-Value progress bar
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('LTV Ratio: ${ltv.toStringAsFixed(1)}%', style: const TextStyle(color: Colors.black45, fontSize: 9, fontWeight: FontWeight.bold)),
                            const Text('Max Allowed: 75%', style: TextStyle(color: Colors.black38, fontSize: 9)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: ltv / 100,
                            backgroundColor: const Color(0xFFF3EFE9),
                            color: ltv > 75 ? const Color(0xFFD32F2F) : AppTheme.goldDark,
                            minHeight: 4,
                          ),
                        ),
                      ],
                    ),
                    if (status == 'ACTIVE') ...[
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () {
                            final controller = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                backgroundColor: const Color(0xFFF9F6F0),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                title: const Text('Record Loan Repayment', style: TextStyle(fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold)),
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
                                    child: const Text('REPAY', style: TextStyle(fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                            );
                          },
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppTheme.goldDark,
                            side: const BorderSide(color: AppTheme.goldDark, width: 1.2),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Text('COLLECT REPAYMENT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
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

class SparklinePainter extends CustomPainter {
  final List<double> data;
  final Color lineColor;
  SparklinePainter(this.data, {this.lineColor = AppTheme.goldMetallic});

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;
    
    final paint = Paint()
      ..color = lineColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          lineColor.withValues(alpha: 0.15),
          lineColor.withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    final path = Path();
    final fillPath = Path();

    final double stepX = size.width / (data.length - 1);
    final double minVal = data.reduce((a, b) => a < b ? a : b);
    final double maxVal = data.reduce((a, b) => a > b ? a : b);
    final double delta = maxVal - minVal == 0 ? 1 : maxVal - minVal;

    double getRawY(double val) {
      return size.height - ((val - minVal) / delta) * size.height;
    }

    path.moveTo(0, getRawY(data[0]));
    fillPath.moveTo(0, size.height);
    fillPath.lineTo(0, getRawY(data[0]));

    for (int i = 1; i < data.length; i++) {
      path.lineTo(i * stepX, getRawY(data[i]));
      fillPath.lineTo(i * stepX, getRawY(data[i]));
    }

    fillPath.lineTo(size.width, size.height);
    fillPath.close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant SparklinePainter oldDelegate) => oldDelegate.data != data || oldDelegate.lineColor != lineColor;
}
