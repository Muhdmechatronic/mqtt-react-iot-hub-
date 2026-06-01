import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../../services/api_client.dart';
import '../../services/socket_service.dart';

/// Central pin-state map:  deviceId → dataKey → value
typedef PinStateMap = Map<int, Map<String, double>>;

// ── Echo suppression ──────────────────────────────────────────────────────────

class _EchoEntry {
  _EchoEntry(this.value) : expiresAt = DateTime.now().add(
        const Duration(milliseconds: AppConstants.echoTtlMs));
  final double value;
  final DateTime expiresAt;
  bool get expired => DateTime.now().isAfter(expiresAt);
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class DeviceSyncNotifier extends Notifier<PinStateMap> {
  final _subs   = <StreamSubscription>[];
  final _echoes = <String, _EchoEntry>{};

  @override
  PinStateMap build() {
    final socket = ref.watch(socketServiceProvider);
    _subs
      ..add(socket.sensorUpdates.listen(_onSensorUpdate))
      ..add(socket.pinUpdates.listen(_onPinUpdate))
      ..add(socket.deviceStatus.listen(_onDeviceStatus));
    ref.onDispose(() {
      for (final s in _subs) { s.cancel(); }
      _subs.clear();
    });
    return {};
  }

  // ── Public API ────────────────────────────────────────────────────────────

  void subscribe(int deviceId, {List<int> pins = const []}) =>
      ref.read(socketServiceProvider).subscribeDevice(deviceId, pins: pins);

  void unsubscribe(int deviceId) =>
      ref.read(socketServiceProvider).unsubscribeDevice(deviceId);

  /// Write a pin value to both Socket.IO (dashboard sync) AND the HTTP
  /// /device/command endpoint (ESP32 hardware control).
  /// Without the HTTP call, pin:write only syncs other dashboard clients
  /// but never reaches the ESP32.
  void writePin(
    int deviceId,
    String dataKey,
    double value, {
    int? widgetId,
    String command = 'set',
  }) {
    _registerEcho(deviceId, dataKey, value);

    // 1. Socket.IO pin:write → real-time sync with other dashboard clients
    ref.read(socketServiceProvider).writePin(
      deviceId: deviceId,
      dataKey:  dataKey,
      value:    value,
      widgetId: widgetId,
    );

    // 2. HTTP POST → sends 'command' event to the device's Socket.IO room
    //    which the ESP32 firmware listens on to control hardware.
    //    Fire-and-forget; optimistic update already applied below.
    ref.read(dioProvider).post('/device/command', data: {
      'device_id': deviceId,
      'command':   command,
      'payload':   {'value': value},
      'data_key':  dataKey,
    // ignore: invalid_return_type_for_catch_error
    }).catchError((_) => null);

    // 3. Optimistic local update for immediate UI response
    _applyUpdate(deviceId, dataKey, value);
  }

  double? valueOf(int deviceId, String dataKey) => state[deviceId]?[dataKey];

  // ── Internal handlers ─────────────────────────────────────────────────────

  void _onSensorUpdate(SensorUpdateEvent e) {
    for (final entry in e.data.entries) {
      if (_shouldSuppress(e.deviceId, entry.key, entry.value)) continue;
      _applyUpdate(e.deviceId, entry.key, entry.value);
    }
  }

  void _onPinUpdate(PinUpdateEvent e) {
    final deviceId = int.tryParse(e.deviceId);
    if (deviceId == null) return;
    _applyUpdate(deviceId, 'V${e.virtualPin}', e.value);
  }

  void _onDeviceStatus(DeviceStatusEvent _) {}

  void _applyUpdate(int deviceId, String dataKey, double value) {
    final current = Map<int, Map<String, double>>.from(state);
    current[deviceId] = {...(current[deviceId] ?? {}), dataKey: value};
    state = current;
  }

  // ── Echo suppression ──────────────────────────────────────────────────────

  void _registerEcho(int deviceId, String dataKey, double value) =>
      _echoes['$deviceId:$dataKey'] = _EchoEntry(value);

  bool _shouldSuppress(int deviceId, String dataKey, double value) {
    final key   = '$deviceId:$dataKey';
    final entry = _echoes[key];
    if (entry == null) return false;
    if (entry.expired) { _echoes.remove(key); return false; }
    if ((entry.value - value).abs() < 0.001) {
      _echoes.remove(key);
      return true;
    }
    return false;
  }
}

final deviceSyncProvider =
    NotifierProvider<DeviceSyncNotifier, PinStateMap>(DeviceSyncNotifier.new);
