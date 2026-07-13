import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';

class SchemesAdminScreen extends StatefulWidget {
  const SchemesAdminScreen({super.key});

  @override
  State<SchemesAdminScreen> createState() => _SchemesAdminScreenState();
}

class _SchemesAdminScreenState extends State<SchemesAdminScreen> with SingleTickerProviderStateMixin {
  final _apiClient = ApiClient();
  late TabController _tabController;

  List<dynamic> _schemes = [];
  List<dynamic> _defaulters = [];
  List<dynamic> _matured = [];

  bool _isLoading = false;
  String? _errorMessage;

  final _nameCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  final _installmentsCtrl = TextEditingController();
  final _bonusCtrl = TextEditingController();
  final _descCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _fetchAdminData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _nameCtrl.dispose();
    _amountCtrl.dispose();
    _installmentsCtrl.dispose();
    _bonusCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  void _showCreateSchemeDialog() {
    _nameCtrl.clear();
    _amountCtrl.clear();
    _installmentsCtrl.clear();
    _bonusCtrl.clear();
    _descCtrl.clear();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFFF9F6F0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text(
            'NEW SCHEME PLAN',
            style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontWeight: FontWeight.bold, fontSize: 16),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Scheme / Plan Name'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Monthly Amount (₹)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _installmentsCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Total Installments (Months)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _bonusCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Bonus Amount (₹)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _descCtrl,
                  decoration: const InputDecoration(labelText: 'Description / Benefit details'),
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
              child: const Text('CREATE PLAN', style: TextStyle(color: Colors.white)),
              onPressed: () async {
                if (_nameCtrl.text.trim().isEmpty) return;

                final amount = double.tryParse(_amountCtrl.text) ?? 0.0;
                final installments = int.tryParse(_installmentsCtrl.text) ?? 11;
                final bonus = double.tryParse(_bonusCtrl.text) ?? 0.0;

                final res = await _apiClient.post(
                  '/schemes',
                  data: {
                    'name': _nameCtrl.text.trim(),
                    'type': 'GOLD_SAVING',
                    'monthlyAmount': amount,
                    'totalInstallments': installments,
                    'bonusAmount': bonus,
                    'description': _descCtrl.text.trim(),
                    'status': 'ACTIVE',
                  },
                );

                if (res.statusCode == 201 || res.statusCode == 200) {
                  Navigator.pop(context);
                  _fetchAdminData();
                }
              },
            )
          ],
        );
      },
    );
  }

  Future<void> _fetchAdminData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final resDefinitions = await _apiClient.get('/schemes');
      final resDefaulters = await _apiClient.get('/schemes/defaulters');
      final resMaturity = await _apiClient.get('/schemes/maturity');

      setState(() {
        if (resDefinitions.statusCode == 200 && resDefinitions.data != null) {
          _schemes = resDefinitions.data['data'] as List<dynamic>? ?? resDefinitions.data as List<dynamic>;
        }
        if (resDefaulters.statusCode == 200 && resDefaulters.data != null) {
          _defaulters = resDefaulters.data['data'] as List<dynamic>? ?? resDefaulters.data as List<dynamic>;
        }
        if (resMaturity.statusCode == 200 && resMaturity.data != null) {
          _matured = resMaturity.data['data'] as List<dynamic>? ?? resMaturity.data as List<dynamic>;
        }
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to fetch schemes data: $e';
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
          'SCHEMES CONSOLE',
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
            onPressed: _showCreateSchemeDialog,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.goldDark,
          unselectedLabelColor: Colors.black38,
          indicatorColor: AppTheme.goldDark,
          tabs: const [
            Tab(text: 'DEFINITIONS'),
            Tab(text: 'DEFAULTERS'),
            Tab(text: 'MATURED PLANS'),
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
                    _buildDefinitionsTab(),
                    _buildDefaultersTab(),
                    _buildMaturedTab(),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDefinitionsTab() {
    if (_schemes.isEmpty) {
      return const Center(child: Text('No schemes defined.', style: TextStyle(color: Colors.black38)));
    }
    return ListView.builder(
      itemCount: _schemes.length,
      itemBuilder: (context, index) {
        final plan = _schemes[index];
        return Card(
          color: Colors.white,
          elevation: 0,
          margin: const EdgeInsets.symmetric(vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFECE6DF))),
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            leading: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppTheme.goldMetallic.withOpacity(0.08), shape: BoxShape.circle),
              child: const Icon(Icons.savings_outlined, color: AppTheme.goldDark),
            ),
            title: Text(plan['schemeName'] ?? plan['name'] ?? 'Gold Kitty Plan', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('Monthly: ₹${plan['monthlyAmount'] ?? '1000'} • Tenure: ${plan['tenureMonths'] ?? '11'} Mos'),
          ),
        );
      },
    );
  }

  Widget _buildDefaultersTab() {
    if (_defaulters.isEmpty) {
      return const Center(child: Text('No active defaulters.', style: TextStyle(color: Colors.black38)));
    }
    return ListView.builder(
      itemCount: _defaulters.length,
      itemBuilder: (context, index) {
        final def = _defaulters[index];
        return Card(
          color: Colors.white,
          elevation: 0,
          margin: const EdgeInsets.symmetric(vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFECE6DF))),
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            leading: const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 28),
            title: Text(def['customerName'] ?? 'Delinquent Client', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('Contact: ${def['customerPhone'] ?? 'N/A'} • Missed Payments: ${def['missedInstallments'] ?? 1}'),
          ),
        );
      },
    );
  }

  Widget _buildMaturedTab() {
    if (_matured.isEmpty) {
      return const Center(child: Text('No schemes matured yet.', style: TextStyle(color: Colors.black38)));
    }
    return ListView.builder(
      itemCount: _matured.length,
      itemBuilder: (context, index) {
        final mat = _matured[index];
        return Card(
          color: Colors.white,
          elevation: 0,
          margin: const EdgeInsets.symmetric(vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFECE6DF))),
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            leading: const Icon(Icons.check_circle_outline_rounded, color: Colors.green, size: 28),
            title: Text(mat['customerName'] ?? 'Loyal Customer', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('Scheme: ${mat['schemeName'] ?? 'Kitty'} • Maturity Amount: ₹${mat['maturityAmount'] ?? '12000'}'),
            trailing: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
              child: const Text('DISBURSE', style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold)),
              onPressed: () async {
                // Redeem Scheme trigger
                final id = mat['enrollmentId'] ?? mat['_id'];
                final res = await _apiClient.post('/schemes/enrollments/$id/redeem');
                if (res.statusCode == 200) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('✓ Scheme redeemed successfully.'), backgroundColor: Colors.green),
                  );
                  _fetchAdminData();
                }
              },
            ),
          ),
        );
      },
    );
  }
}
