import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/dashboard.dart';
import '../../sync/sync_notifier.dart';

class SliderWidget extends ConsumerStatefulWidget {
  const SliderWidget({super.key, required this.widget, required this.value});

  final DashboardWidget widget;
  final double? value;

  @override
  ConsumerState<SliderWidget> createState() => _SliderWidgetState();
}

class _SliderWidgetState extends ConsumerState<SliderWidget> {
  double? _dragging; // local ephemeral value while dragging

  double get _effective =>
      _dragging ??
      widget.value?.clamp(widget.widget.sliderMin, widget.widget.sliderMax) ??
      widget.widget.sliderMin;

  void _onChanged(double v) => setState(() => _dragging = v);

  void _onChangeEnd(double v) {
    setState(() => _dragging = null);
    final w = widget.widget;
    if (w.deviceId == null || w.dataKey == null) return;
    ref.read(deviceSyncProvider.notifier).writePin(
      w.deviceId!,
      w.dataKey!,
      v,
      widgetId: w.id,
    );
  }

  @override
  Widget build(BuildContext context) {
    final w     = widget.widget;
    final color = w.widgetColor;

    return _WidgetCard(
      title: w.title,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '${_effective.toStringAsFixed(1)}${w.unit.isNotEmpty ? ' ${w.unit}' : ''}',
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor:   color,
              inactiveTrackColor: Colors.white12,
              thumbColor:         color,
              overlayColor:       color.withValues(alpha: 0.15),
              trackHeight:        4,
            ),
            child: Slider(
              value:    _effective,
              min:      w.sliderMin,
              max:      w.sliderMax,
              divisions: w.sliderStep > 0
                  ? ((w.sliderMax - w.sliderMin) / w.sliderStep).round()
                  : null,
              onChanged:   _onChanged,
              onChangeEnd: _onChangeEnd,
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${w.sliderMin}',
                  style: const TextStyle(color: Colors.white38, fontSize: 10)),
              Text('${w.sliderMax}',
                  style: const TextStyle(color: Colors.white38, fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }
}

class _WidgetCard extends StatelessWidget {
  const _WidgetCard({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color:        const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          border:       Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title,
                style: const TextStyle(
                    color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w600),
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 4),
            Expanded(child: child),
          ],
        ),
      );
}
