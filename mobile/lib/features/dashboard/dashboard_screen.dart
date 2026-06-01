import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/lucide_icons.dart';
import '../../models/dashboard.dart';
import '../voice/voice_control_sheet.dart';
import 'dashboard_list_screen.dart' show AppBottomNav;
import 'dashboard_notifier.dart';
import 'dashboard_repository.dart';
import 'widgets/widget_renderer.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key, required this.dashboardId});
  final int dashboardId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final widgetsAsync = ref.watch(widgetListProvider(dashboardId));

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation:       0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white70, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          // Settings button — opens widget settings page (no long-press conflict)
          IconButton(
            icon: const Icon(Icons.tune_rounded, color: Colors.white54, size: 22),
            tooltip: 'Widget Settings',
            onPressed: () => widgetsAsync.whenData((widgets) {
              if (widgets.isNotEmpty) {
                _showSettingsSheet(context, ref, widgets, dashboardId);
              }
            }),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_outlined, color: Colors.white54, size: 20),
            onPressed: () => ref.invalidate(widgetListProvider(dashboardId)),
          ),
        ],
      ),
      body: widgetsAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(
                strokeWidth: 2, color: Color(0xFF0EA5E9))),
        error: (e, _) => _ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(widgetListProvider(dashboardId)),
        ),
        data: (widgets) {
          if (widgets.isEmpty) {
            return _EmptyDashboard(
              onRefresh: () => ref.invalidate(widgetListProvider(dashboardId)),
            );
          }
          return _ResponsiveGrid(widgets: widgets);
        },
      ),
      floatingActionButton: VoiceControlFab(dashboardId: dashboardId),
      bottomNavigationBar: const AppBottomNav(currentIndex: 0),
    );
  }

  void _showSettingsSheet(
    BuildContext context,
    WidgetRef ref,
    List<DashboardWidget> widgets,
    int dashboardId,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _WidgetSettingsSheet(
        widgets:     widgets,
        dashboardId: dashboardId,
        onSaved:     () => ref.invalidate(widgetListProvider(dashboardId)),
      ),
    );
  }
}

// ── Responsive grid (no long-press — edit is in app bar) ──────────────────────

class _ResponsiveGrid extends StatelessWidget {
  const _ResponsiveGrid({required this.widgets});
  final List<DashboardWidget> widgets;

  @override
  Widget build(BuildContext context) {
    final width      = MediaQuery.sizeOf(context).width;
    final crossCount = width >= 720 ? 3 : 2;
    const cellHeight = 180.0;

    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount:   crossCount,
        crossAxisSpacing: 10,
        mainAxisSpacing:  10,
        childAspectRatio: (width / crossCount - 22) / cellHeight,
      ),
      itemCount: widgets.length,
      itemBuilder: (_, i) => WidgetRenderer(w: widgets[i]),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyDashboard extends StatelessWidget {
  const _EmptyDashboard({required this.onRefresh});
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              LucideIcons.layoutDashboard(color: Colors.white24, size: 48),
              const SizedBox(height: 16),
              const Text(
                'No widgets yet',
                style: TextStyle(color: Colors.white38, fontSize: 16),
              ),
              const SizedBox(height: 8),
              Text(
                'Add widgets to this dashboard\nfrom the web app.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.2), fontSize: 13),
              ),
              const SizedBox(height: 24),
              GestureDetector(
                onTap: onRefresh,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0EA5E9).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: const Color(0xFF0EA5E9).withValues(alpha: 0.3)),
                  ),
                  child: const Text('Refresh',
                      style: TextStyle(
                          color: Color(0xFF0EA5E9),
                          fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      );
}

// ── Error state ───────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              LucideIcons.helpCircle(color: Colors.redAccent, size: 40),
              const SizedBox(height: 16),
              const Text('Failed to load widgets',
                  style: TextStyle(color: Colors.white54, fontSize: 15)),
              const SizedBox(height: 8),
              Text(
                message.length > 120 ? '${message.substring(0, 120)}…' : message,
                style: const TextStyle(color: Colors.white30, fontSize: 11),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: onRetry,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
}

