import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/models/transaction.dart';
import '../providers/app_providers.dart';
import '../../../core/mock_data.dart';

class WishlistScreen extends ConsumerWidget {
  const WishlistScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wishlistIds = ref.watch(wishlistProvider);
    final products = MockDataService.products.where((p) => wishlistIds.contains(p.id)).toList();
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final goldRate = ref.watch(goldRateProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/customer/dashboard');
            }
          },
        ),
        title: Text('Wishlist (${products.length})',
            style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700)),
        actions: [
          if (products.isNotEmpty)
            TextButton(
              onPressed: () {
                final goldRate = ref.read(goldRateProvider);
                for (final product in products) {
                  ref.read(cartProvider.notifier).add(
                        CartItem(
                          productId: product.id,
                          productName: product.name,
                          sku: product.sku,
                          imageUrl: product.firstImage,
                          quantity: 1,
                          unitPrice: product.calculatePrice(goldRate),
                          purity: product.purityLabel,
                        ),
                      );
                }
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('${products.length} items added to cart'),
                    backgroundColor: AppColors.success,
                  ),
                );
              },
              child: const Text('Add All to Cart', style: TextStyle(color: AppColors.gold, fontSize: 13)),
            ),
        ],
      ),
      body: products.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(color: AppColors.surfaceElevated, shape: BoxShape.circle),
                    child: const Icon(Icons.favorite_border, color: AppColors.textHint, size: 42),
                  ),
                  const SizedBox(height: 20),
                  const Text('No saved designs yet', style: TextStyle(color: AppColors.textSecondary, fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  const Text('Tap ♡ on any product to save it', style: TextStyle(color: AppColors.textHint, fontSize: 13)),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => context.go('/catalog'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold, foregroundColor: AppColors.textOnGold),
                    child: const Text('Browse Catalog'),
                  ),
                ],
              ),
            )
          : GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.7,
              ),
              itemCount: products.length,
              itemBuilder: (ctx, i) {
                final p = products[i];
                final price = p.calculatePrice(goldRate);
                return GestureDetector(
                  onTap: () => context.go('/catalog/product/${p.id}'),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.surfaceBorder),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              ClipRRect(
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                                child: CachedNetworkImage(
                                  imageUrl: p.firstImage,
                                  fit: BoxFit.cover,
                                  errorWidget: (ctx, url, err) => Container(
                                    color: AppColors.surfaceElevated,
                                    child: const Icon(Icons.diamond_outlined, color: AppColors.gold, size: 40),
                                  ),
                                ),
                              ),
                              Positioned(
                                top: 6,
                                right: 6,
                                child: GestureDetector(
                                  onTap: () => ref.read(wishlistProvider.notifier).toggle(p.id),
                                  child: Container(
                                    width: 30, height: 30,
                                    decoration: const BoxDecoration(color: Colors.black38, shape: BoxShape.circle),
                                    child: const Icon(Icons.favorite, color: AppColors.error, size: 16),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 12)),
                              const SizedBox(height: 2),
                              Text(p.purityLabel, style: const TextStyle(color: AppColors.textHint, fontSize: 10)),
                              const SizedBox(height: 6),
                              Text(fmt.format(price),
                                  style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w700, fontSize: 14)),
                              const SizedBox(height: 8),
                              GestureDetector(
                                onTap: () {
                                  ref.read(cartProvider.notifier).add(
                                    CartItem(
                                      productId: p.id,
                                      productName: p.name,
                                      sku: p.sku,
                                      imageUrl: p.firstImage,
                                      quantity: 1,
                                      unitPrice: price,
                                      purity: p.purityLabel,
                                    ),
                                  );
                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                    SnackBar(content: Text('${p.name} added to cart'), backgroundColor: AppColors.success),
                                  );
                                },
                                child: Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(vertical: 7),
                                  decoration: BoxDecoration(
                                    gradient: AppColors.goldGradient,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text('Add to Cart',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(color: AppColors.textOnGold, fontSize: 11, fontWeight: FontWeight.w600)),
                                ),
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
    );
  }
}
