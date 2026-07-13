import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';

class OffersManagerScreen extends StatefulWidget {
  const OffersManagerScreen({super.key});

  @override
  State<OffersManagerScreen> createState() => _OffersManagerScreenState();
}

class _OffersManagerScreenState extends State<OffersManagerScreen> {
  final _apiClient = ApiClient();
  final _codeCtrl = TextEditingController();
  final _valueCtrl = TextEditingController();
  final _minPurchaseCtrl = TextEditingController();

  List<dynamic> _offers = [];
  bool _isLoading = false;
  String? _errorMessage;

  String _selectedType = 'PERCENTAGE';

  @override
  void initState() {
    super.initState();
    _fetchOffers();
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    _valueCtrl.dispose();
    _minPurchaseCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchOffers() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _apiClient.get('/offers');
      if (res.statusCode == 200 && res.data != null) {
        setState(() {
          _offers = res.data['data'] as List<dynamic>? ?? res.data as List<dynamic>;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load offers: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showCreateDialog() {
    _codeCtrl.clear();
    _valueCtrl.clear();
    _minPurchaseCtrl.clear();

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text(
                'CREATE NEW OFFER',
                style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontWeight: FontWeight.bold, fontSize: 16),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: _codeCtrl,
                      decoration: const InputDecoration(labelText: 'Promo Coupon Code (e.g. DIWALI50)'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedType,
                      decoration: const InputDecoration(labelText: 'Discount Type'),
                      items: const [
                        DropdownMenuItem(value: 'PERCENTAGE', child: Text('PERCENTAGE (%)')),
                        DropdownMenuItem(value: 'FIXED', child: Text('FIXED AMOUNT (₹)')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            _selectedType = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _valueCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Discount Value'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _minPurchaseCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Minimum Purchase Limit'),
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
                  child: const Text('ACTIVATE', style: TextStyle(color: Colors.white)),
                  onPressed: () async {
                    if (_codeCtrl.text.trim().isEmpty) return;
                    final val = double.tryParse(_valueCtrl.text) ?? 0.0;
                    final minLimit = double.tryParse(_minPurchaseCtrl.text) ?? 0.0;

                    final res = await _apiClient.post(
                      '/offers',
                      data: {
                        'code': _codeCtrl.text.trim().toUpperCase(),
                        'discountType': _selectedType,
                        'value': val,
                        'minPurchase': minLimit,
                        'isActive': true,
                      },
                    );

                    if (res.statusCode == 201 || res.statusCode == 200) {
                      Navigator.pop(context);
                      _fetchOffers();
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
          'OFFERS MANAGER',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline_rounded, color: AppTheme.goldDark),
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
            else if (_offers.isEmpty)
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.local_offer_outlined, size: 64, color: AppTheme.goldMetallic.withOpacity(0.3)),
                      const SizedBox(height: 16),
                      const Text('No promotional coupons registered.', style: TextStyle(color: Colors.black38)),
                    ],
                  ),
                ),
              )
            else
              Expanded(
                child: ListView.builder(
                  itemCount: _offers.length,
                  itemBuilder: (context, index) {
                    final promo = _offers[index];
                    final code = promo['code'] ?? 'OFFER';
                    final type = promo['discountType'] ?? 'PERCENTAGE';
                    final discountVal = promo['value'] ?? 0;
                    final isActive = promo['isActive'] ?? true;

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
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  code,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF2E2A25)),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  type == 'PERCENTAGE' ? 'Discount: $discountVal%' : 'Discount: ₹$discountVal Off',
                                  style: const TextStyle(color: Colors.black54, fontSize: 12),
                                ),
                                Text(
                                  'Min purchase requirement: ₹${promo['minPurchase'] ?? 0}',
                                  style: const TextStyle(color: Colors.black38, fontSize: 10),
                                ),
                              ],
                            ),
                            Switch(
                              activeColor: AppTheme.goldDark,
                              value: isActive,
                              onChanged: (val) async {
                                final id = promo['id'] ?? promo['_id'];
                                final res = await _apiClient.put(
                                  '/offers/$id',
                                  data: {'isActive': val},
                                );
                                if (res.statusCode == 200) {
                                  _fetchOffers();
                                }
                              },
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
