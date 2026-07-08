import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/customer_provider.dart';

class CustomOrderFormScreen extends ConsumerStatefulWidget {
  const CustomOrderFormScreen({super.key});

  @override
  ConsumerState<CustomOrderFormScreen> createState() => _CustomOrderFormScreenState();
}

class _CustomOrderFormScreenState extends ConsumerState<CustomOrderFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  
  String _selectedMetal = 'GOLD';
  String _selectedCarat = '22K';

  final List<String> _metals = ['GOLD', 'SILVER', 'PLATINUM'];
  final List<String> _carats = ['18K', '22K', '24K'];

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final authState = ref.read(authProvider);
    final user = authState.user;
    final name = user?['name'] ?? 'Bespoke Customer';
    final phone = user?['phone'] ?? '';

    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User profile missing phone information.'), backgroundColor: Colors.redAccent),
      );
      return;
    }

    final success = await ref.read(customerProvider.notifier).submitBespokeOrder(
      name: name,
      phone: phone,
      metalType: _selectedMetal,
      carat: _selectedCarat,
      customDescription: _descriptionController.text.trim(),
    );

    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Custom design submitted! AuraJewel design desk will review soon.'),
            backgroundColor: Colors.green,
          ),
        );
        _descriptionController.clear();
        setState(() {
          _selectedMetal = 'GOLD';
          _selectedCarat = '22K';
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to submit request. Please try again.'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final customerState = ref.watch(customerProvider);
    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppTheme.goldDark),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'BESPOKE DESIGNS',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontSize: 18,
            fontWeight: FontWeight.bold,
            letterSpacing: 2.0,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Description card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFECE6DF)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.brush_outlined, color: AppTheme.goldDark, size: 28),
                  SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      'Describe your dream jewelry design. Our master artisans and CAD designers will build a custom layout and upload it for your approval.',
                      style: TextStyle(color: Colors.black54, fontSize: 12, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Form
            Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Metal type selection dropdown
                  DropdownButtonFormField<String>(
                    value: _selectedMetal,
                    decoration: const InputDecoration(
                      labelText: 'Precious Metal Type',
                      prefixIcon: Icon(Icons.category_outlined, size: 20),
                    ),
                    items: _metals.map((metal) {
                      return DropdownMenuItem(
                        value: metal,
                        child: Text(metal),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() {
                          _selectedMetal = val;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 18),

                  // Carat selection dropdown
                  DropdownButtonFormField<String>(
                    value: _selectedCarat,
                    decoration: const InputDecoration(
                      labelText: 'Metal Purity Purity',
                      prefixIcon: Icon(Icons.star_outline_rounded, size: 20),
                    ),
                    items: _carats.map((carat) {
                      return DropdownMenuItem(
                        value: carat,
                        child: Text(carat),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() {
                          _selectedCarat = val;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 18),

                  // Custom Description input
                  TextFormField(
                    controller: _descriptionController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Describe Your Custom Design Request',
                      prefixIcon: Icon(Icons.description_outlined, size: 20),
                      hintText: 'e.g., Traditional temple-style gold necklace set with embedded rubies and dangling pearls...',
                      alignLabelWithHint: true,
                    ),
                    validator: (val) {
                      if (val == null || val.isEmpty) return 'Please describe your request';
                      if (val.length < 10) return 'Please add more details (min 10 chars)';
                      return null;
                    },
                  ),
                  const SizedBox(height: 28),

                  // Submit button
                  ElevatedButton(
                    onPressed: customerState.isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.goldDark,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(52),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 1,
                      shadowColor: AppTheme.goldDark.withValues(alpha: 0.2),
                    ),
                    child: customerState.isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text('SUBMIT DESIGN REQUEST', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 36),

            // Section Header
            Row(
              children: [
                const Text(
                  'My Previous Bespoke Requests',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF4A3E1B),
                    fontFamily: 'serif',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(child: Container(height: 1, color: AppTheme.goldMetallic.withValues(alpha: 0.15))),
              ],
            ),
            const SizedBox(height: 16),

            // List of previous requests
            if (customerState.customOrders.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 24.0),
                  child: Text(
                    'No past bespoke requests found.',
                    style: TextStyle(color: Colors.black26, fontSize: 13),
                  ),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: customerState.customOrders.length,
                itemBuilder: (context, index) {
                  final order = customerState.customOrders[index];
                  final status = order['status'] ?? 'Received';
                  final metal = order['metalType'] ?? 'GOLD';
                  final purity = order['carat'] ?? '22K';
                  final desc = order['customDescription'] ?? 'Bespoke request';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFECE6DF), width: 1),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Request Spec: $purity $metal',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.goldDark, fontSize: 14),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppTheme.goldDark.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                status.toUpperCase(),
                                style: const TextStyle(color: AppTheme.goldDark, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          desc,
                          style: const TextStyle(color: Colors.black54, fontSize: 12, height: 1.4),
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
