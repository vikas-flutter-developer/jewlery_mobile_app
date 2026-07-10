class KittyScheme {
  final int? id;
  final int customerId;
  final double monthlyAmount;
  final int totalMonths;
  final DateTime startDate;
  final String status; // 'active', 'matured', 'defaulted'

  KittyScheme({
    this.id,
    required this.customerId,
    required this.monthlyAmount,
    required this.totalMonths,
    required this.startDate,
    required this.status,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'customer_id': customerId,
        'monthly_amount': monthlyAmount,
        'total_months': totalMonths,
        'start_date': startDate.toIso8601String(),
        'status': status,
      };

  factory KittyScheme.fromMap(Map<String, dynamic> map) => KittyScheme(
        id: map['id'],
        customerId: map['customer_id'],
        monthlyAmount: map['monthly_amount'],
        totalMonths: map['total_months'],
        startDate: DateTime.parse(map['start_date']),
        status: map['status'],
      );
}
