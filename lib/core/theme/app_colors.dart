// App Color Palette — Premium Light Gold Jewelry Theme
import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // === Primary Palette ===
  static const Color background = Color(0xFFFCFCFC); // Clean white background
  static const Color surface = Color(0xFFFFFFFF); // White card surface
  static const Color surfaceElevated = Color(0xFFF4F5F7); // Very light grey for elevated items
  static const Color surfaceBorder = Color(0xFFEAEBEE); // Subtle light border

  // === Gold Accent ===
  static const Color gold = Color(0xFFD4AF37); // Classic premium gold
  static const Color goldLight = Color(0xFFF1E5AC); // Softer gold
  static const Color goldDark = Color(0xFFAA8222); // Deep gold
  static const Color goldShimmer = Color(0xFFFAF2C8); // Light shimmer
  static const Color goldGradientStart = Color(0xFFD4AF37);
  static const Color goldGradientEnd = Color(0xFFAA8222);

  // === Text ===
  static const Color textPrimary = Color(0xFF1A1A24); // Sharp dark text
  static const Color textSecondary = Color(0xFF5A5A66); // Muted dark grey
  static const Color textHint = Color(0xFF9999A6); // Very muted grey
  static const Color textOnGold = Color(0xFFFFFFFF); // White text on gold items

  // === Semantic ===
  static const Color success = Color(0xFF2E7D32);
  static const Color successBg = Color(0xFFE8F5E9);
  static const Color error = Color(0xFFD32F2F);
  static const Color errorBg = Color(0xFFFFEBEE);
  static const Color warning = Color(0xFFED6C02);
  static const Color warningBg = Color(0xFFFFF3E0);
  static const Color info = Color(0xFF0288D1);
  static const Color infoBg = Color(0xFFE1F5FE);

  // === Status Colors ===
  static const Color statusPending = Color(0xFFED6C02);
  static const Color statusActive = Color(0xFF0288D1);
  static const Color statusCompleted = Color(0xFF2E7D32);
  static const Color statusCancelled = Color(0xFFD32F2F);

  // === Category Colors ===
  static const Color goldCategory = Color(0xFFD4AF37);
  static const Color diamondCategory = Color(0xFF4FC3F7);
  static const Color platinumCategory = Color(0xFF90A4AE);
  static const Color gemstoneCategory = Color(0xFFBA68C8);

  // === Gradients ===
  static const LinearGradient goldGradient = LinearGradient(
    colors: [goldGradientStart, goldGradientEnd],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient backgroundGradient = LinearGradient(
    colors: [Color(0xFFFCFCFC), Color(0xFFF4F5F7)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const LinearGradient cardGradient = LinearGradient(
    colors: [Color(0xFFFFFFFF), Color(0xFFFCFCFC)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient shimmerGradient = LinearGradient(
    colors: [
      surfaceElevated,
      surface,
      surfaceElevated,
    ],
    stops: const [0.1, 0.5, 0.9],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  // === Customer Luxury Constants ===
  static const Color primaryNavy = Color(0xFF071224);
  static const Color secondaryNavy = Color(0xFF132A4F);
  static const Color accentGold = Color(0xFFD4AF37);
  static const Color accentGoldLight = Color(0xFFF3E5AB);
  static const Color ivoryWhite = Color(0xFFFAFAFA);
  static const Color pureWhite = Color(0xFFFFFFFF);
  static const Color textBody = Color(0xFF2C3E50);
  static const Color textLight = Color(0xFF7F8C8D);
  static const Color divider = Color(0xFFEEEEEE);
  static const Color scaffoldBg = ivoryWhite;
  static const Color cardBg = Colors.white;
}
