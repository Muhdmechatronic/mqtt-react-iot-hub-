import 'package:flutter/material.dart';
import '../../../core/lucide_icons.dart';
import '../../../models/dashboard.dart';

class LedWidget extends StatelessWidget {
  const LedWidget({super.key, required this.widget, required this.value});

  final DashboardWidget widget;
  final double? value;

  @override
  Widget build(BuildContext context) {
    final w        = widget;
    final color    = w.widgetColor;
    final ledMode  = w.ledMode;
    final threshold = w.ledThreshold;
    final pwmMin   = w.ledPwmMin;
    final pwmMax   = w.ledPwmMax;

    // Calculate brightness
    double brightness;
    if (ledMode == 'pwm') {
      final v = value ?? 0;
      brightness = (pwmMax > pwmMin)
          ? ((v - pwmMin) / (pwmMax - pwmMin)).clamp(0.0, 1.0)
          : 0.0;
    } else {
      brightness = (value ?? 0) >= threshold ? 1.0 : 0.0;
    }

    final on = brightness > 0.01;

    // Effective glow color with brightness-modulated alpha
    final glowColor = color.withValues(alpha: brightness * 0.55);
    final circleColor = on
        ? Color.lerp(color.withValues(alpha: 0.25), color, brightness)!
        : const Color(0xFF334155);

    String label;
    if (ledMode == 'pwm') {
      label = on ? '${(brightness * 100).round()}%' : 'OFF';
    } else {
      label = on ? 'ON' : 'OFF';
    }

    return _WidgetCard(
      title: w.title,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: circleColor,
              gradient: on
                  ? RadialGradient(
                      colors: [
                        color.withValues(alpha: brightness * 0.9),
                        color.withValues(alpha: brightness * 0.4),
                      ],
                      radius: 0.85,
                    )
                  : null,
              boxShadow: on
                  ? [
                      BoxShadow(
                        color: glowColor,
                        blurRadius: 20 + (brightness * 16),
                        spreadRadius: 2 + (brightness * 4),
                      ),
                    ]
                  : [],
            ),
            child: Center(
              child: LucideIcons.lightbulb(
                color: on ? Colors.white.withValues(alpha: 0.85 + brightness * 0.15) : Colors.white24,
                size: 22,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            label,
            style: TextStyle(
              color: on
                  ? Color.lerp(color.withValues(alpha: 0.6), color, brightness)
                  : Colors.white38,
              fontSize: 13,
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
