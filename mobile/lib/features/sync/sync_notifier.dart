import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../../services/socket_service.dart';

/// Central pin-state map:  deviceId → dataKey → value
///   e.g.  { 3: { 'V0': 24.5, 'V1': 1.0 } }
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
  final _subs    = <StreamSubscription>[];
  final _echoes  = <String, _EchoEntry>{};    // "deviceId:dataKey" → pending echo

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

  /// Join the device's Socket.IO room so updates flow in.
  void subscribe(int deviceId, {List<int> pins = const []}) {
    ref.read(socketServiceProvider).subscribeDevice(deviceId, pins: pins);
  }

  void unsubscribe(int deviceId) {
    ref.read(socketServiceProvider).unsubscribeDevice(deviceId);
  }

  /// Write a pin value via pin:write (server-side echo suppression already
  /// excludes the sender's socket).  A sensor_update echo-suppression entry
  /// is also registered for the legacy sensor_update path.
  void writePin(int deviceId, String dataKey, double value, {int? widgetId}) {
    _registerEcho(deviceId, dataKey, value);
    ref.read(socketServiceProvider).writePin(
      deviceId: deviceId,
      dataKey:  dataKey,
      value:    value,
      widgetId: widgetId,
    );
    // Optimistic local update so UI responds immediately.
    _applyUpdate(deviceId, dataKey, value);
  }

  double? valueOf(int deviceId, String dataKey) =>
      state[deviceId]?[dataKey];

  // ── Internal handlers ─────────────────────────────────────────────────────

  void _onSensorUpdate(SensorUpdateEvent e) {
    for (final entry in e.data.entries) {
      if (_shouldSuppress(e.deviceId, entry.key, entry.value)) continue;
      _applyUpdate(e.deviceId, entry.key, entry.value);
    }
  }

  void _onPinUpdate(PinUpdateEvent e) {
    // pin:update is already echo-suppressed server-side (sender socket excluded).
    final deviceId = int.tryParse(e.deviceId);
    if (deviceId == null) return;
    final dataKey = 'V${e.virtualPin}';
    _applyUpdate(deviceId, dataKey, e.value);
  }

  void _onDeviceStatus(DeviceStatusEvent _) {
    // Could update a device-online map here if needed.
  }

  void _applyUpdate(int deviceId, String dataKey, double value) {
    final current = Map<int, Map<String, double>>.from(state);
    current[deviceId] = {...(current[deviceId] ?? {}), dataKey: value};
    state = current;
  }

  // ── Echo suppression helpers ──────────────────────────────────────────────

  void _registerEcho(int deviceId, String dataKey, double value) {
    final key = '$deviceId:$dataKey';
    _echoes[key] = _EchoEntry(value);
  }

  bool _shouldSuppress(int deviceId, String dataKey, double value) {
    final key   = '$deviceId:$dataKey';
    final entry = _echoes[key];
    if (entry == null) return false;
    if (entry.expired) {
      _echoes.remove(key);
      return false;
    }
    if ((entry.value - value).abs() < 0.001) {
      _echoes.remove(key);
      return true; // this is our echo — discard it
    }
    return false;
  }
}

final deviceSyncProvider =
    NotifierProvider<DeviceSyncNotifier, PinStateMap>(DeviceSyncNotifier.new);
