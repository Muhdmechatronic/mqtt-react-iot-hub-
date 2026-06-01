import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../core/constants.dart';
import '../../models/auth_user.dart';
import '../../services/api_client.dart';
import '../../services/socket_service.dart';
import 'auth_repository.dart';

/// Restores session from secure storage, or returns null when not authenticated.
class AuthNotifier extends AsyncNotifier<AuthUser?> {
  @override
  Future<AuthUser?> build() async {
    // Listen for 401 signals from the Dio interceptor.
    ref.listen(unauthorizedProvider, (_, triggered) {
      if (triggered) {
        ref.read(unauthorizedProvider.notifier).state = false;
        _clearAndDisconnect();
        state = const AsyncData(null);
      }
    });

    return _restoreSession();
  }

  Future<AuthUser?> _restoreSession() async {
    final storage = ref.read(secureStorageProvider);
    final token   = await storage.read(key: AppConstants.kJwt);
    if (token == null) return null;

    final name  = await storage.read(key: AppConstants.kUserName)  ?? '';
    final email = await storage.read(key: AppConstants.kUserEmail) ?? '';
    final avatar = await storage.read(key: AppConstants.kUserAvatar);

    final user = AuthUser(token: token, name: name, email: email, avatar: avatar);
    ref.read(socketServiceProvider).connect(token);
    return user;
  }

  // ── Public actions ────────────────────────────────────────────────────────

  Future<void> loginWithEmail(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final user = await ref.read(authRepositoryProvider).loginWithEmail(email, password);
      await _persist(user);
      ref.read(socketServiceProvider).connect(user.token);
      return user;
    });
  }

  Future<void> loginWithGoogle() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      // Firebase Google Sign-In
      final gAccount = await GoogleSignIn().signIn();
      if (gAccount == null) {
        // User cancelled — restore previous state instead of staying loading
        state = const AsyncData(null);
        return null;
      }
      final gAuth  = await gAccount.authentication;
      final cred   = GoogleAuthProvider.credential(
        idToken:     gAuth.idToken,
        accessToken: gAuth.accessToken,
      );
      final fbUser = await FirebaseAuth.instance.signInWithCredential(cred);
      final idToken = await fbUser.user!.getIdToken();

      final user = await ref.read(authRepositoryProvider).loginWithGoogle(idToken!);
      await _persist(user);
      ref.read(socketServiceProvider).connect(user.token);
      return user;
    });
  }

  Future<void> logout() async {
    await _clearAndDisconnect();
    try { await GoogleSignIn().signOut(); } catch (_) {}
    try { await FirebaseAuth.instance.signOut(); } catch (_) {}
    state = const AsyncData(null);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Future<void> _persist(AuthUser user) async {
    final storage = ref.read(secureStorageProvider);
    await storage.write(key: AppConstants.kJwt,       value: user.token);
    await storage.write(key: AppConstants.kUserName,  value: user.name);
    await storage.write(key: AppConstants.kUserEmail, value: user.email);
    if (user.avatar != null) {
      await storage.write(key: AppConstants.kUserAvatar, value: user.avatar!);
    }
  }

  Future<void> _clearAndDisconnect() async {
    await ref.read(secureStorageProvider).deleteAll();
    ref.read(socketServiceProvider).disconnect();
  }
}

final authNotifierProvider =
    AsyncNotifierProvider<AuthNotifier, AuthUser?>(AuthNotifier.new);
