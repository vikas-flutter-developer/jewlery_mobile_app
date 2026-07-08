import 'package:dio/dio.dart';
import '../database/local_db.dart';
import 'api_endpoints.dart';

class ApiClient {
  late final Dio dio;
  static final ApiClient _instance = ApiClient._internal();
  
  void Function()? onUnauthorized;

  factory ApiClient() => _instance;

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Setup interceptors
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Fetch token from LocalDb and append to headers
          final token = await LocalDb.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          // If token has expired or is invalid (HTTP 401), perform local logout
          if (e.response?.statusCode == 401) {
            print('[API Client] Unauthorized - clear local session');
            await LocalDb.clearAll();
            if (onUnauthorized != null) {
              onUnauthorized!();
            }
          }
          return handler.next(e);
        },
      ),
    );
  }

  // Helper HTTP Methods
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    return await dio.get(path, queryParameters: queryParameters);
  }

  Future<Response> post(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    return await dio.post(path, data: data, queryParameters: queryParameters);
  }

  Future<Response> put(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    return await dio.put(path, data: data, queryParameters: queryParameters);
  }

  Future<Response> delete(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    return await dio.delete(path, data: data, queryParameters: queryParameters);
  }
}

// Global accessor singleton instance
final api = ApiClient();
