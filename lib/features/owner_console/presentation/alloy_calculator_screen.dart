import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/database/database_service.dart';
import '../../../core/models/alloy_composition.dart';

class AlloyCalculatorScreen extends StatefulWidget {
  const AlloyCalculatorScreen({super.key});

  @override
  State<AlloyCalculatorScreen> createState() => _AlloyCalculatorScreenState();
}

class _AlloyCalculatorScreenState extends State<AlloyCalculatorScreen> {
  final _pureWeightCtrl = TextEditingController();
  final _alloyWeightCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  
  double _resultKarat = 0.0;
  List<AlloyComposition> _history = [];

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final list = await DatabaseService.instance.getAllAlloyCompositions();
    setState(() => _history = list);
  }

  void _calculate() {
    final pure = double.tryParse(_pureWeightCtrl.text) ?? 0.0;
    final alloy = double.tryParse(_alloyWeightCtrl.text) ?? 0.0;
    
    if (pure == 0) {
      setState(() => _resultKarat = 0.0);
      return;
    }
    
    final total = pure + alloy;
    final karat = (pure / total) * 24;
    setState(() => _resultKarat = karat);
  }

  Future<void> _saveComposition() async {
    final pure = double.tryParse(_pureWeightCtrl.text) ?? 0.0;
    final alloy = double.tryParse(_alloyWeightCtrl.text) ?? 0.0;
    final name = _nameCtrl.text.trim();
    
    if (pure == 0 || name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter name and valid weights')));
      return;
    }

    final total = pure + alloy;
    final karat = (pure / total) * 24;

    final comp = AlloyComposition(
      name: name,
      targetKarat: karat.round(),
      totalWeight: total,
      pureMetalWeight: pure,
      alloyWeight: alloy,
      createdDate: DateTime.now(),
    );

    await DatabaseService.instance.insertAlloyComposition(comp);
    _nameCtrl.clear();
    _pureWeightCtrl.clear();
    _alloyWeightCtrl.clear();
    setState(() => _resultKarat = 0.0);
    _loadHistory();
  }

  @override
  Widget build(BuildContext context) {
    final double screenWidth = MediaQuery.of(context).size.width;
    final bool isMobile = screenWidth < 650;

    Widget calculatorWidget = SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFECE6DF), width: 1.2),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF4A3E1B).withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Compute Purity', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF4A3E1B))),
            const SizedBox(height: 16),
            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: 'Lot / Composition Name',
                labelStyle: GoogleFonts.inter(color: Colors.black38, fontSize: 13),
                filled: true,
                fillColor: const Color(0xFFF4F4F6),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.gold)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _pureWeightCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: '24K Pure Gold (g)',
                      labelStyle: GoogleFonts.inter(color: Colors.black38, fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFFF4F4F6),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.gold)),
                    ),
                    onChanged: (_) => _calculate(),
                  )
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _alloyWeightCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Alloy/Copper (g)',
                      labelStyle: GoogleFonts.inter(color: Colors.black38, fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFFF4F4F6),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.gold)),
                    ),
                    onChanged: (_) => _calculate(),
                  )
                ),
              ],
            ),
            const SizedBox(height: 24),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFFDF5), Color(0xFFFFF7DB), Color(0xFFF6E7B5)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF755B13).withValues(alpha: 0.12), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF755B13).withValues(alpha: 0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Text('Estimated Purity', style: GoogleFonts.inter(color: const Color(0xFF755B13).withValues(alpha: 0.7), fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                  const SizedBox(height: 6),
                  Text('${_resultKarat.toStringAsFixed(2)} Karat', style: GoogleFonts.outfit(color: const Color(0xFF755B13), fontSize: 32, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text('${((_resultKarat/24)*100).toStringAsFixed(1)}% Pure Gold', style: GoogleFonts.inter(color: const Color(0xFF755B13), fontSize: 14, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _saveComposition,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.textPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: Text('Save Composition', style: GoogleFonts.outfit(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
              )
            )
          ]
        ),
      ),
    );

    Widget historyWidget = Container(
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
            child: Text('Saved Mixes', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF4A3E1B))),
          ),
          const Divider(height: 1),
          _history.isEmpty
              ? Expanded(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.calculate_outlined, size: 48, color: Colors.black26),
                        const SizedBox(height: 12),
                        Text('No mixes saved yet', style: GoogleFonts.inter(color: Colors.black38)),
                      ],
                    ),
                  ),
                )
              : Expanded(
                  child: ListView.separated(
                    padding: EdgeInsets.zero,
                    itemCount: _history.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFECE6DF)),
                    itemBuilder: (context, index) {
                      final comp = _history[index];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
                        title: Text(comp.name, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFF332F28))),
                        subtitle: Text('Pure: ${comp.pureMetalWeight}g | Alloy: ${comp.alloyWeight}g', style: GoogleFonts.inter(color: Colors.black45, fontSize: 12)),
                        trailing: Text('${comp.targetKarat}K', style: GoogleFonts.outfit(color: AppColors.gold, fontWeight: FontWeight.bold, fontSize: 16)),
                      );
                    }
                  ),
                ),
        ],
      ),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        title: Text('Alloy Calculator', style: GoogleFonts.outfit(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
      ),
      body: isMobile
          ? SingleChildScrollView(
              child: Column(
                children: [
                  calculatorWidget,
                  const SizedBox(height: 8),
                  Container(
                    height: 350,
                    margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(color: const Color(0xFFECE6DF), width: 1.2),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF4A3E1B).withValues(alpha: 0.03),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(22),
                      child: historyWidget,
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: calculatorWidget,
                ),
                Expanded(
                  flex: 2,
                  child: historyWidget,
                ),
              ],
            ),
    );
  }
}
