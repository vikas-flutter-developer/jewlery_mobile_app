import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/admin_provider.dart';

class SecurityLogsScreen extends ConsumerStatefulWidget {
  const SecurityLogsScreen({super.key});

  @override
  ConsumerState<SecurityLogsScreen> createState() => _SecurityLogsScreenState();
}

class _SecurityLogsScreenState extends ConsumerState<SecurityLogsScreen> {
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchAuditLogs();
  }

  Future<void> _fetchAuditLogs() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await ref.read(adminProvider.notifier).fetchUserActionLogs();
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load audit logs: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final logs = ref.watch(adminProvider).userActionLogs;

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
          'SECURITY AUDIT LOG',
          style: TextStyle(
            color: AppTheme.goldDark,
            fontFamily: 'serif',
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppTheme.goldDark),
            onPressed: _fetchAuditLogs,
          )
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            if (_isLoading)
              const Expanded(child: Center(child: CircularProgressIndicator(color: AppTheme.goldDark)))
            else if (_errorMessage != null)
              Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold))
            else if (logs.isEmpty)
              const Expanded(
                child: Center(
                  child: Text('No system activity logs found.', style: TextStyle(color: Colors.black38)),
                ),
              )
            else
              Expanded(
                child: ListView.builder(
                  itemCount: logs.length,
                  itemBuilder: (context, index) {
                    final log = logs[index];
                    final action = log['actionType'] ?? log['action'] ?? 'MUTATION';
                    final actor = log['performedBy'] ?? log['actor'] ?? 'System';
                    final status = log['status'] ?? 'SUCCESS';
                    final date = log['createdAt'] ?? log['timestamp'] ?? '';
                    final isFailed = status == 'FAILED' || status == 'FAILURE';

                    return Card(
                      color: Colors.white,
                      elevation: 0,
                      margin: const EdgeInsets.symmetric(vertical: 6),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFECE6DF)),
                      ),
                      child: ListTile(
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: isFailed ? Colors.redAccent.withOpacity(0.08) : Colors.green.withOpacity(0.08),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isFailed ? Icons.gpp_bad_rounded : Icons.gpp_good_rounded,
                            color: isFailed ? Colors.redAccent : Colors.green,
                          ),
                        ),
                        title: Text(action, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF2E2A25))),
                        subtitle: Text('By: $actor • ${date.split('T').first}'),
                        trailing: Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Colors.grey.shade400),
                        onTap: () => _showLogDetail(log),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showLogDetail(Map<String, dynamic> log) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('AUDIT LOG DETAILS', style: TextStyle(fontFamily: 'serif', fontWeight: FontWeight.bold, color: AppTheme.goldDark, fontSize: 15)),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildField('Event ID', log['logId'] ?? log['_id'] ?? 'N/A'),
                _buildField('Action / Event', log['actionType'] ?? log['action'] ?? 'N/A'),
                _buildField('Performed By', log['performedBy'] ?? log['actor'] ?? 'N/A'),
                _buildField('Status', log['status'] ?? 'N/A'),
                _buildField('Entity ID / Ref', log['entityId'] ?? 'N/A'),
                _buildField('Description', log['message'] ?? log['details']?.toString() ?? 'N/A'),
              ],
            ),
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark),
              child: const Text('CLOSE', style: TextStyle(color: Colors.white)),
              onPressed: () => Navigator.pop(context),
            )
          ],
        );
      },
    );
  }

  Widget _buildField(String label, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: Colors.black45, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(val, style: const TextStyle(fontSize: 13, color: Color(0xFF2E2A25))),
        ],
      ),
    );
  }
}
