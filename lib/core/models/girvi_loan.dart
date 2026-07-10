class GirviLoan {
  final int? id;
  final int customerId;
  final double loanAmount;
  final double interestRate;
  final String pledgedItemsDetails;
  final DateTime startDate;
  final String status; // 'active', 'closed'

  GirviLoan({
    this.id,
    required this.customerId,
    required this.loanAmount,
    required this.interestRate,
    required this.pledgedItemsDetails,
    required this.startDate,
    required this.status,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'customer_id': customerId,
        'loan_amount': loanAmount,
        'interest_rate': interestRate,
        'pledged_items_details': pledgedItemsDetails,
        'start_date': startDate.toIso8601String(),
        'status': status,
      };

  factory GirviLoan.fromMap(Map<String, dynamic> map) => GirviLoan(
        id: map['id'],
        customerId: map['customer_id'],
        loanAmount: map['loan_amount'],
        interestRate: map['interest_rate'],
        pledgedItemsDetails: map['pledged_items_details'],
        startDate: DateTime.parse(map['start_date']),
        status: map['status'],
      );
}
