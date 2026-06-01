import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../models/iot_device.dart';
import '../../services/api_client.dart';
import '../dashboard/dashboard_list_screen.dart' show AppBottomNav;
import 'export_notifier.dart';

final _exportDevicesProvider = FutureProvider<List<IotDevice>>((ref) async {
  final resp = await ref.watch(dioProvider).get('/device/list');
  return (resp.data as List)
      .map((j) => IotDevice.fromJson(j as Map<String, dynamic>))
      .toList();
});

class ExportScreen extends ConsumerStatefulWidget {
  const ExportScreen({super.key});
  @override
  ConsumerState<ExportScreen> createState() => _ExportScreenState();
}

class _ExportScreenState extends ConsumerState<ExportScreen> {
  int?      _selectedDeviceId;
  DateTime? _startDate;
  DateTime? _endDate;

  final _dateFmt = DateFormat('dd MMM yyyy');

  Future<void> _pickDate({required bool isStart}) async {
    final initial = (isStart ? _startDate : _endDate) ?? DateTime.now();
    final picked  = await showDatePicker(
      context:     context,
      initialDate: initial,
      firstDate:   DateTime(2020),
      lastDate:    DateTime.now().add(const Duration(days: 1)),
      builder: (ctx, child) => Theme(
        data: ThemeData.dark().copyWith(
          colorScheme: const ColorScheme.dark(primary: Color(0xFF0EA5E9))),
        child: child!,
      ),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) _startDate = picked;
      else         _endDate   = picked;
    });
  }

  @override
  Widget build(BuildContext context) {
    final devicesAsync  = ref.watch(_exportDevicesProvider);
    final exportState   = ref.watch(exportNotifierProvider);
    final loading       = exportState.status == ExportStatus.loading;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: const Text('Export Data',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionLabel('Device'),
            const SizedBox(height: 8),
            devicesAsync.when(
              loading: () => const LinearProgressIndicator(
                  color: Color(0xFF0EA5E9)),
              error:   (e, _) => Text('$e',
                  style: const TextStyle(color: Colors.redAccent)),
              data: (devices) => _card(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    isExpanded: true,
                    value:       _selectedDeviceId,
                    dropdownColor: const Color(0xFF1E293B),
                    style: const TextStyle(color: Colors.white),
                    hint: const Text('Select a device',
                        style: TextStyle(color: Colors.white38)),
                    items: devices.map((d) => DropdownMenuItem(
                      value: d.id,
                      child: Text(d.name,
                          style: const TextStyle(color: Colors.white)),
                    )).toList(),
                    onChanged: (v) => setState(() => _selectedDeviceId = v),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),

            _SectionLabel('Date Range (optional)'),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: _DateButton(
                  label: _startDate != null
                      ? _dateFmt.format(_startDate!)
                      : 'Start date',
                  onTap: () => _pickDate(isStart: true),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _DateButton(
                  label: _endDate != null
                      ? _dateFmt.format(_endDate!)
                      : 'End date',
                  onTap: () => _pickDate(isStart: false),
                ),
              ),
            ]),
            const SizedBox(height: 8),
            if (_startDate != null || _endDate != null)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () =>
                      setState(() { _startDate = null; _endDate = null; }),
                  child: const Text('Clear dates',
                      style: TextStyle(color: Colors.white38, fontSize: 12)),
                ),
              ),
            const SizedBox(height: 28),

            // ── Status feedback ──────────────────────────────────────────────
            if (exportState.status == ExportStatus.error) ...[
              _StatusBanner(
                color: Colors.red,
                icon:  Icons.error_outline,
                text:  exportState.errorMsg ?? 'Export failed',
              ),
              const SizedBox(height: 12),
            ],
            if (exportState.status == ExportStatus.success) ...[
              _StatusBanner(
                color: Colors.green,
                icon:  Icons.check_circle_outline,
                text:  '${exportState.rowCount} rows exported as XLSX (MYT timestamps)',
              ),
              const SizedBox(height: 12),
            ],

            // ── Export button ────────────────────────────────────────────────
            FilledButton.icon(
              onPressed: (_selectedDeviceId == null || loading) ? null : _export,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF0EA5E9),
                padding:         const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              icon: loading
                  ? const SizedBox(
                      width: 18, height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.download_outlined),
              label: Text(
                loading ? 'Generating…' : 'Export to XLSX',
                style: const TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 15),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Timestamps are converted to Malaysia Time (MYT, UTC+8) in the exported file.',
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.25), fontSize: 11),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentIndex: 2),
    );
  }

  Future<void> _export() async {
    await ref.read(exportNotifierProvider.notifier).exportToXlsx(
      deviceId:  _selectedDeviceId!,
      startDate: _startDate,
      endDate:   _endDate != null
          ? _endDate!.add(const Duration(hours: 23, minutes: 59, seconds: 59))
          : null,
    );
  }

  Widget _card({required Widget child}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color:        const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(12),
          border:       Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        child: child,
      );
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(
          color:       Colors.white54,
          fontSize:    11,
          fontWeight:  FontWeight.w700,
          letterSpacing: 0.8));
}

class _DateButton extends StatelessWidget {
  const _DateButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            color:        const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
            border:       Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Row(children: [
            const Icon(Icons.calendar_today_outlined,
                color: Colors.white38, size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(label,
                  style: const TextStyle(color: Colors.white60, fontSize: 13)),
            ),
          ]),
        ),
      );
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner(
      {required this.color, required this.icon, required this.text});
  final Color   color;
  final IconData icon;
  final String  text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color:        color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border:       Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: TextStyle(color: color, fontSize: 12)),
          ),
        ]),
      );
}
