import 'dart:io';
import 'dart:typed_data';
import 'package:excel/excel.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../models/sensor_row.dart';
import 'export_repository.dart';

final _mytFmt = DateFormat('yyyy-MM-dd HH:mm:ss');

/// Formats a UTC DateTime as "YYYY-MM-DD HH:MM:SS" in Malaysia Time (UTC+8).
String _toMyt(DateTime utc) => _mytFmt.format(utc.add(const Duration(hours: 8)));

// ── Export state ──────────────────────────────────────────────────────────────

enum ExportStatus { idle, loading, success, error }

class ExportState {
  const ExportState({
    this.status     = ExportStatus.idle,
    this.rowCount   = 0,
    this.errorMsg,
    this.filePath,
  });
  final ExportStatus status;
  final int          rowCount;
  final String?      errorMsg;
  final String?      filePath;
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class ExportNotifier extends Notifier<ExportState> {
  @override
  ExportState build() => const ExportState();

  Future<void> exportToXlsx({
    required int deviceId,
    String? sensorTypes,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    state = const ExportState(status: ExportStatus.loading);
    try {
      final rows = await ref.read(exportRepositoryProvider).fetchExportData(
        deviceId:    deviceId,
        sensorTypes: sensorTypes,
        startDate:   startDate,
        endDate:     endDate,
      );
      final path = await _buildXlsx(rows);
      state = ExportState(
        status:   ExportStatus.success,
        rowCount: rows.length,
        filePath: path,
      );
      // Immediately share the file so the user can save / send it.
      await Share.shareXFiles(
        [XFile(path, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')],
        subject: 'IoT Sensor Export',
      );
    } catch (e) {
      state = ExportState(status: ExportStatus.error, errorMsg: e.toString());
    }
  }

  // ── XLSX builder ──────────────────────────────────────────────────────────

  Future<String> _buildXlsx(List<SensorRow> rows) async {
    final excel = Excel.createExcel();
    // Remove the default "Sheet1" that Excel.createExcel() creates automatically.
    excel.delete('Sheet1');
    final sheet = excel['Sensor Export'];

    // ── Header row ──────────────────────────────────────────────────────────
    sheet.appendRow([
      TextCellValue('Timestamp (Malaysia Time)'),
      TextCellValue('Sensor Type'),
      TextCellValue('Display Name'),
      TextCellValue('Value'),
      TextCellValue('Unit'),
    ]);

    // Style header: bold + sky-blue background
    for (var col = 0; col < 5; col++) {
      final cell = sheet.cell(
          CellIndex.indexByColumnRow(columnIndex: col, rowIndex: 0));
      cell.cellStyle = CellStyle(
        bold:            true,
        backgroundColorHex: ExcelColor.fromHexString('#0EA5E9'),
        fontColorHex:       ExcelColor.fromHexString('#FFFFFF'),
      );
    }

    // ── Data rows ────────────────────────────────────────────────────────────
    for (final r in rows) {
      sheet.appendRow([
        TextCellValue(_toMyt(r.timestampUtc)),   // UTC → MYT conversion
        TextCellValue(r.sensorType),
        TextCellValue(r.displayName),
        DoubleCellValue(r.value),
        TextCellValue(r.unit ?? ''),
      ]);
    }

    // ── Save ─────────────────────────────────────────────────────────────────
    final bytes = excel.encode();
    if (bytes == null) throw Exception('Failed to encode XLSX');

    final dir  = await getApplicationDocumentsDirectory();
    final ts   = DateFormat('yyyyMMdd_HHmmss')
        .format(DateTime.now().add(const Duration(hours: 8)));
    final path = '${dir.path}/iot_export_$ts.xlsx';
    await File(path).writeAsBytes(Uint8List.fromList(bytes));
    return path;
  }
}

final exportNotifierProvider =
    NotifierProvider<ExportNotifier, ExportState>(ExportNotifier.new);
