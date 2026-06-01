import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/dashboard.dart';
import '../../services/api_client.dart';

class DashboardRepository {
  DashboardRepository(this._dio);
  final Dio _dio;

  Future<List<Dashboard>> listDashboards() async {
    final resp = await _dio.get('/dashboard');
    return (resp.data as List).map((j) => Dashboard.fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<List<DashboardWidget>> listWidgets(int dashboardId) async {
    final resp = await _dio.get('/dashboard/$dashboardId/widgets');
    return (resp.data as List)
        .map((j) => DashboardWidget.fromJson(j as Map<String, dynamic>))
        .toList();
  }
}

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => DashboardRepository(ref.watch(dioProvider)),
);
