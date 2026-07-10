import 'package:flutter/foundation.dart';

class MetalRate {
  final int? id;
  final String metalType; // 'gold' | 'silver' | 'diamond'
  final int karat;        // 24, 22, 18, 14
  final double ratePerGram;
  final DateTime date;
  final String? note;

  MetalRate({
    this.id,
    required this.metalType,
    required this.karat,
    required this.ratePerGram,
    required this.date,
    this.note,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'metal_type': metalType,
        'karat': karat,
        'rate_per_gram': ratePerGram,
        'date': date.toIso8601String(),
        'note': note,
      };

  factory MetalRate.fromMap(Map<String, dynamic> map) => MetalRate(
        id: map['id'],
        metalType: map['metal_type'],
        karat: map['karat'],
        ratePerGram: map['rate_per_gram'],
        date: DateTime.parse(map['date']),
        note: map['note'],
      );

  MetalRate copyWith({
    int? id,
    String? metalType,
    int? karat,
    double? ratePerGram,
    DateTime? date,
    String? note,
  }) =>
      MetalRate(
        id: id ?? this.id,
        metalType: metalType ?? this.metalType,
        karat: karat ?? this.karat,
        ratePerGram: ratePerGram ?? this.ratePerGram,
        date: date ?? this.date,
        note: note ?? this.note,
      );
}
