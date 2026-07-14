import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/loading_screen.dart';
import '../../features/customer_portal/presentation/customer_dashboard.dart';
import '../../features/customer_portal/presentation/catalog_screen.dart';
import '../../features/customer_portal/presentation/product_detail_screen.dart';
import '../../features/customer_portal/presentation/cart_screen.dart';
import '../../features/customer_portal/presentation/wishlist_screen.dart';
import '../../features/customer_portal/presentation/order_tracking_screen.dart';
import '../../features/customer_portal/presentation/search_page.dart';
import '../../features/customer_portal/presentation/care_guide_page.dart';
import '../../features/customer_portal/presentation/saved_addresses_page.dart';
import '../../features/customer_portal/presentation/checkout_page.dart';
import '../../features/staff_pos/presentation/staff_dashboard.dart';
import '../../features/karikar_portal/presentation/karikar_dashboard.dart';
import '../../features/owner_console/presentation/owner_dashboard.dart';
import '../../features/customer_portal/presentation/customer_referral_screen.dart';
import '../../features/owner_console/presentation/partner_referrals_screen.dart';
import '../../features/owner_console/presentation/commission_payouts_screen.dart';
import '../../features/owner_console/presentation/vendor_contracts_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/loading',
    refreshListenable: GoRouterRefreshStream(ref.read(authProvider.notifier).stream),
    routes: [
      GoRoute(
        path: '/loading',
        builder: (context, state) => const LoadingScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/customer/dashboard',
        builder: (context, state) => const CustomerDashboard(),
      ),
      GoRoute(
        path: '/staff/dashboard',
        builder: (context, state) => const StaffDashboard(),
      ),
      GoRoute(
        path: '/karikar/dashboard',
        builder: (context, state) => const KarikarDashboard(),
      ),
      GoRoute(
        path: '/owner/dashboard',
        builder: (context, state) => const OwnerDashboard(),
      ),
      GoRoute(
        path: '/customer/referral',
        builder: (context, state) => const CustomerReferralScreen(),
      ),
      GoRoute(
        path: '/owner/partner-referrals',
        builder: (context, state) => const PartnerReferralsScreen(),
      ),
      GoRoute(
        path: '/owner/referral-commissions',
        builder: (context, state) => const CommissionPayoutsScreen(),
      ),
      GoRoute(
        path: '/owner/vendor-contracts',
        builder: (context, state) => const VendorContractsScreen(),
      ),
      GoRoute(
        path: '/catalog',
        builder: (context, state) => const CatalogScreen(),
      ),
      GoRoute(
        path: '/catalog/product/:productId',
        builder: (context, state) => ProductDetailScreen(
          productId: state.pathParameters['productId']!,
        ),
      ),
      GoRoute(
        path: '/cart',
        builder: (context, state) => const CartScreen(),
      ),
      GoRoute(
        path: '/wishlist',
        builder: (context, state) => const WishlistScreen(),
      ),
      GoRoute(
        path: '/orders',
        builder: (context, state) => const OrderTrackingScreen(orderId: 'ORD001'),
      ),
      GoRoute(
        path: '/search',
        builder: (context, state) => const SearchPage(),
      ),
      GoRoute(
        path: '/care-guide',
        builder: (context, state) => const CareGuidePage(),
      ),
      GoRoute(
        path: '/saved-addresses',
        builder: (context, state) => const SavedAddressesPage(),
      ),
      GoRoute(
        path: '/checkout',
        builder: (context, state) => const CheckoutPage(),
      ),
    ],
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final isInitializing = authState.isInitializing;
      final isAuthenticated = authState.isAuthenticated;
      final user = authState.user;

      final isGoingToLoading = state.matchedLocation == '/loading';
      final isGoingToLogin = state.matchedLocation == '/login';

      // 1. If initializing, go to loading screen
      if (isInitializing) {
        return isGoingToLoading ? null : '/loading';
      }

      // 2. If not authenticated, force login page
      if (!isAuthenticated) {
        return isGoingToLogin ? null : '/login';
      }

      // 3. If authenticated, route users to their role-specific dashboard
      if (isAuthenticated) {
        if (isGoingToLoading || isGoingToLogin) {
          final role = user?['role'] as String?;
          print('[App Router] Redirecting authenticated user with role: $role');
          
          switch (role) {
            case 'CUSTOMER':
              return '/customer/dashboard';
            case 'KARIKAR':
              return '/karikar/dashboard';
            case 'ADMIN':
            case 'STORE_MANAGER':
              return '/owner/dashboard';
            case 'SALES':
            case 'SALES_STAFF':
            case 'ACCOUNTANT':
            case 'CASHIER':
              return '/staff/dashboard';
            default:
              return '/customer/dashboard'; // Default safety fallback
          }
        }
      }

      // No redirect required
      return null;
    },
  );
});

class GoRouterRefreshStream extends ChangeNotifier {
  late final StreamSubscription<dynamic> _subscription;

  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen(
          (dynamic _) => notifyListeners(),
        );
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
