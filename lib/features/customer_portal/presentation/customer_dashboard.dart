import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';
import 'package:intl/intl.dart';
import 'package:carousel_slider/carousel_slider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/models/product.dart';
import '../../../core/models/transaction.dart';
import '../providers/app_providers.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/customer_provider.dart';
import 'scheme_list_screen.dart';
import 'scheme_passbook_screen.dart';
import 'custom_order_form_screen.dart';
import 'self_checkout_screen.dart';
import 'catalog_screen.dart';
import 'ar_try_on_screen.dart';
import 'cart_screen.dart';
import 'wishlist_screen.dart';
import 'order_tracking_screen.dart';
import 'support_screen.dart';
import 'search_page.dart';
import 'care_guide_page.dart';
import 'saved_addresses_page.dart';

class CustomerDashboard extends ConsumerStatefulWidget {
  const CustomerDashboard({super.key});

  @override
  ConsumerState<CustomerDashboard> createState() => _CustomerDashboardState();
}

class _CustomerDashboardState extends ConsumerState<CustomerDashboard> with TickerProviderStateMixin {
  int _currentIndex = 0;
  final _searchController = TextEditingController();
  late AnimationController _rateAnimController;

  @override
  void initState() {
    super.initState();
    _rateAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

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
  void dispose() {
    _searchController.dispose();
    _rateAnimController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final phone = user?['phone'] ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFFBF9F6), // Luxury off-white
      body: RefreshIndicator(
        onRefresh: () async {
          if (phone.isNotEmpty) {
            await ref.read(customerProvider.notifier).fetchCustomerEnrollments(phone);
            await ref.read(customerProvider.notifier).fetchCustomOrders(phone);
          }
        },
        child: _buildBody(phone, user),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: AppTheme.goldDark,
          unselectedItemColor: Colors.black38,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.storefront_outlined),
              activeIcon: Icon(Icons.storefront_rounded),
              label: 'Shop',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.savings_outlined),
              activeIcon: Icon(Icons.savings_rounded),
              label: 'Schemes',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.palette_outlined),
              activeIcon: Icon(Icons.palette_rounded),
              label: 'Bespoke',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.account_circle_outlined),
              activeIcon: Icon(Icons.account_circle_rounded),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(String phone, Map<String, dynamic>? user) {
    switch (_currentIndex) {
      case 0:
        return _buildCatalogTab();
      case 1:
        return _buildSchemesTab();
      case 2:
        return _buildBespokeTab();
      case 3:
      default:
        return _buildProfileTab(phone, user);
    }
  }

  // ── Tab 0: Integrated Shop Catalog ─────────────────────────────────────
  Widget _buildCatalogTab() {
    final products = ref.watch(filteredProductsProvider);
    final selectedCategory = ref.watch(selectedCategoryProvider);
    final sortOption = ref.watch(sortOptionProvider);
    final isGrid = ref.watch(showGridViewProvider);
    final goldRate = ref.watch(goldRateProvider);

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          floating: true,
          automaticallyImplyLeading: false,
          backgroundColor: const Color(0xFFFBF9F6),
          elevation: 0,
          scrolledUnderElevation: 0,
          expandedHeight: 236,
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              padding: const EdgeInsets.fromLTRB(20, 50, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: AppTheme.goldMetallic, width: 1.5),
                          image: const DecorationImage(
                            image: NetworkImage('https://ui-avatars.com/api/?name=Mehta+Jewellers&background=E5C158&color=ffffff&bold=true'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Good afternoon,',
                              style: TextStyle(color: Colors.black38, fontSize: 11, fontWeight: FontWeight.w500),
                            ),
                            Text(
                              'Mehta Jewellers',
                              style: TextStyle(
                                color: Color(0xFF4A3E1B),
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'serif',
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.favorite_border_rounded, color: AppTheme.goldDark, size: 22),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const WishlistScreen()),
                          );
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.shopping_bag_outlined, color: AppTheme.goldDark, size: 22),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const CartScreen()),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Live Market Rate Carousel Banner
                  CarouselSlider(
                    options: CarouselOptions(
                      height: 52,
                      viewportFraction: 1.0,
                      autoPlay: true,
                      autoPlayInterval: const Duration(seconds: 4),
                    ),
                    items: [
                      {'title': 'Gold 22K (916) • Live', 'rate': goldRate, 'color': AppColors.goldCategory},
                      {'title': 'Silver (999) • Live', 'rate': 92.5, 'color': const Color(0xFF78909C)},
                      {'title': 'Diamond (VVS) • Live', 'rate': 65000.0, 'color': AppColors.diamondCategory},
                    ].map((item) {
                      return GestureDetector(
                        onTap: () => _showRateSheet(context),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: (item['color'] as Color).withValues(alpha: 0.2)),
                          ),
                          child: Row(
                            children: [
                              AnimatedBuilder(
                                animation: _rateAnimController,
                                builder: (context, child) => Icon(
                                  Icons.show_chart_rounded, 
                                  color: item['color'] as Color, 
                                  size: 16
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  item['title'] as String,
                                  style: const TextStyle(color: Color(0xFF2E2A25), fontSize: 12, fontWeight: FontWeight.bold),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: (item['color'] as Color).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  item['title'].toString().contains('Silver')
                                      ? '₹${item['rate']}/g'
                                      : item['title'].toString().contains('Diamond')
                                          ? '₹${(item['rate'] as double).toInt()}/ct'
                                          : '₹${(item['rate'] as num).toInt()}/g',
                                  style: TextStyle(color: item['color'] as Color, fontWeight: FontWeight.bold, fontSize: 12),
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
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 8),
              child: TextField(
                controller: _searchController,
                onChanged: (v) => ref.read(searchQueryProvider.notifier).state = v,
                decoration: InputDecoration(
                  hintText: 'Search by SKU, design code, type...',
                  hintStyle: const TextStyle(color: Colors.black26, fontSize: 13),
                  prefixIcon: const Icon(Icons.search_rounded, color: Colors.black38, size: 20),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, color: Colors.black38, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            ref.read(searchQueryProvider.notifier).state = '';
                          },
                        )
                      : null,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(color: Color(0xFFECE6DF)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(color: Color(0xFFECE6DF)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(color: AppTheme.goldDark, width: 1.5),
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
            onSelect: (cat) => ref.read(selectedCategoryProvider.notifier).state = cat,
          ),
        ),

        // ── Sort & View Toggle ────────────────────────────────
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Text(
                  '${products.length} items',
                  style: const TextStyle(color: Colors.black38, fontSize: 13),
                ),
                const Spacer(),
                PopupMenuButton<String>(
                  color: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFECE6DF)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.sort_rounded, color: Color(0xFF2E2A25), size: 16),
                        const SizedBox(width: 4),
                        Text(
                          sortOption,
                          style: const TextStyle(color: Color(0xFF2E2A25), fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        const Icon(Icons.expand_more_rounded, color: Colors.black26, size: 14),
                      ],
                    ),
                  ),
                  itemBuilder: (ctx) => [
                    'Trending',
                    'New Arrivals',
                    'Price: Low to High',
                    'Price: High to Low',
                    'Rating',
                  ].map((s) => PopupMenuItem(
                    value: s,
                    child: Text(s, style: const TextStyle(fontSize: 13)),
                  )).toList(),
                  onSelected: (v) => ref.read(sortOptionProvider.notifier).state = v,
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => ref.read(showGridViewProvider.notifier).state = !isGrid,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFECE6DF)),
                    ),
                    child: Icon(
                      isGrid ? Icons.view_list_rounded : Icons.grid_view_rounded,
                      color: const Color(0xFF2E2A25),
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
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverGrid(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => _ProductCard(product: products[i]),
                childCount: products.length,
              ),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
                childAspectRatio: 0.68,
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => _ProductListTile(product: products[i]),
                childCount: products.length,
              ),
            ),
          ),

        const SliverToBoxAdapter(child: SizedBox(height: 80)),
      ],
    );
  }

  void _showRateSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => const _RatesSheet(),
    );
  }

  // ── Tab 1: Schemes Console ─────────────────────────────────────────────
  Widget _buildSchemesTab() {
    final customerState = ref.watch(customerProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 50),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'My Savings Schemes',
                style: TextStyle(
                  fontSize: 20,
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
                child: const Row(
                  children: [
                    Text('Explore Plans', style: TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold, fontSize: 12)),
                    SizedBox(width: 4),
                    Icon(Icons.arrow_forward_ios_rounded, size: 10, color: AppTheme.goldDark)
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

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
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFECE6DF), width: 1.2),
              ),
              child: Column(
                children: [
                  const Text(
                    'No Active Savings Plans Found',
                    style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black54, fontSize: 14),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Enroll in a plan to start accumulating weight.',
                    style: TextStyle(color: Colors.black38, fontSize: 12),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const SchemeListScreen()),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.goldDark, 
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))
                    ),
                    child: const Text('Enroll Now', style: TextStyle(fontWeight: FontWeight.bold)),
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
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFECE6DF), width: 1.2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.015),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
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
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF2E2A25)),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Accumulated Gold Weight:', style: TextStyle(color: Colors.black45, fontSize: 13)),
                        Text('$gold Grams', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.goldDark, fontSize: 14)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Payment Milestone:', style: TextStyle(color: Colors.black45, fontSize: 13)),
                        Text('$completed of $total Months', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25))),
                      ],
                    ),
                    const SizedBox(height: 14),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: LinearProgressIndicator(
                        value: total > 0 ? (completed / total) : 0,
                        backgroundColor: const Color(0xFFF3EFE9),
                        valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.goldDark),
                        minHeight: 6,
                      ),
                    ),
                    const SizedBox(height: 24),
                    OutlinedButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => SchemePassbookScreen(enrollment: enrollment)),
                        );
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.goldDark,
                        side: const BorderSide(color: AppTheme.goldMetallic, width: 1.2),
                        minimumSize: const Size.fromHeight(48),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text('VIEW PASSBOOK LEDGER', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 0.5)),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  // ── Tab 2: Bespoke Design Console ──────────────────────────────────────
  Widget _buildBespokeTab() {
    final customerState = ref.watch(customerProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 50),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Bespoke Design Requests',
                style: TextStyle(
                  fontSize: 20,
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
                child: const Row(
                  children: [
                    Text('New Request', style: TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold, fontSize: 12)),
                    SizedBox(width: 4),
                    Icon(Icons.add, size: 14, color: AppTheme.goldDark)
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

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
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFECE6DF), width: 1.2),
              ),
              child: const Center(
                child: Text(
                  'No custom bespoke orders requested yet.',
                  style: TextStyle(color: Colors.black38, fontSize: 12),
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
                  border: Border.all(color: const Color(0xFFECE6DF), width: 1.2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.01),
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
    );
  }

  // ── Tab 3: B2C Loyalty Profile & Utility Panel ─────────────────────────
  Widget _buildProfileTab(String phone, Map<String, dynamic>? user) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 50),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Premium Gold Foil Membership Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: const Color(0xFFC48E2F).withValues(alpha: 0.5), width: 1.5),
              gradient: const LinearGradient(
                colors: [Color(0xFFF6E2A3), Color(0xFFD8B053), Color(0xFFC5952B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFC5952B).withValues(alpha: 0.25),
                  blurRadius: 25,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'MEMBERSHIP PORTAL',
                        style: TextStyle(
                          color: Color(0xFF5A4418),
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        user?['name'] ?? 'Guest Customer',
                        style: const TextStyle(
                          color: Color(0xFF241B09),
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'serif',
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        phone.isNotEmpty ? 'Registered: $phone' : 'No phone registered',
                        style: const TextStyle(color: Color(0xFF634D24), fontSize: 11, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFF5A4418).withValues(alpha: 0.5), width: 1.2),
                    borderRadius: BorderRadius.circular(20),
                    color: const Color(0xFF241B09).withValues(alpha: 0.05),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.stars_rounded, color: Color(0xFF5A4418), size: 14),
                      SizedBox(width: 6),
                      Text(
                        'GOLD CLUB',
                        style: TextStyle(color: Color(0xFF5A4418), fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1.0),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // In-Store Self Checkout Gold Banner Prompt
          InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SelfCheckoutScreen()),
              );
            },
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFECE6DF), width: 1.2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD4AF37).withValues(alpha: 0.08),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.qr_code_scanner_outlined, color: AppTheme.goldDark, size: 24),
                  ),
                  const SizedBox(width: 16),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'In-Store Self Checkout',
                          style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25), fontSize: 14),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Scan jewelry barcodes to pay instantly.',
                          style: TextStyle(color: Colors.black45, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppTheme.goldDark),
                ],
              ),
            ),
          ),
          const SizedBox(height: 28),

          const Text(
            'Account Settings',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.bold,
              color: Color(0xFF4A3E1B),
              fontFamily: 'serif',
            ),
          ),
          const SizedBox(height: 16),

          _buildProfileMenuItem(
            icon: Icons.local_shipping_outlined,
            title: 'My Orders',
            subtitle: 'Track and view previous purchases',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const OrderTrackingScreen(orderId: 'ORD001')),
              );
            },
          ),
          const SizedBox(height: 12),
          _buildProfileMenuItem(
            icon: Icons.map_outlined,
            title: 'Saved Addresses',
            subtitle: 'Manage delivery and billing locations',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SavedAddressesPage()),
              );
            },
          ),
          const SizedBox(height: 12),
          _buildProfileMenuItem(
            icon: Icons.support_agent_outlined,
            title: 'Repairs & Support',
            subtitle: 'Get help with resizing, polishing, or custom queries',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SupportScreen()),
              );
            },
          ),
          const SizedBox(height: 12),
          _buildProfileMenuItem(
            icon: Icons.book_outlined,
            title: 'Care Guide',
            subtitle: 'Learn how to keep ornaments clean & sparkling',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const CareGuidePage()),
              );
            },
          ),
          const SizedBox(height: 24),

          // Sign Out Action
          InkWell(
            onTap: () async {
              await ref.read(authProvider.notifier).logout();
            },
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.red.withValues(alpha: 0.2)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Sign Out',
                    style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildProfileMenuItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFECE6DF)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.goldMetallic.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: AppTheme.goldDark, size: 20),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25), fontSize: 14),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(color: Colors.black38, fontSize: 11),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Colors.black26),
          ],
        ),
      ),
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
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (ctx, i) {
          final (cat, label, icon) = categories[i];
          final isSelected = selected == cat;
          final color = cat != null ? _categoryColor(cat) : AppColors.gold;
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
                color: isSelected ? null : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected ? color.withOpacity(0.7) : const Color(0xFFECE6DF),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 14, color: isSelected ? color : Colors.black38),
                  const SizedBox(width: 4),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                      color: isSelected ? color : Colors.black45,
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

