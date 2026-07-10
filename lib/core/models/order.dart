enum OrderStatus {
  quotationPending,
  quotationApproved,
  designApproved,
  metalIssued,
  casting,
  stoneSetting,
  polishing,
  qualityCheck,
  readyForDispatch,
  dispatched,
  delivered,
  cancelled,
}

class Order {
  final String id;
  final String orderNumber;
  final String retailerId;
  final String retailerName;
  final List<OrderItem> items;
  final OrderStatus status;
  final DateTime createdAt;
  final DateTime? expectedDelivery;
  final DateTime? deliveredAt;
  final double subtotal;
  final double gstAmount;
  final double totalAmount;
  final bool isCustomOrder;
  final String? karigarName;
  final String? karigarPhone;
  final List<OrderUpdate> statusHistory;
  final String? notes;
  final String? trackingId;

  const Order({
    required this.id,
    required this.orderNumber,
    required this.retailerId,
    required this.retailerName,
    required this.items,
    required this.status,
    required this.createdAt,
    this.expectedDelivery,
    this.deliveredAt,
    required this.subtotal,
    required this.gstAmount,
    required this.totalAmount,
    this.isCustomOrder = false,
    this.karigarName,
    this.karigarPhone,
    this.statusHistory = const [],
    this.notes,
    this.trackingId,
  });

  String get statusLabel {
    switch (status) {
      case OrderStatus.quotationPending:
        return 'Quotation Pending';
      case OrderStatus.quotationApproved:
        return 'Quotation Approved';
      case OrderStatus.designApproved:
        return 'Design Approved';
      case OrderStatus.metalIssued:
        return 'Metal Issued';
      case OrderStatus.casting:
        return 'Casting';
      case OrderStatus.stoneSetting:
        return 'Stone Setting';
      case OrderStatus.polishing:
        return 'Polishing';
      case OrderStatus.qualityCheck:
        return 'Quality Check';
      case OrderStatus.readyForDispatch:
        return 'Ready for Dispatch';
      case OrderStatus.dispatched:
        return 'Dispatched';
      case OrderStatus.delivered:
        return 'Delivered';
      case OrderStatus.cancelled:
        return 'Cancelled';
    }
  }

  int get statusStep {
    final steps = [
      OrderStatus.designApproved,
      OrderStatus.metalIssued,
      OrderStatus.casting,
      OrderStatus.stoneSetting,
      OrderStatus.polishing,
      OrderStatus.qualityCheck,
      OrderStatus.readyForDispatch,
      OrderStatus.dispatched,
      OrderStatus.delivered,
    ];
    return steps.indexOf(status);
  }

  bool get isActive =>
      status != OrderStatus.delivered && status != OrderStatus.cancelled;
}

class OrderItem {
  final String productId;
  final String productName;
  final String sku;
  final String imageUrl;
  final int quantity;
  final double unitPrice;
  final String purity;
  final String? customSpecs;

  const OrderItem({
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
}

class OrderUpdate {
  final OrderStatus status;
  final DateTime timestamp;
  final String? note;
  final String? photoUrl;
  final String updatedBy;

  const OrderUpdate({
    required this.status,
    required this.timestamp,
    this.note,
    this.photoUrl,
    required this.updatedBy,
  });
}
