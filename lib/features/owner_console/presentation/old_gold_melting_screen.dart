import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';

class OldGoldMeltingScreen extends StatefulWidget {
  const OldGoldMeltingScreen({super.key});

  @override
  State<OldGoldMeltingScreen> createState() => _OldGoldMeltingScreenState();
}

class _OldGoldMeltingScreenState extends State<OldGoldMeltingScreen> with SingleTickerProviderStateMixin {
  final _apiClient = ApiClient();
  late TabController _tabController;

  List<dynamic> _purchases = [];
  List<dynamic> _meltingLogs = [];

  bool _isLoading = false;
  String? _errorMessage;

  // New purchase fields
  final _custNameCtrl = TextEditingController();
  final _purchaseWeightCtrl = TextEditingController();
  final _purchasePurityCtrl = TextEditingController(text: '22K');
  final _purchaseRateCtrl = TextEditingController();

  // New melt fields
  final _meltLotCtrl = TextEditingController();
  final _meltRawCtrl = TextEditingController();
  final _meltFineCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchOldGoldData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _custNameCtrl.dispose();
    _purchaseWeightCtrl.dispose();
    _purchasePurityCtrl.dispose();
    _purchaseRateCtrl.dispose();
    _meltLotCtrl.dispose();
    _meltRawCtrl.dispose();
    _meltFineCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchOldGoldData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final resPurchases = await _apiClient.get('/oldgold/purchases');
      final resMelting = await _apiClient.get('/oldgold/melting');

      setState(() {
        if (resPurchases.statusCode == 200 && resPurchases.data != null) {
          _purchases = resPurchases.data['data'] as List<dynamic>? ?? resPurchases.data as List<dynamic>;
        }
        if (resMelting.statusCode == 200 && resMelting.data != null) {
          _meltingLogs = resMelting.data['data'] as List<dynamic>? ?? resMelting.data as List<dynamic>;
        }
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to fetch Old Gold logs: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showPurchaseDialog() {
    _custNameCtrl.clear();
    _purchaseWeightCtrl.clear();
    _purchaseRateCtrl.clear();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFFF9F6F0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text(
            'NEW OLD GOLD BUYBACK',
            style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontWeight: FontWeight.bold, fontSize: 16),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _custNameCtrl,
                  decoration: const InputDecoration(labelText: 'Customer Name / Phone'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _purchaseWeightCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Raw Gold Weight (g)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _purchasePurityCtrl,
                  decoration: const InputDecoration(labelText: 'Purity (e.g. 22K or 92.5%)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _purchaseRateCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Exchange Buy Rate (₹/g)'),
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
              child: const Text('LOG PURCHASE', style: TextStyle(color: Colors.white)),
              onPressed: () async {
                if (_custNameCtrl.text.trim().isEmpty) return;
                final weight = double.tryParse(_purchaseWeightCtrl.text) ?? 0.0;
                final rate = double.tryParse(_purchaseRateCtrl.text) ?? 0.0;

                final res = await _apiClient.post(
                  '/oldgold/purchases',
                  data: {
                    'customerName': _custNameCtrl.text.trim(),
                    'weight': weight,
                    'purity': _purchasePurityCtrl.text,
                    'ratePerGram': rate,
                    'totalPaid': weight * rate,
                  },
                );

                if (res.statusCode == 201 || res.statusCode == 200) {
                  Navigator.pop(context);
                  _fetchOldGoldData();
                }
              },
            )
          ],
        );
      },
    );
  }

  void _showMeltDialog() {
    _meltLotCtrl.clear();
    _meltRawCtrl.clear();
    _meltFineCtrl.clear();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFFF9F6F0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text(
            'NEW REFINE & MELT LOG',
            style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontWeight: FontWeight.bold, fontSize: 16),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _meltLotCtrl,
                  decoration: const InputDecoration(labelText: 'Lot / Ref Number'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _meltRawCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Raw Melt Weight (g)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _meltFineCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Net Fine Gold Yield (g)'),
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
              child: const Text('LOG MELT', style: TextStyle(color: Colors.white)),
              onPressed: () async {
                if (_meltLotCtrl.text.trim().isEmpty) return;
                final raw = double.tryParse(_meltRawCtrl.text) ?? 0.0;
                final fine = double.tryParse(_meltFineCtrl.text) ?? 0.0;

                final res = await _apiClient.post(
                  '/oldgold/melting',
                  data: {
                    'lotNumber': _meltLotCtrl.text.trim(),
                    'rawWeight': raw,
                    'fineWeight': fine,
                    'lossWeight': raw - fine,
                  },
                );

                if (res.statusCode == 201 || res.statusCode == 200) {
                  Navigator.pop(context);
                  _fetchOldGoldData();
                }
              },
            )
          ],
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
          'OLD GOLD REFINING',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.goldDark,
          unselectedLabelColor: Colors.black38,
          indicatorColor: AppTheme.goldDark,
          tabs: const [
            Tab(text: 'CUSTOMER BUYBACKS'),
            Tab(text: 'MELTING & REFINING'),
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
                    _buildPurchasesTab(),
                    _buildMeltingTab(),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPurchasesTab() {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppTheme.goldDark,
        child: const Icon(Icons.add, color: Colors.white),
        onPressed: _showPurchaseDialog,
      ),
      body: _purchases.isEmpty
          ? const Center(child: Text('No buyback records logged.', style: TextStyle(color: Colors.black38)))
          : ListView.builder(
              itemCount: _purchases.length,
              itemBuilder: (context, index) {
                final item = _purchases[index];
                return Card(
                  color: Colors.white,
                  elevation: 0,
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFECE6DF))),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(16),
                    title: Text(item['customerName'] ?? 'Walk-in Client', style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('Weight: ${item['weight'] ?? 0}g • Purity: ${item['purity'] ?? 'N/A'}'),
                    trailing: Text('₹${item['totalPaid'] ?? 0}', style: const TextStyle(color: AppTheme.goldDark, fontWeight: FontWeight.bold)),
                  ),
                );
              },
            ),
    );
  }

  Widget _buildMeltingTab() {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppTheme.goldDark,
        child: const Icon(Icons.local_fire_department, color: Colors.white),
        onPressed: _showMeltDialog,
      ),
      body: _meltingLogs.isEmpty
          ? const Center(child: Text('No refinery melting logs.', style: TextStyle(color: Colors.black38)))
          : ListView.builder(
              itemCount: _meltingLogs.length,
              itemBuilder: (context, index) {
                final log = _meltingLogs[index];
                final raw = log['rawWeight'] ?? 0;
                final fine = log['fineWeight'] ?? 0;
                final loss = log['lossWeight'] ?? (raw - fine);

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
                            Text(
                              'Lot Number: #${log['lotNumber'] ?? 'N/A'}',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E2A25)),
                            ),
                            Text(
                              log['createdAt']?.split('T')?.first ?? 'Melting Done',
                              style: const TextStyle(color: Colors.black38, fontSize: 11),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Divider(height: 1),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Raw weight: ${raw}g', style: const TextStyle(fontSize: 13, color: Colors.black54)),
                            Text('Yield fine: ${fine}g', style: const TextStyle(fontSize: 13, color: Colors.green, fontWeight: FontWeight.bold)),
                            Text('Loss: ${loss}g', style: const TextStyle(fontSize: 13, color: Colors.redAccent)),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
