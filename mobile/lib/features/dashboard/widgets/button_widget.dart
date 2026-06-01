import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/dashboard.dart';
import '../../sync/sync_notifier.dart';

/// Momentary push button — sends onValue while pressed, offValue on release.
class ButtonWidget extends ConsumerStatefulWidget {
  const ButtonWidget({super.key, required this.widget, required this.value});

  final DashboardWidget widget;
  final double? value;

  @override
  ConsumerState<ButtonWidget> createState() => _ButtonWidgetState();
}

class _ButtonWidgetState extends ConsumerState<ButtonWidget> {
  bool _pressed = false;

  void _sendValue(double v) {
    final w = widget.widget;
    if (w.deviceId == null || w.dataKey == null) return;
    ref
        .read(deviceSyncProvider.notifier)
        .writePin(w.deviceId!, w.dataKey!, v, widgetId: w.id);
  }

  void _onPressDown() {
    if (_pressed) return;
    setState(() => _pressed = true);
    _sendValue(widget.widget.onValue);
  }

  void _onPressUp() {
    if (!_pressed) return;
    setState(() => _pressed = false);
    _sendValue(widget.widget.offValue);
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
          GestureDetector(
            onTapDown: (_) => _onPressDown(),
            onTapUp: (_) => _onPressUp(),
            onTapCancel: _onPressUp,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              width: double.infinity,
              height: 52,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: _pressed
                    ? color.withValues(alpha: 0.85)
                    : color.withValues(alpha: 0.10),
                border: Border.all(
                  color: _pressed ? color : color.withValues(alpha: 0.45),
                  width: 2,
                ),
                boxShadow: _pressed
                    ? [
                        BoxShadow(
                          color: color.withValues(alpha: 0.40),
                          blurRadius: 18,
                          spreadRadius: 2,
                        ),
                      ]
                    : [],
              ),
              child: Center(
                child: Text(
                  w.buttonLabel,
                  style: TextStyle(
                    color: _pressed ? Colors.white : color,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                _pressed ? '● HIGH' : '○ LOW',
                style: TextStyle(
                  color: _pressed ? color : Colors.white38,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.8,
                ),
              ),
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
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: const TextStyle(
                  color: Colors.white60,
                  fontSize: 12,
                  fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            Expanded(child: child),
          ],
        ),
      );
}
