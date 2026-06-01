import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/auth_user.dart';
import '../../services/api_client.dart';

class AuthRepository {
  AuthRepository(this._dio);
  final Dio _dio;

  Future<AuthUser> loginWithEmail(String email, String password) async {
    final resp = await _dio.post('/auth/login', data: {
      'email':    email,
      'password': password,
    });
    final token = resp.data['token'] as String;
    return AuthUser.fromJson(resp.data as Map<String, dynamic>, token);
  }

  Future<AuthUser> loginWithGoogle(String idToken) async {
    final resp = await _dio.post('/auth/google', data: {'idToken': idToken});
    final token = resp.data['token'] as String;
    return AuthUser.fromJson(resp.data as Map<String, dynamic>, token);
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(dioProvider)),
);
