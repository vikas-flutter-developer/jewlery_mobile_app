class MetalBatch {
  final int? id;
  final String batchNumber;
  final String metalType;
  final int karat;
  final double weightGrams;
  final double purityPercentage;
  final String? source;
  final DateTime receivedDate;

  MetalBatch({
    this.id,
    required this.batchNumber,
    required this.metalType,
    required this.karat,
    required this.weightGrams,
    required this.purityPercentage,
    this.source,
    required this.receivedDate,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'batch_number': batchNumber,
        'metal_type': metalType,
        'karat': karat,
        'weight_grams': weightGrams,
        'purity_percentage': purityPercentage,
        'source': source,
        'received_date': receivedDate.toIso8601String(),
      };

  factory MetalBatch.fromMap(Map<String, dynamic> map) => MetalBatch(
        id: map['id'],
        batchNumber: map['batch_number'],
        metalType: map['metal_type'],
        karat: map['karat'],
        weightGrams: map['weight_grams'],
        purityPercentage: map['purity_percentage'],
        source: map['source'],
        receivedDate: DateTime.parse(map['received_date']),
      );
}
