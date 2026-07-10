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
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFECE6DF), width: 1),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _dashboardMode = 0),
                    borderRadius: BorderRadius.circular(14),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        gradient: _dashboardMode == 0
                            ? const LinearGradient(
                                colors: [AppTheme.goldDark, Color(0xFFC5A059)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              )
                            : null,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: _dashboardMode == 0
                            ? [
                                BoxShadow(
                                  color: AppTheme.goldDark.withValues(alpha: 0.2),
                                  blurRadius: 8,
                                  offset: const Offset(0, 4),
                                )
                              ]
                            : [],
                      ),
                      child: Text(
                        'SHOWROOM RETAIL',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _dashboardMode == 0 ? Colors.white : const Color(0xFF8A8276),
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _dashboardMode = 1),
                    borderRadius: BorderRadius.circular(14),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        gradient: _dashboardMode == 1
                            ? const LinearGradient(
                                colors: [AppTheme.goldDark, Color(0xFFC5A059)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              )
                            : null,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: _dashboardMode == 1
                            ? [
                                BoxShadow(
                                  color: AppTheme.goldDark.withValues(alpha: 0.2),
                                  blurRadius: 8,
                                  offset: const Offset(0, 4),
                                )
                              ]
                            : [],
                      ),
                      child: Text(
                        'WORKSHOP MFG',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _dashboardMode == 1 ? Colors.white : const Color(0xFF8A8276),
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _dashboardMode == 0 ? const RetailView() : const ManufacturingView(),
        ],
      ),
    );
  }

  void _showBranchSelectorSheet(BuildContext context, List<dynamic> branches, Map<String, dynamic>? activeBranch) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return Container(
          decoration: const BoxDecoration(
            color: Color(0xFFFAF9F6),
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.black12,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'SELECT BRANCH CONTEXT',
                style: TextStyle(
                  fontFamily: 'serif',
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.goldDark,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Switching the active showroom or factory changes the real-time telemetry, rates, inventory, and staff rosters.',
                style: TextStyle(fontSize: 12, color: Colors.black54),
              ),
              const SizedBox(height: 20),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: branches.length,
                  itemBuilder: (context, idx) {
                    final b = branches[idx];
                    final isSelected = activeBranch != null && (b['_id'] ?? b['id']).toString() == (activeBranch['_id'] ?? activeBranch['id']).toString();
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFFFFBF0) : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isSelected ? AppTheme.goldDark : const Color(0xFFECE6DF),
                          width: isSelected ? 1.5 : 1.0,
                        ),
                        boxShadow: isSelected
                            ? [BoxShadow(color: AppTheme.goldDark.withValues(alpha: 0.08), blurRadius: 12, offset: const Offset(0, 4))]
                            : [],
                      ),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        leading: CircleAvatar(
                          backgroundColor: isSelected ? AppTheme.goldDark : const Color(0xFFF3EFE9),
                          child: Icon(
                            b['code'] == 'MAIN' ? Icons.home_work_outlined : Icons.storefront_rounded,
                            color: isSelected ? Colors.white : AppTheme.goldDark,
                            size: 20,
                          ),
                        ),
                        title: Text(
                          (b['name'] ?? 'Showroom').toString().toUpperCase(),
                          style: const TextStyle(
                            fontFamily: 'serif',
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                            letterSpacing: 0.5,
                          ),
                        ),
                        subtitle: Text(
                          'Code: ${b['code'] ?? "N/A"} | Type: ${b['type'] ?? "RETAIL"}',
                          style: const TextStyle(fontSize: 11, color: Colors.black45),
                        ),
                        trailing: isSelected
                            ? const Icon(Icons.check_circle_rounded, color: AppTheme.goldDark)
                            : null,
                        onTap: () {
                          ref.read(adminProvider.notifier).switchBranch(b as Map<String, dynamic>);
                          Navigator.pop(context);
                        },
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

  Widget _buildNavItem(int index, IconData unselectedIcon, IconData selectedIcon, String label) {
    final isSelected = _currentTab == index;
    return InkWell(
      onTap: () => setState(() => _currentTab = index),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? AppTheme.goldDark.withValues(alpha: 0.08) : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                isSelected ? selectedIcon : unselectedIcon,
                color: isSelected ? AppTheme.goldDark : Colors.black38,
                size: 20,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 9,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? AppTheme.goldDark : Colors.black45,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
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
                style: TextStyle(
                  color: AppTheme.goldDark,
                  fontFamily: 'serif',
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              )
            : InkWell(
                onTap: () => _showBranchSelectorSheet(context, branches, activeBranch),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFECE6DF), width: 1),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.location_on_outlined, color: AppTheme.goldDark, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        (activeBranch['name'] ?? 'Showroom').toString().toUpperCase(),
                        style: const TextStyle(
                          color: AppTheme.goldDark,
                          fontFamily: 'serif',
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.keyboard_arrow_down_rounded, color: AppTheme.goldDark, size: 16),
                    ],
                  ),
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
      bottomNavigationBar: SafeArea(
        child: Container(
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          height: 64,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFECE6DF), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(0, Icons.dashboard_outlined, Icons.dashboard, 'OPERATIONS'),
              _buildNavItem(1, Icons.people_outline, Icons.people, 'STAFF ROSTER'),
              _buildNavItem(2, Icons.settings_outlined, Icons.settings, 'SETTINGS'),
            ],
          ),
        ),
      ),
    );
  }
}
