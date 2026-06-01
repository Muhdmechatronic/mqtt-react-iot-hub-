import 'dart:convert';
import 'dart:ui' show Color;

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

enum WidgetKind {
  gauge, led, slider, switchWidget, button,
  chart, linechart, progressbar, label, status,
  unknown,
}

WidgetKind _kindOf(String? raw) => switch (raw) {
      'gauge'       => WidgetKind.gauge,
      'led'         => WidgetKind.led,
      'slider'      => WidgetKind.slider,
      'switch'      => WidgetKind.switchWidget,
      'button'      => WidgetKind.button,
      'chart'       => WidgetKind.chart,
      'linechart'   => WidgetKind.linechart,
      'progressbar' => WidgetKind.progressbar,
      'label'       => WidgetKind.label,
      'status'      => WidgetKind.status,
      _             => WidgetKind.unknown,
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

  // Safe numeric setting — handles both String and num from server
  double _numSetting(String key, double fallback) {
    final v = settings[key];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? fallback;
    return fallback;
  }

  // Gauge / progress helpers
  double get gaugeMin => _numSetting('min', 0);
  double get gaugeMax => _numSetting('max', 100);
  String get unit     => settings['unit']?.toString() ?? '';

  // Slider helpers
  double get sliderMin  => _numSetting('min', 0);
  double get sliderMax  => _numSetting('max', 100);
  double get sliderStep => _numSetting('step', 1);

  // Switch helpers
  double get onValue  => _numSetting('onValue', 1);
  double get offValue => _numSetting('offValue', 0);
  String get onLabel  => settings['onLabel']?.toString()  ?? 'ON';
  String get offLabel => settings['offLabel']?.toString() ?? 'OFF';

  // Color from settings hex (e.g. "#22c55e") with fallback to cyan
  Color get widgetColor {
    final hex = settings['color']?.toString();
    if (hex == null || hex.isEmpty) return const Color(0xFF0EA5E9);
    final clean = hex.startsWith('#') ? hex.substring(1) : hex;
    if (clean.length != 6) return const Color(0xFF0EA5E9);
    return Color(int.tryParse('FF$clean', radix: 16) ?? 0xFF0EA5E9);
  }

  // LED mode settings
  String get ledMode      => settings['ledMode']?.toString() ?? settings['led_mode']?.toString() ?? 'binary';
  double get ledThreshold => _numSetting('threshold', 0.5);
  double get ledPwmMin    => _numSetting('pwmMin', 0);
  double get ledPwmMax    => _numSetting('pwmMax', 100);

  // Button label
  String get buttonLabel => settings['label']?.toString() ?? title;

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
