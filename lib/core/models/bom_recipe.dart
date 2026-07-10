class BomRecipe {
  final int? id;
  final String designCode;
  final String metalType;
  final int karat;
  final String? cadFilePath;
  final String? designerName;
  final DateTime createdAt;

  BomRecipe({
    this.id,
    required this.designCode,
    required this.metalType,
    required this.karat,
    this.cadFilePath,
    this.designerName,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'design_code': designCode,
        'metal_type': metalType,
        'karat': karat,
        'cad_file_path': cadFilePath,
        'designer_name': designerName,
        'created_at': createdAt.toIso8601String(),
      };

  factory BomRecipe.fromMap(Map<String, dynamic> map) => BomRecipe(
        id: map['id'],
        designCode: map['design_code'],
        metalType: map['metal_type'],
        karat: map['karat'],
        cadFilePath: map['cad_file_path'],
        designerName: map['designer_name'],
        createdAt: DateTime.parse(map['created_at']),
      );
}
