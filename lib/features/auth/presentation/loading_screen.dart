import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class LoadingScreen extends StatelessWidget {
  const LoadingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.obsidianBlack,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Gold Stylized Logo icon
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.goldMetallic, width: 2),
                gradient: LinearGradient(
                  colors: [AppTheme.goldMetallic.withOpacity(0.1), Colors.transparent],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: const Icon(
                Icons.diamond_outlined,
                size: 60,
                color: AppTheme.goldMetallic,
              ),
            ),
            const SizedBox(height: 30),
            const Text(
              'AURAJEWEL',
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
                letterSpacing: 4.0,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'ERP SYSTEM & CLIENT PORTAL',
              style: TextStyle(
                color: Colors.white38,
                fontSize: 10,
                letterSpacing: 2.0,
              ),
            ),
            const SizedBox(height: 40),
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(AppTheme.goldMetallic),
              strokeWidth: 2,
            ),
          ],
        ),
      ),
    );
  }
}
