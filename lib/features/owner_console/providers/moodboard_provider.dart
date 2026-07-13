import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

class MoodboardState {
  final bool isLoading;
  final String? error;
  final List<dynamic> moodboards;

  MoodboardState({
    this.isLoading = false,
    this.error,
    this.moodboards = const [],
  });

  MoodboardState copyWith({
    bool? isLoading,
    String? error,
    List<dynamic>? moodboards,
  }) {
    return MoodboardState(
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
      moodboards: moodboards ?? this.moodboards,
    );
  }
}

class MoodboardNotifier extends StateNotifier<MoodboardState> {
  final ApiClient api;

  MoodboardNotifier(this.api) : super(MoodboardState());

  Future<void> fetchMoodboards(String orderId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.get('/orders/$orderId/moodboard');
      if (res.statusCode == 200 && res.data != null) {
        final rawData = res.data;
        List<dynamic> list = [];
        if (rawData is Map && rawData['data'] != null) {
          list = rawData['data'] as List<dynamic>;
        } else if (rawData is List) {
          list = rawData;
        }
        state = state.copyWith(isLoading: false, moodboards: list);
      } else {
        state = state.copyWith(isLoading: false, error: 'Failed to fetch moodboards');
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<bool> createMoodboard({
    required String orderId,
    required String title,
    required String description,
    required List<String> tags,
    required List<String> images,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.post(
        '/orders/$orderId/moodboard',
        data: {
          'title': title,
          'description': description,
          'tags': tags,
          'images': images,
        },
      );
      if (res.statusCode == 201) {
        await fetchMoodboards(orderId);
        return true;
      }
      state = state.copyWith(isLoading: false, error: 'Create moodboard failed');
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  Future<bool> addImagesToMoodboard({
    required String orderId,
    required String moodboardId,
    required List<String> newImages,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.put(
        '/orders/$orderId/moodboard/$moodboardId',
        data: {
          'addImages': newImages,
        },
      );
      if (res.statusCode == 200) {
        await fetchMoodboards(orderId);
        return true;
      }
      state = state.copyWith(isLoading: false, error: 'Add images failed');
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  Future<bool> deleteMoodboard(String orderId, String moodboardId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await api.delete('/orders/$orderId/moodboard/$moodboardId');
      if (res.statusCode == 200) {
        await fetchMoodboards(orderId);
        return true;
      }
      state = state.copyWith(isLoading: false, error: 'Delete moodboard failed');
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  Future<void> logImageDownload(String orderId, String moodboardId, String imageUrl) async {
    try {
      await api.post(
        '/orders/$orderId/moodboard/$moodboardId/download-log',
        data: {'imageUrl': imageUrl},
      );
    } catch (e) {
      print('[Moodboard Provider] Log download error: $e');
    }
  }
}

final moodboardProvider = StateNotifierProvider<MoodboardNotifier, MoodboardState>((ref) {
  return MoodboardNotifier(ApiClient());
});
