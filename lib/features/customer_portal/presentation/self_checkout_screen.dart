import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/customer_provider.dart';

class SelfCheckoutScreen extends ConsumerStatefulWidget {
  const SelfCheckoutScreen({super.key});

  @override
  ConsumerState<SelfCheckoutScreen> createState() => _SelfCheckoutScreenState();
}

class _SelfCheckoutScreenState extends ConsumerState<SelfCheckoutScreen> {
  final List<Map<String, dynamic>> _cartItems = [];

  // Available mock scan items
  final List<Map<String, dynamic>> _shelfItems = [
    {'id': 'TAG-G-992', 'name': 'Gold Kada 22K', 'weight': 24.50, 'price': 185000.0},
    {'id': 'TAG-D-211', 'name': 'Diamond Studs 18K', 'weight': 4.20, 'price': 85000.0},
    {'id': 'TAG-P-803', 'name': 'Platinum Bands', 'weight': 8.80, 'price': 72000.0},
  ];

  double get _subtotal {
    return _cartItems.fold(0.0, (sum, item) => sum + (item['price'] as double));
  }

  double get _tax {
    return _subtotal * 0.03; // GST 3%
  }

  double get _payable {
    return _subtotal + _tax;
  }

  void _addItem(Map<String, dynamic> item) {
    setState(() {
      _cartItems.add(item);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Scanned Tag ${item['id']}: Added ${item['name']} to cart.'),
        duration: const Duration(seconds: 2),
        backgroundColor: AppTheme.goldDark,
      ),
    );
  }

  void _clearCart() {
    setState(() {
      _cartItems.clear();
    });
  }

  void _checkout() async {
    if (_cartItems.isEmpty) return;

    final authState = ref.read(authProvider);
    final user = authState.user;
    final name = user?['name'] ?? 'Self-Checkout Client';
    final phone = user?['phone'] ?? '';

    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Missing phone metadata.'), backgroundColor: Colors.redAccent),
      );
      return;
    }

    // Convert items format for API payload
    final itemsPayload = _cartItems.map((item) => {
      'barcode': item['id'],
      'name': item['name'],
      'weight': item['weight'],
      'price': item['price'],
    }).toList();

    final success = await ref.read(customerProvider.notifier).createSelfCheckout(
      name: name,
      phone: phone,
      items: itemsPayload,
      subtotal: _subtotal,
      payable: _payable,
    );

    if (mounted) {
      if (success) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            backgroundColor: const Color(0xFFF9F6F0),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            title: const Column(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.green, size: 50),
                SizedBox(height: 14),
                Text(
                  'PAYMENT SUCCESSFUL',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontFamily: 'serif', color: AppTheme.goldDark, fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            content: Text(
              'Your self-checkout payment of ₹${_payable.toStringAsFixed(2)} was processed successfully.\n\nPlease show your checkout invoice details to our showroom representative before exiting.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.black54, fontSize: 13, height: 1.4),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context); // Close dialog
                  Navigator.pop(context); // Back to dashboard
                },
                child: const Text('BACK TO HOME', style: TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Checkout payment processing failed.'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final customerState = ref.watch(customerProvider);

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
          'SELF CHECKOUT',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontSize: 18,
            fontWeight: FontWeight.bold,
            letterSpacing: 2.0,
          ),
        ),
        actions: [
          if (_cartItems.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_outlined, color: Colors.redAccent),
              tooltip: 'Clear Cart',
              onPressed: _clearCart,
            ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Simulated barcode scanner banner
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 10.0),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFECE6DF)),
            ),
            child: Column(
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.qr_code_scanner_outlined, color: AppTheme.goldDark),
                    SizedBox(width: 8),
                    Text(
                      'SIMULATE BARCODE SCAN',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.goldDark, letterSpacing: 1.0),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  children: _shelfItems.map((item) {
                    return ActionChip(
                      backgroundColor: const Color(0xFFF9F6F0),
                      side: const BorderSide(color: AppTheme.goldDark, width: 0.8),
                      label: Text(item['name'], style: const TextStyle(fontSize: 11, color: AppTheme.goldDark, fontWeight: FontWeight.bold)),
                      onPressed: () => _addItem(item),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 10.0),
            child: Row(
              children: [
                const Text(
                  'Cart Summary',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
                ),
                const SizedBox(width: 8),
                Expanded(child: Container(height: 1, color: AppTheme.goldMetallic.withValues(alpha: 0.15))),
              ],
            ),
          ),

          // Cart Items list
          Expanded(
            child: _cartItems.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.shopping_bag_outlined, color: Colors.black26, size: 48),
                        SizedBox(height: 10),
                        Text(
                          'Your cart is empty. Scan tags to add items.',
                          style: TextStyle(color: Colors.black38, fontSize: 13),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0),
                    itemCount: _cartItems.length,
                    itemBuilder: (context, index) {
                      final item = _cartItems[index];
                      final name = item['name'] ?? 'Jewelry Item';
                      final weight = item['weight'] ?? 0.0;
                      final price = item['price'] ?? 0.0;
                      final id = item['id'] ?? 'TAG';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(14),
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
                                  name,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF2E2A25)),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Tag: $id  |  Weight: ${weight}g',
                                  style: const TextStyle(color: Colors.black38, fontSize: 11),
                                ),
                              ],
                            ),
                            Text(
                              '₹$price',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.goldDark),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),

          // Invoice Breakdown & Pay
          if (_cartItems.isNotEmpty)
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Subtotal', style: TextStyle(color: Colors.black45, fontSize: 13)),
                      Text('₹${_subtotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25))),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('GST Tax (3%)', style: TextStyle(color: Colors.black45, fontSize: 13)),
                      Text('₹${_tax.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: Colors.black12, height: 1),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Total Payable',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontSize: 15),
                      ),
                      Text(
                        '₹${_payable.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.goldDark, fontSize: 18),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: customerState.isLoading ? null : _checkout,
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
                        : const Text(
                            'PAY ONLINE VIA UPI',
                            style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
                          ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
