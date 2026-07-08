import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class LocalDb {
  static const String _sessionBoxName = 'session_box';
  static const String _cacheBoxName = 'cache_box';
  
  static const String _tokenKey = 'auth_token';
  static const String _profileKey = 'user_profile';
  static const String _ratesKey = 'metal_rates';
  
  static final _secureStorage = const FlutterSecureStorage();

  // Initialize Hive
  static Future<void> init() async {
    await Hive.initFlutter();
    await Hive.openBox(_sessionBoxName);
    await Hive.openBox(_cacheBoxName);
  }

  // --- Auth Token (stored in Flutter Secure Storage for security) ---
  static Future<void> saveToken(String token) async {
    await _secureStorage.write(key: _tokenKey, value: token);
    
    // Save to Hive session box as a fast-read cache (avoiding slow secure storage calls on UI threads)
    final box = Hive.box(_sessionBoxName);
    await box.put(_tokenKey, token);
  }

  static Future<String?> getToken() async {
    // Read from secure storage
    String? token = await _secureStorage.read(key: _tokenKey);
    if (token == null) {
      // Fallback/check fast-read Hive cache
      final box = Hive.box(_sessionBoxName);
      token = box.get(_tokenKey) as String?;
    }
    return token;
  }

  static Future<void> deleteToken() async {
    await _secureStorage.delete(key: _tokenKey);
    final box = Hive.box(_sessionBoxName);
    await box.delete(_tokenKey);
  }

  // --- User Profile (Mongoose User schema mapping) ---
  static Future<void> saveProfile(Map<String, dynamic> profile) async {
    final box = Hive.box(_sessionBoxName);
    await box.put(_profileKey, jsonEncode(profile));
  }

  static Map<String, dynamic>? getProfile() {
    final box = Hive.box(_sessionBoxName);
    final raw = box.get(_profileKey) as String?;
    if (raw != null) {
      try {
        return jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  // --- Live Metal Rates Cache ---
  static Future<void> saveRates(Map<String, dynamic> rates) async {
    final box = Hive.box(_cacheBoxName);
    await box.put(_ratesKey, jsonEncode(rates));
  }

  static Map<String, dynamic>? getRates() {
    final box = Hive.box(_cacheBoxName);
    final raw = box.get(_ratesKey) as String?;
    if (raw != null) {
      try {
        return jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  // --- Clear all caches on log out ---
  static Future<void> clearAll() async {
    await deleteToken();
    final sessionBox = Hive.box(_sessionBoxName);
    await sessionBox.clear();
    final cacheBox = Hive.box(_cacheBoxName);
    await cacheBox.clear();
  }
}
