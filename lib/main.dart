import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/database/local_db.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Hive offline cache database
  await LocalDb.init();
  
  runApp(
    const ProviderScope(
      child: AuraJewelApp(),
    ),
  );
}

class AuraJewelApp extends ConsumerWidget {
  const AuraJewelApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'AuraJewel',
      debugShowCheckedModeBanner: false,
      
      // Theme settings
      themeMode: ThemeMode.light, // Exclusively Light Theme
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.lightTheme, // Force light theme even if system prefers dark
      
      // GoRouter Configuration
      routerConfig: router,
    );
  }
}