// ── Product Card (Grid View Item) ──────────────────────────────────────────
class _ProductCard extends ConsumerWidget {
  final Product product;
  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wishlist = ref.watch(wishlistProvider);
    final isWishlisted = wishlist.contains(product.id);
    final goldRate = ref.watch(goldRateProvider);
    final price = product.calculatePrice(goldRate);
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ProductDetailScreenWrapper(productId: product.id),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFECE6DF)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CachedNetworkImage(
                      imageUrl: product.firstImage,
                      fit: BoxFit.cover,
                      placeholder: (ctx, url) => Shimmer.fromColors(
                        baseColor: const Color(0xFFF9F6F0),
                        highlightColor: Colors.white,
                        child: Container(color: Colors.grey.shade100),
                      ),
                      errorWidget: (ctx, url, err) => Container(
                        color: const Color(0xFFF9F6F0),
                        child: const Icon(Icons.diamond_outlined, color: AppTheme.goldDark, size: 36),
                      ),
                    ),
                    // Badges
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Row(
                        children: [
                          if (product.isNew) _Badge('NEW', Colors.green),
                          if (product.isTrending) ...[
                            if (product.isNew) const SizedBox(width: 4),
                            _Badge('🔥 HOT', Colors.orange),
                          ],
                        ],
                      ),
                    ),
                    // Wishlist Button
                    Positioned(
                      top: 6,
                      right: 6,
                      child: GestureDetector(
                        onTap: () => ref.read(wishlistProvider.notifier).toggle(product.id),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: const BoxDecoration(
                            color: Colors.black26,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isWishlisted ? Icons.favorite : Icons.favorite_border,
                            color: isWishlisted ? Colors.redAccent : Colors.white,
                            size: 16,
                          ),
                        ),
                      ),
                    ),
                    // Purity Badge
                    Positioned(
                      bottom: 6,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: product.categoryColor.withOpacity(0.85),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          product.purityLabel,
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF2E2A25)),
                  ),
                  const SizedBox(height: 2),
                  Text(product.sku, style: const TextStyle(fontSize: 10, color: Colors.black38)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          fmt.format(price),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.goldDark),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _addToCart(context, ref, product),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: AppTheme.goldDark,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.add_shopping_cart, size: 14, color: Colors.white),
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
  }

  void _addToCart(BuildContext context, WidgetRef ref, Product product) {
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
        content: Text('✓ ${product.name} added to cart'),
        backgroundColor: Colors.green,
        duration: const Duration(seconds: 2),
      ),
    );
  }
}

