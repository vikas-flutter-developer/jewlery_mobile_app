import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import 'package:intl/intl.dart';
import 'package:carousel_slider/carousel_slider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/models/product.dart';
import '../../../core/models/transaction.dart';
import '../providers/app_providers.dart';

class CatalogScreen extends ConsumerStatefulWidget {
  const CatalogScreen({super.key});

  @override
  ConsumerState<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends ConsumerState<CatalogScreen>
    with SingleTickerProviderStateMixin {
  final _searchController = TextEditingController();
  late AnimationController _rateAnimController;


  @override
  void initState() {
    super.initState();
    _rateAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _rateAnimController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(filteredProductsProvider);
    final selectedCategory = ref.watch(selectedCategoryProvider);
    final sortOption = ref.watch(sortOptionProvider);
    final isGrid = ref.watch(showGridViewProvider);
    final goldRate = ref.watch(goldRateProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // ── App Bar ──────────────────────────────────────────
          SliverAppBar(
            pinned: true,
            floating: true,
            backgroundColor: AppColors.background,
            expandedHeight: 236,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                padding: const EdgeInsets.fromLTRB(20, 50, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Row: Profile & Actions
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
                          onPressed: () {
                            if (Navigator.of(context).canPop()) {
                              Navigator.of(context).pop();
                            } else {
                              context.go('/customer/dashboard');
                            }
                          },
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => context.go('/profile'),
                          child: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.gold, width: 1.5),
                              image: const DecorationImage(
                                image: NetworkImage('https://ui-avatars.com/api/?name=Mehta+Jewellers&background=E5C158&color=ffffff&bold=true'),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Good afternoon,',
                                style: TextStyle(color: AppColors.textHint, fontSize: 12),
                              ),
                              const Text(
                                'Mehta Jewellers',
                                style: TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        GestureDetector(
                          onTap: () => context.go('/wishlist'),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceElevated,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.surfaceBorder),
                            ),
                            child: const Icon(Icons.favorite_border, color: AppColors.textPrimary, size: 18),
                          ),
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => context.push('/notifications'),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceElevated,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.surfaceBorder),
                            ),
                            child: const Stack(
                              alignment: Alignment.center,
                              children: [
                                Icon(Icons.notifications_outlined, color: AppColors.textPrimary, size: 18),
                                Positioned(
                                  top: 10,
                                  right: 11,
                                  child: CircleAvatar(radius: 3, backgroundColor: AppColors.error),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Live Rate Banner Carousel
                    CarouselSlider(
                      options: CarouselOptions(
                         height: 90,
                         viewportFraction: 1.0,
                         autoPlay: true,
                         autoPlayInterval: const Duration(seconds: 4),
                         autoPlayAnimationDuration: const Duration(milliseconds: 800),
                         autoPlayCurve: Curves.fastOutSlowIn,
                         scrollDirection: Axis.horizontal,
                      ),
                      items: [
                        {'title': 'Gold 22K (916) • Live', 'rate': goldRate, 'color': AppColors.goldCategory},
                        {'title': 'Silver (999) • Live', 'rate': 92.5, 'color': const Color(0xFF78909C)},
                        {'title': 'Diamond (VVS) • Live', 'rate': 65000.0, 'color': AppColors.diamondCategory},
                      ].map((item) {
                        return GestureDetector(
                          onTap: () => _showRateSheet(context),
                          child: Container(
                            width: MediaQuery.of(context).size.width,
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [AppColors.surfaceElevated, (item['color'] as Color).withOpacity(0.06)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: (item['color'] as Color).withOpacity(0.2)),
                              boxShadow: [
                                BoxShadow(
                                  color: (item['color'] as Color).withOpacity(0.04),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                AnimatedBuilder(
                                  animation: _rateAnimController,
                                  builder: (context, child) => Container(
                                    width: 36,
                                    height: 36,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: (item['color'] as Color).withOpacity(0.1 + (_rateAnimController.value * 0.15)),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(Icons.show_chart, color: (item['color'] as Color), size: 18),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Text(
                                        'Live Market Rate',
                                        style: TextStyle(color: AppColors.textHint, fontSize: 11),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        item['title'] as String,
                                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: (item['color'] as Color).withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: (item['color'] as Color).withOpacity(0.3)),
                                  ),
                                  child: Text(
                                    item['title'].toString().contains('Silver') 
                                        ? '₹${item['rate']}/g' 
                                        : item['title'].toString().contains('Diamond')
                                            ? '₹${(item['rate'] as double).toInt()}/ct'
                                            : '₹${(item['rate'] as num).toInt()}/g', 
                                    style: TextStyle(color: (item['color'] as Color), fontWeight: FontWeight.w800, fontSize: 14),
                                    maxLines: 1,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ),
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(66),
              child: Padding(
                padding:
                    const EdgeInsets.fromLTRB(16, 6, 16, 8),
                child: TextField(
                  controller: _searchController,
                  style: const TextStyle(color: AppColors.textPrimary),
                  onChanged: (v) =>
                      ref.read(searchQueryProvider.notifier).state = v,
                  decoration: InputDecoration(
                    hintText: 'Search by SKU, design code, type...',
                    hintStyle: const TextStyle(
                        color: AppColors.textHint, fontSize: 13),
                    prefixIcon: const Icon(Icons.search,
                        color: AppColors.textHint, size: 20),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear,
                                color: AppColors.textHint, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              ref
                                  .read(searchQueryProvider.notifier)
                                  .state = '';
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    filled: true,
                    fillColor: AppColors.surfaceElevated,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.surfaceBorder),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.surfaceBorder),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.gold, width: 1.5),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // ── Category Chips ────────────────────────────────────
          SliverToBoxAdapter(
            child: _CategoryChips(
              selected: selectedCategory,
              onSelect: (cat) =>
                  ref.read(selectedCategoryProvider.notifier).state = cat,
            ),
          ),

          // ── Sort & View Toggle ────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Text(
                    '${products.length} items',
                    style: const TextStyle(
                        color: AppColors.textHint, fontSize: 13),
                  ),
                  const Spacer(),
                  // Sort dropdown
                  PopupMenuButton<String>(
                    color: AppColors.surfaceElevated,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.surfaceBorder),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.sort,
                              color: AppColors.textSecondary, size: 16),
                          const SizedBox(width: 4),
                          Text(
                            sortOption,
                            style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12),
                          ),
                          const Icon(Icons.expand_more,
                              color: AppColors.textHint, size: 14),
                        ],
                      ),
                    ),
                    itemBuilder: (ctx) => [
                      'Trending',
                      'New Arrivals',
                      'Price: Low to High',
                      'Price: High to Low',
                      'Rating',
                    ]
                        .map((s) => PopupMenuItem(
                              value: s,
                              child: Text(s,
                                  style: const TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: 13)),
                            ))
                        .toList(),
                    onSelected: (v) =>
                        ref.read(sortOptionProvider.notifier).state = v,
                  ),
                  const SizedBox(width: 8),
                  // Grid/List toggle
                  GestureDetector(
                    onTap: () => ref
                        .read(showGridViewProvider.notifier)
                        .state = !isGrid,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.surfaceBorder),
                      ),
                      child: Icon(
                        isGrid ? Icons.view_list : Icons.grid_view,
                        color: AppColors.textSecondary,
                        size: 18,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Product Grid / List ───────────────────────────────
          if (isGrid)
            SliverPadding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverGrid(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => _ProductCard(product: products[i]),
                  childCount: products.length,
                ),
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.68,
                ),
              ),
            )
          else
            SliverPadding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) =>
                      _ProductListTile(product: products[i]),
                  childCount: products.length,
                ),
              ),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }

  void _showRateSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => const _RatesSheet(),
    );
  }
}

