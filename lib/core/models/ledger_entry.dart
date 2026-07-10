class LedgerEntry {
  final int? id;
  final String partyName;
  final int? partyId;
  final String partyType; // karigar | customer | supplier
  final String transactionType; // debit | credit
  final double amount;
  final double? metalWeight;
  final String? metalType;
  final int? karat;
  final String description;
  final String? referenceNo;
  final DateTime date;
  final DateTime createdAt;

  LedgerEntry({
    this.id,
    required this.partyName,
    this.partyId,
    required this.partyType,
    required this.transactionType,
    required this.amount,
    this.metalWeight,
    this.metalType,
    this.karat,
    required this.description,
    this.referenceNo,
    required this.date,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'party_name': partyName,
        'party_id': partyId,
        'party_type': partyType,
        'transaction_type': transactionType,
        'amount': amount,
        'metal_weight': metalWeight,
        'metal_type': metalType,
        'karat': karat,
        'description': description,
        'reference_no': referenceNo,
        'date': date.toIso8601String(),
        'created_at': createdAt.toIso8601String(),
      };

  factory LedgerEntry.fromMap(Map<String, dynamic> map) => LedgerEntry(
        id: map['id'],
        partyName: map['party_name'],
        partyId: map['party_id'],
        partyType: map['party_type'],
        transactionType: map['transaction_type'],
        amount: map['amount'],
        metalWeight: map['metal_weight'],
        metalType: map['metal_type'],
        karat: map['karat'],
        description: map['description'],
        referenceNo: map['reference_no'],
        date: DateTime.parse(map['date']),
        createdAt: DateTime.parse(map['created_at']),
      );
}
