import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/database/database_service.dart';
import 'scanner_screen.dart';
import '../../../core/models/stock_item.dart';
import '../../../core/util/pdf_generator.dart';
import 'inter_branch_transfer_screen.dart';
import 'bom_manager_screen.dart';

class InventoryScreen extends StatefulWidget {
  final String? initialMetalFilter;
  const InventoryScreen({super.key, this.initialMetalFilter});
  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> with SingleTickerProviderStateMixin {
  late TabController _tab;
  List<StockItem> _all = [];
  String? _selectedMetalType;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _selectedMetalType = widget.initialMetalFilter;
    _tab = TabController(length: 3, vsync: this);
    _loadStock();
  }

  @override
  void dispose() { _tab.dispose(); super.dispose(); }

  Future<void> _loadStock() async {
    final items = await DatabaseService.instance.getAllStock();
    if (mounted) setState(() { _all = items; _isLoading = false; });
  }

  List<StockItem> get _filteredAll {
    if (_selectedMetalType == null) return _all;
    if (_selectedMetalType == 'gold') {
      return _all.where((i) => i.metalType == 'gold').toList();
    }
    if (_selectedMetalType == 'silver') {
      return _all.where((i) => i.metalType == 'silver').toList();
    }
    if (_selectedMetalType == 'diamonds') {
      return _all.where((i) => i.name.toLowerCase().contains('diamond') || i.metalType == 'diamonds').toList();
    }
    return _all;
  }

