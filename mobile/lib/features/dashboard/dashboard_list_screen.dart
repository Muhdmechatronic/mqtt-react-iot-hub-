import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_notifier.dart';
import 'dashboard_notifier.dart';

class DashboardListScreen extends ConsumerWidget {
  const DashboardListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth      = ref.watch(authNotifierProvider).valueOrNull;
    final dashAsync = ref.watch(dashboardListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation:       0,
        title: Row(children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color:        const Color(0xFF0EA5E9).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
              border:       Border.all(
                  color: const Color(0xFF0EA5E9).withValues(alpha: 0.3)),
            ),
            child: const Icon(Icons.memory_rounded,
                color: Color(0xFF0EA5E9), size: 16),
          ),
          const SizedBox(width: 10),
          const Text('IoT Platform',
              style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 17)),
        ]),
        actions: [
          if (auth?.avatar != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: CircleAvatar(
                radius: 16,
                backgroundImage: NetworkImage(auth!.avatar!),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white54, size: 20),
            onPressed: () => ref.read(authNotifierProvider.notifier).logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFF0EA5E9),
        onRefresh: () =>
            ref.read(dashboardListProvider.notifier).refresh(),
        child: dashAsync.when(
          loading: () => const Center(
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: Color(0xFF0EA5E9))),
          error: (e, _) => Center(
              child: Text('Error: $e',
                  style: const TextStyle(color: Colors.redAccent))),
          data: (dashboards) => dashboards.isEmpty
              ? _EmptyState()
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: dashboards.length,
                  itemBuilder: (ctx, i) {
                    final d = dashboards[i];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                        tileColor: const Color(0xFF1E293B),
                        leading: Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color:        const Color(0xFF0EA5E9).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.dashboard_outlined,
                              color: Color(0xFF0EA5E9), size: 20),
                        ),
                        title: Text(d.name,
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w600)),
                        trailing: const Icon(Icons.chevron_right,
                            color: Colors.white30),
                        onTap: () => context.push('/dashboard/${d.id}'),
                      ),
                    );
                  },
                ),
        ),
      ),
      bottomNavigationBar: AppBottomNav(currentIndex: 0),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.dashboard_outlined, color: Colors.white24, size: 48),
          const SizedBox(height: 12),
          const Text('No dashboards yet',
              style: TextStyle(color: Colors.white38, fontSize: 15)),
          const SizedBox(height: 6),
          Text('Create one on the web app first.',
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.2), fontSize: 12)),
        ]),
      );
}

class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key, required this.currentIndex});
  final int currentIndex;

  @override
  Widget build(BuildContext context) => BottomNavigationBar(
        currentIndex:     currentIndex,
        backgroundColor:  const Color(0xFF1E293B),
        selectedItemColor: const Color(0xFF0EA5E9),
        unselectedItemColor: Colors.white30,
        type:             BottomNavigationBarType.fixed,
        onTap: (i) {
          switch (i) {
            case 0: context.go('/dashboards');
            case 1: context.go('/devices');
            case 2: context.go('/export');
          }
        },
        items: const [
          BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined), label: 'Dashboards'),
          BottomNavigationBarItem(
              icon: Icon(Icons.memory_outlined), label: 'Devices'),
          BottomNavigationBarItem(
              icon: Icon(Icons.download_outlined), label: 'Export'),
        ],
      );
}
