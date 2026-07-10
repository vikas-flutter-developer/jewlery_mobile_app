import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/karikar_provider.dart';

// ─── Design Tokens ───────────────────────────────────────────
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
const _blue     = Color(0xFF2B72C8);
const _blueLt   = Color(0xFFE0ECFF);

/// ─── Pending Metal Detail Screen ─────────────────────────────
class PendingMetalScreen extends ConsumerWidget {
  const PendingMetalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(karikarProvider);
    final jobs  = state.jobCards;

    final active = jobs.where((j) {
      final s = (j['status'] ?? '').toString().toUpperCase();
      return s != 'RECEIVED' && s != 'COMPLETED' && s != 'CLOSED';
    }).toList();

    double totalIssued = 0;
    for (final j in active) totalIssued += (j['issuedGoldWeight'] ?? j['weight'] ?? 0).toDouble();

    double totalReturned = 0;
    for (final r in state.metalReturns) totalReturned += (r['weight'] ?? 0).toDouble();

    final netPending = state.goldStock;

    // Purity breakdown
    final Map<String, double> byPurity = {};
    for (final j in active) {
      final p  = j['purity'] ?? j['issuedPurity'] ?? '22K';
      byPurity[p] = (byPurity[p] ?? 0) + (j['issuedGoldWeight'] ?? j['weight'] ?? 0).toDouble();
    }

