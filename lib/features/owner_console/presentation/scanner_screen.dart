import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/database/database_service.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final MobileScannerController controller = MobileScannerController();
  bool _isProcessing = false;

  void _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
      final code = barcodes.first.rawValue!;
      setState(() => _isProcessing = true);
      
      // Look up Stock Item by Barcode ID
      final stockItems = await DatabaseService.instance.getAllStock();
      final item = stockItems.where((i) {
        final implicitId = 'STK-${i.id?.toString().padLeft(4, '0')}';
        return i.barcodeId == code || implicitId == code;
      }).firstOrNull;

      if (!mounted) return;

      if (item != null) {
        // Success
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Found ${item.name}!'), backgroundColor: AppColors.success));
        Navigator.pop(context, item);
      } else {
        // Not Found
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Item $code not found in inventory.'), backgroundColor: AppColors.error));
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) setState(() => _isProcessing = false);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text('Scan Stock Tag', style: GoogleFonts.outfit(color: Colors.white)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(icon: const Icon(Icons.flash_on_rounded), onPressed: () => controller.toggleTorch()),
          IconButton(icon: const Icon(Icons.cameraswitch_rounded), onPressed: () => controller.switchCamera()),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: controller,
            onDetect: _onDetect,
          ),
          Center(
            child: Container(
              width: 250,
              height: 100,
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.gold, width: 3),
                borderRadius: BorderRadius.circular(12),
              ),
              child: _isProcessing 
                  ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
                  : null,
            ),
          ),
          Positioned(
            bottom: 60, left: 0, right: 0,
            child: Text(
              'Align barcode within the frame',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }
}
