import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/admin_provider.dart';
import 'purchase_order_screen.dart';
import 'schemes_admin_screen.dart';
import 'old_gold_melting_screen.dart';
import 'compliance_reports_screen.dart';
import 'offers_manager_screen.dart';
import 'security_logs_screen.dart';

class StoreSettingsScreen extends ConsumerStatefulWidget {
  const StoreSettingsScreen({super.key});

  @override
  ConsumerState<StoreSettingsScreen> createState() => _StoreSettingsScreenState();
}

class _StoreSettingsScreenState extends ConsumerState<StoreSettingsScreen> {
  final _addressCtrl = TextEditingController(text: '101 Gold Plaza, Zaveri Bazaar');
  final _phoneCtrl = TextEditingController(text: '9876543210');
  final _invoicePrefixCtrl = TextEditingController(text: 'INV-2026-');

  // Denominations calculator values
  final Map<String, int> _denominations = {
    '2000': 0,
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
  };

  double get _actualCashTotal {
    double sum = 0;
    _denominations.forEach((key, val) {
      sum += double.parse(key) * val;
    });
    return sum;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(adminProvider.notifier).fetchPrinters();
      ref.read(adminProvider.notifier).fetchPaymentGateways();
      ref.read(adminProvider.notifier).fetchMessagingConfigs();
      ref.read(adminProvider.notifier).fetchTaxProfiles();
      ref.read(adminProvider.notifier).fetchBranding();
    });
  }

  @override
  void dispose() {
    _addressCtrl.dispose();
    _phoneCtrl.dispose();
    _invoicePrefixCtrl.dispose();
    super.dispose();
  }

  // --- 1. Tenant Branding Settings ---
  void _showTenantBrandingSheet() {
    final branding = ref.read(adminProvider).tenantBranding ?? {};
    final bizNameCtrl = TextEditingController(text: branding['businessName'] ?? 'AuraJewel Showroom');
    final logoCtrl = TextEditingController(text: branding['logoUrl'] ?? '');
    final footerCtrl = TextEditingController(text: branding['invoiceFooter'] ?? 'Thank you for shopping with us!');
    final termsCtrl = TextEditingController(text: branding['invoiceTerms'] ?? 'No return without invoice.');
    final gstNoCtrl = TextEditingController(text: branding['gstNumber'] ?? '');
    final gstStateCtrl = TextEditingController(text: branding['gstState'] ?? 'Maharashtra');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            top: 24, left: 24, right: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('TENANT BRANDING CONFIGURATION', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.0)),
                const SizedBox(height: 16),
                TextField(controller: bizNameCtrl, decoration: const InputDecoration(labelText: 'Business Name')),
                const SizedBox(height: 12),
                TextField(controller: logoCtrl, decoration: const InputDecoration(labelText: 'Logo URL')),
                const SizedBox(height: 12),
                TextField(controller: gstNoCtrl, decoration: const InputDecoration(labelText: 'GSTIN Number')),
                const SizedBox(height: 12),
                TextField(controller: gstStateCtrl, decoration: const InputDecoration(labelText: 'GST State')),
                const SizedBox(height: 12),
                TextField(controller: footerCtrl, decoration: const InputDecoration(labelText: 'Invoice Footer Text')),
                const SizedBox(height: 12),
                TextField(controller: termsCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Invoice Terms & Conditions')),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      final success = await ref.read(adminProvider.notifier).updateBranding({
                        'businessName': bizNameCtrl.text.trim(),
                        'logoUrl': logoCtrl.text.trim(),
                        'gstNumber': gstNoCtrl.text.trim(),
                        'gstState': gstStateCtrl.text.trim(),
                        'invoiceFooter': footerCtrl.text.trim(),
                        'invoiceTerms': termsCtrl.text.trim(),
                        'tenantId': ref.read(adminProvider).activeBranch?['tenantId'] ?? 'default-shop',
                      });
                      if (success) {
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✓ Tenant branding saved successfully!'), backgroundColor: Colors.green));
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
                    child: const Text('SAVE BRANDING CONFIG'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // --- 2. POS Printer Configuration ---
  void _showPrinterConfigSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        final printers = ref.watch(adminProvider).printers;
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('PAIRED POS PRINTERS', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.0)),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline, color: AppTheme.goldDark),
                    onPressed: () => _showAddEditPrinterDialog(),
                  )
                ],
              ),
              const SizedBox(height: 12),
              if (printers.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('No printers configured.', style: TextStyle(color: Colors.black38, fontSize: 12))),
                )
              else
                Expanded(
                  child: ListView.builder(
                    itemCount: printers.length,
                    itemBuilder: (context, idx) {
                      final prn = printers[idx];
                      return Card(
                        color: Colors.white,
                        elevation: 0,
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFECE6DF))),
                        child: ListTile(
                          title: Text(prn['printerName'] ?? 'Printer', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          subtitle: Text('Type: ${prn['printerType']} • Connection: ${prn['connectionType']}'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (prn['isDefault'] == true)
                                const Chip(label: Text('DEFAULT', style: TextStyle(fontSize: 8, color: Colors.green, fontWeight: FontWeight.bold)), backgroundColor: Colors.white, padding: EdgeInsets.zero),
                              IconButton(
                                icon: const Icon(Icons.print_outlined, color: Colors.blueAccent, size: 18),
                                tooltip: 'Test Connection',
                                onPressed: () async {
                                  final ok = await ref.read(adminProvider.notifier).testPrinter({
                                    'printerType': prn['printerType'],
                                    'connectionType': prn['connectionType'],
                                    'printerIdentifier': prn['printerIdentifier'],
                                  });
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                    content: Text(ok ? '✓ Test page printed successfully!' : '✗ Printer test print failed.'),
                                    backgroundColor: ok ? Colors.green : Colors.redAccent,
                                  ));
                                },
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 18),
                                onPressed: () => ref.read(adminProvider.notifier).deletePrinter(prn['_id']),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _showAddEditPrinterDialog() {
    final nameCtrl = TextEditingController();
    final identCtrl = TextEditingController(text: '192.168.1.100');
    String type = 'THERMAL_80';
    String conn = 'NETWORK';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text('ADD NEW POS PRINTER', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Printer Name (e.g. Counter-1)')),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: type,
                    decoration: const InputDecoration(labelText: 'Printer Type'),
                    items: const [
                      DropdownMenuItem(value: 'THERMAL_58', child: Text('Thermal receipt (58mm)')),
                      DropdownMenuItem(value: 'THERMAL_80', child: Text('Thermal receipt (80mm)')),
                      DropdownMenuItem(value: 'A4', child: Text('Standard Invoice (A4)')),
                      DropdownMenuItem(value: 'BARCODE', child: Text('Barcode Printer')),
                      DropdownMenuItem(value: 'TAG', child: Text('Jewelry Tag Printer')),
                    ],
                    onChanged: (v) => setDialogState(() => type = v!),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: conn,
                    decoration: const InputDecoration(labelText: 'Connection Type'),
                    items: const [
                      DropdownMenuItem(value: 'USB', child: Text('USB Local Port')),
                      DropdownMenuItem(value: 'NETWORK', child: Text('Ethernet / Wi-Fi IP')),
                      DropdownMenuItem(value: 'BLUETOOTH', child: Text('Bluetooth Link')),
                    ],
                    onChanged: (v) => setDialogState(() => conn = v!),
                  ),
                  const SizedBox(height: 12),
                  TextField(controller: identCtrl, decoration: const InputDecoration(labelText: 'IP / USB / Address')),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CANCEL', style: TextStyle(color: Colors.black45))),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
                  onPressed: () async {
                    if (nameCtrl.text.trim().isEmpty || identCtrl.text.trim().isEmpty) return;
                    final ok = await ref.read(adminProvider.notifier).savePrinter({
                      'printerName': nameCtrl.text.trim(),
                      'printerType': type,
                      'connectionType': conn,
                      'printerIdentifier': identCtrl.text.trim(),
                      'isDefault': false,
                      'isActive': true,
                      'branchId': ref.read(adminProvider).activeBranch?['branchId'] ?? 'MAIN',
                      'tenantId': ref.read(adminProvider).activeBranch?['tenantId'] ?? 'default-shop',
                    });
                    if (ok) {
                      Navigator.pop(ctx);
                      ref.read(adminProvider.notifier).fetchPrinters();
                    }
                  },
                  child: const Text('ADD PRINTER', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // --- 3. Payment Gateway Configurations ---
  void _showPaymentGatewaySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        final gateways = ref.watch(adminProvider).paymentGateways;
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('PAYMENT GATEWAY CONFIGS', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.0)),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline, color: AppTheme.goldDark),
                    onPressed: () => _showAddGatewayDialog(),
                  )
                ],
              ),
              const SizedBox(height: 12),
              if (gateways.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('No gateways connected.', style: TextStyle(color: Colors.black38, fontSize: 12))),
                )
              else
                Expanded(
                  child: ListView.builder(
                    itemCount: gateways.length,
                    itemBuilder: (context, idx) {
                      final gw = gateways[idx];
                      return Card(
                        color: Colors.white,
                        elevation: 0,
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFECE6DF))),
                        child: ListTile(
                          title: Text(gw['gatewayName'] ?? 'Gateway', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          subtitle: Text('Type: ${gw['gatewayType']} • Mode: ${gw['testMode'] == true ? "SANDBOX" : "LIVE"}'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Switch(
                                value: gw['isActive'] ?? true,
                                activeColor: AppTheme.goldDark,
                                onChanged: (val) async {
                                  await ref.read(adminProvider.notifier).togglePaymentGatewayStatus(gw['_id']);
                                },
                              ),
                              IconButton(
                                icon: const Icon(Icons.security_outlined, color: Colors.blueAccent, size: 18),
                                tooltip: 'Test API Keys',
                                onPressed: () async {
                                  final ok = await ref.read(adminProvider.notifier).testPaymentGateway({
                                    'gatewayType': gw['gatewayType'],
                                    'apiKey': gw['apiKey'],
                                    'secretKey': gw['secretKey'],
                                    'testMode': gw['testMode'],
                                  });
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                    content: Text(ok ? '✓ Gateway keys connected successfully!' : '✗ Invalid API Keys.'),
                                    backgroundColor: ok ? Colors.green : Colors.redAccent,
                                  ));
                                },
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 18),
                                onPressed: () => ref.read(adminProvider.notifier).deletePaymentGateway(gw['_id']),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _showAddGatewayDialog() {
    final nameCtrl = TextEditingController();
    final keyCtrl = TextEditingController();
    final secCtrl = TextEditingController();
    String type = 'RAZORPAY';
    bool testMode = true;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text('CONNECT PAYMENT GATEWAY', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Connection Name')),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: type,
                      decoration: const InputDecoration(labelText: 'Gateway Provider'),
                      items: const [
                        DropdownMenuItem(value: 'RAZORPAY', child: Text('Razorpay (India)')),
                        DropdownMenuItem(value: 'CASHFREE', child: Text('Cashfree Payments')),
                        DropdownMenuItem(value: 'PHONEPE', child: Text('PhonePe Merchants')),
                        DropdownMenuItem(value: 'STRIPE', child: Text('Stripe International')),
                      ],
                      onChanged: (v) => setDialogState(() => type = v!),
                    ),
                    const SizedBox(height: 12),
                    TextField(controller: keyCtrl, decoration: const InputDecoration(labelText: 'API / Client Key')),
                    const SizedBox(height: 12),
                    TextField(controller: secCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'API / Secret Key')),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Test/Sandbox Mode', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                        Switch(
                          value: testMode,
                          activeColor: AppTheme.goldDark,
                          onChanged: (v) => setDialogState(() => testMode = v),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CANCEL', style: TextStyle(color: Colors.black45))),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
                  onPressed: () async {
                    if (nameCtrl.text.trim().isEmpty || keyCtrl.text.trim().isEmpty || secCtrl.text.trim().isEmpty) return;
                    final ok = await ref.read(adminProvider.notifier).savePaymentGateway({
                      'gatewayName': nameCtrl.text.trim(),
                      'gatewayType': type,
                      'apiKey': keyCtrl.text.trim(),
                      'secretKey': secCtrl.text.trim(),
                      'testMode': testMode,
                      'isActive': true,
                      'isDefault': false,
                      'tenantId': ref.read(adminProvider).activeBranch?['tenantId'] ?? 'default-shop',
                    });
                    if (ok) {
                      Navigator.pop(ctx);
                      ref.read(adminProvider.notifier).fetchPaymentGateways();
                    }
                  },
                  child: const Text('SAVE GATEWAY', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // --- 4. Messaging Configuration Setup ---
  void _showMessagingConfigSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        final configs = ref.watch(adminProvider).messagingConfigs;
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('MESSAGING DISPATCHERS', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.0)),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline, color: AppTheme.goldDark),
                    onPressed: () => _showAddMessagingDialog(),
                  )
                ],
              ),
              const SizedBox(height: 12),
              if (configs.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('No messaging providers connected.', style: TextStyle(color: Colors.black38, fontSize: 12))),
                )
              else
                Expanded(
                  child: ListView.builder(
                    itemCount: configs.length,
                    itemBuilder: (context, idx) {
                      final msg = configs[idx];
                      return Card(
                        color: Colors.white,
                        elevation: 0,
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFECE6DF))),
                        child: ListTile(
                          title: Text('Provider: ${msg['provider']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          subtitle: Text('Channel: ${msg['channelType']} • Status: ${msg['isActive'] == true ? "ACTIVE" : "INACTIVE"}'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.mail_outline_rounded, color: Colors.blueAccent, size: 18),
                                tooltip: 'Send Test SMS/Email',
                                onPressed: () async {
                                  final ok = await ref.read(adminProvider.notifier).testMessagingConfig({
                                    'channelType': msg['channelType'],
                                    'provider': msg['provider'],
                                    'configuration': msg['configuration'],
                                  });
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                    content: Text(ok ? '✓ Test communication dispatched successfully!' : '✗ Dispatcher failed.'),
                                    backgroundColor: ok ? Colors.green : Colors.redAccent,
                                  ));
                                },
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 18),
                                onPressed: () => ref.read(adminProvider.notifier).deleteMessagingConfig(msg['_id']),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _showAddMessagingDialog() {
    final provCtrl = TextEditingController();
    final hostCtrl = TextEditingController(text: 'smtp.gmail.com');
    final portCtrl = TextEditingController(text: '587');
    final userCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    String channel = 'EMAIL';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text('ADD MESSAGING DISPATCHER', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<String>(
                      value: channel,
                      decoration: const InputDecoration(labelText: 'Channel Type'),
                      items: const [
                        DropdownMenuItem(value: 'EMAIL', child: Text('Email (SMTP)')),
                        DropdownMenuItem(value: 'SMS', child: Text('SMS Gateway')),
                        DropdownMenuItem(value: 'WHATSAPP', child: Text('WhatsApp Business')),
                      ],
                      onChanged: (v) => setDialogState(() => channel = v!),
                    ),
                    const SizedBox(height: 12),
                    TextField(controller: provCtrl, decoration: const InputDecoration(labelText: 'Provider Name (e.g. Twilio, NodeMailer)')),
                    const SizedBox(height: 12),
                    if (channel == 'EMAIL') ...[
                      TextField(controller: hostCtrl, decoration: const InputDecoration(labelText: 'SMTP Server Host')),
                      const SizedBox(height: 12),
                      TextField(controller: portCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'SMTP Port (587 / 465)')),
                      const SizedBox(height: 12),
                    ],
                    TextField(controller: userCtrl, decoration: InputDecoration(labelText: channel == 'EMAIL' ? 'SMTP User Email' : 'API Key Account')),
                    const SizedBox(height: 12),
                    TextField(controller: passCtrl, obscureText: true, decoration: InputDecoration(labelText: channel == 'EMAIL' ? 'SMTP App Password' : 'Auth Token Secret')),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CANCEL', style: TextStyle(color: Colors.black45))),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
                  onPressed: () async {
                    if (provCtrl.text.trim().isEmpty || userCtrl.text.trim().isEmpty || passCtrl.text.trim().isEmpty) return;
                    final ok = await ref.read(adminProvider.notifier).saveMessagingConfig({
                      'channelType': channel,
                      'provider': provCtrl.text.trim(),
                      'isActive': true,
                      'isDefault': false,
                      'configuration': {
                        if (channel == 'EMAIL') 'host': hostCtrl.text.trim(),
                        if (channel == 'EMAIL') 'port': int.tryParse(portCtrl.text.trim()) ?? 587,
                        if (channel == 'EMAIL') 'secure': portCtrl.text.trim() == '465',
                        'auth': {
                          'user': userCtrl.text.trim(),
                          'pass': passCtrl.text.trim(),
                        }
                      },
                      'tenantId': ref.read(adminProvider).activeBranch?['tenantId'] ?? 'default-shop',
                    });
                    if (ok) {
                      Navigator.pop(ctx);
                      ref.read(adminProvider.notifier).fetchMessagingConfigs();
                    }
                  },
                  child: const Text('SAVE DISPATCHER', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // --- 5. Tax Profiles Configuration ---
  void _showTaxProfileSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        final profiles = ref.watch(adminProvider).taxProfiles;
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('TAX RATE PROFILES', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.0)),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline, color: AppTheme.goldDark),
                    onPressed: () => _showAddTaxProfileDialog(),
                  )
                ],
              ),
              const SizedBox(height: 12),
              if (profiles.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('No tax profiles configured.', style: TextStyle(color: Colors.black38, fontSize: 12))),
                )
              else
                Expanded(
                  child: ListView.builder(
                    itemCount: profiles.length,
                    itemBuilder: (context, idx) {
                      final tax = profiles[idx];
                      return Card(
                        color: Colors.white,
                        elevation: 0,
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFECE6DF))),
                        child: ListTile(
                          title: Text(tax['profileName'] ?? 'Tax Profile', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          subtitle: Text('HSN: ${tax['hsnCode']} • CGST: ${tax['cgst']}% • SGST: ${tax['sgst']}% • IGST: ${tax['igst']}%'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (tax['isDefault'] == true)
                                const Chip(label: Text('DEFAULT', style: TextStyle(fontSize: 8, color: Colors.green, fontWeight: FontWeight.bold)), backgroundColor: Colors.white, padding: EdgeInsets.zero),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 18),
                                onPressed: () => ref.read(adminProvider.notifier).deleteTaxProfile(tax['_id']),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _showAddTaxProfileDialog() {
    final nameCtrl = TextEditingController();
    final hsnCtrl = TextEditingController(text: '7113');
    final cgstCtrl = TextEditingController(text: '1.5');
    final sgstCtrl = TextEditingController(text: '1.5');
    final igstCtrl = TextEditingController(text: '3.0');

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFFF9F6F0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text('CREATE NEW TAX PROFILE', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Profile Name (e.g. Standard Gold)')),
                const SizedBox(height: 12),
                TextField(controller: hsnCtrl, decoration: const InputDecoration(labelText: 'HSN code (Chapter 71)')),
                const SizedBox(height: 12),
                TextField(controller: cgstCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'CGST rate (%)')),
                const SizedBox(height: 12),
                TextField(controller: sgstCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'SGST rate (%)')),
                const SizedBox(height: 12),
                TextField(controller: igstCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'IGST rate (%)')),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CANCEL', style: TextStyle(color: Colors.black45))),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
              onPressed: () async {
                if (nameCtrl.text.trim().isEmpty || hsnCtrl.text.trim().isEmpty) return;
                final ok = await ref.read(adminProvider.notifier).saveTaxProfile({
                  'profileName': nameCtrl.text.trim(),
                  'hsnCode': hsnCtrl.text.trim(),
                  'taxType': 'GST',
                  'cgst': double.tryParse(cgstCtrl.text) ?? 0.0,
                  'sgst': double.tryParse(sgstCtrl.text) ?? 0.0,
                  'igst': double.tryParse(igstCtrl.text) ?? 0.0,
                  'cess': 0.0,
                  'isDefault': false,
                  'isActive': true,
                  'tenantId': ref.read(adminProvider).activeBranch?['tenantId'] ?? 'default-shop',
                });
                if (ok) {
                  Navigator.pop(ctx);
                  ref.read(adminProvider.notifier).fetchTaxProfiles();
                }
              },
              child: const Text('SAVE PROFILE', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  void _showClosingDenominationSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                top: 24,
                left: 24,
                right: 24,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'DAILY CASH DRAWER CLOSE TALLY',
                      style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1.0),
                    ),
                    const SizedBox(height: 6),
                    const Text('Input cash count in register to tally ledger audits.', style: TextStyle(color: Colors.black38, fontSize: 11)),
                    const SizedBox(height: 20),
                    ...['2000', '500', '200', '100', '50'].map((denom) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('₹$denom Note', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
                            SizedBox(
                              width: 100,
                              child: TextField(
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                decoration: const InputDecoration(hintText: '0', contentPadding: EdgeInsets.zero),
                                onChanged: (val) {
                                  final num = int.tryParse(val) ?? 0;
                                  setSheetState(() {
                                    _denominations[denom] = num;
                                  });
                                },
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 16),
                    const Divider(color: Colors.black12),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('TOTAL PHYSICAL CASH IN HAND:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black54)),
                        Text('₹${_actualCashTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.goldDark)),
                      ],
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          final success = await ref.read(adminProvider.notifier).saveCashClosingDenominations(
                                _denominations,
                                125000.0, // Expected amount from simulated sales
                                _actualCashTotal,
                              );
                          if (success) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              const SnackBar(content: Text('Denomination closing audit registered successfully!'), backgroundColor: AppTheme.goldDark),
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.goldDark,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: const Text('SUBMIT AUDIT REPORT', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                      ),
                    ),
                  ],
                ),
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
        title: const Text(
          'STORE CONFIGURATION',
          style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1.0),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Shop Profile Settings
            const Text(
              'Showroom Profile Parameters',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _addressCtrl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Store Address', prefixIcon: Icon(Icons.location_on_outlined)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Customer Care Hotline', prefixIcon: Icon(Icons.phone_outlined)),
            ),
            const SizedBox(height: 28),

            // Billing configuration
            const Text(
              'Billing & Invoice Sequences',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _invoicePrefixCtrl,
              decoration: const InputDecoration(labelText: 'Invoice ID Prefix', prefixIcon: Icon(Icons.pin_outlined)),
            ),
            const SizedBox(height: 28),

            // Cash management register close
            const Text(
              'Daily Closing Audit Logs',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            const SizedBox(height: 6),
            const Text('Tally register cash values and check for store discrepancy logs.', style: TextStyle(color: Colors.black38, fontSize: 11)),
            const SizedBox(height: 14),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _showClosingDenominationSheet,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppTheme.goldDark,
                  side: const BorderSide(color: AppTheme.goldDark, width: 1.2),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                icon: const Icon(Icons.currency_rupee, size: 20),
                label: const Text('SUBMIT CASH CLOSING SHEET', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5)),
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'Advanced Store Management',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            const SizedBox(height: 14),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 2.2,
              children: [
                _buildManagementTile(
                  icon: Icons.local_shipping_outlined,
                  label: 'Purchase Orders',
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const PurchaseOrderScreen()));
                  },
                ),
                _buildManagementTile(
                  icon: Icons.savings_outlined,
                  label: 'Savings Schemes',
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const SchemesAdminScreen()));
                  },
                ),
                _buildManagementTile(
                  icon: Icons.local_fire_department_outlined,
                  label: 'Old Gold Buyback',
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const OldGoldMeltingScreen()));
                  },
                ),
                _buildManagementTile(
                  icon: Icons.gavel_rounded,
                  label: 'Compliance Reports',
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const ComplianceReportsScreen()));
                  },
                ),
                _buildManagementTile(
                  icon: Icons.local_offer_outlined,
                  label: 'Offers & Coupons',
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const OffersManagerScreen()));
                  },
                ),
                _buildManagementTile(
                  icon: Icons.security_outlined,
                  label: 'Security Logs',
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(builder: (context) => const SecurityLogsScreen()));
                  },
                ),
                _buildManagementTile(
                  icon: Icons.print_outlined,
                  label: 'Printer pairing',
                  onTap: _showPrinterConfigSheet,
                ),
                _buildManagementTile(
                  icon: Icons.credit_card_outlined,
                  label: 'Payment Gateways',
                  onTap: _showPaymentGatewaySheet,
                ),
                _buildManagementTile(
                  icon: Icons.message_outlined,
                  label: 'Messaging Channels',
                  onTap: _showMessagingConfigSheet,
                ),
                _buildManagementTile(
                  icon: Icons.percent_outlined,
                  label: 'Tax Profiles',
                  onTap: _showTaxProfileSheet,
                ),
                _buildManagementTile(
                  icon: Icons.palette_outlined,
                  label: 'Tenant Branding',
                  onTap: _showTenantBrandingSheet,
                ),
                _buildManagementTile(
                  icon: Icons.group_add_outlined,
                  label: 'B2B Referral Partners',
                  onTap: () => context.push('/owner/partner-referrals'),
                ),
                _buildManagementTile(
                  icon: Icons.wallet_outlined,
                  label: 'Referral Commissions',
                  onTap: () => context.push('/owner/referral-commissions'),
                ),
                _buildManagementTile(
                  icon: Icons.business_center_outlined,
                  label: 'Vendor Rate Contracts',
                  onTap: () => context.push('/owner/vendor-contracts'),
                ),
              ],
            ),
            const SizedBox(height: 48),
          ],
        ),
      ),
    );
  }

  Widget _buildManagementTile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFECE6DF)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Icon(icon, color: AppTheme.goldDark, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF2E2A25)),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