// ── Widget settings bottom sheet ──────────────────────────────────────────────

class _WidgetSettingsSheet extends StatelessWidget {
  const _WidgetSettingsSheet({
    required this.widgets,
    required this.dashboardId,
    required this.onSaved,
  });
  final List<DashboardWidget> widgets;
  final int dashboardId;
  final VoidCallback onSaved;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    return Container(
      margin: EdgeInsets.only(top: mq.size.height * 0.15),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top:   BorderSide(color: Color(0xFF1E293B)),
          left:  BorderSide(color: Color(0xFF1E293B)),
          right: BorderSide(color: Color(0xFF1E293B)),
        ),
      ),
      child: Column(
        children: [
          // Handle
          Container(
            width: 40, height: 4,
            margin: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white12,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Row(
              children: [
                LucideIcons.edit(color: const Color(0xFF0EA5E9), size: 18),
                const SizedBox(width: 10),
                const Text('Widget Settings',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w700)),
                const Spacer(),
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: LucideIcons.x(color: Colors.white38, size: 20),
                ),
              ],
            ),
          ),
          const Divider(color: Color(0xFF1E293B), height: 1),
          // Widget list
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: widgets.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (ctx, i) => _WidgetSettingsTile(
                widget:      widgets[i],
                dashboardId: dashboardId,
                onSaved:     onSaved,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WidgetSettingsTile extends ConsumerWidget {
  const _WidgetSettingsTile({
    required this.widget,
    required this.dashboardId,
    required this.onSaved,
  });
  final DashboardWidget widget;
  final int dashboardId;
  final VoidCallback onSaved;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = widget.widgetColor;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color:        const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border:       Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          // Color swatch
          Container(
            width: 14, height: 14,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          // Widget info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.title,
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                    overflow: TextOverflow.ellipsis),
                Text(widget.kind.name,
                    style: const TextStyle(color: Colors.white38, fontSize: 11)),
              ],
            ),
          ),
          // Edit button
          GestureDetector(
            onTap: () => _showEdit(context, ref),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color:        const Color(0xFF0EA5E9).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
                border:       Border.all(
                    color: const Color(0xFF0EA5E9).withValues(alpha: 0.3)),
              ),
              child: LucideIcons.edit(color: const Color(0xFF0EA5E9), size: 14),
            ),
          ),
        ],
      ),
    );
  }

  void _showEdit(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context:           context,
      isScrollControlled: true,
      backgroundColor:   Colors.transparent,
      builder: (_) => _WidgetEditSheet(
        widget:      widget,
        dashboardId: dashboardId,
        onSaved:     onSaved,
      ),
    );
  }
}

// ── Widget edit bottom sheet ──────────────────────────────────────────────────

class _WidgetEditSheet extends ConsumerStatefulWidget {
  const _WidgetEditSheet({
    required this.widget,
    required this.dashboardId,
    required this.onSaved,
  });
  final DashboardWidget widget;
  final int dashboardId;
  final VoidCallback onSaved;

  @override
  ConsumerState<_WidgetEditSheet> createState() => _WidgetEditSheetState();
}

