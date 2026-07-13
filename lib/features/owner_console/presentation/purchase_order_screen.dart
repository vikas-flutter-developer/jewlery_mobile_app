import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';

class PurchaseOrderScreen extends StatefulWidget {
  const PurchaseOrderScreen({super.key});

  @override
  State<PurchaseOrderScreen> createState() => _PurchaseOrderScreenState();
}

class _PurchaseOrderScreenState extends State<PurchaseOrderScreen> {
  final _apiClient = ApiClient();
  final _supplierCtrl = TextEditingController();
  final _weightCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();

  List<dynamic> _purchaseOrders = [];
  bool _isLoading = false;
  String? _errorMessage;

  String _selectedMetal = 'GOLD';
  String _selectedPurity = '22K';

  @override
  void initState() {
    super.initState();
    _fetchPurchaseOrders();
  }

  @override
  void dispose() {
    _supplierCtrl.dispose();
    _weightCtrl.dispose();
    _priceCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchPurchaseOrders() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _apiClient.get('/purchase-orders');
      if (res.statusCode == 200 && res.data != null) {
        setState(() {
          _purchaseOrders = res.data['data'] as List<dynamic>? ?? res.data as List<dynamic>;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to fetch purchase orders: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showCreateDialog() {
    _supplierCtrl.clear();
    _weightCtrl.clear();
    _priceCtrl.clear();

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text(
                'NEW PURCHASE ORDER',
                style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontWeight: FontWeight.bold, fontSize: 16),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: _supplierCtrl,
                      decoration: const InputDecoration(labelText: 'Supplier / Vendor Name'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedMetal,
                      decoration: const InputDecoration(labelText: 'Metal Type'),
                      items: ['GOLD', 'SILVER', 'PLATINUM'].map((m) {
                        return DropdownMenuItem(value: m, child: Text(m));
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            _selectedMetal = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _weightCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Metal Weight (Grams)'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _priceCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Price Per Gram'),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  child: const Text('CANCEL', style: TextStyle(color: Colors.black45)),
                  onPressed: () => Navigator.pop(context),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
                  child: const Text('SUBMIT ORDER', style: TextStyle(color: Colors.white)),
                  onPressed: () async {
                    if (_supplierCtrl.text.trim().isEmpty) return;
                    
                    final weight = double.tryParse(_weightCtrl.text) ?? 0.0;
                    final price = double.tryParse(_priceCtrl.text) ?? 0.0;

                    final res = await _apiClient.post(
                      '/purchase-orders',
                      data: {
                        'vendorName': _supplierCtrl.text.trim(),
                        'metalType': _selectedMetal,
                        'purity': _selectedPurity,
                        'weightGrams': weight,
                        'ratePerGram': price,
                        'totalAmount': weight * price,
                        'status': 'ORDERED',
                      },
                    );

                    if (res.statusCode == 201 || res.statusCode == 200) {
                      Navigator.pop(context);
                      _fetchPurchaseOrders();
                    }
                  },
                )
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.goldDark),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'PURCHASE REGISTER',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_business_rounded, color: AppTheme.goldDark),
            onPressed: _showCreateDialog,
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_isLoading)
              const Expanded(child: Center(child: CircularProgressIndicator(color: AppTheme.goldDark)))
            else if (_errorMessage != null)
              Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold))
            else if (_purchaseOrders.isEmpty)
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.local_shipping_outlined, size: 64, color: AppTheme.goldMetallic.withOpacity(0.3)),
                      const SizedBox(height: 16),
                      const Text('No raw metal purchase orders registered.', style: TextStyle(color: Colors.black38)),
                    ],
                  ),
                ),
              )
            else
              Expanded(
                child: ListView.builder(
                  itemCount: _purchaseOrders.length,
                  itemBuilder: (context, index) {
                    final po = _purchaseOrders[index];
                    final amount = po['totalAmount'] ?? ((po['weightGrams'] ?? 0) * (po['ratePerGram'] ?? 0));
                    final status = po['status'] ?? 'ORDERED';

                    return Card(
                      color: Colors.white,
                      surfaceTintColor: Colors.transparent,
                      elevation: 0,
                      margin: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: const BorderSide(color: Color(0xFFECE6DF)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(20.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  po['vendorName'] ?? 'Vendor / Supplier',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF2E2A25)),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: AppTheme.goldMetallic.withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    status,
                                    style: const TextStyle(color: AppTheme.goldDark, fontSize: 9, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            const Divider(height: 1),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '${po['metalType'] ?? 'GOLD'} • ${po['weightGrams'] ?? 0}g @ ₹${po['ratePerGram'] ?? 0}',
                                  style: const TextStyle(color: Colors.black54, fontSize: 13),
                                ),
                                Text(
                                  '₹$amount',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.goldDark),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
