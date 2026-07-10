class Karigar {
  final int? id;
  final String name;
  final String phone;
  final String? address;
  final String specialization; // melting, casting, polishing, setting, finishing
  final bool isActive;
  final bool biometricEnabled;
  final DateTime createdAt;

  Karigar({
    this.id,
    required this.name,
    required this.phone,
    this.address,
    required this.specialization,
    this.isActive = true,
    this.biometricEnabled = false,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'phone': phone,
        'address': address,
        'specialization': specialization,
        'is_active': isActive ? 1 : 0,
        'biometric_enabled': biometricEnabled ? 1 : 0,
        'created_at': createdAt.toIso8601String(),
      };

  factory Karigar.fromMap(Map<String, dynamic> map) => Karigar(
        id: map['id'],
        name: map['name'],
        phone: map['phone'],
        address: map['address'],
        specialization: map['specialization'],
        isActive: map['is_active'] == 1,
        biometricEnabled: map['biometric_enabled'] == 1,
        createdAt: DateTime.parse(map['created_at']),
      );

  Karigar copyWith({
    int? id,
    String? name,
    String? phone,
    String? address,
    String? specialization,
    bool? isActive,
    bool? biometricEnabled,
    DateTime? createdAt,
  }) =>
      Karigar(
        id: id ?? this.id,
        name: name ?? this.name,
        phone: phone ?? this.phone,
        address: address ?? this.address,
        specialization: specialization ?? this.specialization,
        isActive: isActive ?? this.isActive,
        biometricEnabled: biometricEnabled ?? this.biometricEnabled,
        createdAt: createdAt ?? this.createdAt,
      );
}