class _WidgetEditSheetState extends ConsumerState<_WidgetEditSheet> {
  late final TextEditingController _titleCtrl;
  late final TextEditingController _colorCtrl;
  late final TextEditingController _minCtrl;
  late final TextEditingController _maxCtrl;
  late final TextEditingController _unitCtrl;

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final w = widget.widget;
    final s = w.settings;
    _titleCtrl = TextEditingController(text: w.title);
    _colorCtrl = TextEditingController(text: s['color']?.toString() ?? '');
    _minCtrl   = TextEditingController(text: s['min']?.toString() ?? '');
    _maxCtrl   = TextEditingController(text: s['max']?.toString() ?? '');
    _unitCtrl  = TextEditingController(text: s['unit']?.toString() ?? '');
  }

  @override
  void dispose() {
    _titleCtrl.dispose(); _colorCtrl.dispose();
    _minCtrl.dispose();   _maxCtrl.dispose();
    _unitCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() { _saving = true; _error = null; });
    try {
      final newSettings = Map<String, dynamic>.from(widget.widget.settings);
      var hex = _colorCtrl.text.trim();
      if (hex.isNotEmpty) {
        if (!hex.startsWith('#')) hex = '#$hex';
        newSettings['color'] = hex;
      }
      if (_minCtrl.text.isNotEmpty)
        newSettings['min']  = double.tryParse(_minCtrl.text) ?? newSettings['min'];
      if (_maxCtrl.text.isNotEmpty)
        newSettings['max']  = double.tryParse(_maxCtrl.text) ?? newSettings['max'];
      if (_unitCtrl.text.isNotEmpty)
        newSettings['unit'] = _unitCtrl.text.trim();

      await ref.read(dashboardRepositoryProvider).updateWidget(
        widget.widget.id,
        title:    _titleCtrl.text.trim().isNotEmpty ? _titleCtrl.text.trim() : null,
        settings: newSettings,
      );
      widget.onSaved();
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() { _saving = false; _error = e.toString(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final needsMinMax = {
      WidgetKind.gauge, WidgetKind.slider, WidgetKind.progressbar,
    }.contains(widget.widget.kind);

    return Container(
      margin: EdgeInsets.only(top: mq.size.height * 0.35),
      padding: EdgeInsets.fromLTRB(24, 16, 24, 24 + mq.viewInsets.bottom),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top:   BorderSide(color: Color(0xFF1E293B)),
          left:  BorderSide(color: Color(0xFF1E293B)),
          right: BorderSide(color: Color(0xFF1E293B)),
        ),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40, height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: Colors.white12,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            Row(children: [
              LucideIcons.edit(color: const Color(0xFF0EA5E9), size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Edit: ${widget.widget.title}',
                  style: const TextStyle(
                      color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ]),
            const SizedBox(height: 20),

            _label('Title'),
            const SizedBox(height: 6),
            _field(_titleCtrl, 'Widget title'),

            const SizedBox(height: 14),
            _label('Accent Color'),
            const SizedBox(height: 6),
            Row(children: [
              Expanded(child: _field(_colorCtrl, '#0EA5E9')),
              const SizedBox(width: 10),
              ValueListenableBuilder(
                valueListenable: _colorCtrl,
                builder: (_, val, __) {
                  final hex   = val.text.trim();
                  final clean = hex.startsWith('#') ? hex.substring(1) : hex;
                  final c     = clean.length == 6
                      ? Color(int.tryParse('FF$clean', radix: 16) ?? 0xFF0EA5E9)
                      : const Color(0xFF0EA5E9);
                  return Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: c,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white12),
                    ),
                  );
                },
              ),
            ]),

            if (needsMinMax) ...[
              const SizedBox(height: 14),
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _label('Min'),
                  const SizedBox(height: 6),
                  _field(_minCtrl, '0', numeric: true),
                ])),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _label('Max'),
                  const SizedBox(height: 6),
                  _field(_maxCtrl, '100', numeric: true),
                ])),
              ]),
              const SizedBox(height: 14),
              _label('Unit'),
              const SizedBox(height: 6),
              _field(_unitCtrl, '°C, %, rpm…'),
            ],

            if (_error != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
                ),
                child: Text(_error!,
                    style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12)),
              ),
            ],

            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity, height: 48,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _saving
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Save Changes',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String t) => Text(t,
      style: const TextStyle(
          color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w600));

  Widget _field(TextEditingController ctrl, String hint, {bool numeric = false}) =>
      TextField(
        controller:   ctrl,
        keyboardType: numeric ? TextInputType.number : TextInputType.text,
        style:        const TextStyle(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          hintText:       hint,
          hintStyle:      const TextStyle(color: Colors.white24, fontSize: 14),
          filled:         true,
          fillColor:      const Color(0xFF1E293B),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Colors.white12)),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Colors.white12)),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF0EA5E9), width: 1.5)),
        ),
      );
}