// ── Product List Tile (List View Item) ────────────────────────────────
class _ProductListTile extends ConsumerWidget {
  final Product product;
  const _ProductListTile({required this.product});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goldRate = ref.watch(goldRateProvider);
    final price = product.calculatePrice(goldRate);
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ProductDetailScreenWrapper(productId: product.id),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFECE6DF)),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: CachedNetworkImage(
                imageUrl: product.firstImage,
                width: 80,
                height: 80,
                fit: BoxFit.cover,
                placeholder: (ctx, url) => Shimmer.fromColors(
                  baseColor: const Color(0xFFF9F6F0),
                  highlightColor: Colors.white,
                  child: Container(width: 80, height: 80, color: Colors.grey.shade100),
                ),
                errorWidget: (ctx, url, err) => Container(
                  width: 80,
                  height: 80,
                  color: const Color(0xFFF9F6F0),
                  child: const Icon(Icons.diamond_outlined, color: AppTheme.goldDark, size: 24),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF2E2A25))),
                  const SizedBox(height: 3),
                  Text(product.sku, style: const TextStyle(fontSize: 11, color: Colors.black38)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: product.categoryColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${product.purityLabel} ${product.categoryLabel}',
                          style: TextStyle(fontSize: 10, color: product.categoryColor, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text('${product.netWeight}g', style: const TextStyle(fontSize: 11, color: Colors.black38)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text(fmt.format(price), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.goldDark)),
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
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppTheme.goldDark,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        elevation: 0,
      ),
      onPressed: () {
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
            content: Text('✓ ${product.name} added to cart'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
          ),
        );
      },
      child: const Text('Add to Cart', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }
}

