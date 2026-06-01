/// Central configuration — edit baseUrl to match your server's LAN address.
///
/// Android emulator  → 10.0.2.2  maps to the host's localhost
/// iOS simulator     → localhost  works directly
/// Real device       → use your server's LAN IP, e.g. 192.168.1.X
class AppConstants {
  AppConstants._();

  // 192.168.0.220 — detected LAN IP of this machine.
  // Android emulator can also use 10.0.2.2 if testing in the emulator.
  static const String baseUrl   = 'http://192.168.0.220:3000';
  static const String socketUrl = 'http://192.168.0.220:3000';

  // flutter_secure_storage keys
  static const String kJwt       = 'iot_jwt';
  static const String kUserName  = 'iot_user_name';
  static const String kUserEmail = 'iot_user_email';
  static const String kUserAvatar = 'iot_user_avatar';

  /// Milliseconds within which a server echo of our own command is suppressed.
  static const int echoTtlMs = 4000;
}
