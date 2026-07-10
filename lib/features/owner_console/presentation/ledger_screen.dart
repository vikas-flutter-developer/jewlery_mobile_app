import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/database/database_service.dart';
import '../../../core/models/ledger_entry.dart';
import '../../../core/util/pdf_generator.dart';
import '../../../core/util/tally_exporter.dart';

class LedgerScreen extends StatefulWidget {
  const LedgerScreen({super.key});
  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> with SingleTickerProviderStateMixin {
  late TabController _tab;
  List<LedgerEntry> _entries = [];
  String _partyType = 'all';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 4, vsync: this);
    _tab.addListener(() {
      final types = ['all', 'karigar', 'customer', 'supplier'];
      setState(() => _partyType = types[_tab.index]);
      _loadEntries();
    });
    _loadEntries();
  }
  @override
  void dispose() { _tab.dispose(); super.dispose(); }

  Future<void> _loadEntries() async {
    final e = await DatabaseService.instance.getAllLedgerEntries(partyType: _partyType == 'all' ? null : _partyType);
    if (mounted) setState(() { _entries = e; _isLoading = false; });
  }

  double get _debit  => _entries.where((e) => e.transactionType == 'debit').fold(0.0, (s, e) => s + e.amount);
  double get _credit => _entries.where((e) => e.transactionType == 'credit').fold(0.0, (s, e) => s + e.amount);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        title: Text('Ledger & Accounts', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        actions: [
          IconButton(
            icon: const Icon(Icons.import_export_rounded, color: AppColors.gold),
            tooltip: 'Export Tally XML',
            onPressed: () => TallyExporter.exportLedgersToTally(_entries),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(45),
          child: Container(
            color: Colors.white,
            child: TabBar(
              controller: _tab, indicatorColor: AppColors.gold, indicatorWeight: 2.5,
              labelColor: AppColors.gold, unselectedLabelColor: AppColors.textSecondary,
              isScrollable: true, tabAlignment: TabAlignment.start,
              labelStyle: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600),
              tabs: const [Tab(text: 'All'), Tab(text: 'Karigar'), Tab(text: 'Customer'), Tab(text: 'Supplier')],
            ),
          ),
        ),
      ),
      body: _isLoading ? const Center(child: CircularProgressIndicator(color: AppColors.gold)) : Column(
        children: [
          // Balance summary row
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              _BalCard('Total Debit', _debit, AppColors.error, Icons.arrow_upward_rounded),
              const SizedBox(width: 10),
              _BalCard('Total Credit', _credit, AppColors.success, Icons.arrow_downward_rounded),
              const SizedBox(width: 10),
              _BalCard('Balance', _debit - _credit, _debit >= _credit ? AppColors.error : AppColors.success, Icons.account_balance_rounded),
            ]),
          ),
          Expanded(
            child: _entries.isEmpty
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.receipt_long_outlined, size: 52, color: Color(0xFFCCCCCC)),
                  const SizedBox(height: 12),
                  Text('No entries found', style: GoogleFonts.inter(color: AppColors.textSecondary)),
                ]))
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                  itemCount: _entries.length,
                  itemBuilder: (_, i) => _EntryCard(
                    entry: _entries[i],
                    onEdit: () => _showEntrySheet(_entries[i]),
                    onDelete: () => _confirmDelete(_entries[i]),
                  ),
                ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showEntrySheet(null),
        backgroundColor: AppColors.gold, foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: Text('Add Entry', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _BalCard(String label, double amount, Color color, IconData icon) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(height: 8),
        Text('₹${NumberFormat('#,##0').format(amount)}', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: color)),
        Text(label, style: GoogleFonts.inter(fontSize: 10, color: AppColors.textSecondary)),
      ]),
    ),
  );

  void _showEntrySheet(LedgerEntry? existing) {
    final amountCtrl = TextEditingController(text: existing?.amount.toString() ?? ''),
          partyCtrl = TextEditingController(text: existing?.partyName ?? ''),
          descCtrl = TextEditingController(text: existing?.description ?? ''),
          refCtrl = TextEditingController(text: existing?.referenceNo ?? '');

    String partyType = existing?.partyType ?? 'karigar', transactionType = existing?.transactionType ?? 'debit';
    bool applyGst = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setS) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Text(existing == null ? 'New Ledger Entry' : 'Edit Ledger Entry', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _dd<String>('Party Type', partyType, ['karigar', 'customer', 'supplier'], (v) => setS(() => partyType = v!))),
          ]),
          const SizedBox(height: 12),
          _f(partyCtrl, 'Party Name *'),
          const SizedBox(height: 12),
          _f(amountCtrl, 'Amount (₹) *', type: TextInputType.number),
          const SizedBox(height: 12),
          _f(descCtrl, 'Description *'),
          const SizedBox(height: 12),
          _f(refCtrl, 'Reference No. (optional)'),
          const SizedBox(height: 12),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: Text('Apply 3% Integrated GST', style: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimary)),
            value: applyGst,
            activeColor: AppColors.gold,
            onChanged: (v) => setS(() => applyGst = v ?? false),
          ),
          const SizedBox(height: 16),
          // Dr/Cr Toggle
          Row(children: [
            Expanded(child: GestureDetector(
              onTap: () => setS(() => transactionType = 'debit'),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  color: transactionType == 'debit' ? AppColors.error.withOpacity(0.1) : const Color(0xFFF4F4F6),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: transactionType == 'debit' ? AppColors.error : Colors.transparent),
                ),
                child: Center(child: Text('DEBIT (Dr)', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: transactionType == 'debit' ? AppColors.error : AppColors.textSecondary))),
              ),
            )),
            const SizedBox(width: 12),
            Expanded(child: GestureDetector(
              onTap: () => setS(() => transactionType = 'credit'),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  color: transactionType == 'credit' ? AppColors.success.withOpacity(0.1) : const Color(0xFFF4F4F6),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: transactionType == 'credit' ? AppColors.success : Colors.transparent),
                ),
                child: Center(child: Text('CREDIT (Cr)', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: transactionType == 'credit' ? AppColors.success : AppColors.textSecondary))),
              ),
            )),
          ]),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text);
              if (partyCtrl.text.trim().isEmpty || amount == null || descCtrl.text.trim().isEmpty) return;

              final entry = LedgerEntry(
                id: existing?.id,
                partyName: partyCtrl.text.trim(),
                partyType: partyType,
                transactionType: transactionType,
                amount: applyGst ? amount * 1.03 : amount,
                description: applyGst ? '${descCtrl.text.trim()} (Inc. 3% GST)' : descCtrl.text.trim(),
                referenceNo: refCtrl.text.trim().isEmpty ? null : refCtrl.text.trim(),
                date: existing?.date ?? DateTime.now(),
                createdAt: existing?.createdAt ?? DateTime.now(),
              );

              if (existing == null) {
                await DatabaseService.instance.insertLedgerEntry(entry);
              } else {
                await DatabaseService.instance.updateLedgerEntry(entry);
              }

              if (mounted) { Navigator.pop(ctx); _loadEntries(); }
            },
            child: Text(existing == null ? 'Save Entry' : 'Update Entry'),
          )),
        ])),
      )),
    );
  }

  void _confirmDelete(LedgerEntry entry) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete Entry?', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        content: Text('Are you sure you want to delete this ₹${entry.amount} entry for ${entry.partyName}?', style: GoogleFonts.inter(fontSize: 14)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              await DatabaseService.instance.deleteLedgerEntry(entry.id!);
              if (mounted) { Navigator.pop(ctx); _loadEntries(); }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  void _showAddSheet() => _showEntrySheet(null);

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

