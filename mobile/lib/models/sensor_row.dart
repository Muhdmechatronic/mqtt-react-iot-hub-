/// One row from GET /api/sensor/export-json.
/// The backend returns raw UTC timestamps as ISO-8601 strings.
class SensorRow {
  const SensorRow({
    required this.timestampUtc,
    required this.sensorType,
    required this.displayName,
    required this.value,
    this.unit,
  });

  final DateTime timestampUtc;
  final String sensorType;
  final String displayName;
  final double value;
  final String? unit;

  /// Malaysia Time = UTC + 8 h (no DST, always fixed offset).
  DateTime get timestampMyt => timestampUtc.add(const Duration(hours: 8));

  factory SensorRow.fromJson(Map<String, dynamic> j) => SensorRow(
        timestampUtc: DateTime.parse(j['timestamp'].toString()).toUtc(),
        sensorType:   j['sensor_type']?.toString() ?? '',
        displayName:  j['display_name']?.toString() ?? j['sensor_type']?.toString() ?? '',
        value:        (j['value'] as num).toDouble(),
        unit:         j['unit']?.toString(),
      );
}
