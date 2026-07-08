import 'package:flutter/material.dart';

class AppTheme {
  // Premium Jewelry Branding Colors
  static const Color goldMetallic = Color(0xFFD4AF37); // Classic Gold
  static const Color goldLight = Color(0xFFF3E5AB);    // Champagne
  static const Color goldDark = Color(0xFF996515);     // Dark Golden Bronze
  
  // Dark Theme (Obsidian & Charcoal)
  static const Color obsidianBlack = Color(0xFF0F0F0F);
  static const Color charcoalGray = Color(0xFF1A1A1A);
  static const Color darkCardColor = Color(0xFF242424);
  
  // Light Theme (Pearl & Cream)
  static const Color pearlWhite = Color(0xFFFAF9F6);
  static const Color creamWhite = Color(0xFFF3EFE0);
  static const Color lightCardColor = Color(0xFFFFFFFF);

  // Gradient definitions
  static const LinearGradient premiumGoldGradient = LinearGradient(
    colors: [goldDark, goldMetallic, goldLight, goldMetallic],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient darkMetallicGradient = LinearGradient(
    colors: [obsidianBlack, charcoalGray],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  // Dark Theme Definition
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      primaryColor: goldMetallic,
      scaffoldBackgroundColor: obsidianBlack,
      cardColor: darkCardColor,
      appBarTheme: const AppBarTheme(
        backgroundColor: obsidianBlack,
        elevation: 0,
        centerTitle: true,
        iconTheme: IconThemeData(color: goldMetallic),
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
      ),
      colorScheme: const ColorScheme.dark(
        primary: goldMetallic,
        secondary: goldLight,
        surface: obsidianBlack,
        onPrimary: obsidianBlack,
        onSecondary: Colors.white,
        error: Colors.redAccent,
      ),
      cardTheme: CardThemeData(
        color: darkCardColor,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFF333333), width: 0.8),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: goldMetallic,
          foregroundColor: obsidianBlack,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(30),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: charcoalGray,
        hintStyle: const TextStyle(color: Colors.white38),
        labelStyle: const TextStyle(color: goldMetallic),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF333333), width: 1.0),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: goldMetallic, width: 1.5),
        ),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
        headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
        bodyLarge: TextStyle(fontSize: 16, color: Colors.white70),
        bodyMedium: TextStyle(fontSize: 14, color: Colors.white60),
      ),
    );
  }

  // Light Theme Definition
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: goldMetallic,
      scaffoldBackgroundColor: pearlWhite,
      cardColor: lightCardColor,
      appBarTheme: const AppBarTheme(
        backgroundColor: pearlWhite,
        elevation: 0,
        centerTitle: true,
        iconTheme: IconThemeData(color: goldMetallic),
        titleTextStyle: TextStyle(
          color: obsidianBlack,
          fontSize: 20,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
      ),
      colorScheme: const ColorScheme.light(
        primary: goldMetallic,
        secondary: goldDark,
        surface: pearlWhite,
        onPrimary: Colors.white,
        onSecondary: obsidianBlack,
        error: Colors.redAccent,
      ),
      cardTheme: CardThemeData(
        color: lightCardColor,
        elevation: 3,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFFE0E0E0), width: 0.8),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: goldMetallic,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(30),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: lightCardColor,
        hintStyle: const TextStyle(color: Colors.black38),
        labelStyle: const TextStyle(color: goldDark),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFCCCCCC), width: 1.0),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE0E0E0), width: 1.0),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: goldMetallic, width: 1.5),
        ),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: obsidianBlack),
        headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: obsidianBlack),
        bodyLarge: TextStyle(fontSize: 16, color: Colors.black87),
        bodyMedium: TextStyle(fontSize: 14, color: Colors.black54),
      ),
    );
  }
}
