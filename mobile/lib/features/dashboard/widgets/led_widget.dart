import 'package:flutter/material.dart';
import '../../../core/lucide_icons.dart';
import '../../../models/dashboard.dart';

class LedWidget extends StatelessWidget {
  const LedWidget({super.key, required this.widget, required this.value});

  final DashboardWidget widget;
  final double? value;

  @override
  Widget build(BuildContext context) {
    final on  = (value ?? 0) > 0;
    final pwm = (value ?? 0).clamp(0.0, 255.0);
    final pct = ((pwm / 255.0) * 100).round();
    final color = on ? const Color(0xFF22C55E) : const Color(0xFF334155);
    final glow  = on
        ? [
            BoxShadow(
                color:        const Color(0xFF22C55E).withValues(alpha: 0.4),
                blurRadius:   24,
                spreadRadius: 4),
          ]
        : <BoxShadow>[];

    return _WidgetCard(
      title: widget.title,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: 52, height: 52,
            decoration: BoxDecoration(
              shape:     BoxShape.circle,
              color:     color,
              boxShadow: glow,
            ),
            child: Center(
              child: LucideIcons.lightbulb(
                  color: on ? Colors.white : Colors.white24, size: 22),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            on ? (pwm < 255 ? 'ON  $pct%' : 'ON') : 'OFF',
            style: TextStyle(
              color:      on ? Colors.white : Colors.white38,
              fontSize:   13,
              fontWeight: FontWeight.w600,
            ),
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
            const SizedBox(height: 8),
            Expanded(child: child),
          ],
        ),
      );
}
