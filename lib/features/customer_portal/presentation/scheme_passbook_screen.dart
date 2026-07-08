import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/customer_provider.dart';

class SchemePassbookScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> enrollment;

  const SchemePassbookScreen({super.key, required this.enrollment});

  @override
  ConsumerState<SchemePassbookScreen> createState() => _SchemePassbookScreenState();
}

class _SchemePassbookScreenState extends ConsumerState<SchemePassbookScreen> {
  // Find specific enrollment from provider state dynamically to show updated parameters
  Map<String, dynamic> _getCurrentEnrollment(CustomerState state) {
    try {
      final enrollmentId = widget.enrollment['enrollmentId'];
      return state.customerEnrollments.firstWhere(
        (e) => e['enrollmentId'] == enrollmentId,
        orElse: () => widget.enrollment,
      );
    } catch (_) {
      return widget.enrollment;
    }
  }

  void _payDue(Map<String, dynamic> currentEnrollment) async {
    final amount = (currentEnrollment['monthlyAmount'] ?? 5000).toDouble();
    final enrollmentId = currentEnrollment['enrollmentId'];
    final user = ref.read(authProvider).user;
    final phone = user?['phone'] ?? '';

    // Show simulated payment dialog sheet
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.all(28.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'SECURE PAYMENT GATEWAY',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppTheme.goldDark,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                      letterSpacing: 2.0,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Divider(color: Colors.black12),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Scheme Name', style: TextStyle(color: Colors.black45, fontSize: 13)),
                      Text(
                        currentEnrollment['schemeName'] ?? 'Savings Plan',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Installment Amount', style: TextStyle(color: Colors.black45, fontSize: 13)),
                      Text(
                        '₹$amount',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Simulated Method', style: TextStyle(color: Colors.black45, fontSize: 13)),
                      const Text(
                        'Razorpay Sandbox UPI',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: () async {
                      Navigator.pop(context); // Close sheet
                      
                      final success = await ref.read(customerProvider.notifier).payInstallment(
                        enrollmentId,
                        amount,
                        phone,
                      );
                      
                      if (mounted) {
                        if (success) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Payment Successful! Passbook ledger updated.'),
                              backgroundColor: Colors.green,
                            ),
                          );
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Payment transaction failed. Try again.'),
                              backgroundColor: Colors.redAccent,
                            ),
                          );
                        }
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.goldDark,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('CONFIRM & PAY DUE', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final customerState = ref.watch(customerProvider);
    final currentEnrollment = _getCurrentEnrollment(customerState);

    final name = currentEnrollment['schemeName'] ?? 'Savings Plan';
    final enrollmentId = currentEnrollment['enrollmentId'] ?? 'SCH-ENR-0000';
    final paidAmount = currentEnrollment['paidAmount'] ?? 0;
    final goldAccumulated = currentEnrollment['goldAccumulated'] ?? 0.0;
    final completed = currentEnrollment['completedInstallments'] ?? 0;
    final total = currentEnrollment['totalInstallments'] ?? 11;
    final status = currentEnrollment['status'] ?? 'ACTIVE';
    
    final installments = currentEnrollment['installments'] as List<dynamic>? ?? [];

    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.goldDark),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'LEDGER PASSBOOK',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontSize: 18,
            fontWeight: FontWeight.bold,
            letterSpacing: 2.0,
          ),
        ),
      ),
      body: Column(
        children: [
          // Elegant Header Summary Card
          Container(
            margin: const EdgeInsets.all(24.0),
            padding: const EdgeInsets.all(24.0),
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
                  color: AppTheme.goldDark.withValues(alpha: 0.06),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'ID: $enrollmentId',
                      style: const TextStyle(color: AppTheme.goldDark, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.0),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '$completed / $total Paid',
                        style: const TextStyle(color: Color(0xFF2E2A25), fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  name,
                  style: const TextStyle(
                    color: Color(0xFF4A3E1B),
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'serif',
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('GOLD ACCUMULATED', style: TextStyle(color: Colors.black38, fontSize: 9, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(
                          '$goldAccumulated g',
                          style: const TextStyle(color: Color(0xFF2E2A25), fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('TOTAL CASH PAID', style: TextStyle(color: Colors.black38, fontSize: 9, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(
                          '₹$paidAmount',
                          style: const TextStyle(color: Color(0xFF2E2A25), fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Row(
              children: [
                const Text(
                  'Installment History',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
                ),
                const SizedBox(width: 8),
                Expanded(child: Container(height: 1, color: AppTheme.goldMetallic.withValues(alpha: 0.15))),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Ledger Passbook timeline
          Expanded(
            child: installments.isEmpty
                ? const Center(child: Text('No installments recorded.'))
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0),
                    itemCount: installments.length,
                    itemBuilder: (context, index) {
                      // Reverse order to show newest first
                      final item = installments[installments.length - 1 - index];
                      final installmentId = item['installmentId'] ?? 'INST';
                      final instAmount = item['amount'] ?? 0;
                      final paidAtRaw = item['paidAt'] ?? '';
                      final method = item['paymentMethod'] ?? 'UPI';
                      final txId = item['transactionId'] ?? 'N/A';
                      final goldGrams = item['goldGramsAccumulated'] ?? 0.0;

                      final paidDate = paidAtRaw.isNotEmpty ? paidAtRaw.split('T')[0] : 'N/A';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFECE6DF), width: 1),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Installment #$installmentId',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF2E2A25)),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Date: $paidDate  |  $method',
                                  style: const TextStyle(color: Colors.black38, fontSize: 11),
                                ),
                                Text(
                                  'Txn: $txId',
                                  style: const TextStyle(color: Colors.black38, fontSize: 11),
                                ),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '₹$instAmount',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.goldDark),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '+$goldGrams g',
                                  style: const TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),

          // Pay installment action drawer
          if (status.toString().toUpperCase() != 'MATURED')
            Container(
              padding: const EdgeInsets.all(24.0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                border: Border.all(color: const Color(0xFFECE6DF), width: 1),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 10, offset: const Offset(0, -4)),
                ],
              ),
              child: ElevatedButton(
                onPressed: customerState.isLoading ? null : () => _payDue(currentEnrollment),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.goldDark,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: customerState.isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
                      )
                    : Text(
                        'PAY MONTHLY DUE (₹${currentEnrollment['monthlyAmount'] ?? 5000})',
                        style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
              ),
            ),
        ],
      ),
    );
  }
}
