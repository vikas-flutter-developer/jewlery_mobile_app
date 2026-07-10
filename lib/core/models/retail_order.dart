class RetailOrder {
  final int? id;
  final String customerName;
  final int? partyId;
  final String details;
  final String status; // 'pending', 'in_progress', 'completed', 'delivered'
  final DateTime? targetDate;
  final DateTime createdAt;

  RetailOrder({
    this.id,
    required this.customerName,
    this.partyId,
    required this.details,
    required this.status,
    this.targetDate,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'customer_name': customerName,
      'party_id': partyId,
      'details': details,
      'status': status,
      'target_date': targetDate?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory RetailOrder.fromMap(Map<String, dynamic> map) {
    return RetailOrder(
      id: map['id'],
      customerName: map['customer_name'],
      partyId: map['party_id'],
      details: map['details'],
      status: map['status'],
      targetDate: map['target_date'] != null ? DateTime.parse(map['target_date']) : null,
      createdAt: DateTime.parse(map['created_at']),
    );
  }
}
