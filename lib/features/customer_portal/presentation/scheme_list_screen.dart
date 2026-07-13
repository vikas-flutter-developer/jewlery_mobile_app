import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/customer_provider.dart';
import '../../auth/providers/auth_provider.dart';

class SchemeListScreen extends ConsumerStatefulWidget {
  const SchemeListScreen({super.key});

  @override
  ConsumerState<SchemeListScreen> createState() => _SchemeListScreenState();
}

class _SchemeListScreenState extends ConsumerState<SchemeListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(customerProvider.notifier).fetchAvailableSchemes();
    });
  }

  @override
  Widget build(BuildContext context) {
    final customerState = ref.watch(customerProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0), // Alabaster background
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.goldDark),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'SAVINGS SCHEMES',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontSize: 18,
            fontWeight: FontWeight.bold,
            letterSpacing: 2.0,
          ),
        ),
      ),
      body: customerState.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.goldDark))
          : customerState.error != null
              ? Center(child: Text(customerState.error!, style: const TextStyle(color: Colors.redAccent)))
              : customerState.availableSchemes.isEmpty
                  ? const Center(child: Text('No savings schemes currently active.'))
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                      itemCount: customerState.availableSchemes.length,
                      itemBuilder: (context, index) {
                        final scheme = customerState.availableSchemes[index];
                        final name = scheme['name'] ?? 'Savings Scheme';
                        final monthlyAmount = scheme['monthlyAmount'] ?? 5000;
                        final totalMonths = scheme['totalInstallments'] ?? 11;
                        final type = scheme['type'] ?? 'GOLD_SAVING';
                        final desc = scheme['description'] ?? 'Savings Plan';
                        final bonus = scheme['bonusAmount'] ?? monthlyAmount;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 20),
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: AppTheme.goldMetallic.withValues(alpha: 0.3), width: 1.2),
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.goldDark.withValues(alpha: 0.05),
                                blurRadius: 16,
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
                                  Expanded(
                                    child: Text(
                                      name,
                                      style: const TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.goldDark,
                                        fontFamily: 'serif',
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: AppTheme.goldMetallic.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(30),
                                    ),
                                    child: Text(
                                      type == 'GOLD_SAVING' ? 'GOLD WEIGHT' : 'CASH DISC',
                                      style: const TextStyle(
                                        color: AppTheme.goldDark,
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Text(
                                desc,
                                style: const TextStyle(color: Colors.black45, fontSize: 13, height: 1.4),
                              ),
                              const SizedBox(height: 20),
                              const Divider(color: Colors.black12, height: 1),
                              const SizedBox(height: 18),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('MONTHLY DUE', style: TextStyle(color: Colors.black38, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                                      const SizedBox(height: 4),
                                      Text(
                                        '₹$monthlyAmount',
                                        style: const TextStyle(color: Color(0xFF2E2A25), fontSize: 16, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      const Text('DURATION', style: TextStyle(color: Colors.black38, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                                      const SizedBox(height: 4),
                                      Text(
                                        '$totalMonths Months',
                                        style: const TextStyle(color: Color(0xFF2E2A25), fontSize: 16, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      const Text('BONUS BENEFIT', style: TextStyle(color: Colors.black38, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                                      const SizedBox(height: 4),
                                      Text(
                                        '₹$bonus',
                                        style: const TextStyle(color: Colors.green, fontSize: 16, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 24),
                              ElevatedButton(
                                onPressed: () async {
                                  final user = ref.read(authProvider).user;
                                  final phone = user?['phone'] ?? '';
                                  if (phone.isEmpty) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Please log in to enroll in a scheme.')),
                                    );
                                    return;
                                  }

                                  // Show progress indicator
                                  showDialog(
                                    context: context,
                                    barrierDismissible: false,
                                    builder: (context) => const Center(
                                      child: CircularProgressIndicator(color: AppTheme.goldDark),
                                    ),
                                  );

                                  final success = await ref.read(customerProvider.notifier).enrollInScheme(
                                    scheme['_id'] ?? scheme['id'] ?? '',
                                    phone,
                                  );

                                  if (context.mounted) {
                                    Navigator.pop(context); // Close loading dialog
                                    if (success) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text('✓ Successfully enrolled in ${name}!'),
                                          backgroundColor: Colors.green,
                                        ),
                                      );
                                      Navigator.pop(context); // Go back to dashboard
                                    } else {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('Failed to enroll. Please try again.'),
                                          backgroundColor: Colors.redAccent,
                                        ),
                                      );
                                    }
                                  }
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.goldDark,
                                  foregroundColor: Colors.white,
                                  minimumSize: const Size.fromHeight(50),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                ),
                                child: const Text('ENROLL IN PLAN', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.0)),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}
