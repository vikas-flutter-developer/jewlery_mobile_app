enum TransactionType { invoice, payment, creditNote, debitNote, openingBalance }

class LedgerTransaction {
  final String id;
  final String referenceNumber;
  final TransactionType type;
  final DateTime date;
  final double amount;
  final double balance;
  final String description;
  final bool isDebit;
  final String? invoiceNumber;
  final String? orderId;
  final bool isPaid;
  final DateTime? dueDate;

  const LedgerTransaction({
    required this.id,
    required this.referenceNumber,
    required this.type,
    required this.date,
    required this.amount,
    required this.balance,
    required this.description,
    required this.isDebit,
    this.invoiceNumber,
    this.orderId,
    this.isPaid = false,
    this.dueDate,
  });

  String get typeLabel {
    switch (type) {
      case TransactionType.invoice:
        return 'Invoice';
      case TransactionType.payment:
        return 'Payment';
      case TransactionType.creditNote:
        return 'Credit Note';
      case TransactionType.debitNote:
        return 'Debit Note';
      case TransactionType.openingBalance:
        return 'Opening Balance';
    }
  }

  int get agingDays => DateTime.now().difference(date).inDays;

  String get agingBucket {
    if (agingDays <= 30) return '0-30 days';
    if (agingDays <= 60) return '31-60 days';
    if (agingDays <= 90) return '61-90 days';
    return '90+ days';
  }
}

class CartItem {
  final String productId;
  final String productName;
  final String sku;
  final String imageUrl;
  int quantity;
  final double unitPrice;
  final String purity;
  final String? customSpecs;

  CartItem({
    required this.productId,
    required this.productName,
    required this.sku,
    required this.imageUrl,
    required this.quantity,
    required this.unitPrice,
    required this.purity,
    this.customSpecs,
  });

  double get total => unitPrice * quantity;

  CartItem copyWith({int? quantity, double? unitPrice}) {
    return CartItem(
      productId: productId,
      productName: productName,
      sku: sku,
      imageUrl: imageUrl,
      quantity: quantity ?? this.quantity,
      unitPrice: unitPrice ?? this.unitPrice,
      purity: purity,
      customSpecs: customSpecs,
    );
  }
}