    return Scaffold(
      backgroundColor: _bg,
      appBar: _appBar(context, 'Pending Metal'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

          // Hero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6B4012), _goldDeep, _gold],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [BoxShadow(color: _gold.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8))],
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(14)),
                  child: const Icon(Icons.scale_outlined, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                const Text('PENDING METAL', style: TextStyle(color: Colors.white60, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
              ]),
              const SizedBox(height: 16),
              Text('${netPending.toStringAsFixed(3)} g',
                  style: const TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.bold, fontFamily: 'serif')),
              const SizedBox(height: 4),
              const Text('Net metal in your possession', style: TextStyle(color: Colors.white60, fontSize: 12)),
              const SizedBox(height: 20),
              Row(children: [
                _heroPill(Icons.arrow_downward_rounded, 'Issued', '${totalIssued.toStringAsFixed(3)} g'),
                const SizedBox(width: 10),
                _heroPill(Icons.arrow_upward_rounded, 'Returned', '${totalReturned.toStringAsFixed(3)} g'),
                const SizedBox(width: 10),
                _heroPill(Icons.hourglass_bottom_rounded, 'Net', '${netPending.toStringAsFixed(3)} g'),
              ]),
            ]),
          ),
          const SizedBox(height: 24),

          // Quick stat chips
          Row(children: [
            Expanded(child: _miniStatCard('Active Orders', '${active.length}', Icons.engineering_outlined, _gold, _goldLt)),
            const SizedBox(width: 12),
            Expanded(child: _miniStatCard('Purities', '${byPurity.length}', Icons.layers_outlined, _blue, _blueLt)),
            const SizedBox(width: 12),
            Expanded(child: _miniStatCard('Returns', '${state.metalReturns.length}', Icons.assignment_return_outlined, _green, _greenLt)),
          ]),
          const SizedBox(height: 24),

          // Purity breakdown
          if (byPurity.isNotEmpty) ...[
            _secHeader(Icons.analytics_outlined, 'Metal by Purity'),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: _cardDeco(),
              child: Column(children: byPurity.entries.map((e) {
                final pct = totalIssued > 0 ? e.value / totalIssued : 0.0;
                return _purityBar(e.key, e.value, pct, totalIssued);
              }).toList()),
            ),
            const SizedBox(height: 24),
          ],

          // Active Work Orders
          _secHeader(Icons.list_alt_outlined, 'Active Work Orders (${active.length})'),
          const SizedBox(height: 12),
          if (active.isEmpty)
            _emptyCard(Icons.engineering_outlined, 'No active orders with issued metal.')
          else
            ...active.asMap().entries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _jobDetailCard(e.value, e.key),
            )),
          const SizedBox(height: 24),

          // Metal Return History
          _secHeader(Icons.history_outlined, 'Metal Returns (${state.metalReturns.length})'),
          const SizedBox(height: 12),
          if (state.metalReturns.isEmpty)
            _emptyCard(Icons.scale_outlined, 'No metal returns recorded yet.')
          else
            ...state.metalReturns.map((r) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _returnDetailCard(r),
            )),
        ]),
      ),
    );
  }

  Widget _heroPill(IconData icon, String label, String val) {
    return Expanded(child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Icon(icon, color: Colors.white60, size: 12), const SizedBox(width: 4), Text(label, style: const TextStyle(color: Colors.white60, fontSize: 9, fontWeight: FontWeight.bold))]),
        const SizedBox(height: 4),
        Text(val, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
      ]),
    ));
  }

  Widget _miniStatCard(String label, String value, IconData icon, Color accent, Color bg) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _cardDeco(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: accent, size: 16)),
        const SizedBox(height: 10),
        Text(value, style: TextStyle(color: accent, fontSize: 20, fontWeight: FontWeight.bold)),
        Text(label, style: const TextStyle(color: _muted, fontSize: 10)),
      ]),
    );
  }

  Widget _purityBar(String purity, double weight, double pct, double total) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(children: [
            Container(width: 10, height: 10, decoration: BoxDecoration(color: _gold, shape: BoxShape.circle)),
            const SizedBox(width: 8),
            Text(purity, style: const TextStyle(color: _ink, fontWeight: FontWeight.bold, fontSize: 14)),
          ]),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${weight.toStringAsFixed(3)} g', style: const TextStyle(color: _goldDeep, fontWeight: FontWeight.bold, fontSize: 14)),
            Text('${(pct * 100).toStringAsFixed(1)}% of total', style: const TextStyle(color: _muted, fontSize: 10)),
          ]),
        ]),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: pct, minHeight: 8,
            backgroundColor: _goldLt,
            valueColor: const AlwaysStoppedAnimation<Color>(_gold),
          ),
        ),
      ]),
    );
  }

  Widget _jobDetailCard(Map<String, dynamic> job, int idx) {
    final id     = job['orderId'] ?? job['_id'] ?? 'N/A';
    final type   = job['jewelryType'] ?? job['category'] ?? 'Jewelry';
    final purity = job['purity'] ?? job['issuedPurity'] ?? '22K';
    final wt     = (job['issuedGoldWeight'] ?? job['weight'] ?? 0).toDouble();
    final due    = (job['dueDate'] ?? '').toString();
    final status = (job['status'] ?? 'OPEN').toString().toUpperCase();
    final sc     = _statusClr(status);
    final sbg    = _statusBg(status);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDeco(),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: _goldLt, shape: BoxShape.circle,
              border: Border.all(color: _gold.withValues(alpha: 0.35))),
          child: Center(child: Text('${idx + 1}', style: const TextStyle(color: _goldDeep, fontWeight: FontWeight.bold, fontSize: 16))),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Order #$id', style: const TextStyle(color: _ink, fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 2),
          Text('$type · $purity', style: const TextStyle(color: _muted, fontSize: 12)),
          if (due.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(children: [
              const Icon(Icons.calendar_today_outlined, size: 11, color: _muted),
              const SizedBox(width: 4),
              Text('Due: ${due.length > 10 ? due.substring(0, 10) : due}', style: const TextStyle(color: _muted, fontSize: 11)),
            ]),
          ],
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('${wt.toStringAsFixed(3)} g', style: const TextStyle(color: _gold, fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: sbg, borderRadius: BorderRadius.circular(8)),
            child: Text(status, style: TextStyle(color: sc, fontSize: 9, fontWeight: FontWeight.bold)),
          ),
        ]),
      ]),
    );
  }

  Widget _returnDetailCard(Map<String, dynamic> r) {
    final wt   = (r['weight'] ?? 0).toDouble();
    final pur  = r['purity'] ?? '22K';
    final note = r['note'] ?? 'Gold metal return';
    final date = _sDate(r['returnedAt'] ?? r['createdAt']);
    final st   = (r['status'] ?? 'COMPLETED').toString().toUpperCase();
    final isPending = st == 'PENDING';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDeco(),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: isPending ? _amberLt : _greenLt, shape: BoxShape.circle),
          child: Icon(Icons.arrow_upward_rounded, color: isPending ? _amber : _green, size: 18),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${wt.toStringAsFixed(3)} g ($pur)', style: const TextStyle(color: _ink, fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 3),
          Text(note, style: const TextStyle(color: _muted, fontSize: 12)),
          const SizedBox(height: 3),
          Row(children: [
            const Icon(Icons.calendar_today_outlined, size: 11, color: _muted),
            const SizedBox(width: 4),
            Text(date, style: const TextStyle(color: _muted, fontSize: 11)),
          ]),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(color: isPending ? _amberLt : _greenLt, borderRadius: BorderRadius.circular(8)),
          child: Text(st, style: TextStyle(color: isPending ? _amber : _green, fontSize: 9, fontWeight: FontWeight.bold)),
        ),
      ]),
    );
  }
}

