import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/dashboard.dart';
import '../../sync/sync_notifier.dart';

class SwitchWidget extends ConsumerWidget {
  const SwitchWidget({super.key, required this.widget, required this.value});

  final DashboardWidget widget;
  final double? value;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final w     = widget;
    final isOn  = (value ?? w.offValue) == w.onValue;
    final color = w.widgetColor;

    void toggle() {
      if (w.deviceId == null || w.dataKey == null) return;
      final next = isOn ? w.offValue : w.onValue;
      ref
          .read(deviceSyncProvider.notifier)
          .writePin(w.deviceId!, w.dataKey!, next, widgetId: w.id);
    }

    return _WidgetCard(
      title: w.title,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          GestureDetector(
            onTap: toggle,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: 64,
              height: 34,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(99),
                color: isOn
                    ? color.withValues(alpha: 0.85)
                    : Colors.white.withValues(alpha: 0.08),
                border: Border.all(
                  color: isOn ? color : Colors.white.withValues(alpha: 0.18),
                  width: 1.5,
                ),
                boxShadow: isOn
                    ? [
                        BoxShadow(
                          color: color.withValues(alpha: 0.35),
                          blurRadius: 12,
                          spreadRadius: 1,
                        ),
                      ]
                    : [],
              ),
              child: Stack(
                children: [
                  AnimatedPositioned(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeInOut,
                    left: isOn ? 34 : 4,
                    top: 5,
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isOn ? Colors.white : Colors.white54,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.25),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            isOn ? w.onLabel : w.offLabel,
            style: TextStyle(
              color:         isOn ? color : Colors.white38,
              fontSize:      13,
              fontWeight:    FontWeight.w700,
              letterSpacing: 0.5,
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
