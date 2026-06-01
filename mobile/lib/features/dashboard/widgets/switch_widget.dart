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

    void toggle() {
      if (w.deviceId == null || w.dataKey == null) return;
      final next = isOn ? w.offValue : w.onValue;
      ref.read(deviceSyncProvider.notifier)
          .writePin(w.deviceId!, w.dataKey!, next, widgetId: w.id);
    }

    return _WidgetCard(
      title: w.title,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // ── Big toggle button ────────────────────────────────────────────
          GestureDetector(
            onTap: toggle,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: 64, height: 64,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isOn
                    ? const Color(0xFF0EA5E9).withValues(alpha: 0.15)
                    : Colors.white.withValues(alpha: 0.04),
                border: Border.all(
                  color: isOn
                      ? const Color(0xFF0EA5E9)
                      : Colors.white.withValues(alpha: 0.12),
                  width: 2,
                ),
                boxShadow: isOn
                    ? [
                        BoxShadow(
                            color:       const Color(0xFF0EA5E9).withValues(alpha: 0.35),
                            blurRadius:  20,
                            spreadRadius: 2),
                      ]
                    : [],
              ),
              child: Icon(
                Icons.power_settings_new_rounded,
                color: isOn ? const Color(0xFF0EA5E9) : Colors.white24,
                size:  28,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            isOn ? w.onLabel : w.offLabel,
            style: TextStyle(
              color:      isOn ? const Color(0xFF0EA5E9) : Colors.white38,
              fontSize:   13,
              fontWeight: FontWeight.w700,
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
