import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/models/product.dart';
import '../../../core/models/transaction.dart';
import '../providers/app_providers.dart';
import '../../../core/mock_data.dart';

class ProductDetailScreen extends ConsumerStatefulWidget {
  final String productId;
  const ProductDetailScreen({super.key, required this.productId});

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  int _imageIndex = 0;
  int _qty = 1;
  final _fmt =
      NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  Widget build(BuildContext context) {
    final product = MockDataService.products.firstWhere(
      (p) => p.id == widget.productId,
      orElse: () => MockDataService.products.first,
    );
    final goldRate = ref.watch(goldRateProvider);
    final price = product.calculatePrice(goldRate);
    final isWishlisted = ref.watch(wishlistProvider).contains(product.id);
    final images = product.imageUrls.isNotEmpty
        ? product.imageUrls
        : [product.firstImage];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // ── Image Carousel ─────────────────────────────────
          SliverAppBar(
            backgroundColor: AppColors.surface,
            expandedHeight: 340,
            pinned: true,
            leading: GestureDetector(
              onTap: () => context.pop(),
              child: Container(
                margin: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.black45,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.arrow_back_ios_new,
                    color: Colors.white, size: 18),
              ),
            ),
            actions: [
              GestureDetector(
                onTap: () =>
                    ref.read(wishlistProvider.notifier).toggle(product.id),
                child: Container(
                  margin: const EdgeInsets.all(10),
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.black45,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isWishlisted ? Icons.favorite : Icons.favorite_border,
                    color:
                        isWishlisted ? AppColors.error : Colors.white,
                    size: 18,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () {
                  Share.share(
                      'Check out ${product.name} at our store!\nSKU: ${product.sku}\nDownload the app to see more.');
                },
                child: Container(
                  margin: const EdgeInsets.all(10),
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.black45,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.share_outlined,
                      color: Colors.white, size: 18),
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                children: [
                  CarouselSlider.builder(
                    itemCount: images.length,
                    itemBuilder: (ctx, i, _) => CachedNetworkImage(
                      imageUrl: images[i],
                      fit: BoxFit.cover,
                      width: double.infinity,
                      errorWidget: (ctx, url, err) => Container(
                        color: AppColors.surfaceElevated,
                        child: const Icon(Icons.diamond_outlined,
                            color: AppColors.gold, size: 80),
                      ),
                    ),
                    options: CarouselOptions(
                      height: 340,
                      viewportFraction: 1.0,
                      enableInfiniteScroll: images.length > 1,
                      onPageChanged: (i, _) =>
                          setState(() => _imageIndex = i),
                    ),
                  ),
                  // Dots
                  if (images.length > 1)
                    Positioned(
                      bottom: 12,
                      left: 0,
                      right: 0,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                          images.length,
                          (i) => AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: i == _imageIndex ? 20 : 6,
                            height: 6,
                            margin: const EdgeInsets.symmetric(horizontal: 2),
                            decoration: BoxDecoration(
                              color: i == _imageIndex
                                  ? AppColors.gold
                                  : Colors.white38,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                        ),
                      ),
                    ),
                  // AR Try-On overlay button
                  Positioned(
                    bottom: 12,
                    right: 12,
                    child: GestureDetector(
                      onTap: () => _showArTryOn(context, images.first),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          gradient: AppColors.goldGradient,
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                                color: AppColors.gold.withOpacity(0.4),
                                blurRadius: 8),
                          ],
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.camera_alt_outlined,
                                color: AppColors.textOnGold, size: 14),
                            SizedBox(width: 4),
                            Text(
                              'AR Try-On',
                              style: TextStyle(
                                  color: AppColors.textOnGold,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Product Info ────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Name & Category
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          product.name,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: product.categoryColor.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: product.categoryColor.withOpacity(0.4)),
                        ),
                        child: Text(
                          '${product.purityLabel} ${product.categoryLabel}',
                          style: TextStyle(
                            color: product.categoryColor,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'SKU: ${product.sku}  •  Design Code: ${product.sku}',
                    style: const TextStyle(
                        color: AppColors.textHint, fontSize: 12),
                  ),
                  // Rating & Orders
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      ...List.generate(
                        5,
                        (i) => Icon(
                          i < product.rating.floor()
                              ? Icons.star
                              : i < product.rating
                                  ? Icons.star_half
                                  : Icons.star_outline,
                          color: AppColors.warning,
                          size: 14,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${product.rating}  •  ${product.orderCount} orders',
                        style: const TextStyle(
                            color: AppColors.textHint, fontSize: 12),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),
                  // Price Breakdown
                  _PriceBreakdown(product: product, goldRate: goldRate),

                  const SizedBox(height: 20),
                  // Description
                  const Text(
                    'Description',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    product.description,
                    style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 14,
                        height: 1.5),
                  ),

                  // Stone details
                  if (product.stones.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _StoneDetails(stones: product.stones),
                  ],

                  // Specifications
                  if (product.specs.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _SpecsTable(specs: product.specs),
                  ],

                  const SizedBox(height: 20),
                  // Weight info
                  _WeightInfo(product: product),

                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
      // ── Bottom Action Bar ───────────────────────────────────
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.surfaceBorder)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Quantity selector + price
              Row(
                children: [
                  const Text('Qty:',
                      style: TextStyle(
                          color: AppColors.textSecondary, fontSize: 14)),
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.surfaceBorder),
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove,
                              color: AppColors.textSecondary, size: 16),
                          onPressed: () => setState(
                              () => _qty = (_qty - 1).clamp(1, 999)),
                          padding: const EdgeInsets.all(6),
                          constraints: const BoxConstraints(),
                        ),
                        Text(
                          '$_qty',
                          style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add,
                              color: AppColors.textSecondary, size: 16),
                          onPressed: () =>
                              setState(() => _qty = _qty + 1),
                          padding: const EdgeInsets.all(6),
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        _fmt.format(price * _qty),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gold,
                        ),
                      ),
                      const Text(
                        'incl. 3% GST',
                        style: TextStyle(
                            color: AppColors.textHint, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  // Custom Order
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/custom-order'),
                      icon: const Icon(Icons.tune, size: 16),
                      label: const Text('Custom'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.gold,
                        side: const BorderSide(color: AppColors.gold),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Add to Cart
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed: () => _addToCart(context, ref, product, price),
                      icon: const Icon(Icons.shopping_bag_outlined, size: 18),
                      label: const Text('Add to Cart'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.gold,
                        foregroundColor: AppColors.textOnGold,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _addToCart(BuildContext ctx, WidgetRef ref, Product product, double price) {
    ref.read(cartProvider.notifier).add(
          CartItem(
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            imageUrl: product.firstImage,
            quantity: _qty,
            unitPrice: price,
            purity: product.purityLabel,
          ),
        );
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(
        content: Text('${product.name} (x$_qty) added to cart'),
        backgroundColor: AppColors.success,
        action: SnackBarAction(
          label: 'View Cart',
          textColor: Colors.white,
          onPressed: () => ctx.go('/cart'),
        ),
      ),
    );
  }

  void _showArTryOn(BuildContext context, String imageUrl) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                gradient: AppColors.goldGradient,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.camera_alt,
                  color: AppColors.textOnGold, size: 18),
            ),
            const SizedBox(width: 10),
            const Text('AR Virtual Try-On',
                style: TextStyle(color: AppColors.textPrimary, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: CachedNetworkImage(
                imageUrl: imageUrl,
                height: 200,
                width: 280,
                fit: BoxFit.cover,
                errorWidget: (context, url, error) => Container(
                  height: 200,
                  width: 280,
                  color: AppColors.surfaceElevated,
                  alignment: Alignment.center,
                  child: const Icon(Icons.image_not_supported_outlined,
                      color: AppColors.textHint, size: 40),
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'AR Try-On feature coming soon! Upload a photo to see how this piece looks on you.',
              style: TextStyle(
                  color: AppColors.textSecondary, fontSize: 13, height: 1.4),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close',
                style: TextStyle(color: AppColors.textHint)),
          ),
          ElevatedButton(
            onPressed: () async {
              final picker = ImagePicker();
              final pickedFile = await picker.pickImage(source: ImageSource.gallery);
              if (pickedFile != null && context.mounted) {
                Navigator.pop(ctx);
                context.push('/catalog/ar-try-on', extra: {
                  'imagePath': pickedFile.path,
                  'jewelryUrl': imageUrl,
                });
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.gold,
              foregroundColor: AppColors.textOnGold,
            ),
            child: const Text('Upload Photo'),
          ),
        ],
      ),
    );
  }
}

