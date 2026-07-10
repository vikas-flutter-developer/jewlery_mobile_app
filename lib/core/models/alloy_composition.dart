class AlloyComposition {
  final int? id;
  final String name;
  final int targetKarat;
  final double totalWeight;
  final double pureMetalWeight;
  final double alloyWeight;
  final DateTime createdDate;

  AlloyComposition({
    this.id,
    required this.name,
    required this.targetKarat,
    required this.totalWeight,
    required this.pureMetalWeight,
    required this.alloyWeight,
    required this.createdDate,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'target_karat': targetKarat,
        'total_weight': totalWeight,
        'pure_metal_weight': pureMetalWeight,
        'alloy_weight': alloyWeight,
        'created_date': createdDate.toIso8601String(),
      };

  factory AlloyComposition.fromMap(Map<String, dynamic> map) => AlloyComposition(
        id: map['id'],
        name: map['name'],
        targetKarat: map['target_karat'],
        totalWeight: map['total_weight'],
        pureMetalWeight: map['pure_metal_weight'],
        alloyWeight: map['alloy_weight'],
        createdDate: DateTime.parse(map['created_date']),
      );
}
