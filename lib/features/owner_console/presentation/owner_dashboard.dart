import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/admin_provider.dart';
import 'retail_view.dart';
import 'manufacturing_view.dart';
import 'staff_roster_screen.dart';
import 'store_settings_screen.dart';

class OwnerDashboard extends ConsumerStatefulWidget {
  const OwnerDashboard({super.key});

  @override
  ConsumerState<OwnerDashboard> createState() => _OwnerDashboardState();
}

class _OwnerDashboardState extends ConsumerState<OwnerDashboard> {
  int _currentTab = 0;
  int _dashboardMode = 0; // 0: Retail Showroom, 1: Manufacturing Workshop

  @override
  void initState() {
    super.initState();
    // Fetch fresh database records for admin
    Future.microtask(() {
      ref.read(adminProvider.notifier).loadInitialData();
    });
  }

  Widget _buildDashboardTab(AdminState adminState) {
    if (adminState.isLoading && adminState.branches.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: AppTheme.goldDark),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Dynamic segment mode switcher
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: const Color(0xFFF3EFE9),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _dashboardMode = 0),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _dashboardMode == 0 ? AppTheme.goldDark : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'SHOWROOM RETAIL',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _dashboardMode == 0 ? Colors.white : Colors.black54,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _dashboardMode = 1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _dashboardMode == 1 ? AppTheme.goldDark : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'WORKSHOP MFG',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _dashboardMode == 1 ? Colors.white : Colors.black54,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Render selected mode sub-view
          _dashboardMode == 0 ? const RetailView() : const ManufacturingView(),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final adminState = ref.watch(adminProvider);
    final activeBranch = adminState.activeBranch;
    final branches = adminState.branches;

    // Subpages selection
    final List<Widget> tabs = [
      _buildDashboardTab(adminState),
      const StaffRosterScreen(),
      const StoreSettingsScreen(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF9F6F0),
        elevation: 0,
        scrolledUnderElevation: 0,
        title: activeBranch == null
            ? const Text(
                'OWNER CONSOLE',
                style: TextStyle(color: AppTheme.goldDark, fontFamily: 'serif', fontSize: 16, fontWeight: FontWeight.bold),
              )
            : DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: (activeBranch['_id'] ?? activeBranch['id']).toString(),
                  dropdownColor: const Color(0xFFF9F6F0),
                  icon: const Icon(Icons.arrow_drop_down, color: AppTheme.goldDark),
                  onChanged: (id) {
                    if (id != null) {
                      final newActive = branches.firstWhere((b) => (b['_id'] ?? b['id']).toString() == id);
                      ref.read(adminProvider.notifier).switchBranch(newActive as Map<String, dynamic>);
                    }
                  },
                  items: branches.map<DropdownMenuItem<String>>((b) {
                    return DropdownMenuItem<String>(
                      value: (b['_id'] ?? b['id']).toString(),
                      child: Text(
                        (b['name'] ?? 'Showroom').toString().toUpperCase(),
                        style: const TextStyle(
                          color: AppTheme.goldDark,
                          fontFamily: 'serif',
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppTheme.goldDark),
            tooltip: 'Sign Out',
            onPressed: () {
              ref.read(authProvider.notifier).logout();
            },
          ),
        ],
      ),
      body: adminState.isLoading && branches.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppTheme.goldDark))
          : tabs[_currentTab],
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Color(0xFFECE6DF), width: 1.2)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentTab,
          onTap: (idx) => setState(() => _currentTab = idx),
          backgroundColor: Colors.white,
          selectedItemColor: AppTheme.goldDark,
          unselectedItemColor: Colors.black26,
          showUnselectedLabels: true,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 10, letterSpacing: 0.5),
          unselectedLabelStyle: const TextStyle(fontSize: 10),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard),
              label: 'OPERATIONS',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.people_outline),
              activeIcon: Icon(Icons.people),
              label: 'STAFF ROSTER',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.settings_outlined),
              activeIcon: Icon(Icons.settings),
              label: 'SETTINGS',
            ),
          ],
        ),
      ),
    );
  }
}
