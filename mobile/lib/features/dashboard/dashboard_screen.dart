import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/lucide_icons.dart';
import '../../models/dashboard.dart';
import 'dashboard_list_screen.dart' show AppBottomNav;
import 'dashboard_notifier.dart';
import 'dashboard_repository.dart';
import 'widgets/widget_renderer.dart';
import '../voice/voice_control_sheet.dart';

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
          icon: const Icon(Icons.arrow_back_ios_new,
              color: Colors.white70, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: widgetsAsync.maybeWhen(
          data: (_) => const SizedBox.shrink(),
          orElse: () => const SizedBox.shrink(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined,
                color: Colors.white54, size: 20),
            onPressed: () => ref.invalidate(widgetListProvider(dashboardId)),
          ),
        ],
      ),
      body: widgetsAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(
                strokeWidth: 2, color: Color(0xFF0EA5E9))),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: Colors.redAccent))),
        data: (widgets) {
          if (widgets.isEmpty) {
            return const Center(
              child: Text('No widgets on this dashboard.',
                  style: TextStyle(color: Colors.white38)),
            );
          }
          return _ResponsiveGrid(
            widgets: widgets,
            dashboardId: dashboardId,
          );
        },
      ),
      floatingActionButton: VoiceControlFab(dashboardId: dashboardId),
      bottomNavigationBar: const AppBottomNav(currentIndex: 0),
    );
  }
}

/// Responsive 2-column grid that adapts to screen width.
class _ResponsiveGrid extends ConsumerWidget {
  const _ResponsiveGrid({
    required this.widgets,
    required this.dashboardId,
  });
  final List<DashboardWidget> widgets;
  final int dashboardId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final width      = MediaQuery.sizeOf(context).width;
    final crossCount = width >= 720 ? 3 : 2;
    const cellHeight = 180.0;

    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossCount,
        crossAxisSpacing: 10,
        mainAxisSpacing:  10,
        childAspectRatio: (width / crossCount - 22) / cellHeight,
      ),
      itemCount: widgets.length,
      itemBuilder: (_, i) {
        final w = widgets[i];
        return GestureDetector(
          onLongPress: () => _showEditSheet(context, ref, w, dashboardId),
          child: WidgetRenderer(w: w),
        );
      },
    );
  }

  void _showEditSheet(
      BuildContext context, WidgetRef ref, DashboardWidget w, int dashboardId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _WidgetEditSheet(
        widget: w,
        dashboardId: dashboardId,
        onSaved: () => ref.invalidate(widgetListProvider(dashboardId)),
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
  String? _errorMsg;

  @override
  void initState() {
    super.initState();
    final w = widget.widget;
    _titleCtrl = TextEditingController(text: w.title);
    _colorCtrl = TextEditingController(
        text: w.settings['color']?.toString() ?? '');
    _minCtrl = TextEditingController(
        text: w.settings['min']?.toString() ?? '');
    _maxCtrl = TextEditingController(
        text: w.settings['max']?.toString() ?? '');
    _unitCtrl = TextEditingController(
        text: w.settings['unit']?.toString() ?? '');
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _colorCtrl.dispose();
    _minCtrl.dispose();
    _maxCtrl.dispose();
    _unitCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() { _saving = true; _errorMsg = null; });

    try {
      // Build updated settings from current settings + edited fields
      final newSettings = Map<String, dynamic>.from(widget.widget.settings);
      if (_colorCtrl.text.trim().isNotEmpty) {
        var hex = _colorCtrl.text.trim();
        if (!hex.startsWith('#')) hex = '#$hex';
        newSettings['color'] = hex;
      }
      if (_minCtrl.text.isNotEmpty) {
        newSettings['min'] = double.tryParse(_minCtrl.text) ?? newSettings['min'];
      }
      if (_maxCtrl.text.isNotEmpty) {
        newSettings['max'] = double.tryParse(_maxCtrl.text) ?? newSettings['max'];
      }
      if (_unitCtrl.text.isNotEmpty) {
        newSettings['unit'] = _unitCtrl.text.trim();
      }

      await ref.read(dashboardRepositoryProvider).updateWidget(
        widget.widget.id,
        title: _titleCtrl.text.trim().isNotEmpty ? _titleCtrl.text.trim() : null,
        settings: newSettings,
      );

      if (mounted) {
        widget.onSaved();
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _errorMsg = 'Save failed: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final needsMinMax = [
      WidgetKind.gauge,
      WidgetKind.slider,
      WidgetKind.progressbar,
    ].contains(widget.widget.kind);

    return Container(
      margin: EdgeInsets.only(top: mq.size.height * 0.30),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top:   BorderSide(color: Color(0xFF1E293B), width: 1),
          left:  BorderSide(color: Color(0xFF1E293B), width: 1),
          right: BorderSide(color: Color(0xFF1E293B), width: 1),
        ),
      ),
      padding: EdgeInsets.fromLTRB(24, 16, 24, 24 + mq.viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: Colors.white12,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),

            // Header
            Row(
              children: [
                LucideIcons.edit(color: const Color(0xFF0EA5E9), size: 18),
                const SizedBox(width: 8),
                const Text(
                  'Edit Widget',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w700),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Title field
            const _FieldLabel('Title'),
            const SizedBox(height: 6),
            _DarkTextField(controller: _titleCtrl, hint: 'Widget title'),

            const SizedBox(height: 16),

            // Color field
            const _FieldLabel('Accent Color (hex)'),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: _DarkTextField(
                    controller: _colorCtrl,
                    hint: '#0EA5E9',
                  ),
                ),
                const SizedBox(width: 10),
                // Live preview swatch
                ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _colorCtrl,
                  builder: (_, val, __) {
                    final hex = val.text.trim();
                    final clean = hex.startsWith('#') ? hex.substring(1) : hex;
                    final c = clean.length == 6
                        ? Color(int.tryParse('FF$clean', radix: 16) ?? 0xFF0EA5E9)
                        : const Color(0xFF0EA5E9);
                    return Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: c,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.white12),
                      ),
                    );
                  },
                ),
              ],
            ),

            if (needsMinMax) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _FieldLabel('Min'),
                        const SizedBox(height: 6),
                        _DarkTextField(
                          controller: _minCtrl,
                          hint: '0',
                          keyboardType: TextInputType.number,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _FieldLabel('Max'),
                        const SizedBox(height: 6),
                        _DarkTextField(
                          controller: _maxCtrl,
                          hint: '100',
                          keyboardType: TextInputType.number,
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),
              const _FieldLabel('Unit'),
              const SizedBox(height: 6),
              _DarkTextField(controller: _unitCtrl, hint: '°C, %, rpm…'),
            ],

            if (_errorMsg != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.35)),
                ),
                child: Text(_errorMsg!,
                    style: const TextStyle(
                        color: Color(0xFFEF4444), fontSize: 13)),
              ),
            ],

            const SizedBox(height: 24),

            // Save button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Save Changes',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Helper widgets ────────────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(
            color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w600),
      );
}

class _DarkTextField extends StatelessWidget {
  const _DarkTextField({
    required this.controller,
    required this.hint,
    this.keyboardType,
  });
  final TextEditingController controller;
  final String hint;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        keyboardType: keyboardType,
        style: const TextStyle(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Colors.white24, fontSize: 14),
          filled: true,
          fillColor: const Color(0xFF1E293B),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Colors.white12),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Colors.white12),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide:
                const BorderSide(color: Color(0xFF0EA5E9), width: 1.5),
          ),
        ),
      );
}