  List<StockItem> _cat(String c) => _filteredAll.where((i) => i.category == c).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        title: Text('Inventory & Stock', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        actions: [
          IconButton(
            icon: const Icon(Icons.architecture_rounded, color: AppColors.gold),
            tooltip: 'Manufacturing BOMs',
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BomManagerScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.local_shipping_rounded, color: AppColors.gold),
            tooltip: 'Multi-Branch Transfers',
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const InterBranchTransferScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.document_scanner_rounded, color: AppColors.gold),
            onPressed: () async {
              final StockItem? item = await Navigator.push(context, MaterialPageRoute(builder: (_) => const ScannerScreen()));
              if (item != null && mounted) _showStockSheet(item);
            },
          ),
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(45),
          child: Container(
            color: Colors.white,
            child: TabBar(
              controller: _tab, indicatorColor: AppColors.gold, indicatorWeight: 2.5,
              labelColor: AppColors.gold, unselectedLabelColor: AppColors.textSecondary,
              labelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600),
              tabs: [Tab(text: 'Raw (${_cat('raw').length})'), Tab(text: 'Semi (${_cat('semi_finished').length})'), Tab(text: 'Finished (${_cat('finished').length})')],
            ),
          ),
        ),
      ),
      body: _isLoading ? const Center(child: CircularProgressIndicator(color: AppColors.gold)) : Column(
        children: [
          // Filter Chips Row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  FilterChip(
                    label: const Text('All Metals'),
                    selected: _selectedMetalType == null,
                    onSelected: (_) => setState(() => _selectedMetalType = null),
                    selectedColor: AppColors.gold.withValues(alpha: 0.15),
                    checkmarkColor: AppColors.gold,
                    labelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _selectedMetalType == null ? AppColors.gold : AppColors.textSecondary),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Gold'),
                    selected: _selectedMetalType == 'gold',
                    onSelected: (_) => setState(() => _selectedMetalType = 'gold'),
                    selectedColor: const Color(0xFFFFF7DB),
                    checkmarkColor: const Color(0xFF755B13),
                    labelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _selectedMetalType == 'gold' ? const Color(0xFF755B13) : AppColors.textSecondary),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Silver'),
                    selected: _selectedMetalType == 'silver',
                    onSelected: (_) => setState(() => _selectedMetalType = 'silver'),
                    selectedColor: const Color(0xFFF1F3F5),
                    checkmarkColor: const Color(0xFF4A5568),
                    labelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _selectedMetalType == 'silver' ? const Color(0xFF4A5568) : AppColors.textSecondary),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Diamonds'),
                    selected: _selectedMetalType == 'diamonds',
                    onSelected: (_) => setState(() => _selectedMetalType = 'diamonds'),
                    selectedColor: const Color(0xFFE3F2FD),
                    checkmarkColor: const Color(0xFF1565C0),
                    labelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: _selectedMetalType == 'diamonds' ? const Color(0xFF1565C0) : AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ),
          // Summary banner
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF11998E), Color(0xFF38EF7D)]),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [BoxShadow(color: const Color(0xFF11998E).withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4))],
            ),
            child: Row(
              children: [
                _SumPill('Raw', '${_cat('raw').fold(0.0, (s, i) => s + i.weightGrams).toStringAsFixed(0)}g'),
                _vDiv(), _SumPill('Semi', '${_cat('semi_finished').fold(0.0, (s, i) => s + i.weightGrams).toStringAsFixed(0)}g'),
                _vDiv(), _SumPill('Finished', '${_cat('finished').fold(0.0, (s, i) => s + i.weightGrams).toStringAsFixed(0)}g'),
                _vDiv(), _SumPill('Items', '${_filteredAll.length}'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tab, 
              children: [
                _StockList(items: _cat('raw'), onEdit: _showStockSheet, onDelete: _confirmDelete), 
                _StockList(items: _cat('semi_finished'), onEdit: _showStockSheet, onDelete: _confirmDelete), 
                _StockList(items: _cat('finished'), onEdit: _showStockSheet, onDelete: _confirmDelete),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showStockSheet(null),
        backgroundColor: AppColors.gold, foregroundColor: Colors.white,
        icon: const Icon(Icons.add_box_rounded),
        label: Text('Add Stock', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _vDiv() => Container(width: 0.5, height: 32, margin: const EdgeInsets.symmetric(horizontal: 8), color: Colors.white.withOpacity(0.3));

  Widget _SumPill(String label, String value) => Expanded(
    child: Column(children: [
      Text(value, style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
      Text(label, style: GoogleFonts.inter(fontSize: 9, color: Colors.white.withOpacity(0.85))),
    ]),
  );

  void _showStockSheet(StockItem? existing) {
    final nameCtrl = TextEditingController(text: existing?.name ?? ''), 
          weightCtrl = TextEditingController(text: existing?.weightGrams.toString() ?? ''), 
          piecesCtrl = TextEditingController(text: existing?.pieces.toString() ?? '1'), 
          locationCtrl = TextEditingController(text: existing?.location ?? ''), 
          costCtrl = TextEditingController(text: existing?.costPerGram?.toString() ?? ''),
          rfidCtrl = TextEditingController(text: existing?.rfidTag ?? ''),
          huidCtrl = TextEditingController(text: existing?.huidCode ?? '');
    
    String category = existing?.category ?? 'raw', metalType = existing?.metalType ?? 'gold';
    String memoStatus = existing?.memoStatus ?? 'owned';
    int karat = existing?.karat ?? (metalType == 'diamond' ? 1 : 22);
    String? imagePath = existing?.imagePath;

    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setS) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Text(existing == null ? 'Add Stock Item' : 'Edit Stock Item', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 16),
          _f(nameCtrl, 'Item Name *'),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _dd<String>('Category', category, ['raw', 'semi_finished', 'finished'], (v) => setS(() => category = v!))),
            const SizedBox(width: 12),
            Expanded(child: _dd<String>('Metal', metalType, ['gold', 'silver', 'diamond'], (v) => setS(() {
              metalType = v!;
              karat = metalType == 'diamond' ? 1 : (metalType == 'gold' ? 22 : 999);
            }))),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _dd<int>(metalType == 'diamond' ? 'Carat' : 'Karat', karat, metalType == 'diamond' ? [1, 2, 3, 5] : (metalType == 'gold' ? [24,22,18] : [999]), (v) => setS(() => karat = v!))),
            const SizedBox(width: 12),
            Expanded(child: _f(weightCtrl, metalType == 'diamond' ? 'Weight (ct) *' : 'Weight (g) *', type: TextInputType.number)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _f(piecesCtrl, 'Pieces', type: TextInputType.number)),
            const SizedBox(width: 12),
            Expanded(child: _f(costCtrl, 'Cost/u (₹)', type: TextInputType.number)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _f(rfidCtrl, 'RFID Tag ID (Optional)')),
            const SizedBox(width: 12),
            Expanded(child: _f(huidCtrl, 'HUID Code (Optional)')),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _dd<String>('Stock Type', memoStatus, ['owned', 'memo'], (v) => setS(() => memoStatus = v!))),
            const SizedBox(width: 12),
            Expanded(child: _f(locationCtrl, 'Shelf/Location')),
          ]),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () async {
              final ImagePicker picker = ImagePicker();
              final XFile? image = await picker.pickImage(source: ImageSource.gallery);
              if (image != null) setS(() => imagePath = image.path);
            },
            child: Container(
              height: 120, width: double.infinity,
              decoration: BoxDecoration(color: const Color(0xFFF4F4F6), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey[300]!)),
              child: imagePath != null 
                  ? ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.file(File(imagePath!), fit: BoxFit.cover, width: double.infinity, height: 120))
                  : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      const Icon(Icons.add_photo_alternate_outlined, color: Colors.grey, size: 32),
                      const SizedBox(height: 8),
                      Text('Add Product Photo', style: GoogleFonts.inter(color: Colors.grey, fontSize: 13)),
                    ]),
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () async {
              final weight = double.tryParse(weightCtrl.text);
              if (nameCtrl.text.trim().isEmpty || weight == null) return;
              
              final item = StockItem(
                id: existing?.id,
                name: nameCtrl.text.trim(), 
                category: category, 
                metalType: metalType, 
                karat: karat, 
                weightGrams: weight, 
                pieces: int.tryParse(piecesCtrl.text) ?? 1, 
                location: locationCtrl.text.trim().isEmpty ? null : locationCtrl.text.trim(), 
                costPerGram: double.tryParse(costCtrl.text), 
                rfidTag: rfidCtrl.text.trim().isEmpty ? null : rfidCtrl.text.trim(),
                huidCode: huidCtrl.text.trim().isEmpty ? null : huidCtrl.text.trim(),
                memoStatus: memoStatus,
                warehouseId: existing?.warehouseId,
                imagePath: imagePath,
                updatedAt: DateTime.now()
              );

              if (existing == null) {
                await DatabaseService.instance.insertStockItem(item);
              } else {
                await DatabaseService.instance.updateStockItem(item);
              }
              
              if (mounted) { Navigator.pop(ctx); _loadStock(); }
            },
            child: Text(existing == null ? 'Add to Inventory' : 'Save Changes'),
          )),
        ])),
      )),
    );
  }

  void _confirmDelete(StockItem item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete Stock Item?', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        content: Text('Delete ${item.name}? This will remove it from inventory.', style: GoogleFonts.inter(fontSize: 14)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              await DatabaseService.instance.deleteStockItem(item.id!);
              if (mounted) { Navigator.pop(ctx); _loadStock(); }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  void _showAddSheet() => _showStockSheet(null);

  Widget _f(TextEditingController c, String label, {TextInputType type = TextInputType.text}) => TextFormField(
    controller: c, keyboardType: type,
    style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 14),
    decoration: InputDecoration(labelText: label, labelStyle: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13), filled: true, fillColor: const Color(0xFFF4F4F6), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.gold))),
  );

  Widget _dd<T>(String label, T value, List<T> items, void Function(T?) onChanged) => DropdownButtonFormField<T>(
    value: value,
    decoration: InputDecoration(labelText: label, labelStyle: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13), filled: true, fillColor: const Color(0xFFF4F4F6), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.gold))),
    items: items.map((i) => DropdownMenuItem<T>(value: i, child: Text(i.toString(), style: GoogleFonts.inter(fontSize: 13)))).toList(),
    onChanged: onChanged,
  );
}

