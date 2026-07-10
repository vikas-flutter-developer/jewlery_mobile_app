import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../providers/address_provider.dart';
import '../../../core/models/address_model.dart';

class SavedAddressesPage extends ConsumerWidget {
  const SavedAddressesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addresses = ref.watch(addressProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9F9F9),
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.primaryNavy),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/customer/dashboard');
            }
          },
        ),
        title: Text('Saved Addresses', style: GoogleFonts.playfairDisplay(fontWeight: FontWeight.bold, color: AppColors.primaryNavy)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.primaryNavy),
      ),
      body: addresses.isEmpty
          ? _buildEmptyState()
          : ListView.builder(
              padding: const EdgeInsets.all(24),
              itemCount: addresses.length,
              itemBuilder: (context, index) {
                final AddressModel address = addresses[index];
                return _buildAddressCard(context, ref, address);
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddAddressDialog(context, ref),
        backgroundColor: AppColors.primaryNavy,
        icon: const Icon(Icons.add_location_alt_rounded, color: AppColors.accentGold),
        label: Text('ADD NEW', style: GoogleFonts.montserrat(fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 1)),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.location_off_outlined, size: 80, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text('No addresses saved yet', style: GoogleFonts.montserrat(color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _buildAddressCard(BuildContext context, WidgetRef ref, AddressModel address) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
        ],
        border: address.isDefault ? Border.all(color: AppColors.accentGold.withOpacity(0.5), width: 1) : null,
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text(address.name, style: GoogleFonts.montserrat(fontWeight: FontWeight.bold, color: AppColors.primaryNavy, fontSize: 16)),
                    if (address.isDefault)
                      Container(
                        margin: const EdgeInsets.only(left: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.accentGold.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                        child: Text('DEFAULT', style: GoogleFonts.montserrat(fontSize: 8, fontWeight: FontWeight.bold, color: AppColors.accentGold)),
                      ),
                  ],
                ),
                PopupMenuButton(
                  icon: const Icon(Icons.more_vert, color: Colors.grey, size: 20),
                  itemBuilder: (context) => [
                    if (!address.isDefault)
                      const PopupMenuItem(value: 'default', child: Text('Set as Default')),
                    const PopupMenuItem(value: 'remove', child: Text('Remove')),
                  ],
                  onSelected: (value) {
                    if (value == 'default') ref.read(addressProvider.notifier).setDefault(address.id);
                    if (value == 'remove') ref.read(addressProvider.notifier).removeAddress(address.id);
                  },
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${address.street}, ${address.city}\n${address.state} - ${address.pincode}',
              style: GoogleFonts.montserrat(fontSize: 14, color: Colors.grey[600], height: 1.5),
            ),
            const SizedBox(height: 12),
            Text('+91 ${address.phone}', style: GoogleFonts.montserrat(fontSize: 13, color: AppColors.primaryNavy, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  void _showAddAddressDialog(BuildContext context, WidgetRef ref) {
    // Simple mock dialog for add address
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Address verification in progress...', style: GoogleFonts.montserrat()),
        backgroundColor: AppColors.primaryNavy,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
