import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:uuid/uuid.dart';
import '../core/constants.dart';

// ── Event models ──────────────────────────────────────────────────────────────

class SensorUpdateEvent {
  const SensorUpdateEvent({
    required this.deviceId,
    required this.data,  // dataKey → value
  });
  final int deviceId;
  final Map<String, double> data;
}

class PinUpdateEvent {
  const PinUpdateEvent({
    required this.deviceId,
    required this.virtualPin,
    required this.value,
    required this.originId,
  });
  final String deviceId;
  final int virtualPin;
  final double value;
  final String originId;
}

class DeviceStatusEvent {
  const DeviceStatusEvent({required this.deviceId, required this.isOnline});
  final int deviceId;
  final bool isOnline;
}

// ── SocketService ─────────────────────────────────────────────────────────────

class SocketService {
  SocketService({required this.originId});

  final String originId;
  io.Socket? _socket;

  int _seqCounter = 0;
  int _nextSeq() => ++_seqCounter;

  final _sensorController = StreamController<SensorUpdateEvent>.broadcast();
  final _pinController    = StreamController<PinUpdateEvent>.broadcast();
  final _statusController = StreamController<DeviceStatusEvent>.broadcast();

  Stream<SensorUpdateEvent>  get sensorUpdates => _sensorController.stream;
  Stream<PinUpdateEvent>     get pinUpdates    => _pinController.stream;
  Stream<DeviceStatusEvent>  get deviceStatus  => _statusController.stream;

  bool get isConnected => _socket?.connected ?? false;

  // ── Connection lifecycle ──────────────────────────────────────────────────

  void connect(String token) {
    _socket?.disconnect();
    _socket = io.io(AppConstants.socketUrl, <String, dynamic>{
      'transports':  ['websocket'],
      'auth':        {'token': token},
      'autoConnect': false,
    });

    _socket!
      ..on('connect',       (_) => _onConnect())
      ..on('disconnect',    (_) => _onDisconnect())
      ..on('sensor_update', _onSensorUpdate)
      ..on('pin:update',    _onPinUpdate)
      ..on('pin:sync',      _onPinSync)
      ..on('device_status', _onDeviceStatus)
      ..connect();
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  void dispose() {
    disconnect();
    _sensorController.close();
    _pinController.close();
    _statusController.close();
  }

  // ── Device subscriptions ──────────────────────────────────────────────────

  void subscribeDevice(int deviceId, {List<int> pins = const []}) {
    _socket?.emit('subscribe_device', {'device_id': deviceId});
    _socket?.emit('pin:subscribe', {
      'deviceId': deviceId.toString(),
      'pins':     pins,
    });
  }

  void unsubscribeDevice(int deviceId) {
    _socket?.emit('unsubscribe_device', {'device_id': deviceId});
    _socket?.emit('pin:unsubscribe', {'deviceId': deviceId.toString()});
  }

  // ── Bidirectional pin write ───────────────────────────────────────────────
  // The server broadcasts pin:update to the entire device room EXCEPT this
  // socket, so we get server-side echo suppression for free.

  void writePin({
    required int deviceId,
    required String dataKey,
    required double value,
    int? widgetId,
  }) {
    final pin = int.tryParse(dataKey.replaceFirst('V', ''));
    if (pin == null) return;
    _socket?.emit('pin:write', {
      'deviceId':   deviceId.toString(),
      'virtualPin': pin,
      'value':      value,
      'originId':   originId,
      'seq':        _nextSeq(),
      if (widgetId != null) 'widgetId': widgetId,
    });
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  void _onConnect()    {}  // can log/update UI state if desired
  void _onDisconnect() {}

  void _onSensorUpdate(dynamic raw) {
    final data = raw as Map<dynamic, dynamic>;
    final deviceId = int.tryParse(data['device_id']?.toString() ?? '');
    if (deviceId == null) return;

    final pinMap = (data['data'] as Map<dynamic, dynamic>? ?? {})
        .entries
        .fold<Map<String, double>>({}, (acc, e) {
      final v = double.tryParse(e.value?.toString() ?? '');
      if (v != null) acc[e.key.toString()] = v;
      return acc;
    });

    if (pinMap.isEmpty) return;
    _sensorController.add(SensorUpdateEvent(deviceId: deviceId, data: pinMap));
  }

  void _onPinUpdate(dynamic raw) {
    final data = raw as Map<dynamic, dynamic>;
    final deviceId  = data['deviceId']?.toString();
    final vPin      = (data['virtualPin'] as num?)?.toInt();
    final value     = double.tryParse(data['value']?.toString() ?? '');
    final origin    = data['originId']?.toString() ?? '';
    if (deviceId == null || vPin == null || value == null) return;

    _pinController.add(PinUpdateEvent(
      deviceId:   deviceId,
      virtualPin: vPin,
      value:      value,
      originId:   origin,
    ));
  }

  // pin:sync is an array of pin states sent immediately after pin:subscribe.
  void _onPinSync(dynamic raw) {
    final list = raw as List<dynamic>;
    for (final item in list) {
      _onPinUpdate(item);
    }
  }

  void _onDeviceStatus(dynamic raw) {
    final data     = raw as Map<dynamic, dynamic>;
    final deviceId = int.tryParse(data['device_id']?.toString() ?? '');
    final online   = data['is_online'];
    if (deviceId == null) return;

    _statusController.add(DeviceStatusEvent(
      deviceId: deviceId,
      isOnline: online == true || online == 1,
    ));
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

/// Stable UUID identifying this app instance — used as originId in pin:write
/// for server-side echo suppression.
final appOriginIdProvider = Provider<String>((_) => const Uuid().v4());

final socketServiceProvider = Provider<SocketService>((ref) {
  final svc = SocketService(originId: ref.watch(appOriginIdProvider));
  ref.onDispose(svc.dispose);
  return svc;
});