// ── Category Filter Chips ────────────────────────────────────────
class _CategoryChips extends StatelessWidget {
  final JewelryCategory? selected;
  final void Function(JewelryCategory?) onSelect;

  const _CategoryChips({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final categories = [
      (null, 'All', Icons.grid_view),
      (JewelryCategory.gold, 'Gold', Icons.circle),
      (JewelryCategory.diamond, 'Diamond', Icons.diamond),
      (JewelryCategory.platinum, 'Platinum', Icons.circle_outlined),
      (JewelryCategory.gemstone, 'Gemstone', Icons.lens),
      (JewelryCategory.bridal, 'Bridal', Icons.favorite),
    ];

    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (ctx, i) {
          final (cat, label, icon) = categories[i];
          final isSelected = selected == cat;
          final color = cat != null
              ? _categoryColor(cat)
              : AppColors.gold;
          return GestureDetector(
            onTap: () => onSelect(cat),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                gradient: isSelected
                    ? LinearGradient(colors: [
                        color.withOpacity(0.3),
                        color.withOpacity(0.1)
                      ])
                    : null,
                color: isSelected ? null : AppColors.surfaceElevated,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected
                      ? color.withOpacity(0.7)
                      : AppColors.surfaceBorder,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon,
                      size: 14,
                      color: isSelected ? color : AppColors.textHint),
                  const SizedBox(width: 4),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.normal,
                      color: isSelected ? color : AppColors.textHint,
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

  Color _categoryColor(JewelryCategory cat) {
    switch (cat) {
      case JewelryCategory.gold:
        return AppColors.goldCategory;
      case JewelryCategory.diamond:
        return AppColors.diamondCategory;
      case JewelryCategory.platinum:
        return AppColors.platinumCategory;
      case JewelryCategory.gemstone:
        return AppColors.gemstoneCategory;
      case JewelryCategory.bridal:
        return const Color(0xFFEF9A9A);
    }
  }
}

// ── Product Card (Grid) ──────────────────────────────────────────
class _ProductCard extends ConsumerWidget {
  final Product product;
  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wishlist = ref.watch(wishlistProvider);
    final isWishlisted = wishlist.contains(product.id);
    final goldRate = ref.watch(goldRateProvider);
    final price = product.calculatePrice(goldRate);
    final fmt = NumberFormat.currency(
        locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return GestureDetector(
      onTap: () => context.go('/catalog/product/${product.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.surfaceBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            Expanded(
              child: ClipRRect(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(16)),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CachedNetworkImage(
                      imageUrl: product.firstImage,
                      fit: BoxFit.cover,
                      placeholder: (ctx, url) => Shimmer.fromColors(
                        baseColor: AppColors.surface,
                        highlightColor: AppColors.surfaceElevated,
                        child: Container(color: AppColors.surface),
                      ),
                      errorWidget: (ctx, url, err) => Container(
                        color: AppColors.surfaceElevated,
                        child: const Icon(Icons.diamond_outlined,
                            color: AppColors.gold, size: 40),
                      ),
                    ),
                    // Gradient overlay at bottom
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: Container(
                        height: 50,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [
                              Colors.black.withOpacity(0.6),
                              Colors.transparent
                            ],
                          ),
                        ),
                      ),
                    ),
                    // Badges
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Row(
                        children: [
                          if (product.isNew)
                            _Badge('NEW', AppColors.success),
                          if (product.isTrending)
                            ...[
                              if (product.isNew) const SizedBox(width: 4),
                              _Badge('🔥 HOT', AppColors.warning),
                            ],
                        ],
                      ),
                    ),
                    // Wishlist
                    Positioned(
                      top: 6,
                      right: 6,
                      child: GestureDetector(
                        onTap: () => ref
                            .read(wishlistProvider.notifier)
                            .toggle(product.id),
                        child: Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: Colors.black45,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isWishlisted
                                ? Icons.favorite
                                : Icons.favorite_border,
                            color: isWishlisted
                                ? AppColors.error
                                : Colors.white,
                            size: 16,
                          ),
                        ),
                      ),
                    ),
                    // Purity badge at bottom
                    Positioned(
                      bottom: 6,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: product.categoryColor.withOpacity(0.85),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          product.purityLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Info
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    product.sku,
                    style: const TextStyle(
                        fontSize: 10, color: AppColors.textHint),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          fmt.format(price),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.gold,
                          ),
                        ),
                      ),
                      // Add to cart
                      GestureDetector(
                        onTap: () => _addToCart(context, ref),
                        child: Container(
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            gradient: AppColors.goldGradient,
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: const Icon(
                            Icons.add_shopping_cart,
                            size: 14,
                            color: AppColors.textOnGold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (product.stones.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Row(
                        children: [
                          const Icon(Icons.diamond,
                              size: 10, color: AppColors.diamondCategory),
                          const SizedBox(width: 2),
                          Text(
                            '${product.stones.first.carats}ct ${product.stones.first.type}',
                            style: const TextStyle(
                              fontSize: 10,
                              color: AppColors.diamondCategory,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _addToCart(BuildContext context, WidgetRef ref) {
    final goldRate = ref.read(goldRateProvider);
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${product.name} added to cart'),
        backgroundColor: AppColors.success,
        duration: const Duration(seconds: 2),
      ),
    );
  }
}

// ── Product List Tile (List View) ────────────────────────────────
class _ProductListTile extends ConsumerWidget {
  final Product product;
  const _ProductListTile({required this.product});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goldRate = ref.watch(goldRateProvider);
    final price = product.calculatePrice(goldRate);
    final fmt = NumberFormat.currency(
        locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return GestureDetector(
      onTap: () => context.go('/catalog/product/${product.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.surfaceBorder),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: CachedNetworkImage(
                imageUrl: product.firstImage,
                width: 80,
                height: 80,
                fit: BoxFit.cover,
                placeholder: (ctx, url) => Shimmer.fromColors(
                  baseColor: AppColors.surface,
                  highlightColor: AppColors.surfaceElevated,
                  child: Container(
                      width: 80, height: 80, color: AppColors.surface),
                ),
                errorWidget: (ctx, url, err) => Container(
                  width: 80,
                  height: 80,
                  color: AppColors.surfaceElevated,
                  child: const Icon(Icons.diamond_outlined,
                      color: AppColors.gold),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 3),
                  Text(product.sku,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.textHint)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: product.categoryColor.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${product.purityLabel} ${product.categoryLabel}',
                          style: TextStyle(
                            fontSize: 10,
                            color: product.categoryColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${product.netWeight}g',
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.textHint),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text(
                        fmt.format(price),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gold,
                        ),
                      ),
                      const Spacer(),
                      _AddCartBtn(product: product),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddCartBtn extends ConsumerWidget {
  final Product product;
  const _AddCartBtn({required this.product});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () {
        final goldRate = ref.read(goldRateProvider);
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${product.name} added to cart'),
            backgroundColor: AppColors.success,
            duration: const Duration(seconds: 2),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          gradient: AppColors.goldGradient,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          'Add to Cart',
          style: TextStyle(
            color: AppColors.textOnGold,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

// ── Badge widget ─────────────────────────────────────────────────
class _Badge extends StatelessWidget {
  final String text;
  final Color color;
  const _Badge(this.text, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.9),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ── Gold Rate Bottom Sheet ────────────────────────────────────────
class _RatesSheet extends StatelessWidget {
  const _RatesSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 4,
                height: 20,
                decoration: BoxDecoration(
                  gradient: AppColors.goldGradient,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 10),
              const Text('Live Metal Rates',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary)),
              const Spacer(),
              const Icon(Icons.refresh, color: AppColors.gold, size: 20),
            ],
          ),
          const SizedBox(height: 4),
          const Text('MCX rates updated at 5:15 PM',
              style: TextStyle(color: AppColors.textHint, fontSize: 12)),
          const SizedBox(height: 20),
          _RateRow('Gold 24K', '₹7,822/g', '+₹35', true),
          _RateRow('Gold 22K', '₹7,240/g', '+₹32', true),
          _RateRow('Gold 18K', '₹5,934/g', '+₹26', true),
          _RateRow('Gold 14K', '₹4,630/g', '+₹20', true),
          const Divider(color: AppColors.surfaceBorder, height: 24),
          _RateRow('Silver 999', '₹89.50/g', '-₹0.30', false),
          _RateRow('Platinum 950', '₹3,120/g', '+₹15', true),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.goldCategory.withOpacity(0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.gold.withOpacity(0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: AppColors.gold, size: 16),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Prices auto-refresh every 5 minutes during market hours',
                    style:
                        TextStyle(color: AppColors.textHint, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }
}

class _RateRow extends StatelessWidget {
  final String metal;
  final String rate;
  final String change;
  final bool isUp;

  const _RateRow(this.metal, this.rate, this.change, this.isUp);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(metal,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 14)),
          ),
          Text(rate,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 14)),
          const SizedBox(width: 12),
          Text(
            change,
            style: TextStyle(
              color: isUp ? AppColors.success : AppColors.error,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