/// ─── Ledger Balance Detail Screen ─────────────────────────────
class LedgerBalanceScreen extends ConsumerWidget {
  const LedgerBalanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state   = ref.watch(karikarProvider);
    final balance = state.ledgerBalance;
    final wageLogs = state.wageLedgers;

    // Compute totals from wage ledgers
    double totalEarned = 0, totalDeducted = 0, totalPaid = 0, totalPending = 0;
    for (final w in wageLogs) {
      final amt    = (w['amount'] ?? w['netPayable'] ?? w['totalWage'] ?? 0).toDouble();
      final status = (w['status'] ?? '').toString().toLowerCase();
      totalEarned += amt;
      if (status == 'paid') totalPaid += amt;
      else totalPending += amt;
      totalDeducted += (w['tdsDeducted'] ?? w['deduction'] ?? 0).toDouble();
    }

    // Build synthetic ledger from job cards when wageLogs empty
    final jobs = state.jobCards;
    final synthEntries = _buildSynthEntries(state, wageLogs);

    return Scaffold(
      backgroundColor: _bg,
      appBar: _appBar(context, 'Ledger Balance'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

          // Hero
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0B3324), _green, Color(0xFF2DB56A)],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [BoxShadow(color: _green.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8))],
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(14)),
                  child: const Icon(Icons.account_balance_wallet_outlined, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                const Text('LEDGER BALANCE', style: TextStyle(color: Colors.white60, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
              ]),
              const SizedBox(height: 16),
              Text('₹${_fmtFull(balance)}',
                  style: const TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.bold, fontFamily: 'serif')),
              const SizedBox(height: 4),
              Text(balance >= 0 ? 'Amount payable to you' : 'Outstanding dues',
                  style: const TextStyle(color: Colors.white60, fontSize: 12)),
              const SizedBox(height: 20),
              Row(children: [
                _heroPill2(Icons.payments_outlined,        'Total Earned', _fmtFull(totalEarned > 0 ? totalEarned : balance)),
                const SizedBox(width: 10),
                _heroPill2(Icons.check_circle_outline,     'Paid Out',     _fmtFull(totalPaid)),
                const SizedBox(width: 10),
                _heroPill2(Icons.pending_outlined,         'Pending',      _fmtFull(totalPending > 0 ? totalPending : balance)),
              ]),
            ]),
          ),
          const SizedBox(height: 24),

          // Summary cards
          Row(children: [
            Expanded(child: _miniCard('Total Earned',  '₹${_fmt(totalEarned > 0 ? totalEarned : balance)}', Icons.trending_up_rounded, _green, _greenLt)),
            const SizedBox(width: 12),
            Expanded(child: _miniCard('TDS Deducted', '₹${_fmt(totalDeducted)}', Icons.percent_rounded, _amber, _amberLt)),
            const SizedBox(width: 12),
            Expanded(child: _miniCard('Pending Pay',  '₹${_fmt(totalPending > 0 ? totalPending : balance)}', Icons.hourglass_bottom_rounded, _blue, _blueLt)),
          ]),
          const SizedBox(height: 24),

          // Wage Ledger Entries
          _secHeader(Icons.receipt_long_outlined, wageLogs.isNotEmpty
              ? 'Wage Ledger Entries (${wageLogs.length})'
              : 'Payment Activity (${synthEntries.length})'),
          const SizedBox(height: 12),
          if (synthEntries.isEmpty)
            _emptyCard(Icons.receipt_outlined, 'No payment entries found.')
          else
            ...synthEntries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ledgerRow(e),
            )),

          const SizedBox(height: 24),

          // Job-wise earnings breakdown
          if (jobs.isNotEmpty) ...[
            _secHeader(Icons.work_outline_rounded, 'Job-wise Earnings (${jobs.length} orders)'),
            const SizedBox(height: 12),
            ...jobs.take(8).toList().asMap().entries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _jobEarningCard(e.value, e.key),
            )),
          ],
        ]),
      ),
    );
  }

  /// Build synthetic entries from whatever data we have
  List<Map<String, dynamic>> _buildSynthEntries(KarikarState state, List<dynamic> wageLogs) {
    if (wageLogs.isNotEmpty) return wageLogs.cast<Map<String, dynamic>>();

    final result = <Map<String, dynamic>>[];
    final jobs = state.jobCards;

    // Derive payment entries from job cards
    for (final j in jobs) {
      final wt     = (j['issuedGoldWeight'] ?? j['weight'] ?? 0).toDouble();
      final purity = j['purity'] ?? '22K';
      final id     = j['orderId'] ?? j['_id'] ?? 'N/A';
      final status = (j['status'] ?? '').toString().toUpperCase();
      // Rough wage estimate (₹350/g as karigar fee)
      final estimated = wt * 350;
      result.add({
        'type': 'credit',
        'description': 'Karigar fee – Order #$id ($purity)',
        'amount': estimated,
        'status': status == 'COMPLETED' || status == 'RECEIVED' ? 'PAID' : 'PENDING',
        'date': j['dueDate'] ?? j['createdAt'] ?? DateTime.now().toIso8601String(),
        'referenceNo': 'JB-$id',
      });
    }

    // Add balance as a credit if no jobs
    if (result.isEmpty && state.ledgerBalance != 0) {
      result.add({
        'type': 'credit',
        'description': 'Karigar wage balance',
        'amount': state.ledgerBalance,
        'status': 'PENDING',
        'date': DateTime.now().toIso8601String(),
        'referenceNo': 'WLG-001',
      });
    }

    return result;
  }

  Widget _heroPill2(IconData icon, String label, String val) {
    return Expanded(child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Icon(icon, color: Colors.white60, size: 12), const SizedBox(width: 4), Text(label, style: const TextStyle(color: Colors.white60, fontSize: 9, fontWeight: FontWeight.bold))]),
        const SizedBox(height: 4),
        Text('₹$val', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
      ]),
    ));
  }

  Widget _miniCard(String label, String value, IconData icon, Color accent, Color bg) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _cardDeco(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(padding: const EdgeInsets.all(7), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: accent, size: 16)),
        const SizedBox(height: 10),
        Text(value, style: TextStyle(color: accent, fontSize: 16, fontWeight: FontWeight.bold)),
        Text(label, style: const TextStyle(color: _muted, fontSize: 9)),
      ]),
    );
  }

  Widget _ledgerRow(Map<String, dynamic> entry) {
    final amt    = (entry['amount'] ?? entry['netPayable'] ?? entry['totalWage'] ?? 0).toDouble();
    final type   = (entry['type'] ?? entry['transactionType'] ?? 'credit').toString().toLowerCase();
    final isCredit = type == 'credit';
    final status = (entry['status'] ?? 'PENDING').toString().toUpperCase();
    final desc   = entry['description'] ?? entry['note'] ?? 'Wage payment';
    final ref    = entry['referenceNo'] ?? entry['reference'] ?? '';
    final date   = _sDate(entry['date'] ?? entry['createdAt']);
    final tds    = (entry['tdsDeducted'] ?? entry['deduction'] ?? 0).toDouble();
    final isPaid = status == 'PAID' || status == 'APPROVED';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isPaid ? _green.withValues(alpha: 0.2) : _divider),
        boxShadow: const [BoxShadow(color: Color(0x05000000), blurRadius: 8, offset: Offset(0, 2))],
      ),
      child: Column(children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: isCredit ? _greenLt : _redLt, shape: BoxShape.circle),
            child: Icon(isCredit ? Icons.add_rounded : Icons.remove_rounded,
                color: isCredit ? _green : _red, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(desc, style: const TextStyle(color: _ink, fontWeight: FontWeight.bold, fontSize: 13),
                maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 3),
            Row(children: [
              if (ref.isNotEmpty) ...[
                const Icon(Icons.tag_rounded, size: 11, color: _muted),
                const SizedBox(width: 3),
                Text(ref, style: const TextStyle(color: _muted, fontSize: 11)),
                const SizedBox(width: 8),
              ],
              const Icon(Icons.calendar_today_outlined, size: 11, color: _muted),
              const SizedBox(width: 3),
              Text(date, style: const TextStyle(color: _muted, fontSize: 11)),
            ]),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${isCredit ? '+' : '-'}₹${_fmtFull(amt)}',
                style: TextStyle(color: isCredit ? _green : _red, fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: isPaid ? _greenLt : _amberLt,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(status, style: TextStyle(color: isPaid ? _green : _amber, fontSize: 9, fontWeight: FontWeight.bold)),
            ),
          ]),
        ]),
        if (tds > 0) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(10)),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Row(children: [
                Icon(Icons.percent_rounded, size: 14, color: _amber),
                SizedBox(width: 6),
                Text('TDS Deducted', style: TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w500)),
              ]),
              Text('-₹${_fmtFull(tds)}', style: const TextStyle(color: _amber, fontWeight: FontWeight.bold, fontSize: 12)),
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _jobEarningCard(Map<String, dynamic> job, int idx) {
    final id     = job['orderId'] ?? job['_id'] ?? 'N/A';
    final type   = job['jewelryType'] ?? job['category'] ?? 'Jewelry';
    final purity = job['purity'] ?? '22K';
    final wt     = (job['issuedGoldWeight'] ?? job['weight'] ?? 0).toDouble();
    final status = (job['status'] ?? '').toString().toUpperCase();
    final estimated = wt * 350; // ₹350/g karigar fee estimate
    final isPaid  = status == 'COMPLETED' || status == 'RECEIVED' || status == 'CLOSED';
    final sc      = isPaid ? _green : _amber;
    final sbg     = isPaid ? _greenLt : _amberLt;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDeco(),
      child: Row(children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(color: _goldLt, shape: BoxShape.circle,
              border: Border.all(color: _gold.withValues(alpha: 0.3))),
          child: Center(child: Text('${idx + 1}', style: const TextStyle(color: _goldDeep, fontWeight: FontWeight.bold, fontSize: 14))),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Order #$id', style: const TextStyle(color: _ink, fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 2),
          Text('$type · $purity · ${wt.toStringAsFixed(3)}g', style: const TextStyle(color: _muted, fontSize: 11)),
          const SizedBox(height: 4),
          Row(children: [
            const Text('Est. Fee: ', style: TextStyle(color: _muted, fontSize: 11)),
            Text('₹${_fmtFull(estimated)}', style: const TextStyle(color: _goldDeep, fontWeight: FontWeight.bold, fontSize: 11)),
            const Text(' (₹350/g)', style: TextStyle(color: _muted, fontSize: 10)),
          ]),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(color: sbg, borderRadius: BorderRadius.circular(8)),
          child: Text(isPaid ? 'PAID' : 'PENDING', style: TextStyle(color: sc, fontSize: 9, fontWeight: FontWeight.bold)),
        ),
      ]),
    );
  }

  static String _fmt(double n) {
    if (n.abs() >= 100000) return '${(n / 100000).toStringAsFixed(2)}L';
    if (n.abs() >= 1000)   return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toStringAsFixed(2);
  }
}