class _EntryCard extends StatelessWidget {
  final LedgerEntry entry;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _EntryCard({required this.entry, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final isDr = entry.transactionType == 'debit';
    final color = isDr ? AppColors.error : AppColors.success;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
            child: Icon(isDr ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(entry.partyName, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            const SizedBox(height: 2),
            Text('${DateFormat('d MMM, yyyy').format(entry.date)} · ${entry.partyType.toUpperCase()}', style: GoogleFonts.inter(fontSize: 10, color: AppColors.textSecondary, letterSpacing: 0.5)),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            PopupMenuButton<String>(
              onSelected: (val) {
                if (val == 'print') PdfGenerator.generateLedgerReceipt(entry);
                if (val == 'edit') onEdit();
                if (val == 'delete') onDelete();
              },
              padding: EdgeInsets.zero,
              icon: const Icon(Icons.more_horiz_rounded, color: Color(0xFFCCCCCC), size: 22),
              itemBuilder: (ctx) => [
                const PopupMenuItem(value: 'print', child: Row(children: [Icon(Icons.print_rounded, size: 16, color: Colors.blueGrey), SizedBox(width: 8), Text('Print Receipt', style: TextStyle(fontSize: 13))])),
                const PopupMenuItem(value: 'edit', child: Row(children: [Icon(Icons.edit_rounded, size: 16, color: Colors.blue), SizedBox(width: 8), Text('Edit', style: TextStyle(fontSize: 13))])),
                const PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete_rounded, size: 16, color: Colors.red), SizedBox(width: 8), Text('Delete', style: TextStyle(fontSize: 13))])),
              ],
            ),
            const SizedBox(height: 4),
            Text('₹${NumberFormat('#,##0').format(entry.amount)}', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
          ]),
        ],
      ),
    );
  }
}
