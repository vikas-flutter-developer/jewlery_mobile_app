import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/database/database_service.dart';
import '../../../core/models/karigar.dart';
import '../../../core/models/karigar_payroll.dart';
import 'package:intl/intl.dart';

class KarigarPayrollScreen extends StatefulWidget {
  final Karigar karigar;
  const KarigarPayrollScreen({super.key, required this.karigar});

  @override
  State<KarigarPayrollScreen> createState() => _KarigarPayrollScreenState();
}

class _KarigarPayrollScreenState extends State<KarigarPayrollScreen> {
  List<KarigarPayroll> _payrolls = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadPayroll();
  }

  Future<void> _loadPayroll() async {
    final list = await DatabaseService.instance.getPayrollByKarigar(widget.karigar.id!);
    if(mounted) setState(() { _payrolls = list; _isLoading = false; });
  }

  void _showGeneratePayroll() {
    final amountCtrl = TextEditingController();
    final tdsCtrl = TextEditingController(text: '0');

    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setS) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Text('Generate Payroll', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 16),
          TextField(
            controller: amountCtrl,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: 'Gross Amount (₹)', filled: true, fillColor: const Color(0xFFF4F4F6), border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none)),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: tdsCtrl,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: 'TDS Deduction (₹)', filled: true, fillColor: const Color(0xFFF4F4F6), border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none)),
          ),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, height: 48, child: ElevatedButton(
            onPressed: () async {
              final amt = double.tryParse(amountCtrl.text) ?? 0.0;
              final tds = double.tryParse(tdsCtrl.text) ?? 0.0;
              if (amt <= 0) return;

              final net = amt - tds;
              final p = KarigarPayroll(
                karigarId: widget.karigar.id!,
                periodStart: DateTime.now().subtract(const Duration(days: 30)),
                periodEnd: DateTime.now(),
                totalAmount: amt,
                tdsDeducted: tds,
                netPayable: net,
                status: 'pending',
              );
              await DatabaseService.instance.insertKarigarPayroll(p);
              if (mounted) { Navigator.pop(ctx); _loadPayroll(); }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.gold),
            child: const Text('Generate Salary Slip'),
          ))
        ]),
      ))
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        title: Text('${widget.karigar.name} Payroll', style: GoogleFonts.outfit(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showGeneratePayroll,
        backgroundColor: AppColors.gold,
        icon: const Icon(Icons.receipt_long),
        label: Text('Generate Slip', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white)),
      ),
      body: _isLoading ? const Center(child: CircularProgressIndicator()) : ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _payrolls.length,
        itemBuilder: (context, index) {
          final p = _payrolls[index];
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6)]
            ),
            child: Column(
               crossAxisAlignment: CrossAxisAlignment.start,
               children: [
                 Row(
                   mainAxisAlignment: MainAxisAlignment.spaceBetween,
                   children: [
                     Text(DateFormat('MMM dd, yyyy').format(p.periodEnd), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16)),
                     Container(
                       padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                       decoration: BoxDecoration(
                         color: p.status == 'paid' ? AppColors.success.withOpacity(0.1) : AppColors.warning.withOpacity(0.1),
                         borderRadius: BorderRadius.circular(6)
                       ),
                       child: Text(p.status.toUpperCase(), style: GoogleFonts.inter(fontSize: 10, color: p.status == 'paid' ? AppColors.success : AppColors.warning, fontWeight: FontWeight.bold))
                     )
                   ]
                 ),
                 const SizedBox(height: 12),
                 Row(
                   mainAxisAlignment: MainAxisAlignment.spaceBetween,
                   children: [
                     Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                       Text('Gross', style: GoogleFonts.inter(color: Colors.grey, fontSize: 12)),
                       Text('₹${p.totalAmount.toStringAsFixed(0)}', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                     ]),
                     Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                       Text('TDS', style: GoogleFonts.inter(color: Colors.grey, fontSize: 12)),
                       Text('₹${p.tdsDeducted.toStringAsFixed(0)}', style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.error)),
                     ]),
                     Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                       Text('Net Payable', style: GoogleFonts.inter(color: Colors.grey, fontSize: 12)),
                       Text('₹${p.netPayable.toStringAsFixed(0)}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.gold)),
                     ]),
                   ]
                 )
               ]
            )
          );
        }
      )
    );
  }
}
