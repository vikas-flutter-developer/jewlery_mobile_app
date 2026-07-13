import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';

class ScanBarcodeScreen extends StatefulWidget {
  const ScanBarcodeScreen({super.key});

  @override
  State<ScanBarcodeScreen> createState() => _ScanBarcodeScreenState();
}

class _ScanBarcodeScreenState extends State<ScanBarcodeScreen> {
  final _apiClient = ApiClient();
  final MobileScannerController _controller = MobileScannerController();
  bool _isProcessing = false;

  bool _isTorchOn = false;

  void _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;

    final Barcode? barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;

    setState(() {
      _isProcessing = true;
    });

    final String code = barcode.rawValue!;
    _controller.stop(); // Temporarily stop scanner

    _showResultDialog(code);
  }

  Future<void> _showResultDialog(String barcodeValue) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return FutureBuilder(
          future: _apiClient.get('/barcodes/$barcodeValue'),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const AlertDialog(
                content: Row(
                  children: [
                    CircularProgressIndicator(color: AppTheme.goldDark),
                    SizedBox(width: 20),
                    Text('Querying database...', style: TextStyle(color: Color(0xFF2E2A25))),
                  ],
                ),
              );
            }

            if (snapshot.hasError) {
              return _buildErrorDialog('Connection error or item not found.');
            }

            final res = snapshot.data;
            if (res == null || res.statusCode != 200 || res.data == null) {
              return _buildErrorDialog('Item not found for barcode: $barcodeValue');
            }

            // Successfully fetched metadata
            final rawItem = res.data;
            final data = rawItem is Map && rawItem['data'] != null ? rawItem['data'] : rawItem;

            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.goldMetallic.withOpacity(0.08),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.diamond_rounded, color: AppTheme.goldDark, size: 20),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'ITEM DETECTED',
                    style: TextStyle(fontFamily: 'serif', fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.goldDark),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDetailRow('Barcode Code', barcodeValue),
                  _buildDetailRow('Item Name', data['name'] ?? data['barcode'] ?? 'N/A'),
                  _buildDetailRow('Category', data['category'] ?? 'N/A'),
                  _buildDetailRow('Metal & Karat', '${data['metal_type'] ?? data['metal'] ?? 'Gold'} ${data['karat'] ?? data['purity'] ?? '22K'}'),
                  _buildDetailRow('Weight (Grams)', '${data['weight_grams'] ?? data['weight'] ?? '0.0'} g'),
                  _buildDetailRow('Location', data['location'] ?? 'Display Case'),
                  _buildDetailRow('Cost', '₹${data['cost_per_gram'] ?? data['price'] ?? '0.0'}'),
                ],
              ),
              actions: [
                TextButton(
                  child: const Text('RESUME SCAN', style: TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold)),
                  onPressed: () {
                    Navigator.pop(context);
                    setState(() {
                      _isProcessing = false;
                    });
                    _controller.start();
                  },
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
                  child: const Text('CONFIRM & CLOSE', style: TextStyle(color: Colors.white)),
                  onPressed: () {
                    Navigator.pop(context); // Close dialog
                    Navigator.pop(context); // Exit scanner screen
                  },
                )
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildErrorDialog(String msg) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Text('Error', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
      content: Text(msg, style: const TextStyle(color: Color(0xFF2E2A25))),
      actions: [
        TextButton(
          child: const Text('RETRY', style: TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold)),
          onPressed: () {
            Navigator.pop(context);
            setState(() {
              _isProcessing = false;
            });
            _controller.start();
          },
        ),
      ],
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black45, fontSize: 12)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25), fontSize: 13),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'SCAN BARCODE',
          style: TextStyle(
            color: Colors.white,
            fontFamily: 'serif',
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
        actions: [
          IconButton(
            color: Colors.white,
            icon: Icon(_isTorchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded),
            onPressed: () async {
              await _controller.toggleTorch();
              setState(() {
                _isTorchOn = !_isTorchOn;
              });
            },
          ),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        alignment: Alignment.center,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          // HUD Scanner frame
          Container(
            width: 250,
            height: 250,
            decoration: BoxDecoration(
              border: Border.all(color: AppTheme.goldDark, width: 3),
              borderRadius: BorderRadius.circular(24),
            ),
          ),
          const Positioned(
            bottom: 80,
            child: Text(
              'Align barcode within the gold frame to scan',
              style: TextStyle(color: Colors.white70, fontSize: 12, letterSpacing: 0.5),
            ),
          ),
        ],
      ),
    );
  }
}
