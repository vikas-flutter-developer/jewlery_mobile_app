class Customer {
  final int? id;
  final String name;
  final String phone;
  final String? email;
  final String? address;
  final DateTime? dob;
  final DateTime? anniversary;
  final int loyaltyPoints;
  final double totalPurchaseValue;
  final DateTime createdAt;

  Customer({
    this.id,
    required this.name,
    required this.phone,
    this.email,
    this.address,
    this.dob,
    this.anniversary,
    this.loyaltyPoints = 0,
    this.totalPurchaseValue = 0.0,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'phone': phone,
        'email': email,
        'address': address,
        'dob': dob?.toIso8601String(),
        'anniversary': anniversary?.toIso8601String(),
        'loyalty_points': loyaltyPoints,
        'total_purchase_value': totalPurchaseValue,
        'created_at': createdAt.toIso8601String(),
      };

  factory Customer.fromMap(Map<String, dynamic> map) => Customer(
        id: map['id'],
        name: map['name'],
        phone: map['phone'],
        email: map['email'],
        address: map['address'],
        dob: map['dob'] != null ? DateTime.parse(map['dob']) : null,
        anniversary: map['anniversary'] != null ? DateTime.parse(map['anniversary']) : null,
        loyaltyPoints: map['loyalty_points'] ?? 0,
        totalPurchaseValue: (map['total_purchase_value'] ?? 0.0).toDouble(),
        createdAt: DateTime.parse(map['created_at']),
      );
}
