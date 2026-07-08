import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/customer_provider.dart';
import 'scheme_list_screen.dart';
import 'scheme_passbook_screen.dart';
import 'custom_order_form_screen.dart';
import 'self_checkout_screen.dart';

class CustomerDashboard extends ConsumerStatefulWidget {
  const CustomerDashboard({super.key});

  @override
  ConsumerState<CustomerDashboard> createState() => _CustomerDashboardState();
}

class _CustomerDashboardState extends ConsumerState<CustomerDashboard> {
  @override
  void initState() {
    super.initState();
    // Dispatch data fetches on start-up
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = ref.read(authProvider).user;
      final phone = user?['phone'] ?? '';
      if (phone.isNotEmpty) {
        ref.read(customerProvider.notifier).fetchCustomerEnrollments(phone);
        ref.read(customerProvider.notifier).fetchCustomOrders(phone);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final customerState = ref.watch(customerProvider);
    final user = authState.user;
    final phone = user?['phone'] ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0), // Luxury Warm Alabaster background
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'CLIENT PORTAL',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontSize: 20,
            fontWeight: FontWeight.bold,
            letterSpacing: 3.0,
          ),
        ),
        actions: [
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
          if (phone.isNotEmpty) {
            await ref.read(customerProvider.notifier).fetchCustomerEnrollments(phone);
            await ref.read(customerProvider.notifier).fetchCustomOrders(phone);
          }
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Greeting Card with premium light gradient
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
                    const Text(
                      'WELCOME BACK',
                      style: TextStyle(
                        color: AppTheme.goldDark,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 2.0,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      user?['name'] ?? 'Guest Customer',
                      style: const TextStyle(
                        color: Color(0xFF4A3E1B), // Dark Gold-Bronze
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'serif',
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      phone.isNotEmpty ? phone : 'No phone registered',
                      style: const TextStyle(color: Colors.black38, fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // In-Store Self Checkout Card Prompt
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFECE6DF), width: 1),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.goldMetallic.withValues(alpha: 0.08),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.qr_code_scanner_outlined, color: AppTheme.goldDark, size: 24),
                  ),
                  title: const Text('In-Store Self Checkout', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25))),
                  subtitle: const Text('Scan jewelry barcodes to pay instantly.'),
                  trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Colors.black26),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const SelfCheckoutScreen()),
                    );
                  },
                ),
              ),
              const SizedBox(height: 32),
              
              // Section Title: Schemes
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'My Savings Schemes',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF4A3E1B),
                      fontFamily: 'serif',
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const SchemeListScreen()),
                      );
                    },
                    child: const Text('Explore Schemes', style: TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold, fontSize: 13)),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              if (customerState.isLoading && customerState.customerEnrollments.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 24.0),
                    child: CircularProgressIndicator(color: AppTheme.goldDark),
                  ),
                )
              else if (customerState.customerEnrollments.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFECE6DF), width: 1),
                  ),
                  child: Column(
                    children: [
                      const Text(
                        'No Active Savings Plans Found',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black54),
                      ),
                      const SizedBox(height: 14),
                      ElevatedButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const SchemeListScreen()),
                          );
                        },
                        style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
                        child: const Text('Enroll Now'),
                      ),
                    ],
                  ),
                )
              else
                ...customerState.customerEnrollments.map((enrollment) {
                  final completed = enrollment['completedInstallments'] ?? 0;
                  final total = enrollment['totalInstallments'] ?? 11;
                  final gold = enrollment['goldAccumulated'] ?? 0.0;
                  
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFECE6DF), width: 1),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 12,
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
                              enrollment['schemeName'] ?? 'Savings Plan',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.goldDark),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.green.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                (enrollment['status'] ?? '').toString().toUpperCase(),
                                style: const TextStyle(color: Colors.green, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Accumulated Weight:', style: TextStyle(color: Colors.black45, fontSize: 13)),
                            Text('$gold Grams', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25))),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Paid Installments:', style: TextStyle(color: Colors.black45, fontSize: 13)),
                            Text('$completed of $total Months', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25))),
                          ],
                        ),
                        const SizedBox(height: 18),
                        ElevatedButton(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (context) => SchemePassbookScreen(enrollment: enrollment)),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.goldDark,
                            foregroundColor: Colors.white,
                            minimumSize: const Size.fromHeight(48),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('VIEW PASSBOOK LEDGER'),
                        ),
                      ],
                    ),
                  );
                }),
              
              const SizedBox(height: 32),

              // Section Title: Bespoke Custom Orders
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Bespoke Design Requests',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF4A3E1B),
                      fontFamily: 'serif',
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const CustomOrderFormScreen()),
                      );
                    },
                    child: const Text('New Request', style: TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold, fontSize: 13)),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              if (customerState.isLoading && customerState.customOrders.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 24.0),
                    child: CircularProgressIndicator(color: AppTheme.goldDark),
                  ),
                )
              else if (customerState.customOrders.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFECE6DF), width: 1),
                  ),
                  child: const Center(
                    child: Text(
                      'No custom bespoke orders requested yet.',
                      style: TextStyle(color: Colors.black38, fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                  ),
                )
              else
                ...customerState.customOrders.map((order) {
                  final status = order['status'] ?? 'Submitted';
                  final metal = order['metalType'] ?? 'GOLD';
                  final purity = order['carat'] ?? '22K';
                  
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFECE6DF), width: 1),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.goldMetallic.withValues(alpha: 0.08),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.palette_outlined, color: AppTheme.goldDark, size: 22),
                      ),
                      title: Text(
                        order['customDescription'] ?? 'Bespoke Order Request',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        'Spec: $purity $metal  |  Status: $status',
                        style: const TextStyle(fontSize: 12, color: Colors.black45),
                      ),
                      trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 13, color: Colors.black26),
                      onTap: () {},
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}