// Price Breakdown Card
class _PriceBreakdown extends StatelessWidget {
  final Product product;
  final double goldRate;

  const _PriceBreakdown({required this.product, required this.goldRate});

  @override
  Widget build(BuildContext context) {
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final metalValue = product.netWeight * goldRate;
    final making = metalValue * (product.makingCharges / 100);
    final wastage = metalValue * (product.wastagePercent / 100);
    final stoneValue =
        product.stones.fold(0.0, (sum, s) => sum + s.totalValue);
    final subtotal = metalValue + making + wastage + stoneValue;
    final gst = subtotal * 0.03;
    final total = subtotal + gst;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.gold.withOpacity(0.08),
            AppColors.gold.withOpacity(0.04),
          ],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.gold.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.calculate_outlined,
                  color: AppColors.gold, size: 16),
              const SizedBox(width: 6),
              const Text(
                'Price Breakdown',
                style: TextStyle(
                    color: AppColors.gold,
                    fontSize: 13,
                    fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              Text(
                '@ ₹${goldRate.toStringAsFixed(0)}/g',
                style: const TextStyle(
                    color: AppColors.textHint, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _PriceRow(
              'Metal (${product.netWeight}g × ₹${goldRate.toStringAsFixed(0)})',
              fmt.format(metalValue)),
          _PriceRow(
              'Making Charges (${product.makingCharges}%)',
              fmt.format(making)),
          _PriceRow(
              'Wastage (${product.wastagePercent}%)', fmt.format(wastage)),
          if (stoneValue > 0)
            _PriceRow('Stone Value', fmt.format(stoneValue)),
          const Divider(color: AppColors.surfaceBorder, height: 16),
          _PriceRow('Subtotal', fmt.format(subtotal)),
          _PriceRow('GST (3%)', fmt.format(gst)),
          const SizedBox(height: 4),
          Row(
            children: [
              const Text(
                'Total',
                style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 15),
              ),
              const Spacer(),
              Text(
                fmt.format(total),
                style: const TextStyle(
                  color: AppColors.gold,
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  final String label;
  final String value;
  const _PriceRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12)),
          ),
          Text(value,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class _StoneDetails extends StatelessWidget {
  final List<StoneSpec> stones;
  const _StoneDetails({required this.stones});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.diamondCategory.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: AppColors.diamondCategory.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.diamond, color: AppColors.diamondCategory, size: 16),
              SizedBox(width: 6),
              Text(
                'Stone Details',
                style: TextStyle(
                    color: AppColors.diamondCategory,
                    fontSize: 13,
                    fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...stones.map((s) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '${s.type} (${s.stoneTypeLabel})',
                          style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13),
                        ),
                        const Spacer(),
                        Text(
                          '${s.carats}ct × ${s.count} pcs',
                          style: const TextStyle(
                              color: AppColors.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                    if (s.cut != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          children: [
                            _StoneChip('Cut: ${s.cut}'),
                            const SizedBox(width: 4),
                            _StoneChip('Color: ${s.color}'),
                            const SizedBox(width: 4),
                            _StoneChip('Clarity: ${s.clarity}'),
                          ],
                        ),
                      ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}

class _StoneChip extends StatelessWidget {
  final String text;
  const _StoneChip(this.text);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(text,
          style: const TextStyle(color: AppColors.textHint, fontSize: 10)),
    );
  }
}

class _SpecsTable extends StatelessWidget {
  final Map<String, String> specs;
  const _SpecsTable({required this.specs});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Specifications',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          ...specs.entries.map((e) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: [
                    SizedBox(
                      width: 130,
                      child: Text(e.key,
                          style: const TextStyle(
                              color: AppColors.textHint, fontSize: 12)),
                    ),
                    Expanded(
                      child: Text(
                        e.value,
                        style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}

class _WeightInfo extends StatelessWidget {
  final Product product;
  const _WeightInfo({required this.product});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _WeightCard('Gross\nWeight', '${product.grossWeight}g'),
        const SizedBox(width: 8),
        _WeightCard('Net\nWeight', '${product.netWeight}g'),
        const SizedBox(width: 8),
        _WeightCard('Making\nCharges', '${product.makingCharges}%'),
        const SizedBox(width: 8),
        _WeightCard('Wastage', '${product.wastagePercent}%'),
      ],
    );
  }
}

class _WeightCard extends StatelessWidget {
  final String label;
  final String value;
  const _WeightCard(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                  color: AppColors.gold,
                  fontSize: 14,
                  fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: const TextStyle(
                  color: AppColors.textHint, fontSize: 10),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