// ─── Shared helpers ───────────────────────────────────────────
AppBar _appBar(BuildContext context, String title) {
  return AppBar(
    backgroundColor: _surface,
    foregroundColor: _ink,
    elevation: 0,
    scrolledUnderElevation: 0,
    surfaceTintColor: _surface,
    leading: IconButton(
      icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
      onPressed: () => Navigator.pop(context),
    ),
    title: Text(title, style: const TextStyle(color: _ink, fontWeight: FontWeight.bold, fontSize: 18, fontFamily: 'serif')),
    bottom: PreferredSize(
      preferredSize: const Size.fromHeight(1),
      child: Container(height: 1, color: _divider),
    ),
  );
}

Widget _secHeader(IconData icon, String title) {
  return Row(children: [
    Icon(icon, color: _gold, size: 18),
    const SizedBox(width: 8),
    Expanded(
      child: Text(title, style: const TextStyle(color: _ink, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'serif')),
    ),
    const SizedBox(width: 8),
    Container(height: 1, width: 40, color: _divider),
  ]);
}

Widget _emptyCard(IconData icon, String msg) {
  return Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: 40),
    decoration: _cardDeco(),
    child: Column(children: [
      Icon(icon, size: 44, color: _divider),
      const SizedBox(height: 12),
      Text(msg, style: const TextStyle(color: _muted, fontSize: 13)),
    ]),
  );
}

