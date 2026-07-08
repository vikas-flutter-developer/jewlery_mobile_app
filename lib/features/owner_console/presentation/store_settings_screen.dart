import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/admin_provider.dart';

class StoreSettingsScreen extends ConsumerStatefulWidget {
  const StoreSettingsScreen({super.key});

  @override
  ConsumerState<StoreSettingsScreen> createState() => _StoreSettingsScreenState();
}

class _StoreSettingsScreenState extends ConsumerState<StoreSettingsScreen> {
  final _addressCtrl = TextEditingController(text: '101 Gold Plaza, Zaveri Bazaar');
  final _phoneCtrl = TextEditingController(text: '9876543210');
  final _invoicePrefixCtrl = TextEditingController(text: 'INV-2026-');

  // Denominations calculator values
  final Map<String, int> _denominations = {
    '2000': 0,
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
  };

  double get _actualCashTotal {
    double sum = 0;
    _denominations.forEach((key, val) {
      sum += double.parse(key) * val;
    });
    return sum;
  }

  @override
  void dispose() {
    _addressCtrl.dispose();
    _phoneCtrl.dispose();
    _invoicePrefixCtrl.dispose();
    super.dispose();
  }

  void _showClosingDenominationSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                top: 24,
                left: 24,
                right: 24,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'DAILY CASH DRAWER CLOSE TALLY',
                      style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1.0),
                    ),
                    const SizedBox(height: 6),
                    const Text('Input cash count in register to tally ledger audits.', style: TextStyle(color: Colors.black38, fontSize: 11)),
                    const SizedBox(height: 20),
                    ...['2000', '500', '200', '100', '50'].map((denom) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('₹$denom Note', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
                            SizedBox(
                              width: 100,
                              child: TextField(
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                decoration: const InputDecoration(hintText: '0', contentPadding: EdgeInsets.zero),
                                onChanged: (val) {
                                  final num = int.tryParse(val) ?? 0;
                                  setSheetState(() {
                                    _denominations[denom] = num;
                                  });
                                },
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 16),
                    const Divider(color: Colors.black12),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('TOTAL PHYSICAL CASH IN HAND:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black54)),
                        Text('₹${_actualCashTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.goldDark)),
                      ],
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          final success = await ref.read(adminProvider.notifier).saveCashClosingDenominations(
                                _denominations,
                                125000.0, // Expected amount from simulated sales
                                _actualCashTotal,
                              );
                          if (success) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              const SnackBar(content: Text('Denomination closing audit registered successfully!'), backgroundColor: AppTheme.goldDark),
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.goldDark,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: const Text('SUBMIT AUDIT REPORT', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        title: const Text(
          'STORE CONFIGURATION',
          style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1.0),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Shop Profile Settings
            const Text(
              'Showroom Profile Parameters',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _addressCtrl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Store Address', prefixIcon: Icon(Icons.location_on_outlined)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Customer Care Hotline', prefixIcon: Icon(Icons.phone_outlined)),
            ),
            const SizedBox(height: 28),

            // Billing configuration
            const Text(
              'Billing & Invoice Sequences',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _invoicePrefixCtrl,
              decoration: const InputDecoration(labelText: 'Invoice ID Prefix', prefixIcon: Icon(Icons.pin_outlined)),
            ),
            const SizedBox(height: 28),

            // Cash management register close
            const Text(
              'Daily Closing Audit Logs',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            const SizedBox(height: 6),
            const Text('Tally register cash values and check for store discrepancy logs.', style: TextStyle(color: Colors.black38, fontSize: 11)),
            const SizedBox(height: 14),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _showClosingDenominationSheet,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppTheme.goldDark,
                  side: const BorderSide(color: AppTheme.goldDark, width: 1.2),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                icon: const Icon(Icons.currency_rupee, size: 20),
                label: const Text('SUBMIT CASH CLOSING SHEET', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
