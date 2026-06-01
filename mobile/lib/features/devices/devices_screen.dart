import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/iot_device.dart';
import '../../services/api_client.dart';
import '../../services/socket_service.dart';
import '../dashboard/dashboard_list_screen.dart' show AppBottomNav;

final _devicesProvider = FutureProvider<List<IotDevice>>((ref) async {
  final resp = await ref.watch(dioProvider).get('/device/list');
  return (resp.data as List)
      .map((j) => IotDevice.fromJson(j as Map<String, dynamic>))
      .toList();
});

class DevicesScreen extends ConsumerStatefulWidget {
  const DevicesScreen({super.key});
  @override
  ConsumerState<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends ConsumerState<DevicesScreen> {
  /// Overrides from live socket events: deviceId → isOnline
  final Map<int, bool> _liveStatus = {};
  StreamSubscription<DeviceStatusEvent>? _sub;

  @override
  void initState() {
    super.initState();
    // Subscribe to the socket service's device status stream.
    // Using `addPostFrameCallback` so `ref` is available.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _sub = ref.read(socketServiceProvider).deviceStatus.listen((e) {
        if (mounted) setState(() => _liveStatus[e.deviceId] = e.isOnline);
      });
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final devicesAsync = ref.watch(_devicesProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: const Text('Devices',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined,
                color: Colors.white54, size: 20),
            onPressed: () => ref.invalidate(_devicesProvider),
          ),
        ],
      ),
      body: devicesAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(
                strokeWidth: 2, color: Color(0xFF0EA5E9))),
        error: (e, _) => Center(
            child: Text('$e', style: const TextStyle(color: Colors.redAccent))),
        data: (devices) => devices.isEmpty
            ? const Center(
                child: Text('No devices registered.',
                    style: TextStyle(color: Colors.white38)))
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: devices.length,
                itemBuilder: (_, i) {
                  final d      = devices[i];
                  final online = _liveStatus[d.id] ?? d.isOnline;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color:        const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.06)),
                      ),
                      child: Row(children: [
                        Container(
                          width: 42, height: 42,
                          decoration: BoxDecoration(
                            color: online
                                ? Colors.green.withValues(alpha: 0.12)
                                : Colors.white.withValues(alpha: 0.04),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(Icons.memory_outlined,
                              color:  online ? Colors.green : Colors.white24,
                              size:   20),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(d.name,
                                  style: const TextStyle(
                                      color:      Colors.white,
                                      fontWeight: FontWeight.w600)),
                              const SizedBox(height: 2),
                              Text(
                                d.deviceType,
                                style: const TextStyle(
                                    color: Colors.white38, fontSize: 12),
                              ),
                              if (d.lastSeen != null) ...[
                                const SizedBox(height: 1),
                                Text('Last seen: ${_fmtRelative(d.lastSeen!)}',
                                    style: const TextStyle(
                                        color: Colors.white24, fontSize: 11)),
                              ],
                            ],
                          ),
                        ),
                        _StatusPill(online: online),
                      ]),
                    ),
                  );
                },
              ),
      ),
      bottomNavigationBar: const AppBottomNav(currentIndex: 1),
    );
  }

  String _fmtRelative(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60)  return '${diff.inSeconds}s ago';
    if (diff.inMinutes < 60)  return '${diff.inMinutes}m ago';
    if (diff.inHours   < 24)  return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.online});
  final bool online;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: online
              ? Colors.green.withValues(alpha: 0.12)
              : Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: online
                ? Colors.green.withValues(alpha: 0.3)
                : Colors.white.withValues(alpha: 0.1),
          ),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 6, height: 6,
            decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: online ? Colors.green : Colors.white24),
          ),
          const SizedBox(width: 5),
          Text(online ? 'Online' : 'Offline',
              style: TextStyle(
                  color:      online ? Colors.green : Colors.white38,
                  fontSize:   11,
                  fontWeight: FontWeight.w600)),
        ]),
      );
}