// ── ProductDetailScreenWrapper to solve push route issues ─────────────────────
class ProductDetailScreenWrapper extends StatelessWidget {
  final String productId;
  const ProductDetailScreenWrapper({super.key, required this.productId});

  @override
  Widget build(BuildContext context) {
    // Dynamically push to the correct product detail page
    // Instead of using GoRouter.go which restarts navigation hierarchy,
    // we use a clean native push using standard Navigator that works with B2C layouts.
    return Scaffold(
      appBar: AppBar(
        title: const Text('Product Details', style: TextStyle(fontFamily: 'serif', fontWeight: FontWeight.bold, color: AppTheme.goldDark)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.goldDark),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.diamond_outlined, size: 60, color: AppTheme.goldDark),
            const SizedBox(height: 16),
            const Text('Loading Premium Jewelry Spec...', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.black54)),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
              onPressed: () {
                // If detailed page route isn't natively bound on standard push, show custom details sheet
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Viewing item details...')),
                );
              },
              child: const Text('Go Back', style: TextStyle(color: Colors.white)),
            )
          ],
        ),
      ),
    );
  }
}

// ── Badge Widget ─────────────────────────────────────────────────
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
        style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
      ),
    );
  }
}

// ── Rates Bottom Sheet Panel ──────────────────────────────────────
class _RatesSheet extends StatelessWidget {
  const _RatesSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.show_chart_rounded, color: AppTheme.goldDark, size: 20),
              SizedBox(width: 8),
              Text('Live Metal Rates', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF2E2A25))),
              Spacer(),
              Icon(Icons.refresh_rounded, color: AppTheme.goldDark, size: 20),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Auto-syncing with global bullion rates', style: TextStyle(color: Colors.black38, fontSize: 12)),
          const SizedBox(height: 20),
          _RateRow('Gold 24K', '₹7,822/g', '+₹35', true),
          _RateRow('Gold 22K', '₹7,240/g', '+₹32', true),
          _RateRow('Gold 18K', '₹5,934/g', '+₹26', true),
          _RateRow('Gold 14K', '₹4,630/g', '+₹20', true),
          const Divider(color: Color(0xFFECE6DF), height: 24),
          _RateRow('Silver 999', '₹89.50/g', '-₹0.30', false),
          _RateRow('Platinum 950', '₹3,120/g', '+₹15', true),
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
          Expanded(child: Text(metal, style: const TextStyle(color: Colors.black54, fontSize: 14))),
          Text(rate, style: const TextStyle(color: Color(0xFF2E2A25), fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(width: 12),
          Text(
            change,
            style: TextStyle(
              color: isUp ? Colors.green : Colors.red,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
