class StockItem {
  final int? id;
  final String name;
  final String category; // raw | semi_finished | finished
  final String metalType;
  final int karat;
  final double weightGrams;
  final int pieces;
  final String? location;
  final String? barcodeId;
  final String? designCode;
  final double? costPerGram;
  final String? imagePath;
  final int? warehouseId;
  final String? rfidTag;
  final String? huidCode;
  final String? memoStatus;
  final DateTime updatedAt;

  StockItem({
    this.id,
    required this.name,
    required this.category,
    required this.metalType,
    required this.karat,
    required this.weightGrams,
    required this.pieces,
    this.location,
    this.barcodeId,
    this.designCode,
    this.costPerGram,
    this.imagePath,
    this.warehouseId,
    this.rfidTag,
    this.huidCode,
    this.memoStatus,
    required this.updatedAt,
  });

  double get totalValue => (costPerGram ?? 0) * weightGrams;

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'category': category,
        'metal_type': metalType,
        'karat': karat,
        'weight_grams': weightGrams,
        'pieces': pieces,
        'location': location,
        'barcode_id': barcodeId,
        'design_code': designCode,
        'cost_per_gram': costPerGram,
        'image_path': imagePath,
        'warehouse_id': warehouseId,
        'rfid_tag': rfidTag,
        'huid_code': huidCode,
        'memo_status': memoStatus,
        'updated_at': updatedAt.toIso8601String(),
      };

  factory StockItem.fromMap(Map<String, dynamic> map) => StockItem(
        id: map['id'],
        name: map['name'],
        category: map['category'],
        metalType: map['metal_type'],
        karat: map['karat'],
        weightGrams: map['weight_grams'],
        pieces: map['pieces'],
        location: map['location'],
        barcodeId: map['barcode_id'],
        designCode: map['design_code'],
        costPerGram: map['cost_per_gram'],
        imagePath: map['image_path'],
        warehouseId: map['warehouse_id'],
        rfidTag: map['rfid_tag'],
        huidCode: map['huid_code'],
        memoStatus: map['memo_status'],
        updatedAt: DateTime.parse(map['updated_at']),
      );
}
