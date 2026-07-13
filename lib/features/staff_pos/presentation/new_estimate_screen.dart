import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';

class NewEstimateScreen extends ConsumerStatefulWidget {
  const NewEstimateScreen({super.key});

  @override
  ConsumerState<NewEstimateScreen> createState() => _NewEstimateScreenState();
}

class _NewEstimateScreenState extends ConsumerState<NewEstimateScreen> {
  final _apiClient = ApiClient();
  final _customerIdController = TextEditingController(text: 'walk-in');
  final _barcodeController = TextEditingController();
  
  // Old Gold inputs
  bool _hasExchange = false;
  final _goldWeightController = TextEditingController();
  final _goldPurityController = TextEditingController(text: '22K');
  final _goldRateController = TextEditingController();

  List<String> _barcodes = [];
  bool _isLoading = false;
  String? _errorMessage;
  Map<String, dynamic>? _estimateResult;

  // Invoice / Payment info
  String _paymentMethod = 'CASH';
  bool _isInvoiceCreating = false;

  @override
  void dispose() {
    _customerIdController.dispose();
    _barcodeController.dispose();
    _goldWeightController.dispose();
    _goldPurityController.dispose();
    _goldRateController.dispose();
    super.dispose();
  }

  void _addBarcode() {
    final code = _barcodeController.text.trim();
    if (code.isNotEmpty && !_barcodes.contains(code)) {
      setState(() {
        _barcodes.add(code);
        _barcodeController.clear();
        _estimateResult = null; // Reset previous estimation
      });
    }
  }

  void _removeBarcode(int index) {
    setState(() {
      _barcodes.removeAt(index);
      _estimateResult = null;
    });
  }

