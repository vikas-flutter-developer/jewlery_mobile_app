import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';

class EmiRepaymentsScreen extends StatefulWidget {
  const EmiRepaymentsScreen({super.key});

  @override
  State<EmiRepaymentsScreen> createState() => _EmiRepaymentsScreenState();
}

class _EmiRepaymentsScreenState extends State<EmiRepaymentsScreen> {
  final _apiClient = ApiClient();
  final _searchController = TextEditingController();

  bool _isLoading = false;
  String? _errorMessage;
  Map<String, dynamic>? _emiPlan;
  List<dynamic> _installments = [];

  // Pay dialog state
  bool _isPaying = false;
  String _payMethod = 'CASH';

  Future<void> _searchEmi() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _emiPlan = null;
      _installments = [];
    });

    try {
      // 1. Get EMI by Invoice Id
      final planRes = await _apiClient.get('/pos/emi/$query');
      if (planRes.statusCode == 200 && planRes.data != null && planRes.data['data'] != null) {
        final plan = planRes.data['data'] as Map<String, dynamic>;
        
        // 2. Fetch its installments list using the plan's emiPlanId
        final emiId = plan['emiPlanId'];
        final instRes = await _apiClient.get('/pos/emi/$emiId/installments');
        
        setState(() {
          _emiPlan = plan;
          if (instRes.statusCode == 200 && instRes.data != null) {
            _installments = instRes.data['data'] as List<dynamic>;
          }
        });
      } else {
        setState(() {
          _errorMessage = 'No active EMI plan found for Invoice ID: $query';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to find EMI plan: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _payInstallment(Map<String, dynamic> installment) async {
    if (_emiPlan == null) return;
    
    setState(() {
      _isPaying = true;
      _errorMessage = null;
    });

    try {
      final emiId = _emiPlan!['emiPlanId'];
      final res = await _apiClient.post(
        '/pos/emi/$emiId/pay',
        data: {
          'installmentNumber': installment['installmentNumber'],
          'payments': [
            {
              'method': _payMethod,
              'amount': installment['amount'],
            }
          ],
          'note': 'Collected at showroom POS counter',
        },
      );

      if (res.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✓ Installment #${installment['installmentNumber']} payment recorded!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context); // Close payment modal
        _searchEmi(); // Refresh installments status
      } else {
        setState(() {
          _errorMessage = res.data?['error'] ?? 'Payment failed';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      setState(() {
        _isPaying = false;
      });
    }
  }

  void _showPayModal(Map<String, dynamic> installment) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'COLLECT EMI REPAYMENT',
                    style: TextStyle(
                      fontFamily: 'serif',
                      fontWeight: FontWeight.bold,
                      color: AppTheme.goldDark,
                      fontSize: 18,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text('Installment Number: #${installment['installmentNumber']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('Amount Due: ₹${installment['amount']}', style: const TextStyle(fontSize: 16, color: Colors.black54)),
                  const SizedBox(height: 16),
                  const Text('Payment Method', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B))),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: _payMethod,
                    decoration: const InputDecoration(border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(value: 'CASH', child: Text('CASH')),
                      DropdownMenuItem(value: 'CARD', child: Text('CARD')),
                      DropdownMenuItem(value: 'UPI', child: Text('UPI / GPAY / PHONEPE')),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setModalState(() {
                          _payMethod = val;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 24),
                  if (_errorMessage != null) ...[
                    Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent)),
                    const SizedBox(height: 12),
                  ],
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
                      onPressed: _isPaying ? null : () => _payInstallment(installment),
                      child: _isPaying
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text('SUBMIT REPAYMENT', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                    ),
                  ),
                ],
              ),
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
          'EMI REPAYMENTS',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFECE6DF), width: 1),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          decoration: const InputDecoration(
                            labelText: 'Invoice ID / Bill Number',
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.receipt_long_rounded, color: AppTheme.goldDark),
                          ),
                          onSubmitted: (_) => _searchEmi(),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.goldDark,
                          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
                        ),
                        onPressed: _searchEmi,
                        child: const Icon(Icons.search, color: Colors.white),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            if (_isLoading)
              const Center(child: CircularProgressIndicator(color: AppTheme.goldDark))
            else if (_errorMessage != null)
              Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold))
            else if (_emiPlan != null) ...[
              // Plan Summary Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFECE6DF), width: 1),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'EMI PLAN SUMMARY',
                      style: TextStyle(fontFamily: 'serif', fontWeight: FontWeight.bold, color: AppTheme.goldDark, fontSize: 13),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Customer ID', style: TextStyle(color: Colors.black45)),
                        Text(_emiPlan!['customerId'] ?? 'N/A', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total Plan Value', style: TextStyle(color: Colors.black45)),
                        Text('₹${_emiPlan!['totalAmount']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Installment Table list
              const Text(
                'Installments Registry',
                style: TextStyle(fontFamily: 'serif', fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontSize: 16),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.builder(
                  itemCount: _installments.length,
                  itemBuilder: (context, index) {
                    final inst = _installments[index];
                    final isPaid = inst['status']?.toString().toUpperCase() == 'PAID';

                    return Card(
                      color: Colors.white,
                      surfaceTintColor: Colors.transparent,
                      elevation: 0,
                      margin: const EdgeInsets.symmetric(vertical: 6),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFECE6DF)),
                      ),
                      child: ListTile(
                        title: Text('Installment #${inst['installmentNumber']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('Due: ${inst['dueDate']?.split('T')?.first ?? 'N/A'} • ₹${inst['amount']}'),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: isPaid ? Colors.green.withOpacity(0.08) : Colors.redAccent.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isPaid ? Colors.green.withOpacity(0.2) : Colors.redAccent.withOpacity(0.2)),
                          ),
                          child: Text(
                            isPaid ? 'PAID' : 'PENDING',
                            style: TextStyle(color: isPaid ? Colors.green : Colors.redAccent, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                        onTap: isPaid ? null : () => _showPayModal(inst),
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
