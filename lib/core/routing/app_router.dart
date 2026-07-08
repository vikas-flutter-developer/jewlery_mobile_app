import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/loading_screen.dart';
import '../../features/customer_portal/presentation/customer_dashboard.dart';
import '../../features/staff_pos/presentation/staff_dashboard.dart';
import '../../features/karikar_portal/presentation/karikar_dashboard.dart';
import '../../features/owner_console/presentation/owner_dashboard.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/loading',
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
    ],
    redirect: (context, state) {
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
