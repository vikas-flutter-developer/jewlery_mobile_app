import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/customer/dashboard');
            }
          },
        ),
        title: const Text('Support / Help'),
        backgroundColor: AppColors.background,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ContactCard(
            icon: Icons.support_agent,
            title: 'Call Us Now',
            subtitle: '+91 98765 43210\nAvailable Mon-Sat, 10 AM - 7 PM',
            color: AppColors.info,
            bgColor: AppColors.infoBg,
          ),
          const SizedBox(height: 16),
          _ContactCard(
            icon: Icons.chat,
            title: 'WhatsApp Support',
            subtitle: 'Click to start chatting\nWe typically reply in 5 minutes',
            color: AppColors.success,
            bgColor: AppColors.successBg,
          ),
          const SizedBox(height: 16),
          _ContactCard(
            icon: Icons.email,
            title: 'Email Support',
            subtitle: 'support@jewelretail.com\nGenerate a tracking ticket directly',
            color: AppColors.warning,
            bgColor: AppColors.warningBg,
          ),
          const SizedBox(height: 40),
          const Center(
            child: Text('App Version 1.0.0', style: TextStyle(color: AppColors.textHint)),
          ),
        ],
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final Color bgColor;

  const _ContactCard({required this.icon, required this.title, required this.subtitle, required this.color, required this.bgColor});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceBorder),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: bgColor,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(subtitle, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
