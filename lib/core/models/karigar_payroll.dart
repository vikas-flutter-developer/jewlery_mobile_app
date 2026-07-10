class KarigarPayroll {
  final int? id;
  final int karigarId;
  final DateTime periodStart;
  final DateTime periodEnd;
  final double totalAmount;
  final double tdsDeducted;
  final double netPayable;
  final String status; // 'pending' | 'paid'
  final DateTime? paymentDate;

  KarigarPayroll({
    this.id,
    required this.karigarId,
    required this.periodStart,
    required this.periodEnd,
    required this.totalAmount,
    required this.tdsDeducted,
    required this.netPayable,
    this.status = 'pending',
    this.paymentDate,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'karigar_id': karigarId,
        'period_start': periodStart.toIso8601String(),
        'period_end': periodEnd.toIso8601String(),
        'total_amount': totalAmount,
        'tds_deducted': tdsDeducted,
        'net_payable': netPayable,
        'status': status,
        'payment_date': paymentDate?.toIso8601String(),
      };

  factory KarigarPayroll.fromMap(Map<String, dynamic> map) => KarigarPayroll(
        id: map['id'],
        karigarId: map['karigar_id'],
        periodStart: DateTime.parse(map['period_start']),
        periodEnd: DateTime.parse(map['period_end']),
        totalAmount: map['total_amount'],
        tdsDeducted: map['tds_deducted'],
        netPayable: map['net_payable'],
        status: map['status'],
        paymentDate: map['payment_date'] != null
            ? DateTime.parse(map['payment_date'])
            : null,
      );
}
