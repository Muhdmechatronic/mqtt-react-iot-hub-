import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/dashboard.dart';
import '../../../services/api_client.dart';
import '../../sync/sync_notifier.dart';

// ── Historical data provider ──────────────────────────────────────────────────

final _historyProvider = FutureProvider.family<List<FlSpot>, _HistoryKey>(
  (ref, key) async {
    final dio  = ref.watch(dioProvider);
    final resp = await dio.get('/sensor/history', queryParameters: {
      'device_id':   key.deviceId,
      'sensor_type': key.dataKey,
      'limit':       150,
    });
    final rows = resp.data as List<dynamic>;
    if (rows.isEmpty) return [];

    // Normalize x to [0, rowCount-1] for display; keep absolute epoch on tooltip.
    return List<FlSpot>.generate(rows.length, (i) {
      final v = double.tryParse(rows[i]['value']?.toString() ?? '') ?? 0;
      return FlSpot(i.toDouble(), v);
    });
  },
);

class _HistoryKey {
  const _HistoryKey(this.deviceId, this.dataKey);
  final int deviceId;
  final String dataKey;
  @override
  bool operator ==(Object other) =>
      other is _HistoryKey &&
      other.deviceId == deviceId &&
      other.dataKey  == dataKey;
  @override
  int get hashCode => Object.hash(deviceId, dataKey);
}

// ── Chart widget ──────────────────────────────────────────────────────────────

class ChartWidget extends ConsumerWidget {
  const ChartWidget({super.key, required this.widget});

  final DashboardWidget widget;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final w = widget;
    if (w.deviceId == null || w.dataKey == null) {
      return _WidgetCard(title: w.title, child: _noData());
    }

    final histAsync = ref.watch(
        _historyProvider(_HistoryKey(w.deviceId!, w.dataKey!)));

    // Append live value to history tail.
    final liveValue = ref.watch(
      deviceSyncProvider.select((m) => m[w.deviceId!]?[w.dataKey!]),
    );

    return _WidgetCard(
      title: w.title,
      child: histAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(
                strokeWidth: 2, color: Color(0xFF0EA5E9))),
        error: (e, _) => _noData(msg: 'Error loading history'),
        data: (baseSpots) {
          final spots = [...baseSpots];
          if (liveValue != null && spots.isNotEmpty) {
            spots.add(FlSpot(spots.last.x + 1, liveValue));
          } else if (liveValue != null) {
            spots.add(FlSpot(0, liveValue));
          }
          if (spots.isEmpty) return _noData();
          return _buildChart(spots);
        },
      ),
    );
  }

  Widget _buildChart(List<FlSpot> spots) {
    final minY = spots.map((s) => s.y).reduce((a, b) => a < b ? a : b) - 2;
    final maxY = spots.map((s) => s.y).reduce((a, b) => a > b ? a : b) + 2;

    return LineChart(
      LineChartData(
        gridData:   FlGridData(show: true, drawVerticalLine: false,
            getDrawingHorizontalLine: (_) => FlLine(
                color: Colors.white.withValues(alpha: 0.05), strokeWidth: 1)),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(sideTitles: SideTitles(
              showTitles:   true,
              reservedSize: 36,
              getTitlesWidget: (v, _) => Text(
                  v.toStringAsFixed(0),
                  style: const TextStyle(color: Colors.white38, fontSize: 9)))),
          bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles:   AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: false),
        minY: minY, maxY: maxY,
        lineBarsData: [
          LineChartBarData(
            spots:       spots,
            isCurved:    true,
            color:       const Color(0xFF0EA5E9),
            barWidth:    2,
            dotData:     FlDotData(show: false),
            belowBarData: BarAreaData(
              show:  true,
              color: const Color(0xFF0EA5E9).withValues(alpha: 0.08),
            ),
          ),
        ],
      ),
    );
  }

  Widget _noData({String msg = 'No data'}) => Center(
      child: Text(msg, style: const TextStyle(color: Colors.white30, fontSize: 12)));
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
