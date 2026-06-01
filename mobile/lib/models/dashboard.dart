import 'dart:convert';

class Dashboard {
  const Dashboard({required this.id, required this.name});

  final int id;
  final String name;

  factory Dashboard.fromJson(Map<String, dynamic> j) => Dashboard(
        id:   (j['id'] as num).toInt(),
        name: j['name']?.toString() ?? '',
      );
}

// ── Widget types ──────────────────────────────────────────────────────────────

enum WidgetKind { gauge, led, slider, switchWidget, button, chart, unknown }

WidgetKind _kindOf(String? raw) => switch (raw) {
      'gauge'  => WidgetKind.gauge,
      'led'    => WidgetKind.led,
      'slider' => WidgetKind.slider,
      'switch' => WidgetKind.switchWidget,
      'button' => WidgetKind.button,
      'chart'  => WidgetKind.chart,
      _        => WidgetKind.unknown,
    };

class DashboardWidget {
  const DashboardWidget({
    required this.id,
    required this.kind,
    required this.title,
    required this.settings,
    this.deviceId,
    this.dataKey,
    this.x = 0,
    this.y = 0,
    this.w = 2,
    this.h = 2,
  });

  final int id;
  final WidgetKind kind;
  final String title;
  final Map<String, dynamic> settings;
  final int? deviceId;
  final String? dataKey; // e.g. "V0"
  final int x, y, w, h;

  bool get isBidirectional =>
      kind == WidgetKind.slider ||
      kind == WidgetKind.switchWidget ||
      kind == WidgetKind.button;

  // Gauge helpers
  double get gaugeMin => (settings['min'] as num?)?.toDouble() ?? 0;
  double get gaugeMax => (settings['max'] as num?)?.toDouble() ?? 100;
  String get unit     => settings['unit']?.toString() ?? '';

  // Slider helpers
  double get sliderMin  => (settings['min'] as num?)?.toDouble() ?? 0;
  double get sliderMax  => (settings['max'] as num?)?.toDouble() ?? 100;
  double get sliderStep => (settings['step'] as num?)?.toDouble() ?? 1;

  // Switch helpers
  double get onValue  => (settings['onValue']  as num?)?.toDouble() ?? 1;
  double get offValue => (settings['offValue'] as num?)?.toDouble() ?? 0;
  String get onLabel  => settings['onLabel']?.toString()  ?? 'ON';
  String get offLabel => settings['offLabel']?.toString() ?? 'OFF';

  factory DashboardWidget.fromJson(Map<String, dynamic> j) {
    final raw = j['settings_json'];
    Map<String, dynamic> settings = {};
    if (raw is String && raw.isNotEmpty) {
      try { settings = jsonDecode(raw) as Map<String, dynamic>; } catch (_) {}
    } else if (raw is Map<String, dynamic>) {
      settings = raw;
    }

    return DashboardWidget(
      id:       (j['id'] as num).toInt(),
      kind:     _kindOf(j['type']?.toString()),
      title:    j['title']?.toString() ?? '',
      settings: settings,
      deviceId: j['device_id'] != null ? (j['device_id'] as num).toInt() : null,
      dataKey:  j['data_key']?.toString(),
      x: (j['x'] as num?)?.toInt() ?? 0,
      y: (j['y'] as num?)?.toInt() ?? 0,
      w: (j['w'] as num?)?.toInt() ?? 2,
      h: (j['h'] as num?)?.toInt() ?? 2,
    );
  }
}
