import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/sensor_row.dart';
import '../../services/api_client.dart';

class ExportRepository {
  ExportRepository(this._dio);
  final Dio _dio;

  /// Fetch raw UTC sensor data for one device and optional pin list.
  ///
  /// [sensorTypes]  comma-separated virtual pins, e.g. "V0,V1" (null = all).
  Future<List<SensorRow>> fetchExportData({
    required int deviceId,
    String? sensorTypes,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final params = <String, dynamic>{'device_id': deviceId};
    if (sensorTypes != null) params['sensor_types'] = sensorTypes;
    if (startDate   != null) params['start_date']   = startDate.toIso8601String();
    if (endDate     != null) params['end_date']      = endDate.toIso8601String();

    final resp = await _dio.get('/sensor/export-json', queryParameters: params);
    return (resp.data as List)
        .map((j) => SensorRow.fromJson(j as Map<String, dynamic>))
        .toList();
  }
}

final exportRepositoryProvider = Provider<ExportRepository>(
  (ref) => ExportRepository(ref.watch(dioProvider)),
);
