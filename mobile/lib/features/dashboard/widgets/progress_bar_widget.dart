import 'package:flutter/material.dart';
import '../../../models/dashboard.dart';

class ProgressBarWidget extends StatelessWidget {
  const ProgressBarWidget({super.key, required this.widget, required this.value});

  final DashboardWidget widget;
  final double? value;

  @override
  Widget build(BuildContext context) {
    final w     = widget;
    final min   = w.gaugeMin;
    final max   = w.gaugeMax;
    final color = w.widgetColor;
    final pct   = value != null
        ? ((value! - min) / (max - min)).clamp(0.0, 1.0)
        : 0.0;

    return _WidgetCard(
      title: w.title,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value != null ? value!.toStringAsFixed(1) : '--',
                style: TextStyle(
                  color: color,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (w.unit.isNotEmpty)
                Text(w.unit,
                    style: const TextStyle(color: Colors.white38, fontSize: 11)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: pct),
              duration: const Duration(milliseconds: 500),
              curve: Curves.easeInOut,
              builder: (_, v, __) => LinearProgressIndicator(
                value:           v,
                minHeight:       10,
                backgroundColor: Colors.white10,
                valueColor: AlwaysStoppedAnimation<Color>(color),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${min.toStringAsFixed(0)}${w.unit}',
                  style: const TextStyle(color: Colors.white38, fontSize: 9)),
              Text('${(pct * 100).toStringAsFixed(0)}%',
                  style: TextStyle(
                      color: color, fontSize: 9, fontWeight: FontWeight.w600)),
              Text('${max.toStringAsFixed(0)}${w.unit}',
                  style: const TextStyle(color: Colors.white38, fontSize: 9)),
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
                    color: Colors.white60,
                    fontSize: 12,
                    fontWeight: FontWeight.w600),
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 8),
            Expanded(child: child),
          ],
        ),
      );
}
