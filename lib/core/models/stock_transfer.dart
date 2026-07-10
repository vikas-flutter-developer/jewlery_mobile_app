class StockTransfer {
  final int? id;
  final int itemId;
  final int? fromWarehouseId;
  final int toWarehouseId;
  final DateTime transferDate;
  final String status; // pending, in_transit, completed

  StockTransfer({
    this.id,
    required this.itemId,
    this.fromWarehouseId,
    required this.toWarehouseId,
    required this.transferDate,
    required this.status,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'item_id': itemId,
        'from_warehouse_id': fromWarehouseId,
        'to_warehouse_id': toWarehouseId,
        'transfer_date': transferDate.toIso8601String(),
        'status': status,
      };

  factory StockTransfer.fromMap(Map<String, dynamic> map) => StockTransfer(
        id: map['id'],
        itemId: map['item_id'],
        fromWarehouseId: map['from_warehouse_id'],
        toWarehouseId: map['to_warehouse_id'],
        transferDate: DateTime.parse(map['transfer_date']),
        status: map['status'],
      );
}
