class IotDevice {
  const IotDevice({
    required this.id,
    required this.name,
    required this.deviceType,
    required this.isOnline,
    this.description,
    this.apiKey,
    this.lastSeen,
  });

  final int id;
  final String name;
  final String deviceType;
  final bool isOnline;
  final String? description;
  final String? apiKey;
  final DateTime? lastSeen;

  factory IotDevice.fromJson(Map<String, dynamic> j) => IotDevice(
        id:          (j['id'] as num).toInt(),
        name:        j['name']?.toString() ?? '',
        deviceType:  j['device_type']?.toString() ?? 'generic',
        isOnline:    (j['is_online'] as int? ?? 0) == 1,
        description: j['description']?.toString(),
        apiKey:      j['api_key']?.toString(),
        lastSeen: j['last_seen'] != null
            ? DateTime.tryParse(j['last_seen'].toString())
            : null,
      );

  IotDevice copyWith({bool? isOnline}) => IotDevice(
        id:          id,
        name:        name,
        deviceType:  deviceType,
        isOnline:    isOnline ?? this.isOnline,
        description: description,
        apiKey:      apiKey,
        lastSeen:    lastSeen,
      );
}
