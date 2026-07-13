import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';

class KycScannerScreen extends StatefulWidget {
  const KycScannerScreen({super.key});

  @override
  State<KycScannerScreen> createState() => _KycScannerScreenState();
}

class _KycScannerScreenState extends State<KycScannerScreen> {
  final _apiClient = ApiClient();
  final _searchController = TextEditingController();
  final _picker = ImagePicker();

  bool _isLoadingSearch = false;
  List<dynamic> _searchResults = [];
  Map<String, dynamic>? _selectedCustomer;

  File? _aadharFile;
  File? _panFile;
  bool _isUploading = false;
  String? _errorMessage;

  Future<void> _searchCustomer() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;

    setState(() {
      _isLoadingSearch = true;
      _errorMessage = null;
      _searchResults = [];
      _selectedCustomer = null;
    });

    try {
      final res = await _apiClient.get('/customers/search?q=$query');
      if (res.statusCode == 200 && res.data != null) {
        setState(() {
          _searchResults = res.data['data'] as List<dynamic>;
          if (_searchResults.isEmpty) {
            _errorMessage = 'No customer found matching: $query';
          }
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Search failed: $e';
      });
    } finally {
      setState(() {
        _isLoadingSearch = false;
      });
    }
  }

  Future<void> _captureDocument(String type) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
      );

      if (image != null) {
        setState(() {
          if (type == 'aadhar') {
            _aadharFile = File(image.path);
          } else {
            _panFile = File(image.path);
          }
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Camera access failed: $e';
      });
    }
  }

  Future<void> _uploadKyc() async {
    if (_selectedCustomer == null) return;
    if (_aadharFile == null && _panFile == null) {
      setState(() {
        _errorMessage = 'Please capture at least Aadhar or PAN Card';
      });
      return;
    }

    setState(() {
      _isUploading = true;
      _errorMessage = null;
    });

    try {
      final id = _selectedCustomer!['id'] ?? _selectedCustomer!['_id'];
      
      final formDataMap = <String, dynamic>{};
      if (_aadharFile != null) {
        formDataMap['aadhar'] = await MultipartFile.fromFile(
          _aadharFile!.path,
          filename: 'aadhar_${DateTime.now().millisecondsSinceEpoch}.jpg',
        );
      }
      if (_panFile != null) {
        formDataMap['pan'] = await MultipartFile.fromFile(
          _panFile!.path,
          filename: 'pan_${DateTime.now().millisecondsSinceEpoch}.jpg',
        );
      }

      final formData = FormData.fromMap(formDataMap);

      // Perform upload
      final res = await _apiClient.post(
        '/customers/$id/kyc',
        data: formData,
      );

      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ KYC documents uploaded successfully! Status: PENDING'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      } else {
        setState(() {
          _errorMessage = res.data?['error'] ?? 'KYC upload failed';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      setState(() {
        _isUploading = false;
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
          'KYC DOCUMENT UPLOADER',
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
              // Search customer
              _buildSectionTitle('1. Search Customer Account'),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFECE6DF)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        decoration: const InputDecoration(
                          hintText: 'Customer name or phone number',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.search, color: AppTheme.goldDark),
                        ),
                        onSubmitted: (_) => _searchCustomer(),
                      ),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, padding: const EdgeInsets.symmetric(vertical: 16)),
                      onPressed: _searchCustomer,
                      child: const Icon(Icons.search, color: Colors.white),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              if (_isLoadingSearch)
                const Center(child: CircularProgressIndicator(color: AppTheme.goldDark))
              else if (_searchResults.isNotEmpty && _selectedCustomer == null)
                Container(
                  height: 150,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFECE6DF))),
                  child: ListView.builder(
                    itemCount: _searchResults.length,
                    itemBuilder: (context, index) {
                      final item = _searchResults[index];
                      return ListTile(
                        title: Text(item['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(item['phone'] ?? ''),
                        onTap: () {
                          setState(() {
                            _selectedCustomer = item;
                          });
                        },
                      );
                    },
                  ),
                ),

              if (_selectedCustomer != null) ...[
                // Selected Customer Info
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.goldMetallic.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.goldDark.withOpacity(0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: Colors.green, size: 24),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_selectedCustomer!['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          Text('Phone: ${_selectedCustomer!['phone'] ?? ''}', style: const TextStyle(color: Colors.black45)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Document capture controls
                _buildSectionTitle('2. Capture ID Verification Files'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _buildDocCard('AADHAR CARD', 'aadhar', _aadharFile)),
                    const SizedBox(width: 16),
                    Expanded(child: _buildDocCard('PAN CARD', 'pan', _panFile)),
                  ],
                ),
                const SizedBox(height: 32),

                if (_errorMessage != null) ...[
                  Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                ],

                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    onPressed: _isUploading ? null : _uploadKyc,
                    child: _isUploading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('UPLOAD KYC DOCUMENTS', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
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

  Widget _buildDocCard(String title, String type, File? file) {
    return Container(
      height: 180,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFECE6DF)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => _captureDocument(type),
        child: file != null
              ? ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.file(file, fit: BoxFit.cover),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppTheme.goldMetallic.withOpacity(0.08), shape: BoxShape.circle),
                    child: const Icon(Icons.camera_alt_rounded, color: AppTheme.goldDark),
                  ),
                  const SizedBox(height: 12),
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF2E2A25))),
                  const SizedBox(height: 4),
                  const Text('Tap to capture', style: TextStyle(color: Colors.black26, fontSize: 10)),
                ],
              ),
      ),
    );
  }
}

class CoverAnchor {
  static BoxFit get coverFit => BoxFit.cover;
}
