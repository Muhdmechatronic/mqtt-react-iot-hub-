import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/dashboard.dart';
import '../../sync/sync_notifier.dart';
import 'gauge_widget.dart';
import 'led_widget.dart';
import 'slider_widget.dart';
import 'switch_widget.dart';
import 'chart_widget.dart';

/// Renders the correct widget component based on [w.kind].
/// Pulls the current pin value directly from [deviceSyncProvider] so
/// each card rebuilds only when its own pin changes.
class WidgetRenderer extends ConsumerWidget {
  const WidgetRenderer({super.key, required this.w});
  final DashboardWidget w;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = (w.deviceId != null && w.dataKey != null)
        ? ref.watch(deviceSyncProvider
            .select((m) => m[w.deviceId!]?[w.dataKey!]))
        : null;

    return switch (w.kind) {
      WidgetKind.gauge        => GaugeWidget(widget: w, value: value),
      WidgetKind.led          => LedWidget(widget: w, value: value),
      WidgetKind.slider       => SliderWidget(widget: w, value: value),
      WidgetKind.switchWidget => SwitchWidget(widget: w, value: value),
      WidgetKind.button       => SwitchWidget(widget: w, value: value),
      WidgetKind.chart        => ChartWidget(widget: w),
      _                       => _Unknown(title: w.title),
    };
  }
}

class _Unknown extends StatelessWidget {
  const _Unknown({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color:        const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          border:       Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.help_outline, color: Colors.white24, size: 28),
              const SizedBox(height: 6),
              Text(title,
                  style: const TextStyle(color: Colors.white30, fontSize: 12)),
            ],
          ),
        ),
      );
}
