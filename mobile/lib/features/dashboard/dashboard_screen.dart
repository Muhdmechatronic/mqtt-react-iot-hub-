import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dashboard_list_screen.dart' show AppBottomNav;
import 'dashboard_notifier.dart';
import 'widgets/widget_renderer.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key, required this.dashboardId});
  final int dashboardId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final widgetsAsync = ref.watch(widgetListProvider(dashboardId));

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation:       0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              color: Colors.white70, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: widgetsAsync.maybeWhen(
          data: (_) => const SizedBox.shrink(),
          orElse: () => const SizedBox.shrink(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined,
                color: Colors.white54, size: 20),
            onPressed: () => ref.invalidate(widgetListProvider(dashboardId)),
          ),
        ],
      ),
      body: widgetsAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(
                strokeWidth: 2, color: Color(0xFF0EA5E9))),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: Colors.redAccent))),
        data: (widgets) {
          if (widgets.isEmpty) {
            return const Center(
              child: Text('No widgets on this dashboard.',
                  style: TextStyle(color: Colors.white38)),
            );
          }
          return _ResponsiveGrid(widgets: widgets);
        },
      ),
      bottomNavigationBar: const AppBottomNav(currentIndex: 0),
    );
  }
}

/// Responsive 2-column grid that adapts to screen width.
/// On tablets (≥ 600 dp) it switches to 3 columns automatically.
class _ResponsiveGrid extends StatelessWidget {
  const _ResponsiveGrid({required this.widgets});
  final List<dynamic> widgets; // List<DashboardWidget>

  @override
  Widget build(BuildContext context) {
    final width      = MediaQuery.sizeOf(context).width;
    final crossCount = width >= 720 ? 3 : 2;
    const cellHeight = 180.0;

    return GridView.builder(
      padding:     const EdgeInsets.all(12),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossCount,
        crossAxisSpacing: 10,
        mainAxisSpacing:  10,
        childAspectRatio: (width / crossCount - 22) / cellHeight,
      ),
      itemCount: widgets.length,
      itemBuilder: (_, i) => WidgetRenderer(w: widgets[i]),
    );
  }
}
