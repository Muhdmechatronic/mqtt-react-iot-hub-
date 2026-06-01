import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../models/dashboard.dart';

class GaugeWidget extends StatelessWidget {
  const GaugeWidget({
    super.key,
    required this.widget,
    required this.value,
  });

  final DashboardWidget widget;
  final double? value;

  @override
  Widget build(BuildContext context) {
    final v     = value ?? widget.gaugeMin;
    final frac  = ((v - widget.gaugeMin) / (widget.gaugeMax - widget.gaugeMin))
        .clamp(0.0, 1.0);
    final color = _arcColor(frac);

    return _WidgetCard(
      title: widget.title,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 130,
            height: 90,
            child: CustomPaint(painter: _GaugePainter(frac: frac, color: color)),
          ),
          const SizedBox(height: 4),
          Text(
            '${v.toStringAsFixed(1)}${widget.unit.isNotEmpty ? ' ${widget.unit}' : ''}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${widget.gaugeMin}',
                  style: const TextStyle(color: Colors.white38, fontSize: 11)),
              Text('${widget.gaugeMax}',
                  style: const TextStyle(color: Colors.white38, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }

  Color _arcColor(double frac) {
    if (frac < 0.5) return Color.lerp(Colors.green, Colors.orange, frac * 2)!;
    return Color.lerp(Colors.orange, Colors.red, (frac - 0.5) * 2)!;
  }
}

class _GaugePainter extends CustomPainter {
  const _GaugePainter({required this.frac, required this.color});
  final double frac;
  final Color color;

  static const _startAngle = math.pi * 0.75;
  static const _sweep      = math.pi * 1.5;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height * 0.85;
    final r  = size.width * 0.42;
    final rect = Rect.fromCircle(center: Offset(cx, cy), radius: r);

    // Background track
    canvas.drawArc(rect, _startAngle, _sweep, false,
        Paint()
          ..color       = Colors.white10
          ..style       = PaintingStyle.stroke
          ..strokeWidth = 14
          ..strokeCap   = StrokeCap.round);

    // Value arc
    if (frac > 0) {
      canvas.drawArc(rect, _startAngle, _sweep * frac, false,
          Paint()
            ..color       = color
            ..style       = PaintingStyle.stroke
            ..strokeWidth = 14
            ..strokeCap   = StrokeCap.round);
    }
  }

  @override
  bool shouldRepaint(_GaugePainter old) =>
      old.frac != frac || old.color != color;
}

// ── Shared card frame ─────────────────────────────────────────────────────────

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
