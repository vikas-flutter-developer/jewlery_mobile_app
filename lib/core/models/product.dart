import 'package:flutter/material.dart';

enum JewelryCategory { gold, diamond, platinum, gemstone, bridal }
enum StoneType { natural, labGrown, none }
enum MetalPurity { k14, k18, k22, k24, pt950 }

class Product {
  final String id;
  final String sku;
  final String name;
  final String description;
  final JewelryCategory category;
  final MetalPurity purity;
  final double grossWeight;
  final double netWeight;
  final double makingCharges;
  final double wastagePercent;
  final List<String> imageUrls;
  final List<StoneSpec> stones;
  final bool isNew;
  final bool isTrending;
  final int orderCount;
  final double rating;
  final List<String> tags;
  final Map<String, String> specs;

  const Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.description,
    required this.category,
    required this.purity,
    required this.grossWeight,
    required this.netWeight,
    required this.makingCharges,
    this.wastagePercent = 3.0,
    this.imageUrls = const [],
    this.stones = const [],
    this.isNew = false,
    this.isTrending = false,
    this.orderCount = 0,
    this.rating = 4.5,
    this.tags = const [],
    this.specs = const {},
  });

  Color get categoryColor {
    switch (category) {
      case JewelryCategory.gold:
        return const Color(0xFFC9A84C);
      case JewelryCategory.diamond:
        return const Color(0xFF7EC8E3);
      case JewelryCategory.platinum:
        return const Color(0xFFB0BEC5);
      case JewelryCategory.gemstone:
        return const Color(0xFFCE93D8);
      case JewelryCategory.bridal:
        return const Color(0xFFEF9A9A);
    }
  }

  String get categoryLabel {
    switch (category) {
      case JewelryCategory.gold:
        return 'Gold';
      case JewelryCategory.diamond:
        return 'Diamond';
      case JewelryCategory.platinum:
        return 'Platinum';
      case JewelryCategory.gemstone:
        return 'Gemstone';
      case JewelryCategory.bridal:
        return 'Bridal';
    }
  }

  String get purityLabel {
    switch (purity) {
      case MetalPurity.k14:
        return '14K';
      case MetalPurity.k18:
        return '18K';
      case MetalPurity.k22:
        return '22K';
      case MetalPurity.k24:
        return '24K';
      case MetalPurity.pt950:
        return 'Pt 950';
    }
  }

  double calculatePrice(double goldRatePerGram) {
    final metalValue = netWeight * goldRatePerGram;
    final making = metalValue * (makingCharges / 100);
    final wastage = metalValue * (wastagePercent / 100);
    final stoneValue = stones.fold(0.0, (sum, s) => sum + s.totalValue);
    final subtotal = metalValue + making + wastage + stoneValue;
    final gst = subtotal * 0.03; // 3% GST on jewelry
    return subtotal + gst;
  }

  String get firstImage =>
      imageUrls.isNotEmpty ? imageUrls.first : _defaultImage;

  String get _defaultImage {
    switch (category) {
      case JewelryCategory.gold:
        return 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400';
      case JewelryCategory.diamond:
        return 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400';
      case JewelryCategory.platinum:
        return 'https://images.unsplash.com/photo-1573408301185-9519f94815b3?w=400';
      case JewelryCategory.gemstone:
        return 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400';
      case JewelryCategory.bridal:
        return 'https://images.unsplash.com/photo-1519741347686-c1e331c20a2d?w=400';
    }
  }
}

class StoneSpec {
  final String type; // Diamond, Ruby, Emerald etc.
  final StoneType stoneType;
  final double carats;
  final String? cut;   // Excellent, Very Good, Good
  final String? color; // D, E, F, G, H
  final String? clarity; // FL, IF, VVS1, VVS2, VS1, VS2, SI1
  final double pricePerCarat;
  final int count;

  const StoneSpec({
    required this.type,
    required this.stoneType,
    required this.carats,
    this.cut,
    this.color,
    this.clarity,
    required this.pricePerCarat,
    this.count = 1,
  });

  double get totalValue => carats * pricePerCarat * count;

  String get stoneTypeLabel =>
      stoneType == StoneType.labGrown ? 'Lab Grown' : 'Natural';
}
