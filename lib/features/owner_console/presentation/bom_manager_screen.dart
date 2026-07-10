import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/database/database_service.dart';
import '../../../core/models/bom_recipe.dart';
import '../../../core/models/bom_component.dart';

class BomManagerScreen extends StatefulWidget {
  const BomManagerScreen({super.key});

  @override
  State<BomManagerScreen> createState() => _BomManagerScreenState();
}

class _BomManagerScreenState extends State<BomManagerScreen> {
  List<BomRecipe> _recipes = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadRecipes();
  }

  Future<void> _loadRecipes() async {
    final recipes = await DatabaseService.instance.getAllBomRecipes();
    if(mounted) setState(() { _recipes = recipes; _isLoading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(
        title: Text('BOM / Manufacturing', style: GoogleFonts.outfit(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddRecipe,
        backgroundColor: const Color(0xFF6C63FF),
        icon: const Icon(Icons.architecture_rounded, color: Colors.white),
        label: Text('New BOM Recipe', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading ? const Center(child: CircularProgressIndicator()) : ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _recipes.length,
        itemBuilder: (ctx, i) {
          final r = _recipes[i];
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6)]),
            child: ListTile(
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFF6C63FF).withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.precision_manufacturing_rounded, color: Color(0xFF6C63FF)),
              ),
              title: Text(r.designCode, style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
              subtitle: Text('${r.karat}K ${r.metalType.toUpperCase()} | Designer: ${r.designerName ?? 'In-House'}', style: GoogleFonts.inter(fontSize: 12)),
              trailing: const Icon(Icons.chevron_right, color: Colors.grey),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => BomDetailScreen(recipe: r))),
            )
          );
        }
      )
    );
  }

  void _showAddRecipe() {
    final designCtrl = TextEditingController();
    final designerCtrl = TextEditingController();
    final cadCtrl = TextEditingController();
    String metalType = 'gold';
    int karat = 22;

    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setS) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Text('Create BOM Recipe', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 16),
          TextField(controller: designCtrl, decoration: _deco('Design Code *')),
          const SizedBox(height: 12),
          Row(children: [
             Expanded(child: DropdownButtonFormField<String>(
               value: metalType, decoration: _deco('Metal Type'),
               items: ['gold', 'silver', 'platinum'].map((e)=>DropdownMenuItem(value: e, child: Text(e.toUpperCase()))).toList(),
               onChanged: (v)=>setS((){ metalType = v!; karat = metalType=='gold'?22:(metalType=='silver'?999:950); })
             )),
             const SizedBox(width: 12),
             Expanded(child: DropdownButtonFormField<int>(
               value: karat, decoration: _deco('Karat / Purity'),
               items: (metalType=='gold'?[24,22,18]:(metalType=='silver'?[999]:[950])).map((e)=>DropdownMenuItem(value: e, child: Text('$e'))).toList(),
               onChanged: (v)=>setS(()=>karat=v!)
             )),
          ]),
          const SizedBox(height: 12),
          TextField(controller: designerCtrl, decoration: _deco('Designer Name (Analytics)')),
          const SizedBox(height: 12),
          TextField(controller: cadCtrl, decoration: _deco('CAD File URL / Path')),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, height: 48, child: ElevatedButton(
            onPressed: () async {
              if(designCtrl.text.isEmpty) return;
              final r = BomRecipe(
                designCode: designCtrl.text.trim(),
                metalType: metalType,
                karat: karat,
                cadFilePath: cadCtrl.text.trim().isEmpty ? null : cadCtrl.text.trim(),
                designerName: designerCtrl.text.trim().isEmpty ? null : designerCtrl.text.trim(),
                createdAt: DateTime.now()
              );
              await DatabaseService.instance.insertBomRecipe(r);
              if(mounted) { Navigator.pop(ctx); _loadRecipes(); }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C63FF)),
            child: const Text('Create Recipe')
          ))
        ]))
      ))
    );
  }

  InputDecoration _deco(String label) => InputDecoration(labelText: label, filled: true, fillColor: const Color(0xFFF4F4F6), border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none));
}

class BomDetailScreen extends StatefulWidget {
  final BomRecipe recipe;
  const BomDetailScreen({super.key, required this.recipe});
  @override
  State<BomDetailScreen> createState() => _BomDetailScreenState();
}

class _BomDetailScreenState extends State<BomDetailScreen> {
  List<BomComponent> _components = [];
  bool _isLoading = true;

  @override
  void initState() { super.initState(); _loadC(); }

  Future<void> _loadC() async {
    final c = await DatabaseService.instance.getComponentsForRecipe(widget.recipe.id!);
    if(mounted) setState(() { _components = c; _isLoading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FB),
      appBar: AppBar(title: Text('Recipe: ${widget.recipe.designCode}', style: GoogleFonts.outfit(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)), backgroundColor: Colors.white, iconTheme: const IconThemeData(color: AppColors.textPrimary), elevation: 0),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addComp, backgroundColor: AppColors.gold, icon: const Icon(Icons.add), label: Text('Add Component', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
      ),
      body: _isLoading ? const Center(child: CircularProgressIndicator()) : SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Container(
              width: double.infinity, padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('3D CAD Link: ${widget.recipe.cadFilePath ?? 'None'}', style: GoogleFonts.inter(color: Colors.blue)),
                const SizedBox(height: 8),
                Text('Designer: ${widget.recipe.designerName ?? 'Unassigned'}', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              ])
            ),
            const SizedBox(height: 16),
            ..._components.map((c) => ListTile(
              title: Text(c.name, style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
              subtitle: Text('Type: ${c.componentType} | Qty: ${c.quantity}'),
              trailing: Text(c.weightGrams!=null ? '${c.weightGrams}g' : '', style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.gold)),
              tileColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            )).toList()
          ]
        )
      )
    );
  }

  void _addComp() {
    final nameCtrl = TextEditingController();
    final qtyCtrl = TextEditingController(text: '1');
    final wCtrl = TextEditingController();
    String type = 'metal';
    showModalBottomSheet(
      context: context, isScrollControlled: true, builder: (ctx) => StatefulBuilder(builder: (c, setS) => Padding(
        padding: EdgeInsets.only(left:20, right:20, top:20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
           DropdownButtonFormField<String>(
             value: type, decoration: const InputDecoration(labelText: 'Component Type'),
             items: ['metal','stone','finding','consumable'].map((e)=>DropdownMenuItem(value:e, child:Text(e.toUpperCase()))).toList(),
             onChanged: (v)=>setS(()=>type=v!)
           ),
           TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Component Name (e.g. 2mm Diamond)')),
           TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')),
           TextField(controller: wCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Weight/ct/grams (optional)')),
           const SizedBox(height: 20),
           ElevatedButton(onPressed: () async {
             if(nameCtrl.text.isEmpty) return;
             final comp = BomComponent(recipeId: widget.recipe.id!, componentType: type, name: nameCtrl.text.trim(), quantity: int.tryParse(qtyCtrl.text) ?? 1, weightGrams: double.tryParse(wCtrl.text));
             await DatabaseService.instance.insertBomComponent(comp);
             if(mounted) { Navigator.pop(ctx); _loadC(); }
           }, child: const Text('Add Component'))
        ]))
      ))
    );
  }
}
