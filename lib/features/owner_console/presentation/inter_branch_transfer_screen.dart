import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/database/database_service.dart';
import '../../../core/models/warehouse.dart';
import '../../../core/models/stock_transfer.dart';
import '../../../core/models/stock_item.dart';
import 'package:intl/intl.dart';

class InterBranchTransferScreen extends StatefulWidget {
  const InterBranchTransferScreen({super.key});

  @override
  State<InterBranchTransferScreen> createState() => _InterBranchTransferScreenState();
}

class _InterBranchTransferScreenState extends State<InterBranchTransferScreen> {
  List<StockTransfer> _transfers = [];
  List<Warehouse> _warehouses = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final t = await DatabaseService.instance.getAllStockTransfers();
    final w = await DatabaseService.instance.getAllWarehouses();
    if(mounted) setState(() { _transfers = t; _warehouses = w; _isLoading = false; });
  }

  String _whName(int? id) => id == null ? 'Main Store' : _warehouses.firstWhere((w) => w.id == id, orElse: () => Warehouse(name: 'Unknown', location: '')).name;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        title: Text('Inter-Branch Transfers', style: GoogleFonts.outfit(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        actions: [
          IconButton(icon: const Icon(Icons.store_rounded, color: AppColors.gold), onPressed: _showAddWarehouse)
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddTransfer,
        backgroundColor: AppColors.gold,
        icon: const Icon(Icons.swap_horiz_rounded),
        label: Text('New Transfer', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
      ),
      body: _isLoading ? const Center(child: CircularProgressIndicator()) : ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _transfers.length,
        itemBuilder: (ctx, i) {
          final tr = _transfers[i];
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6)]),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                 Text('Stock Ref #${tr.itemId}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 15)),
                 Container(
                   padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                   decoration: BoxDecoration(color: tr.status == 'completed' ? AppColors.success.withOpacity(0.1) : AppColors.warning.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                   child: Text(tr.status.toUpperCase(), style: GoogleFonts.inter(fontSize: 10, color: tr.status == 'completed' ? AppColors.success : AppColors.warning, fontWeight: FontWeight.bold))
                 )
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('From', style: GoogleFonts.inter(color: Colors.grey, fontSize: 11)),
                  Text(_whName(tr.fromWarehouseId), style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                ])),
                const Icon(Icons.arrow_forward_rounded, color: Colors.grey, size: 20),
                const SizedBox(width: 8),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('To', style: GoogleFonts.inter(color: Colors.grey, fontSize: 11)),
                  Text(_whName(tr.toWarehouseId), style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                ])),
              ]),
              const SizedBox(height: 8),
              Divider(height: 1, color: Colors.grey[200]),
              const SizedBox(height: 8),
              Text(DateFormat('MMM dd, yyyy h:mm a').format(tr.transferDate), style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
            ])
          );
        }
      )
    );
  }

  void _showAddWarehouse() {
    final nCtrl = TextEditingController();
    final lCtrl = TextEditingController();
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: Text('Add Branch / Warehouse', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: nCtrl, decoration: const InputDecoration(labelText: 'Branch Name')),
        TextField(controller: lCtrl, decoration: const InputDecoration(labelText: 'Location')),
      ]),
      actions: [
        TextButton(onPressed:()=>Navigator.pop(ctx), child: const Text('Cancel')),
        ElevatedButton(onPressed: () async {
          if(nCtrl.text.isEmpty) return;
          await DatabaseService.instance.insertWarehouse(Warehouse(name: nCtrl.text.trim(), location: lCtrl.text.trim()));
          if(mounted) { Navigator.pop(ctx); _loadData(); }
        }, child: const Text('Add'))
      ]
    ));
  }

  void _showAddTransfer() async {
    final items = await DatabaseService.instance.getAllStock();
    int? selItem;
    int? fromW;
    int? toW;
    
    if(!mounted) return;
    showModalBottomSheet(
      context: context, isScrollControlled: true, builder: (ctx) => StatefulBuilder(builder: (c, setS) => Padding(
        padding: EdgeInsets.only(left:20, right:20, top:20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
           Text('Initiate Stock Transfer', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold)),
           const SizedBox(height: 16),
           DropdownButtonFormField<int>(
             decoration: const InputDecoration(labelText: 'Select Stock Item'),
             items: items.map((e)=>DropdownMenuItem(value:e.id, child:Text('${e.name} (${e.weightGrams}g)'))).toList(),
             onChanged: (v) { setS((){ selItem = v; fromW = items.firstWhere((i)=>i.id==v).warehouseId; }); }
           ),
           const SizedBox(height: 12),
           DropdownButtonFormField<int?>(
             value: fromW,
             decoration: const InputDecoration(labelText: 'From Branch (Auto-detected)', enabled: false),
             items: [..._warehouses.map((e)=>DropdownMenuItem(value:e.id, child:Text(e.name))), const DropdownMenuItem(value:null, child:Text('Main Store'))],
             onChanged: null,
           ),
           const SizedBox(height: 12),
           DropdownButtonFormField<int?>(
             decoration: const InputDecoration(labelText: 'To Branch'),
             items: [..._warehouses.map((e)=>DropdownMenuItem(value:e.id, child:Text(e.name))), const DropdownMenuItem(value:null, child:Text('Main Store'))],
             onChanged: (v)=>setS(()=>toW=v),
           ),
           const SizedBox(height: 20),
           ElevatedButton(onPressed: () async {
             if(selItem == null || toW == fromW) return;
             final tr = StockTransfer(itemId: selItem!, fromWarehouseId: fromW, toWarehouseId: toW ?? 0, transferDate: DateTime.now(), status: 'completed');
             
             // Update stock item to new warehouse
             var item = items.firstWhere((i)=>i.id==selItem);
             // Create a new map and reconstruct stockitem since it doesnt have copyWith
             var m = item.toMap();
             m['warehouse_id'] = toW;
             await DatabaseService.instance.updateStockItem(StockItem.fromMap(m));
             await DatabaseService.instance.insertStockTransfer(tr);

             if(mounted) { Navigator.pop(ctx); _loadData(); }
           }, child: const Text('Transfer Content'))
        ]))
      ))
    );
  }
}
