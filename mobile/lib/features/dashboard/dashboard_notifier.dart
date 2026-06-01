import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/dashboard.dart';
import '../sync/sync_notifier.dart';
import 'dashboard_repository.dart';

// ── Dashboard list ────────────────────────────────────────────────────────────

class DashboardListNotifier extends AsyncNotifier<List<Dashboard>> {
  @override
  Future<List<Dashboard>> build() =>
      ref.watch(dashboardRepositoryProvider).listDashboards();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
        () => ref.read(dashboardRepositoryProvider).listDashboards());
  }
}

final dashboardListProvider =
    AsyncNotifierProvider<DashboardListNotifier, List<Dashboard>>(
        DashboardListNotifier.new);

// ── Widget list for a specific dashboard ─────────────────────────────────────

class WidgetListNotifier
    extends FamilyAsyncNotifier<List<DashboardWidget>, int> {
  @override
  Future<List<DashboardWidget>> build(int dashboardId) async {
    final widgets =
        await ref.watch(dashboardRepositoryProvider).listWidgets(dashboardId);

    // Subscribe to device rooms for all widgets that have a device.
    final deviceIds =
        widgets.map((w) => w.deviceId).whereType<int>().toSet();
    final sync = ref.read(deviceSyncProvider.notifier);
    for (final id in deviceIds) {
      sync.subscribe(id);
    }
    // Unsubscribe when this provider is disposed (dashboard no longer visible).
    ref.onDispose(() {
      for (final id in deviceIds) {
        sync.unsubscribe(id);
      }
    });

    return widgets;
  }
}

final widgetListProvider =
    AsyncNotifierProvider.family<WidgetListNotifier, List<DashboardWidget>, int>(
        WidgetListNotifier.new);