  Future<void> _calculateEstimate() async {
    if (_customerIdController.text.trim().isEmpty) {
      setState(() {
        _errorMessage = 'Customer ID is required';
      });
      return;
    }
    if (_barcodes.isEmpty) {
      setState(() {
        _errorMessage = 'Please add at least one item barcode';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _estimateResult = null;
    });

    try {
      final itemsPayload = _barcodes.map((b) => {'barcode': b}).toList();
      
      Map<String, dynamic>? exchangePayload;
      if (_hasExchange) {
        exchangePayload = {
          'weight': double.tryParse(_goldWeightController.text) ?? 0.0,
          'purity': _goldPurityController.text,
          'rate': double.tryParse(_goldRateController.text) ?? 0.0,
        };
      }

      final res = await _apiClient.post(
        '/pos/estimate',
        data: {
          'customerId': _customerIdController.text.trim(),
          'items': itemsPayload,
          'oldGoldExchange': exchangePayload,
          'state': 'MH', // Default state for tax calculation
        },
      );

      if (res.statusCode == 200 && res.data != null) {
        setState(() {
          _estimateResult = res.data['data'] as Map<String, dynamic>;
        });
      } else {
        setState(() {
          _errorMessage = res.data?['error'] ?? 'Failed to estimate billing';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _createInvoice() async {
    if (_estimateResult == null) return;

    setState(() {
      _isInvoiceCreating = true;
      _errorMessage = null;
    });

    try {
      final res = await _apiClient.post(
        '/pos/invoices',
        data: {
          'estimateId': _estimateResult!['estimateId'],
          'payments': [
            {
              'method': _paymentMethod,
              'amount': _estimateResult!['payable'],
            }
          ],
          'customerName': _customerIdController.text.trim(),
          'total': _estimateResult!['payable'],
          'paymentMethod': _paymentMethod,
        },
      );

      if (res.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Invoice created and stock updated successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      } else {
        setState(() {
          _errorMessage = res.data?['error'] ?? 'Failed to create invoice';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      setState(() {
        _isInvoiceCreating = false;
      });
    }
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
          'NEW POS ESTIMATE',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Customer Setup
              _buildSectionTitle('1. Customer Information'),
              const SizedBox(height: 12),
              _buildCard(
                child: TextField(
                  controller: _customerIdController,
                  decoration: const InputDecoration(
                    labelText: 'Customer ID / Phone / Name',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.person_outline_rounded, color: AppTheme.goldDark),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Barcode Inputs
              _buildSectionTitle('2. Jewelry Items (Barcodes)'),
              const SizedBox(height: 12),
              _buildCard(
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _barcodeController,
                            decoration: const InputDecoration(
                              labelText: 'Enter Barcode ID',
                              border: OutlineInputBorder(),
                              prefixIcon: Icon(Icons.qr_code_rounded, color: AppTheme.goldDark),
                            ),
                            onSubmitted: (_) => _addBarcode(),
                          ),
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.goldDark,
                            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: _addBarcode,
                          child: const Icon(Icons.add, color: Colors.white),
                        ),
                      ],
                    ),
                    if (_barcodes.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      const Divider(),
                      const SizedBox(height: 8),
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _barcodes.length,
                        itemBuilder: (context, index) {
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppTheme.goldMetallic.withOpacity(0.08),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.diamond_outlined, color: AppTheme.goldDark, size: 18),
                            ),
                            title: Text(
                              _barcodes[index],
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25)),
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                              onPressed: () => _removeBarcode(index),
                            ),
                          );
                        },
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Old Gold Exchange Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildSectionTitle('3. Old Gold Buyback (Optional)'),
                  Switch(
                    activeColor: AppTheme.goldDark,
                    value: _hasExchange,
                    onChanged: (val) {
                      setState(() {
                        _hasExchange = val;
                        _estimateResult = null;
                      });
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_hasExchange)
                _buildCard(
                  child: Column(
                    children: [
                      TextField(
                        controller: _goldWeightController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Gold Weight (Grams)',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.scale_outlined, color: AppTheme.goldDark),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _goldPurityController,
                        decoration: const InputDecoration(
                          labelText: 'Purity (Karat, e.g. 22K)',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.grade_outlined, color: AppTheme.goldDark),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _goldRateController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Exchange Gold Rate (Per Gram)',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.currency_rupee_rounded, color: AppTheme.goldDark),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 32),

              // Calculate Button
              if (_errorMessage != null) ...[
                Text(
                  _errorMessage!,
                  style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
              ],

              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.goldDark,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: _isLoading ? null : _calculateEstimate,
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'CALCULATE ESTIMATE',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white, letterSpacing: 1.0),
                        ),
                ),
              ),

              // Estimate Result and Checkout Area
              if (_estimateResult != null) ...[
                const SizedBox(height: 32),
                _buildSectionTitle('4. Summary & Payment'),
                const SizedBox(height: 12),
                _buildCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildSummaryRow('Subtotal Value', '₹${_estimateResult!['subtotal']}'),
                      const SizedBox(height: 8),
                      _buildSummaryRow('Exchange Discount', '₹${_estimateResult!['exchangeDiscount']}'),
                      const SizedBox(height: 8),
                      _buildSummaryRow('Computed Tax (GST 3%)', '₹${_estimateResult!['tax']}'),
                      const SizedBox(height: 8),
                      const Divider(),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'NET PAYABLE AMOUNT',
                            style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.goldDark),
                          ),
                          Text(
                            '₹${_estimateResult!['payable']}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF2E2A25)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Select Payment Method',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B)),
                      ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: _paymentMethod,
                        decoration: const InputDecoration(border: OutlineInputBorder()),
                        items: const [
                          DropdownMenuItem(value: 'CASH', child: Text('CASH')),
                          DropdownMenuItem(value: 'CARD', child: Text('DEBIT / CREDIT CARD')),
                          DropdownMenuItem(value: 'UPI', child: Text('UPI / DIGITAL WALLET')),
                          DropdownMenuItem(value: 'NET_BANKING', child: Text('NET BANKING')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _paymentMethod = val;
                            });
                          }
                        },
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green.shade700,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: _isInvoiceCreating ? null : _createInvoice,
                          child: _isInvoiceCreating
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text(
                                  'CREATE POS INVOICE & COMPLETE',
                                  style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                        ),
                      )
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 48),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.bold,
        color: Color(0xFF4A3E1B),
        fontFamily: 'serif',
      ),
    );
  }

  Widget _buildCard({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFECE6DF), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.01),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _buildSummaryRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.black45)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25))),
      ],
    );
  }
}