BoxDecoration _cardDeco() => BoxDecoration(
  color: _surface,
  borderRadius: BorderRadius.circular(18),
  border: Border.all(color: _divider),
  boxShadow: const [BoxShadow(color: Color(0x06000000), blurRadius: 10, offset: Offset(0, 3))],
);

Color _statusClr(String s) {
  if (s.contains('PROGRESS') || s.contains('ACTIVE') || s.contains('OPEN')) return _amber;
  if (s.contains('COMPLETED') || s.contains('RECEIVED') || s.contains('CLOSED')) return _green;
  if (s.contains('DELAY') || s.contains('REJECT')) return _red;
  return _gold;
}

Color _statusBg(String s) {
  if (s.contains('PROGRESS') || s.contains('ACTIVE') || s.contains('OPEN')) return _amberLt;
  if (s.contains('COMPLETED') || s.contains('RECEIVED') || s.contains('CLOSED')) return _greenLt;
  if (s.contains('DELAY') || s.contains('REJECT')) return _redLt;
  return _goldLt;
}

String _sDate(dynamic d) {
  if (d == null) return 'N/A';
  final s = d.toString();
  return s.contains('T') ? s.substring(0, 10) : s;
}

String _fmtFull(double n) {
  if (n.abs() >= 10000000) return '${(n / 10000000).toStringAsFixed(2)} Cr';
  if (n.abs() >= 100000)   return '${(n / 100000).toStringAsFixed(2)} L';
  if (n.abs() >= 1000)     return '${(n / 1000).toStringAsFixed(2)}K';
  return n.toStringAsFixed(2);
}
