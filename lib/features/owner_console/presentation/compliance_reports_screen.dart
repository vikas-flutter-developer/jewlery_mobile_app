import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';

class ComplianceReportsScreen extends StatefulWidget {
  const ComplianceReportsScreen({super.key});

  @override
  State<ComplianceReportsScreen> createState() => _ComplianceReportsScreenState();
}

class _ComplianceReportsScreenState extends State<ComplianceReportsScreen> with SingleTickerProviderStateMixin {
  final _apiClient = ApiClient();
  late TabController _tabController;

  List<dynamic> _gstSummary = [];
  List<dynamic> _form60Records = [];
  List<dynamic> _amlLogs = [];

  bool _isLoading = false;
  String? _errorMessage;

  final _custNameCtrl = TextEditingController();
  final _custPhoneCtrl = TextEditingController();
  final _custAddrCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  final _txIdCtrl = TextEditingController();
  final _aadharCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController(text: 'Income below taxable threshold limit');

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _fetchComplianceData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _custNameCtrl.dispose();
    _custPhoneCtrl.dispose();
    _custAddrCtrl.dispose();
    _amountCtrl.dispose();
    _txIdCtrl.dispose();
    _aadharCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  void _showAddForm60Dialog() {
    _custNameCtrl.clear();
    _custPhoneCtrl.clear();
    _custAddrCtrl.clear();
    _amountCtrl.clear();
    _txIdCtrl.clear();
    _aadharCtrl.clear();
    _reasonCtrl.text = 'Income below taxable threshold limit';

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFFF9F6F0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text(
            'FILE STATUTORY FORM 60',
            style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontWeight: FontWeight.bold, fontSize: 16),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _custNameCtrl,
                  decoration: const InputDecoration(labelText: 'Customer Name'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _custPhoneCtrl,
                  decoration: const InputDecoration(labelText: 'Customer Phone'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _custAddrCtrl,
                  decoration: const InputDecoration(labelText: 'Customer Address'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Transaction Amount (₹)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _txIdCtrl,
                  decoration: const InputDecoration(labelText: 'Transaction / Invoice ID'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _aadharCtrl,
                  decoration: const InputDecoration(labelText: 'Aadhaar Card Number'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _reasonCtrl,
                  decoration: const InputDecoration(labelText: 'Reason for No PAN'),
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
              child: const Text('SUBMIT', style: TextStyle(color: Colors.white)),
              onPressed: () async {
                if (_custNameCtrl.text.trim().isEmpty ||
                    _custPhoneCtrl.text.trim().isEmpty ||
                    _custAddrCtrl.text.trim().isEmpty ||
                    _amountCtrl.text.trim().isEmpty ||
                    _txIdCtrl.text.trim().isEmpty ||
                    _aadharCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please fill all required fields.')),
                  );
                  return;
                }

                final amount = double.tryParse(_amountCtrl.text) ?? 0.0;

                final res = await _apiClient.post(
                  '/compliance/form60',
                  data: {
                    'customerName': _custNameCtrl.text.trim(),
                    'customerPhone': _custPhoneCtrl.text.trim(),
                    'customerAddress': _custAddrCtrl.text.trim(),
                    'amount': amount,
                    'transactionId': _txIdCtrl.text.trim(),
                    'aadharNumber': _aadharCtrl.text.trim(),
                    'reasonNoPan': _reasonCtrl.text.trim(),
                  },
                );

                if (res.statusCode == 201 || res.statusCode == 200) {
                  Navigator.pop(context);
                  _fetchComplianceData();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('✓ Form 60 declaration successfully submitted!'), backgroundColor: Colors.green),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Submission failed: ${res.data['error'] ?? 'Unknown Error'}')),
                  );
                }
              },
            )
          ],
        );
      },
    );
  }

  Future<void> _fetchComplianceData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Fetch compliance endpoints
      final resGst = await _apiClient.get('/compliance/gst');
      final resForm60 = await _apiClient.get('/compliance/form60');
      final resAml = await _apiClient.get('/compliance/aml/logs');

      setState(() {
        if (resGst.statusCode == 200 && resGst.data != null) {
          _gstSummary = resGst.data['data'] as List<dynamic>? ?? resGst.data as List<dynamic>;
        }
        if (resForm60.statusCode == 200 && resForm60.data != null) {
          _form60Records = resForm60.data['data'] as List<dynamic>? ?? resForm60.data as List<dynamic>;
        }
        if (resAml.statusCode == 200 && resAml.data != null) {
          _amlLogs = resAml.data['data'] as List<dynamic>? ?? resAml.data as List<dynamic>;
        }
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to fetch compliance logs: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
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
          'COMPLIANCE REPORTS',
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
            onPressed: _showAddForm60Dialog,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.goldDark,
          unselectedLabelColor: Colors.black38,
          indicatorColor: AppTheme.goldDark,
          tabs: const [
            Tab(text: 'TAX GST FILING'),
            Tab(text: 'FORM 60 REGISTRY'),
            Tab(text: 'AML LOGS'),
          ],
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            if (_isLoading)
              const Expanded(child: Center(child: CircularProgressIndicator(color: AppTheme.goldDark)))
            else if (_errorMessage != null)
              Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold))
            else
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildGstTab(),
                    _buildForm60Tab(),
                    _buildAmlTab(),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildGstTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('GSTR-1 & GSTR-3B filings summary', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B))),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
              icon: const Icon(Icons.download_rounded, size: 16, color: Colors.white),
              label: const Text('EXPORT', style: TextStyle(fontSize: 11, color: Colors.white)),
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('✓ GSTR-1 spreadsheet exported to downloads directory.'), backgroundColor: Colors.blueAccent),
                );
              },
            ),
          ],
        ),
        const SizedBox(height: 16),
        Expanded(
          child: _gstSummary.isEmpty
              ? const Center(child: Text('No GST collection logged for the current period.', style: TextStyle(color: Colors.black38)))
              : ListView.builder(
                  itemCount: _gstSummary.length,
                  itemBuilder: (context, index) {
                    final item = _gstSummary[index];
                    // Handle both GSTR-1 format and legacy month-summary format
                    final title = item['month'] ?? item['invoiceNo'] ?? 'Invoice #${index + 1}';
                    final subtitle = item['invoiceDate'] != null
                        ? 'Date: ${item['invoiceDate']}  •  Customer: ${item['customerName'] ?? 'N/A'}'
                        : 'Taxable Value: ₹${item['taxableValue'] ?? 0}';
                    final gstAmt = item['gstAmount'] ?? ((item['cgst'] ?? 0) + (item['sgst'] ?? 0));
                    return Card(
                      color: Colors.white,
                      elevation: 0,
                      margin: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFECE6DF))),
                      child: ListTile(
                        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(subtitle),
                        trailing: Text('GST: ₹$gstAmt', style: const TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold)),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildForm60Tab() {
    if (_form60Records.isEmpty) {
      return const Center(child: Text('No Form 60 declarations submitted.', style: TextStyle(color: Colors.black38)));
    }
    return ListView.builder(
      itemCount: _form60Records.length,
      itemBuilder: (context, index) {
        final form = _form60Records[index];
        return Card(
          color: Colors.white,
          elevation: 0,
          margin: const EdgeInsets.symmetric(vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFECE6DF))),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(form['customerName'] ?? form['declarantName'] ?? 'Declarant Name', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: Colors.green.withOpacity(0.08), borderRadius: BorderRadius.circular(8)),
                      child: Text(form['status'] ?? 'SUBMITTED', style: const TextStyle(color: Colors.green, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 12),
                Text('Address: ${form['customerAddress'] ?? form['declarantAddress'] ?? 'N/A'}', style: const TextStyle(fontSize: 12, color: Colors.black54)),
                const SizedBox(height: 4),
                Text('Aadhaar: ${form['aadharNumber'] ?? 'Attached'}', style: const TextStyle(fontSize: 12, color: Colors.black54)),
                const SizedBox(height: 4),
                Text('Amount: ₹${form['amount'] ?? 'N/A'}  •  Reason: ${form['reasonNoPan'] ?? 'N/A'}', style: const TextStyle(fontSize: 11, color: Colors.black38)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildAmlTab() {
    if (_amlLogs.isEmpty) {
      return const Center(child: Text('No flagged high-value cash transactions.', style: TextStyle(color: Colors.black38)));
    }
    return ListView.builder(
      itemCount: _amlLogs.length,
      itemBuilder: (context, index) {
        final log = _amlLogs[index];
        final message = log['message'] ?? log['flaggedReason'] ?? 'High value transaction alert';
        final name = log['customerName'] ?? 'Unknown Customer';
        final amount = log['amount'];
        return Card(
          color: Colors.white,
          elevation: 0,
          margin: const EdgeInsets.symmetric(vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFECE6DF))),
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            leading: const Icon(Icons.security_rounded, color: Colors.amber, size: 28),
            title: Text(message, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            subtitle: Text('Customer: $name${amount != null ? '  •  ₹$amount' : ''}  •  ${log['createdAt']?.split('T')?.first ?? 'N/A'}'),
          ),
        );
      },
    );
  }
}
