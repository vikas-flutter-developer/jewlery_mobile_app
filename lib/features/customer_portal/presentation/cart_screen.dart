import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../providers/app_providers.dart';
import '../../../core/mock_data.dart';
import '../../../core/models/transaction.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(cartProvider);
    final cart = ref.watch(cartProvider.notifier);
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    if (items.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
            onPressed: () {
              if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop();
              } else {
                context.go('/customer/dashboard');
              }
            },
          ),
          title: const Text('Cart'),
          backgroundColor: AppColors.background,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.shopping_bag_outlined,
                    color: AppColors.textHint, size: 48),
              ),
              const SizedBox(height: 20),
              const Text('Your cart is empty',
                  style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 18,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              const Text('Browse the catalog to add items',
                  style: TextStyle(color: AppColors.textHint, fontSize: 14)),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => context.go('/catalog'),
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: AppColors.textOnGold),
                child: const Text('Browse Catalog'),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => _uploadCSV(context, ref),
                icon: const Icon(Icons.upload_file),
                label: const Text('Bulk Upload CSV'),
                style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/customer/dashboard');
            }
          },
        ),
        title: Text('Cart (${items.length} items)',
            style: const TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.upload_file, color: AppColors.textPrimary, size: 22),
            onPressed: () => _uploadCSV(context, ref),
            tooltip: 'Bulk Upload CSV',
          ),
          TextButton(
            onPressed: () => ref.read(cartProvider.notifier).clear(),
            child: const Text('Clear',
                style: TextStyle(color: AppColors.error, fontSize: 13)),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (ctx, i) {
                final item = items[i];
                return Dismissible(
                  key: Key(item.productId),
                  direction: DismissDirection.endToStart,
                  onDismissed: (_) => ref
                      .read(cartProvider.notifier)
                      .remove(item.productId),
                  background: Container(
                    decoration: BoxDecoration(
                      color: AppColors.errorBg,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 20),
                    child: const Icon(Icons.delete_outline,
                        color: AppColors.error, size: 24),
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.surfaceBorder),
                    ),
                    child: Row(
                      children: [
                        // Image
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: CachedNetworkImage(
                            imageUrl: item.imageUrl,
                            width: 72,
                            height: 72,
                            fit: BoxFit.cover,
                            errorWidget: (ctx, url, err) => Container(
                              width: 72,
                              height: 72,
                              color: AppColors.surfaceElevated,
                              child: const Icon(Icons.diamond_outlined,
                                  color: AppColors.gold),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        // Details
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.productName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '${item.sku}  •  ${item.purity}',
                                style: const TextStyle(
                                    color: AppColors.textHint, fontSize: 11),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Text(
                                    fmt.format(item.total),
                                    style: const TextStyle(
                                      color: AppColors.gold,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const Spacer(),
                                  // Qty stepper
                                  Container(
                                    decoration: BoxDecoration(
                                      color: AppColors.surfaceElevated,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Row(
                                      children: [
                                        _QtyBtn(
                                          icon: Icons.remove,
                                          onTap: () =>
                                              ref
                                                  .read(cartProvider.notifier)
                                                  .updateQuantity(
                                                    item.productId,
                                                    item.quantity - 1,
                                                  ),
                                        ),
                                        SizedBox(
                                          width: 28,
                                          child: Text(
                                            '${item.quantity}',
                                            textAlign: TextAlign.center,
                                            style: const TextStyle(
                                              color: AppColors.textPrimary,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                        _QtyBtn(
                                          icon: Icons.add,
                                          onTap: () =>
                                              ref
                                                  .read(cartProvider.notifier)
                                                  .updateQuantity(
                                                    item.productId,
                                                    item.quantity + 1,
                                                  ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Order Summary
          Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.surfaceBorder)),
            ),
            child: SafeArea(
              child: Column(
                children: [
                  _SummaryRow('Subtotal', fmt.format(cart.subtotal)),
                  const SizedBox(height: 6),
                  _SummaryRow('GST (3%)', fmt.format(cart.gst)),
                  const Divider(color: AppColors.surfaceBorder, height: 16),
                  Row(
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        fmt.format(cart.total),
                        style: const TextStyle(
                          color: AppColors.gold,
                          fontWeight: FontWeight.w800,
                          fontSize: 20,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () => _placeOrder(context, ref),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.gold,
                        foregroundColor: AppColors.textOnGold,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, size: 18),
                          SizedBox(width: 8),
                          Text('Place Order',
                              style: TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _placeOrder(BuildContext context, WidgetRef ref) {
    context.push('/checkout');
  }

  Future<void> _uploadCSV(BuildContext context, WidgetRef ref) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['csv'],
      );
      if (result != null && result.files.single.path != null) {
        final file = File(result.files.single.path!);
        final csvString = await file.readAsString();
        final lines = csvString.split(RegExp(r'\r?\n'));
        
        int addedCount = 0;
        final goldRate = ref.read(goldRateProvider);
        
        for (var i = 1; i < lines.length; i++) {
          if (lines[i].trim().isEmpty) continue;
          final row = lines[i].split(RegExp(r',|;'));
          if (row.length >= 2) {
            final sku = row[0].trim();
            final qtyStr = row[1].trim();
            final qty = int.tryParse(qtyStr) ?? 1;
            
            try {
              final product = MockDataService.products.firstWhere((p) => p.sku == sku);
              ref.read(cartProvider.notifier).add(
                CartItem(
                  productId: product.id,
                  productName: product.name,
                  sku: product.sku,
                  imageUrl: product.firstImage,
                  quantity: qty,
                  unitPrice: product.calculatePrice(goldRate),
                  purity: product.purityLabel,
                ),
              );
              addedCount++;
            } catch (e) {
              // Product not found
            }
          }
        }
        
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Successfully added $addedCount items from CSV'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error parsing CSV: $e'),
            backgroundColor: AppColors.errorBg,
          ),
        );
      }
    }
  }
}

class _QtyBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _QtyBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Icon(icon, color: AppColors.textSecondary, size: 16),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  const _SummaryRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(label,
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 13)),
        const Spacer(),
        Text(value,
            style: const TextStyle(
                color: AppColors.textPrimary, fontSize: 13)),
      ],
    );
  }
}
