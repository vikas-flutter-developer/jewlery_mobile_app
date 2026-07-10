import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/product.dart';
import '../../../core/models/transaction.dart';
import '../../../core/models/order.dart';
import '../../../core/models/retailer.dart';
import '../../../core/mock_data.dart';

// ── User / Profile Provider ────────────────────────────────────────
final userProvider = StateProvider<Retailer>((ref) {
  return MockDataService.currentRetailer;
});

// ── Gold Rate Provider ───────────────────────────────────────────
final goldRateProvider = StateProvider<double>((ref) {
  return MockDataService.goldRatePerGram;
});

// ── Catalog Providers ────────────────────────────────────────────
final selectedCategoryProvider = StateProvider<JewelryCategory?>((ref) => null);
final searchQueryProvider = StateProvider<String>((ref) => '');
final sortOptionProvider = StateProvider<String>((ref) => 'Trending');
final showGridViewProvider = StateProvider<bool>((ref) => true);

final filteredProductsProvider = Provider<List<Product>>((ref) {
  final category = ref.watch(selectedCategoryProvider);
  final query = ref.watch(searchQueryProvider);
  final sort = ref.watch(sortOptionProvider);

  var products = MockDataService.products;

  if (category != null) {
    products = products.where((p) => p.category == category).toList();
  }

  if (query.isNotEmpty) {
    final q = query.toLowerCase();
    products = products.where((p) {
      return p.name.toLowerCase().contains(q) ||
          p.sku.toLowerCase().contains(q) ||
          p.tags.any((t) => t.contains(q));
    }).toList();
  }

  switch (sort) {
    case 'Trending':
      products.sort((a, b) => b.orderCount.compareTo(a.orderCount));
    case 'New Arrivals':
      products = products.where((p) => p.isNew).toList() +
          products.where((p) => !p.isNew).toList();
    case 'Price: Low to High':
      products.sort((a, b) => a.calculatePrice(MockDataService.goldRatePerGram)
          .compareTo(b.calculatePrice(MockDataService.goldRatePerGram)));
    case 'Price: High to Low':
      products.sort((a, b) => b.calculatePrice(MockDataService.goldRatePerGram)
          .compareTo(a.calculatePrice(MockDataService.goldRatePerGram)));
    case 'Rating':
      products.sort((a, b) => b.rating.compareTo(a.rating));
  }

  return products;
});

final wishlistProvider = StateNotifierProvider<WishlistNotifier, List<String>>(
  (ref) => WishlistNotifier(),
);

class WishlistNotifier extends StateNotifier<List<String>> {
  WishlistNotifier() : super([]);

  void toggle(String productId) {
    if (state.contains(productId)) {
      state = state.where((id) => id != productId).toList();
    } else {
      state = [...state, productId];
    }
  }

  bool isWishlisted(String productId) => state.contains(productId);
}

// ── Cart Provider ────────────────────────────────────────────────
final cartProvider = StateNotifierProvider<CartNotifier, List<CartItem>>(
  (ref) => CartNotifier(),
);

class CartNotifier extends StateNotifier<List<CartItem>> {
  CartNotifier() : super([]);

  void add(CartItem item) {
    final index = state.indexWhere((i) => i.productId == item.productId);
    if (index >= 0) {
      state = [
        for (int i = 0; i < state.length; i++)
          if (i == index)
            state[i].copyWith(quantity: state[i].quantity + item.quantity)
          else
            state[i]
      ];
    } else {
      state = [...state, item];
    }
  }

  void remove(String productId) {
    state = state.where((i) => i.productId != productId).toList();
  }

  void updateQuantity(String productId, int qty) {
    if (qty <= 0) {
      remove(productId);
      return;
    }
    state = [
      for (final item in state)
        if (item.productId == productId) item.copyWith(quantity: qty) else item
    ];
  }

  void clear() => state = [];

  double get subtotal => state.fold(0, (sum, item) => sum + item.total);
  double get gst => subtotal * 0.03;
  double get total => subtotal + gst;
  int get itemCount => state.fold(0, (sum, item) => sum + item.quantity);
}

// ── Order Provider ───────────────────────────────────────────────
final ordersProvider = StateNotifierProvider<OrdersNotifier, List<Order>>(
  (ref) => OrdersNotifier(),
);

class OrdersNotifier extends StateNotifier<List<Order>> {
  OrdersNotifier() : super(MockDataService.orders);

  void add(Order order) => state = [order, ...state];
}

// ── Ledger Provider ──────────────────────────────────────────────
final ledgerProvider = Provider<List<LedgerTransaction>>((ref) {
  return MockDataService.ledgerTransactions;
});

final ledgerFilterProvider = StateProvider<String>((ref) => 'All');
