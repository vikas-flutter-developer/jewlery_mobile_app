import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/karikar_provider.dart';
import 'karikar_detail_screens.dart';

// ─── Design Tokens ──────────────────────────────────────────
const _bg       = Color(0xFFFAF7F2);
const _surface  = Color(0xFFFFFFFF);
const _gold     = Color(0xFFC8943A);
const _goldLt   = Color(0xFFF5E6C8);
const _goldDeep = Color(0xFF9B6E1E);
const _ink      = Color(0xFF2A1F0E);
const _ink2     = Color(0xFF5C4A2A);
const _muted    = Color(0xFF9E8C72);
const _divider  = Color(0xFFEDE5D5);
const _green    = Color(0xFF3A9B6F);
const _greenLt  = Color(0xFFDDF2E7);
const _amber    = Color(0xFFDD8000);
const _amberLt  = Color(0xFFFFF0CE);
const _red      = Color(0xFFCC3D3D);
const _redLt    = Color(0xFFFFECEC);

class KarikarDashboard extends ConsumerStatefulWidget {
  const KarikarDashboard({super.key});

  @override
  ConsumerState<KarikarDashboard> createState() => _KarikarDashboardState();
}

class _KarikarDashboardState extends ConsumerState<KarikarDashboard>
    with SingleTickerProviderStateMixin {
  int _tabIndex = 0;
  late AnimationController _shimmerCtrl;

  // Dialog controllers
  final _returnWeightCtrl    = TextEditingController();
  final _returnNoteCtrl      = TextEditingController();
  String _returnPurity       = '22K';

  final _wReqCtrl            = TextEditingController();
  final _wScrapCtrl          = TextEditingController();
  final _wEstCtrl            = TextEditingController();
  final _wActCtrl            = TextEditingController();
  final _wNoteCtrl           = TextEditingController();
  String _wPurity            = '22K';
  String? _wJobId;

  final _oldPassCtrl         = TextEditingController();
  final _newPassCtrl         = TextEditingController();
  final _confirmPassCtrl     = TextEditingController();
  final _addressCtrl         = TextEditingController();
  final _emergencyCtrl       = TextEditingController();

  @override
  void initState() {
    super.initState();
    _shimmerCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat(reverse: true);
    Future.microtask(() {
      final uid = ref.read(authProvider).user?['id'] ?? ref.read(authProvider).user?['_id'];
      if (uid != null) ref.read(karikarProvider.notifier).loadInitialData(uid.toString());
    });
  }

  @override
  void dispose() {
    _shimmerCtrl.dispose();
    for (final c in [_returnWeightCtrl, _returnNoteCtrl, _wReqCtrl, _wScrapCtrl,
                     _wEstCtrl, _wActCtrl, _wNoteCtrl, _oldPassCtrl, _newPassCtrl,
                     _confirmPassCtrl, _addressCtrl, _emergencyCtrl]) {
      c.dispose();
    }
    super.dispose();
  }

  // ── helpers ─────────────────────────────────────────────────
  void _snack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        Icon(error ? Icons.error_outline : Icons.check_circle_outline,
             color: Colors.white, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(msg, style: const TextStyle(fontWeight: FontWeight.w600))),
      ]),
      backgroundColor: error ? _red : _goldDeep,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: const EdgeInsets.all(16),
    ));
  }

  String _shortDate(dynamic d) {
    if (d == null) return 'N/A';
    final s = d.toString();
    return s.contains('T') ? s.substring(0, 10) : s;
  }

  String _compactNum(double n) {
    if (n >= 100000) return '${(n / 100000).toStringAsFixed(2)}L';
    if (n >= 1000)   return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toStringAsFixed(2);
  }

  Color _statusColor(String s) {
    if (s.contains('PROGRESS') || s.contains('ACTIVE')) return _green;
    if (s.contains('PENDING') || s.contains('ISSUE'))  return _amber;
    if (s.contains('DELAY')  || s.contains('REJECT'))  return _red;
    return _gold;
  }

  Color _statusBg(String s) {
    if (s.contains('PROGRESS') || s.contains('ACTIVE')) return _greenLt;
    if (s.contains('PENDING') || s.contains('ISSUE'))  return _amberLt;
    if (s.contains('DELAY')  || s.contains('REJECT'))  return _redLt;
    return _goldLt;
  }

  // ── light-themed text field ──────────────────────────────────
  Widget _field(TextEditingController c, String label, IconData icon,
      {bool obscure = false, TextInputType? kb}) {
    return TextField(
      controller: c,
      obscureText: obscure,
      keyboardType: kb,
      style: const TextStyle(color: _ink, fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: _muted, fontSize: 13),
        prefixIcon: Icon(icon, color: _gold, size: 20),
        filled: true,
        fillColor: _bg,
        contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        border:        OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _divider)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _divider)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _gold, width: 1.8)),
      ),
    );
  }

  Widget _drop<T>({required String label, required T? val, required List<T> items,
      List<String>? labels, required ValueChanged<T?> onChange}) {
    return DropdownButtonFormField<T>(
      value: val,
      dropdownColor: _surface,
      style: const TextStyle(color: _ink, fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: _muted, fontSize: 13),
        filled: true, fillColor: _bg,
        contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        border:        OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _divider)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _divider)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _gold, width: 1.8)),
      ),
      items: items.asMap().entries.map((e) {
        final lbl = labels != null ? labels[e.key] : e.value.toString();
        return DropdownMenuItem<T>(value: e.value, child: Text(lbl, style: const TextStyle(color: _ink)));
      }).toList(),
      onChanged: onChange,
    );
  }

  Widget _dialogBtn(String label, VoidCallback onPressed) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [_gold, _goldDeep]),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: _gold.withValues(alpha: 0.35), blurRadius: 8, offset: const Offset(0, 3))],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
            child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 0.4)),
          ),
        ),
      ),
    );
  }

  // ── dialogs ─────────────────────────────────────────────────
  void _returnGoldDialog(String userId) {
    _returnWeightCtrl.clear(); _returnNoteCtrl.clear(); _returnPurity = '22K';
    showDialog(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
      return _lightDialog(
        title: 'Return Metal to Showroom',
        icon: Icons.scale_outlined,
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Record outgoing metal return to clear pending stock weight.', style: TextStyle(color: _muted, fontSize: 12)),
          const SizedBox(height: 16),
          _field(_returnWeightCtrl, 'Returned Weight (Grams)', Icons.scale_outlined, kb: TextInputType.number),
          const SizedBox(height: 12),
          _drop<String>(label: 'Gold Purity', val: _returnPurity, items: ['18K','22K','24K'],
              onChange: (v) => set(() => _returnPurity = v!)),
          const SizedBox(height: 12),
          _field(_returnNoteCtrl, 'Reference / Note', Icons.note_alt_outlined),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: _muted))),
          _dialogBtn('Submit Return', () async {
            final wt = double.tryParse(_returnWeightCtrl.text) ?? 0.0;
            if (wt <= 0) { _snack('Enter a valid weight', error: true); return; }
            final ok = await ref.read(karikarProvider.notifier).returnMetal(
              weight: wt, purity: _returnPurity,
              note: _returnNoteCtrl.text.trim().isEmpty ? 'Returned gold stock' : _returnNoteCtrl.text.trim(),
              karikarId: userId,
            );
            if (ok) { Navigator.pop(ctx); _snack('Metal return recorded!'); }
          }),
        ],
      );
    }));
  }

  void _wastageDialog(String userId, List<dynamic> jobs) {
    for (final c in [_wReqCtrl, _wScrapCtrl, _wEstCtrl, _wActCtrl, _wNoteCtrl]) c.clear();
    _wPurity = '22K';
    _wJobId  = jobs.isNotEmpty ? (jobs.first['_id'] ?? jobs.first['id'] ?? jobs.first['orderId']).toString() : null;

    showDialog(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
      return _lightDialog(
        title: 'Claim Wastage Reconciliation',
        icon: Icons.warning_amber_rounded,
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Request wastage audit for completed artisan tasks.', style: TextStyle(color: _muted, fontSize: 12)),
          const SizedBox(height: 16),
          if (jobs.isNotEmpty) ...[
            _drop<String>(
              label: 'Work Order',
              val: _wJobId,
              items: jobs.map<String>((j) => (j['_id'] ?? j['id'] ?? j['orderId']).toString()).toList(),
              labels: jobs.map<String>((j) => 'Order #${j['orderId'] ?? j['_id']} · ${j['jewelryType'] ?? "Jewelry"}').toList(),
              onChange: (v) => set(() => _wJobId = v),
            ),
            const SizedBox(height: 12),
          ],
          _field(_wReqCtrl,   'Issued Metal Weight (g)', Icons.scale_outlined, kb: TextInputType.number),
          const SizedBox(height: 10),
          _drop<String>(label: 'Gold Purity', val: _wPurity, items: ['18K','22K','24K'],
              onChange: (v) => set(() => _wPurity = v!)),
          const SizedBox(height: 10),
          _field(_wScrapCtrl, 'Scrap Returned (g)',       Icons.recycling_outlined, kb: TextInputType.number),
          const SizedBox(height: 10),
          _field(_wEstCtrl,   'Allowed Wastage Est. (g)', Icons.percent_outlined,   kb: TextInputType.number),
          const SizedBox(height: 10),
          _field(_wActCtrl,   'Actual Loss (g)',           Icons.trending_down_outlined, kb: TextInputType.number),
          const SizedBox(height: 10),
          _field(_wNoteCtrl,  'Artisan Notes',             Icons.description_outlined),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: _muted))),
          _dialogBtn('Submit Claim', () async {
            final rw = double.tryParse(_wReqCtrl.text) ?? 0.0;
            if (rw <= 0) { _snack('Enter valid issued weight', error: true); return; }
            String? orderId;
            if (_wJobId != null && jobs.isNotEmpty) {
              final t = jobs.firstWhere((j) => (j['_id'] ?? j['id'] ?? j['orderId']).toString() == _wJobId, orElse: () => null);
              if (t != null) orderId = (t['orderId'] ?? t['_id']).toString();
            }
            final ok = await ref.read(karikarProvider.notifier).claimWastage(
              requestedWeight: rw, purity: _wPurity,
              scrapWeight: double.tryParse(_wScrapCtrl.text) ?? 0.0,
              estimatedWastage: double.tryParse(_wEstCtrl.text) ?? 0.0,
              actualWastage: double.tryParse(_wActCtrl.text) ?? 0.0,
              calculatedLoss: (double.tryParse(_wActCtrl.text) ?? 0.0) - (double.tryParse(_wEstCtrl.text) ?? 0.0),
              notes: _wNoteCtrl.text.trim(), karikarId: userId, jobId: _wJobId, orderId: orderId,
            );
            if (ok) { Navigator.pop(ctx); _snack('Wastage claim submitted!'); }
          }),
        ],
      );
    }));
  }

  void _changePasswordDialog() {
    _oldPassCtrl.clear(); _newPassCtrl.clear(); _confirmPassCtrl.clear();
    showDialog(context: context, builder: (ctx) => _lightDialog(
      title: 'Change Password',
      icon: Icons.vpn_key_outlined,
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        _field(_oldPassCtrl,     'Current Password',      Icons.lock_outline,       obscure: true),
        const SizedBox(height: 12),
        _field(_newPassCtrl,     'New Password',          Icons.lock_reset_outlined, obscure: true),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 4),
          child: Text('Min 8 chars, include number & special char', style: TextStyle(color: _muted, fontSize: 11)),
        ),
        const SizedBox(height: 6),
        _field(_confirmPassCtrl, 'Confirm New Password',  Icons.lock_outlined,       obscure: true),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: _muted))),
        _dialogBtn('Update Password', () async {
          final oldP  = _oldPassCtrl.text.trim();
          final newP  = _newPassCtrl.text.trim();
          final confP = _confirmPassCtrl.text.trim();
          if (oldP.isEmpty || newP.isEmpty || confP.isEmpty) {
            _snack('Please fill all fields', error: true); return;
          }
          if (newP != confP) {
            _snack('New passwords do not match', error: true); return;
          }
          if (newP.length < 8) {
            _snack('Password must be at least 8 characters', error: true); return;
          }
          // Backend expects: currentPassword, newPassword, confirmPassword
          final ok = await ref.read(karikarProvider.notifier).changePassword(oldP, newP, confirmPassword: confP);
          if (ok) { Navigator.pop(ctx); _snack('Password updated successfully!'); }
          else _snack('Failed — check your current password and try again', error: true);
        }),
      ],
    ));
  }

  void _editProfileDialog(Map<String, dynamic>? profile) {
    _addressCtrl.text   = profile?['address'] ?? '';
    _emergencyCtrl.text = profile?['emergencyContact'] ?? '';
    showDialog(context: context, builder: (ctx) => _lightDialog(
      title: 'Update Contact Info',
      icon: Icons.edit_note_outlined,
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        _field(_emergencyCtrl, 'Emergency Contact', Icons.phone_outlined),
        const SizedBox(height: 12),
        _field(_addressCtrl,   'Address',            Icons.map_outlined),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: _muted))),
        _dialogBtn('Save', () async {
          final emergency = _emergencyCtrl.text.trim();
          final address   = _addressCtrl.text.trim();
          if (emergency.isEmpty && address.isEmpty) {
            _snack('Enter at least one field to update', error: true); return;
          }
          final ok = await ref.read(karikarProvider.notifier).updateProfile({
            if (emergency.isNotEmpty) 'emergencyContact': emergency,
            if (address.isNotEmpty)   'address': address,
          });
          if (ok) { Navigator.pop(ctx); _snack('Contact info updated!'); }
          else _snack('Failed to save — please try again', error: true);
        }),
      ],
    ));
  }

  Widget _lightDialog({required String title, required IconData icon,
      required Widget content, required List<Widget> actions}) {
    return Dialog(
      backgroundColor: _surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: _goldLt, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, color: _gold, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(title, style: const TextStyle(color: _ink, fontSize: 17, fontWeight: FontWeight.bold, fontFamily: 'serif'))),
            ]),
            const SizedBox(height: 20),
            const Divider(color: _divider, height: 1),
            const SizedBox(height: 16),
            content,
            const SizedBox(height: 20),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: actions.map((a) => Padding(padding: const EdgeInsets.only(left: 8), child: a)).toList()),
          ],
        ),
      ),
    );
  }

  // ── MAIN BUILD ───────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final auth  = ref.watch(authProvider);
    final state = ref.watch(karikarProvider);
    final uid   = (auth.user?['id'] ?? auth.user?['_id'] ?? '').toString();
    final name  = auth.user?['name'] ?? 'Artisan';

    return Scaffold(
      backgroundColor: _bg,
      body: Column(children: [
        _buildHeader(name, state, uid),
        Expanded(child: RefreshIndicator(
          onRefresh: () async { if (uid.isNotEmpty) await ref.read(karikarProvider.notifier).loadInitialData(uid); },
          color: _gold,
          child: state.isLoading && state.jobCards.isEmpty
              ? const Center(child: CircularProgressIndicator(color: _gold))
              : IndexedStack(index: _tabIndex, children: [
                  _workshopTab(uid, state),
                  _historyTab(state),
                  _profileTab(state),
                ]),
        )),
        _bottomNav(),
      ]),
    );
  }

  // ── Header ───────────────────────────────────────────────────
  Widget _buildHeader(String name, KarikarState state, String uid) {
    return Container(
      decoration: const BoxDecoration(
        color: _surface,
        border: Border(bottom: BorderSide(color: _divider, width: 1)),
        boxShadow: [BoxShadow(color: Color(0x0A000000), blurRadius: 12, offset: Offset(0, 3))],
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 16, 16),
          child: Row(children: [
            // Avatar
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(colors: [_gold, _goldDeep], begin: Alignment.topLeft, end: Alignment.bottomRight),
                boxShadow: [BoxShadow(color: _gold.withValues(alpha: 0.35), blurRadius: 12, offset: const Offset(0, 4))],
              ),
              child: Center(
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : 'A',
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('ARTISAN WORKSHOP', style: TextStyle(color: _gold, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 2.0)),
              Text(name, style: const TextStyle(color: _ink, fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'serif')),
            ])),
            // Notification bell
            Stack(alignment: Alignment.center, children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: _ink2, size: 24),
                onPressed: () => _notifSheet(state.notifications),
              ),
              if (state.notifications.isNotEmpty)
                Positioned(
                  right: 8, top: 8,
                  child: Container(
                    width: 16, height: 16,
                    decoration: const BoxDecoration(color: _red, shape: BoxShape.circle),
                    child: Center(child: Text('${state.notifications.length}', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold))),
                  ),
                ),
            ]),
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: _muted, size: 22),
              onPressed: () => ref.read(authProvider.notifier).logout(),
            ),
          ]),
        ),
      ),
    );
  }

  // ── Bottom Nav ────────────────────────────────────────────────
  Widget _bottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: _surface,
        border: Border(top: BorderSide(color: _divider, width: 1)),
        boxShadow: [BoxShadow(color: Color(0x0A000000), blurRadius: 12, offset: Offset(0, -3))],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            _navTile(0, Icons.engineering_outlined, Icons.engineering, 'Workshop'),
            _navTile(1, Icons.history_outlined,     Icons.history,     'History'),
            _navTile(2, Icons.person_outline_rounded, Icons.person_rounded, 'My Account'),
          ]),
        ),
      ),
    );
  }

  Widget _navTile(int idx, IconData off, IconData on, String label) {
    final active = _tabIndex == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tabIndex = idx),
        behavior: HitTestBehavior.opaque,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 8),
          AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            padding: EdgeInsets.all(active ? 9 : 0),
            decoration: active
                ? BoxDecoration(color: _goldLt, borderRadius: BorderRadius.circular(14))
                : null,
            child: Icon(active ? on : off, color: active ? _gold : _muted, size: 22),
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(color: active ? _gold : _muted, fontSize: 10, fontWeight: active ? FontWeight.bold : FontWeight.normal, letterSpacing: 0.2)),
          const SizedBox(height: 6),
        ]),
      ),
    );
  }

  // ── TAB 1: Workshop ──────────────────────────────────────────
  Widget _workshopTab(String uid, KarikarState state) {
    final active = state.jobCards.where((j) {
      final s = (j['status'] ?? '').toString().toUpperCase();
      return s != 'RECEIVED' && s != 'COMPLETED' && s != 'CLOSED';
    }).toList();

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Error
        if (state.error != null) _errBanner(state.error!),

        // Stat Cards
        Row(children: [
          Expanded(child: GestureDetector(
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PendingMetalScreen())),
            child: _statCard(
              title: 'PENDING METAL',
              value: '${state.goldStock.toStringAsFixed(3)} g',
              icon: Icons.scale_outlined,
              accent: _gold, bg: _goldLt,
              tappable: true,
            ),
          )),
          const SizedBox(width: 14),
          Expanded(child: GestureDetector(
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LedgerBalanceScreen())),
            child: _statCard(
              title: 'LEDGER BALANCE',
              value: '₹${_compactNum(state.ledgerBalance)}',
              icon: Icons.account_balance_wallet_outlined,
              accent: _green, bg: _greenLt,
              tappable: true,
            ),
          )),
        ]),
        const SizedBox(height: 28),

        // Active Jobs
        _secHeader(Icons.list_alt_outlined, 'Active Job Orders', '${active.length}'),
        const SizedBox(height: 14),
        if (active.isEmpty)
          _emptyCard(Icons.engineering_outlined, 'No active job orders assigned to you.')
        else
          ...active.asMap().entries.map((e) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _jobCard(e.value, e.key),
          )),

        const SizedBox(height: 28),

        // Actions
        _secHeader(Icons.flash_on_outlined, 'Quick Actions', null),
        const SizedBox(height: 14),
        _actionTile(
          icon: Icons.scale,
          title: 'Return Gold to Showroom',
          subtitle: 'Submit completed metal weight',
          iconBg: _goldLt, iconColor: _gold,
          onTap: () => _returnGoldDialog(uid),
        ),
        const SizedBox(height: 12),
        _actionTile(
          icon: Icons.warning_amber_rounded,
          title: 'Claim Wastage Reconciliation',
          subtitle: 'Request audit for processing loss',
          iconBg: _amberLt, iconColor: _amber,
          onTap: () => _wastageDialog(uid, active),
          highlight: true,
        ),
      ]),
    );
  }

  Widget _statCard({required String title, required String value, required IconData icon,
      required Color accent, required Color bg, bool tappable = false}) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: tappable ? accent.withValues(alpha: 0.25) : _divider, width: tappable ? 1.5 : 1),
        boxShadow: tappable
            ? [BoxShadow(color: accent.withValues(alpha: 0.12), blurRadius: 14, offset: const Offset(0, 5))]
            : const [BoxShadow(color: Color(0x08000000), blurRadius: 12, offset: Offset(0, 4))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: accent, size: 20),
          ),
          if (tappable)
            Icon(Icons.arrow_forward_ios_rounded, size: 13, color: accent.withValues(alpha: 0.5)),
        ]),
        const SizedBox(height: 14),
        Text(title, style: const TextStyle(color: _muted, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(color: accent, fontSize: 20, fontWeight: FontWeight.bold, fontFamily: 'serif')),
      ]),
    );
  }

  Widget _jobCard(Map<String, dynamic> job, int idx) {
    final id     = job['orderId'] ?? job['_id'] ?? 'N/A';
    final type   = job['jewelryType'] ?? job['category'] ?? 'Jewelry';
    final purity = job['purity'] ?? job['issuedPurity'] ?? '22K';
    final wt     = (job['issuedGoldWeight'] ?? job['weight'] ?? 0).toDouble();
    final due    = job['dueDate']?.toString() ?? 'Soon';
    final status = (job['status'] ?? 'IN PROGRESS').toString().toUpperCase();
    final sc     = _statusColor(status);
    final sbg    = _statusBg(status);

    return Container(
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _divider),
        boxShadow: const [BoxShadow(color: Color(0x06000000), blurRadius: 12, offset: Offset(0, 4))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(children: [
          // Numbered circle
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(color: _goldLt, shape: BoxShape.circle, border: Border.all(color: _gold.withValues(alpha: 0.3), width: 1.5)),
            child: Center(child: Text('${idx + 1}', style: const TextStyle(color: _goldDeep, fontWeight: FontWeight.bold, fontSize: 17))),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('Order #$id', style: const TextStyle(color: _ink, fontWeight: FontWeight.bold, fontSize: 14))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(color: sbg, borderRadius: BorderRadius.circular(8)),
                child: Text(status, style: TextStyle(color: sc, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.4)),
              ),
            ]),
            const SizedBox(height: 4),
            Text('$type · $purity', style: const TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w500)),
            const SizedBox(height: 10),
            Row(children: [
              _chip(Icons.scale_outlined, '${wt.toStringAsFixed(3)}g'),
              const SizedBox(width: 8),
              _chip(Icons.calendar_today_outlined, due.length > 10 ? due.substring(0, 10) : due),
            ]),
          ])),
        ]),
      ),
    );
  }

  Widget _chip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(10), border: Border.all(color: _divider)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: _muted),
        const SizedBox(width: 5),
        Text(label, style: const TextStyle(color: _ink2, fontSize: 11, fontWeight: FontWeight.w600)),
      ]),
    );
  }

  Widget _actionTile({required IconData icon, required String title, required String subtitle,
      required Color iconBg, required Color iconColor, required VoidCallback onTap, bool highlight = false}) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: highlight ? _gold : _surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: highlight ? _gold : _divider),
          boxShadow: highlight
              ? [BoxShadow(color: _gold.withValues(alpha: 0.25), blurRadius: 16, offset: const Offset(0, 6))]
              : [const BoxShadow(color: Color(0x06000000), blurRadius: 10, offset: Offset(0, 3))],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          child: Row(children: [
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: highlight ? Colors.white.withValues(alpha: 0.25) : iconBg,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: highlight ? Colors.white : iconColor, size: 22),
            ),
            const SizedBox(width: 16),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: TextStyle(color: highlight ? Colors.white : _ink, fontWeight: FontWeight.bold, fontSize: 14)),
              Text(subtitle, style: TextStyle(color: highlight ? Colors.white70 : _muted, fontSize: 12)),
            ])),
            Icon(Icons.arrow_forward_ios_rounded, color: highlight ? Colors.white70 : _muted, size: 16),
          ]),
        ),
      ),
    );
  }

  Widget _secHeader(IconData icon, String title, String? count) {
    return Row(children: [
      Icon(icon, color: _gold, size: 18),
      const SizedBox(width: 8),
      Text(title, style: const TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'serif')),
      if (count != null) ...[
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
          decoration: BoxDecoration(gradient: const LinearGradient(colors: [_gold, _goldDeep]), borderRadius: BorderRadius.circular(10)),
          child: Text(count, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
        ),
      ],
      const SizedBox(width: 8),
      Expanded(child: Container(height: 1, color: _divider)),
    ]);
  }

  Widget _emptyCard(IconData icon, String msg) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: _divider)),
      child: Column(children: [
        Icon(icon, size: 44, color: _divider),
        const SizedBox(height: 12),
        Text(msg, style: const TextStyle(color: _muted, fontSize: 13)),
      ]),
    );
  }

  Widget _errBanner(String msg) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: _redLt, borderRadius: BorderRadius.circular(14), border: Border.all(color: _red.withValues(alpha: 0.3))),
      child: Row(children: [
        const Icon(Icons.error_outline, color: _red, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(msg, style: const TextStyle(color: _red, fontSize: 12, fontWeight: FontWeight.w500))),
      ]),
    );
  }

  // ── TAB 2: History ───────────────────────────────────────────
  Widget _historyTab(KarikarState state) {
    final done = state.jobCards.where((j) {
      final s = (j['status'] ?? '').toString().toUpperCase();
      return s == 'RECEIVED' || s == 'COMPLETED' || s == 'CLOSED';
    }).toList();

    return DefaultTabController(
      length: 3,
      child: Column(children: [
        Container(
          color: _surface,
          child: TabBar(
            indicatorColor: _gold,
            indicatorWeight: 2.5,
            labelColor: _gold,
            unselectedLabelColor: _muted,
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 10, letterSpacing: 0.6),
            dividerColor: _divider,
            tabs: const [
              Tab(text: 'METAL RETURNS', icon: Icon(Icons.scale_outlined, size: 16)),
              Tab(text: 'WASTAGE',       icon: Icon(Icons.history_toggle_off_outlined, size: 16)),
              Tab(text: 'COMPLETED',     icon: Icon(Icons.done_all_outlined, size: 16)),
            ],
          ),
        ),
        Expanded(child: Container(
          color: _bg,
          child: TabBarView(children: [
            _returnsList(state.metalReturns),
            _wastageList(state.wastageReconciliations),
            _doneList(done),
          ]),
        )),
      ]),
    );
  }

  Widget _returnsList(List<dynamic> list) {
    if (list.isEmpty) return _histEmpty('No metal return logs yet.');
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: list.length,
      itemBuilder: (_, i) {
        final r = list[i];
        final wt = (r['weight'] ?? 0).toDouble();
        final st = (r['status'] ?? 'COMPLETED').toString().toUpperCase();
        return _histCard(
          icon: Icons.scale, iconColor: _gold, iconBg: _goldLt,
          title: '${wt.toStringAsFixed(3)}g (${r['purity'] ?? '22K'}) Returned',
          sub: '${r['note'] ?? 'Gold return'} · ${_shortDate(r['returnedAt'] ?? r['createdAt'])}',
          badge: st, badgeColor: st == 'PENDING' ? _amber : _green, badgeBg: st == 'PENDING' ? _amberLt : _greenLt,
        );
      },
    );
  }

  Widget _wastageList(List<dynamic> list) {
    if (list.isEmpty) return _histEmpty('No wastage claims yet.');
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: list.length,
      itemBuilder: (_, i) {
        final c = list[i];
        final st = (c['status'] ?? 'PENDING').toString().toUpperCase();
        final approved = st == 'APPROVED';
        return _histCard(
          icon: Icons.warning_amber_rounded, iconColor: _amber, iconBg: _amberLt,
          title: 'Order #${c['orderId'] ?? 'N/A'} – Wastage Claim',
          sub: 'Issued: ${(c['requestedWeight'] ?? 0).toStringAsFixed(2)}g · Loss: ${(c['actualWastage'] ?? 0).toStringAsFixed(2)}g · ${_shortDate(c['createdAt'])}',
          badge: st, badgeColor: approved ? _green : _amber, badgeBg: approved ? _greenLt : _amberLt,
        );
      },
    );
  }

  Widget _doneList(List<dynamic> list) {
    if (list.isEmpty) return _histEmpty('No completed jobs yet.');
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: list.length,
      itemBuilder: (_, i) {
        final j = list[i];
        final wt = (j['issuedGoldWeight'] ?? j['weight'] ?? 0).toDouble();
        return _histCard(
          icon: Icons.verified_outlined, iconColor: _green, iconBg: _greenLt,
          title: 'Job Order #${j['orderId'] ?? j['_id'] ?? 'N/A'}',
          sub: '${j['jewelryType'] ?? 'Jewelry'} (${j['purity'] ?? '22K'}) · ${wt.toStringAsFixed(3)}g',
          badge: 'DONE', badgeColor: _green, badgeBg: _greenLt,
        );
      },
    );
  }

  Widget _histCard({required IconData icon, required Color iconColor, required Color iconBg,
      required String title, required String sub,
      required String badge, required Color badgeColor, required Color badgeBg}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: _divider),
          boxShadow: const [BoxShadow(color: Color(0x05000000), blurRadius: 8, offset: Offset(0, 2))]),
      child: Row(children: [
        Container(padding: const EdgeInsets.all(9), decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
            child: Icon(icon, color: iconColor, size: 18)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(color: _ink, fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 3),
          Text(sub, style: const TextStyle(color: _muted, fontSize: 11)),
        ])),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(8)),
          child: Text(badge, style: TextStyle(color: badgeColor, fontSize: 9, fontWeight: FontWeight.bold)),
        ),
      ]),
    );
  }

  Widget _histEmpty(String msg) {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.inbox_outlined, color: _divider, size: 52),
      const SizedBox(height: 12),
      Text(msg, style: const TextStyle(color: _muted, fontSize: 13)),
    ]));
  }

  // ── TAB 3: Profile ───────────────────────────────────────────
  Widget _profileTab(KarikarState state) {
    final p = state.profile ?? state.selfServiceData?['karikar'] ?? <String, dynamic>{};
    final skills = (p['skills'] as List<dynamic>?)?.map((s) => s.toString()).toList() ?? <String>[];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(children: [
        // Hero card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
          decoration: BoxDecoration(
            color: _surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: _divider),
            boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 16, offset: Offset(0, 4))],
          ),
          child: Column(children: [
            Container(
              width: 72, height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(colors: [_gold, _goldDeep], begin: Alignment.topLeft, end: Alignment.bottomRight),
                boxShadow: [BoxShadow(color: _gold.withValues(alpha: 0.35), blurRadius: 16, offset: const Offset(0, 6))],
              ),
              child: Center(child: Text(
                ((p['name'] ?? 'A') as String).isNotEmpty ? ((p['name'] ?? 'A') as String)[0].toUpperCase() : 'A',
                style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.bold),
              )),
            ),
            const SizedBox(height: 14),
            Text((p['name'] ?? 'Master Artisan').toString().toUpperCase(),
                style: const TextStyle(color: _ink, fontWeight: FontWeight.bold, fontSize: 17, fontFamily: 'serif', letterSpacing: 1.2)),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
              decoration: BoxDecoration(color: _goldLt, borderRadius: BorderRadius.circular(20)),
              child: Text(p['specialization'] ?? 'Master Craftsman', style: const TextStyle(color: _goldDeep, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ]),
        ),
        const SizedBox(height: 16),

        // Details
        _profileCard('Contact Details', [
          _pRow(Icons.email_outlined,         'Email',             p['email']            ?? '—'),
          _pRow(Icons.phone_android_outlined,  'Phone',             p['phone']            ?? '—'),
          _pRow(Icons.contact_phone_outlined,  'Emergency Contact', p['emergencyContact'] ?? 'Not set'),
          _pRow(Icons.location_on_outlined,    'Address',           p['address']          ?? '—'),
        ]),
        if (skills.isNotEmpty) ...[
          const SizedBox(height: 14),
          _profileCard('Certified Skills', [
            Wrap(spacing: 8, runSpacing: 6, children: skills.map((s) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: _goldLt, borderRadius: BorderRadius.circular(12), border: Border.all(color: _gold.withValues(alpha: 0.3))),
              child: Text(s, style: const TextStyle(color: _goldDeep, fontSize: 11, fontWeight: FontWeight.bold)),
            )).toList()),
          ]),
        ],
        if (state.sessions.isNotEmpty) ...[
          const SizedBox(height: 14),
          _profileCard('Active Sessions', state.sessions.take(2).map((s) =>
            _pRow(Icons.devices_outlined, 'IP: ${s['ip'] ?? 'Local'}', 'Last seen: ${_shortDate(s['lastSeenAt'])}')
          ).toList()),
        ],
        const SizedBox(height: 20),
        _profileBtn(Icons.edit_note_outlined, 'Update Contact Info', _gold,       () => _editProfileDialog(p)),
        const SizedBox(height: 10),
        _profileBtn(Icons.vpn_key_outlined,   'Change Password',     _red,        _changePasswordDialog),
      ]),
    );
  }

  Widget _profileCard(String title, List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: _surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: _divider),
          boxShadow: const [BoxShadow(color: Color(0x05000000), blurRadius: 10, offset: Offset(0, 3))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 3, height: 16, decoration: BoxDecoration(gradient: const LinearGradient(colors: [_gold, _goldDeep], begin: Alignment.topCenter, end: Alignment.bottomCenter), borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 8),
          Text(title, style: const TextStyle(color: _ink, fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 0.3)),
        ]),
        const SizedBox(height: 16),
        ...children,
      ]),
    );
  }

  Widget _pRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: _goldLt, borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, size: 16, color: _gold)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: _muted, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.4)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(color: _ink, fontSize: 13, fontWeight: FontWeight.w600)),
        ])),
      ]),
    );
  }

  Widget _profileBtn(IconData icon, String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.35)),
          boxShadow: const [BoxShadow(color: Color(0x05000000), blurRadius: 8, offset: Offset(0, 2))],
        ),
        child: Row(children: [
          Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: color, size: 20)),
          const SizedBox(width: 14),
          Expanded(child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14))),
          Icon(Icons.arrow_forward_ios_rounded, color: color.withValues(alpha: 0.4), size: 14),
        ]),
      ),
    );
  }

  // ── Notifications Sheet ───────────────────────────────────────
  void _notifSheet(List<dynamic> notifs) {
    showModalBottomSheet(
      context: context,
      backgroundColor: _surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
        return DraggableScrollableSheet(
          initialChildSize: 0.55,
          minChildSize: 0.3,
          maxChildSize: 0.85,
          expand: false,
          builder: (_, sc) => Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
            child: Column(children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(color: _divider, borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 20),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Row(children: const [
                  Icon(Icons.notifications_active, color: _gold, size: 22),
                  SizedBox(width: 10),
                  Text('Notifications', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: _ink, fontFamily: 'serif')),
                ]),
                if (notifs.isNotEmpty) TextButton(
                  onPressed: () async {
                    final ok = await ref.read(karikarProvider.notifier).markNotificationsRead();
                    if (ok) { set(() { notifs = []; }); Navigator.pop(ctx); _snack('All marked as read!'); }
                  },
                  child: const Text('Mark Read', style: TextStyle(color: _gold, fontWeight: FontWeight.bold, fontSize: 12)),
                ),
              ]),
              const SizedBox(height: 12),
              const Divider(color: _divider),
              const SizedBox(height: 8),
              if (notifs.isEmpty)
                Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: const [
                  Icon(Icons.notifications_off_outlined, color: _divider, size: 52),
                  SizedBox(height: 12),
                  Text('No unread notifications', style: TextStyle(color: _muted, fontSize: 14)),
                ]))
              else
                Expanded(child: ListView.builder(
                  controller: sc,
                  itemCount: notifs.length,
                  itemBuilder: (_, i) {
                    final n = notifs[i];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: _divider)),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: _goldLt, shape: BoxShape.circle),
                            child: const Icon(Icons.info_outline, color: _gold, size: 16)),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(n['message'] ?? 'Alert received.', style: const TextStyle(color: _ink, fontSize: 12, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 3),
                          Text(_shortDate(n['createdAt']), style: const TextStyle(color: _muted, fontSize: 10)),
                        ])),
                      ]),
                    );
                  },
                )),
            ]),
          ),
        );
      }),
    );
  }
}
