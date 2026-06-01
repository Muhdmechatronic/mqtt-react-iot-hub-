import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/app_router.dart';

class IotCompanionApp extends ConsumerWidget {
  const IotCompanionApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title:       'IoT Companion',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: _buildTheme(),
    );
  }

  ThemeData _buildTheme() => ThemeData(
        useMaterial3:          true,
        brightness:            Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        colorScheme: ColorScheme.fromSeed(
          seedColor:  const Color(0xFF0EA5E9),
          brightness: Brightness.dark,
          surface:    const Color(0xFF1E293B),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0F172A),
          foregroundColor: Colors.white,
          elevation:       0,
          centerTitle:     false,
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor:     Color(0xFF1E293B),
          selectedItemColor:   Color(0xFF0EA5E9),
          unselectedItemColor: Colors.white30,
          type:                BottomNavigationBarType.fixed,
          elevation:           0,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled:    true,
          fillColor: Colors.white.withValues(alpha: 0.04),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: Colors.white12),
          ),
        ),
      );
}
