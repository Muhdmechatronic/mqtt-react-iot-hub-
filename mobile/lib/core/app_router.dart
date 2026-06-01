import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/auth_notifier.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/dashboard_list_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/devices/devices_screen.dart';
import '../features/export/export_screen.dart';

// Listens to auth state changes and notifies GoRouter to re-evaluate redirects.
class _RouterNotifier extends ChangeNotifier {
  _RouterNotifier(this._ref) {
    _ref.listen(authNotifierProvider, (_, __) => notifyListeners());
  }
  final Ref _ref;
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final notifier = _RouterNotifier(ref);

  return GoRouter(
    refreshListenable: notifier,
    initialLocation:   '/dashboards',
    redirect: (context, state) {
      final auth    = ref.read(authNotifierProvider);
      final loading = auth.isLoading;
      if (loading) return null; // splash-like: don't redirect while restoring session

      final loggedIn = auth.valueOrNull != null;
      final isLogin  = state.matchedLocation == '/login';

      if (!loggedIn && !isLogin) return '/login';
      if (loggedIn  &&  isLogin) return '/dashboards';
      return null;
    },
    routes: [
      GoRoute(
        path:    '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path:    '/dashboards',
        builder: (_, __) => const DashboardListScreen(),
      ),
      GoRoute(
        path:    '/dashboard/:id',
        builder: (_, state) {
          final id = int.tryParse(state.pathParameters['id'] ?? '') ?? 0;
          return DashboardScreen(dashboardId: id);
        },
      ),
      GoRoute(
        path:    '/devices',
        builder: (_, __) => const DevicesScreen(),
      ),
      GoRoute(
        path:    '/export',
        builder: (_, __) => const ExportScreen(),
      ),
    ],
    errorBuilder: (_, state) => Scaffold(
      body: Center(
        child: Text('Page not found: ${state.error}',
            style: const TextStyle(color: Colors.white)),
      ),
    ),
  );
});
