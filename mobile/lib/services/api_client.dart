import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/constants.dart';

// ── Secure storage ────────────────────────────────────────────────────────────

final secureStorageProvider = Provider<FlutterSecureStorage>((_) {
  return const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
});

// ── 401 signal ────────────────────────────────────────────────────────────────
// Flipped to true when an interceptor catches a 401.  The router watches this
// and redirects to the login screen.

final unauthorizedProvider = StateProvider<bool>((_) => false);

// ── Dio client ────────────────────────────────────────────────────────────────

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl:        '${AppConstants.baseUrl}/api',
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
    headers: {'Content-Type': 'application/json'},
  ));
  dio.interceptors.add(_AuthInterceptor(ref));
  return dio;
});

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._ref);
  final Ref _ref;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final storage = _ref.read(secureStorageProvider);
    final token   = await storage.read(key: AppConstants.kJwt);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Purge stored credentials so the auth notifier re-evaluates to null.
      _ref.read(secureStorageProvider).deleteAll();
      _ref.read(unauthorizedProvider.notifier).state = true;
    }
    handler.next(err);
  }
}