class _StockList extends StatelessWidget {
  final List<StockItem> items;
  final Function(StockItem) onEdit;
  final Function(StockItem) onDelete;
  const _StockList({required this.items, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.inventory_2_outlined, size: 52, color: Color(0xFFCCCCCC)),
      const SizedBox(height: 12),
      Text('No items here yet', style: GoogleFonts.inter(color: AppColors.textSecondary)),
    ]));
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final item = items[i];
        final isGold = item.metalType == 'gold';
        final isDiamond = item.metalType == 'diamond';
        final color = isDiamond ? AppColors.diamondCategory : (isGold ? AppColors.gold : AppColors.platinumCategory);
        final val = item.totalValue;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: Row(children: [
            Container(width: 42, height: 42, decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                child: item.imagePath != null
                    ? ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.file(File(item.imagePath!), fit: BoxFit.cover, width: 42, height: 42))
                    : Icon(isDiamond ? Icons.diamond_outlined : (isGold ? Icons.diamond_rounded : Icons.water_drop_rounded), color: color, size: 20)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(item.name, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              const SizedBox(height: 3),
              Text('${item.karat}${isDiamond ? 'CT' : 'K'} · ${item.pieces} pcs · ${item.location ?? '—'}', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary)),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              PopupMenuButton<String>(
                onSelected: (val) {
                  if (val == 'print') PdfGenerator.generateStockBarcode(item);
                  if (val == 'edit') onEdit(item);
                  if (val == 'delete') onDelete(item);
                },
                padding: EdgeInsets.zero,
                icon: const Icon(Icons.more_horiz_rounded, color: Color(0xFFCCCCCC), size: 22),
                itemBuilder: (ctx) => [
                  const PopupMenuItem(value: 'print', child: Row(children: [Icon(Icons.qr_code_2_rounded, size: 16, color: Colors.blueGrey), SizedBox(width: 8), Text('Print Tag', style: TextStyle(fontSize: 13))])),
                  const PopupMenuItem(value: 'edit', child: Row(children: [Icon(Icons.edit_rounded, size: 16, color: Colors.blue), SizedBox(width: 8), Text('Edit', style: TextStyle(fontSize: 13))])),
                  const PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete_rounded, size: 16, color: Colors.red), SizedBox(width: 8), Text('Delete', style: TextStyle(fontSize: 13))])),
                ],
              ),
              const SizedBox(height: 4),
              Text('${item.weightGrams.toStringAsFixed(2)}${isDiamond ? 'ct' : 'g'}', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
              if (val > 0) Text('₹${NumberFormat('#,##0').format(val)}', style: GoogleFonts.inter(fontSize: 10, color: AppColors.textSecondary)),
            ]),
          ]),
        );
      },
    );
  }
}
