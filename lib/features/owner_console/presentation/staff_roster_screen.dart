import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/admin_provider.dart';
import 'karikar_details_dialog.dart';

class StaffRosterScreen extends ConsumerStatefulWidget {
  const StaffRosterScreen({super.key});

  @override
  ConsumerState<StaffRosterScreen> createState() => _StaffRosterScreenState();
}

class _StaffRosterScreenState extends ConsumerState<StaffRosterScreen> {
  final _startHourCtrl = TextEditingController();
  final _endHourCtrl = TextEditingController();
  
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  String _selectedRole = 'KARIKAR';

  @override
  void dispose() {
    _startHourCtrl.dispose();
    _endHourCtrl.dispose();
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  void _showEditShiftDialog(Map<String, dynamic> staffMember) {
    final schedule = staffMember['schedule'] as Map<String, dynamic>? ?? {};
    _startHourCtrl.text = schedule['shiftStart'] ?? '09:00 AM';
    _endHourCtrl.text = schedule['shiftEnd'] ?? '07:00 PM';

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFFF9F6F0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Text(
            'SCHEDULE SHIFT: ${staffMember['name'] ?? "Employee"}',
            style: const TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _startHourCtrl,
                decoration: const InputDecoration(labelText: 'Shift Start Time (e.g. 09:00 AM)', prefixIcon: Icon(Icons.access_time_outlined)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _endHourCtrl,
                decoration: const InputDecoration(labelText: 'Shift End Time (e.g. 07:00 PM)', prefixIcon: Icon(Icons.access_time_filled_outlined)),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('CANCEL', style: TextStyle(color: Colors.black45, fontWeight: FontWeight.bold)),
            ),
            ElevatedButton(
              onPressed: () async {
                final start = _startHourCtrl.text.trim();
                final end = _endHourCtrl.text.trim();
                if (start.isEmpty || end.isEmpty) return;

                final success = await ref.read(adminProvider.notifier).updateStaffSchedule(
                      (staffMember['_id'] ?? staffMember['id']).toString(),
                      start,
                      end,
                    );

                if (success) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Shift schedule updated!'), backgroundColor: AppTheme.goldDark),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
              child: const Text('UPDATE SHIFT', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _showAddStaffDialog() {
    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFFF9F6F0),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Text(
                'ONBOARD STAFF / ARTISAN',
                style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: _nameCtrl,
                      decoration: const InputDecoration(labelText: 'Full Name', prefixIcon: Icon(Icons.person_outline)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Email Address', prefixIcon: Icon(Icons.mail_outlined)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _passCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Login Password', prefixIcon: Icon(Icons.lock_outline)),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Phone Number', prefixIcon: Icon(Icons.phone_outlined)),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedRole,
                      decoration: const InputDecoration(labelText: 'Designation / Role'),
                      items: const [
                        DropdownMenuItem(value: 'KARIKAR', child: Text('Karigar (Goldsmith)')),
                        DropdownMenuItem(value: 'STORE_MANAGER', child: Text('Store Manager')),
                        DropdownMenuItem(value: 'SALES', child: Text('Sales Representative')),
                        DropdownMenuItem(value: 'CASHIER', child: Text('Cashier')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            _selectedRole = val;
                          });
                        }
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('CANCEL', style: TextStyle(color: Colors.black45, fontWeight: FontWeight.bold)),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final name = _nameCtrl.text.trim();
                    final email = _emailCtrl.text.trim();
                    final pass = _passCtrl.text.trim();
                    final phone = _phoneCtrl.text.trim();

                    if (name.isEmpty || email.isEmpty || pass.isEmpty || phone.isEmpty) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Please fill all fields correctly'), backgroundColor: Colors.redAccent),
                      );
                      return;
                    }

                    final success = await ref.read(adminProvider.notifier).createStaffMember(
                      name: name,
                      email: email,
                      password: pass,
                      role: _selectedRole,
                      phone: phone,
                    );

                    if (success) {
                      _nameCtrl.clear();
                      _emailCtrl.clear();
                      _passCtrl.clear();
                      _phoneCtrl.clear();
                      Navigator.pop(context);
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        const SnackBar(content: Text('Account Onboarded Successfully!'), backgroundColor: AppTheme.goldDark),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldDark, foregroundColor: Colors.white),
                  child: const Text('ONBOARD', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showSecurityActionsSheet(Map<String, dynamic> staffMember) {
    final name = staffMember['name'] ?? 'Employee';
    final userId = (staffMember['_id'] ?? staffMember['id']).toString();
    final isActive = staffMember['isActive'] ?? true;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFFF9F6F0),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SECURITY CONTROLS: $name',
                style: const TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.0),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Icon(isActive ? Icons.block : Icons.check_circle_outline, color: isActive ? Colors.redAccent : Colors.green),
                title: Text(isActive ? 'Block Staff Member' : 'Activate Staff Member'),
                subtitle: Text(isActive ? 'Suspend store & POS dashboard logins' : 'Re-enable store login access'),
                onTap: () {
                  Navigator.pop(ctx);
                  if (isActive) {
                    _showBlockReasonDialog(userId);
                  } else {
                    ref.read(adminProvider.notifier).activateUser(userId).then((ok) {
                      if (ok) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✓ Staff user activated!'), backgroundColor: Colors.green));
                      }
                    });
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.password, color: Colors.amber),
                title: const Text('Force Password Reset'),
                subtitle: const Text('Invalidate credentials and require password change'),
                onTap: () async {
                  Navigator.pop(ctx);
                  final ok = await ref.read(adminProvider.notifier).forcePasswordReset(userId);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(ok ? '✓ Password reset forced successfully!' : '✗ Failed to force reset.'),
                    backgroundColor: ok ? Colors.green : Colors.redAccent,
                  ));
                },
              ),
              ListTile(
                leading: const Icon(Icons.logout, color: Colors.blueAccent),
                title: const Text('Terminate Sessions'),
                subtitle: const Text('Log out from all linked devices and terminals'),
                onTap: () async {
                  Navigator.pop(ctx);
                  final ok = await ref.read(adminProvider.notifier).logoutAllSessions(userId);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(ok ? '✓ Dispatched terminate command. Sessions cleared!' : '✗ Failed to clear sessions.'),
                    backgroundColor: ok ? Colors.green : Colors.redAccent,
                  ));
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showBlockReasonDialog(String userId) {
    final reasonCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFFF9F6F0),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text('BLOCK USER ACCESS', style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 14, fontWeight: FontWeight.bold)),
          content: TextField(
            controller: reasonCtrl,
            decoration: const InputDecoration(labelText: 'Specify Reason for Suspension'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CANCEL')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
              onPressed: () async {
                if (reasonCtrl.text.trim().isEmpty) return;
                final ok = await ref.read(adminProvider.notifier).blockUser(userId, reasonCtrl.text.trim());
                if (ok) {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✓ User account suspended.'), backgroundColor: Colors.orange));
                }
              },
              child: const Text('BLOCK USER', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final adminState = ref.watch(adminProvider);
    final activeBranchCode = adminState.activeBranch?['code'] ?? 'MAIN';
    final staff = adminState.staff.where((s) => s['branchId'] == activeBranchCode).toList();

    // Simulated attendance sheet logs
    final mockAttendanceLogs = [
      { 'name': 'Aditya Mehta', 'role': 'STORE_MANAGER', 'date': 'Today', 'clockIn': '08:52 AM', 'status': 'ON TIME' },
      { 'name': 'Bhavesh Goldsmith', 'role': 'KARIKAR', 'date': 'Today', 'clockIn': '09:05 AM', 'status': 'ON TIME' },
      { 'name': 'Rajesh Sharma', 'role': 'RETAILER', 'date': 'Today', 'clockIn': '09:12 AM', 'status': 'ON TIME' },
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        title: const Text(
          'STAFF MANAGEMENT',
          style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1.0),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Roster list
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Showroom & Artisan Roster',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
                ),
                ElevatedButton.icon(
                  onPressed: _showAddStaffDialog,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.goldDark,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  icon: const Icon(Icons.add, size: 14),
                  label: const Text('ONBOARD STAFF', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (adminState.isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator(color: AppTheme.goldDark)),
              )
            else if (staff.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 36),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.badge_outlined, size: 36, color: Colors.black26),
                      SizedBox(height: 8),
                      Text('No staff members onboarded in this branch', style: TextStyle(color: Colors.black38, fontSize: 12)),
                    ],
                  ),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: staff.length,
                itemBuilder: (ctx, idx) {
                  final s = staff[idx];
                  final name = s['name'] ?? 'Employee';
                  final role = s['role'] ?? 'STAFF';
                  final email = s['email'] ?? '';
                  final schedule = s['schedule'] as Map<String, dynamic>? ?? {};
                  final shift = '${schedule['shiftStart'] ?? "09:00 AM"} - ${schedule['shiftEnd'] ?? "07:00 PM"}';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFECE6DF)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    name,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF2E2A25)),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppTheme.goldDark.withValues(alpha: 0.08),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      role,
                                      style: const TextStyle(color: AppTheme.goldDark, fontSize: 8, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(email, style: const TextStyle(color: Colors.black38, fontSize: 11)),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(Icons.schedule, size: 12, color: AppTheme.goldDark),
                                  const SizedBox(width: 4),
                                  Text('Shift: $shift', style: const TextStyle(color: Colors.black54, fontSize: 11, fontWeight: FontWeight.w500)),
                                ],
                              ),
                            ],
                          ),
                        ),
                        if (role == 'KARIKAR') ...[
                          IconButton(
                            icon: const Icon(Icons.analytics_outlined, color: AppTheme.goldDark),
                            tooltip: 'Artisan Details',
                            onPressed: () async {
                              final karikarId = (s['_id'] ?? s['id']).toString();
                              ref.read(adminProvider.notifier).fetchKarikarDetails(karikarId);
                              showDialog(
                                context: context,
                                builder: (ctx) => KarikarDetailsDialog(staffMember: s),
                              );
                            },
                          ),
                          const SizedBox(width: 4),
                        ],
                        IconButton(
                          icon: const Icon(Icons.edit_calendar_outlined, color: AppTheme.goldDark),
                          tooltip: 'Edit Schedule',
                          onPressed: () => _showEditShiftDialog(s),
                        ),
                        IconButton(
                          icon: const Icon(Icons.security_outlined, color: Colors.redAccent),
                          tooltip: 'Security Actions',
                          onPressed: () => _showSecurityActionsSheet(s),
                        ),
                      ],
                    ),
                  );
                },
              ),

            const SizedBox(height: 28),

            // Live Attendance Logs
            const Text(
              'Live Attendance Register',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4A3E1B), fontFamily: 'serif'),
            ),
            const SizedBox(height: 12),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: mockAttendanceLogs.length,
              itemBuilder: (ctx, idx) {
                final log = mockAttendanceLogs[idx];
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFECE6DF)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(log['name']!, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
                          const SizedBox(height: 2),
                          Text('${log['role']} | Clock In: ${log['clockIn']}', style: const TextStyle(color: Colors.black38, fontSize: 11)),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.green.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          log['status']!,
                          style: const TextStyle(color: Colors.green, fontSize: 8, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
