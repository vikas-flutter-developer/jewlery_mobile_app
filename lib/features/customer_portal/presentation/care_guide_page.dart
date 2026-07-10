import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';

class CareGuidePage extends StatelessWidget {
  const CareGuidePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.primaryNavy),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/customer/dashboard');
            }
          },
        ),
        title: const Text('JEWELRY CARE GUIDE'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Keep Your Sparkle Forever',
              style: TextStyle(
                fontSize: 28,
                color: AppColors.primaryNavy,
                fontWeight: FontWeight.bold,
                fontFamily: 'Playfair Display',
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Proper care is essential to maintain the brilliance and longevity of your fine jewelry collection.',
              style: TextStyle(fontSize: 16, color: Colors.grey[600], height: 1.5),
            ),
            const SizedBox(height: 32),
            _CareSection(
              title: 'Gold Jewelry',
              icon: Icons.brightness_high,
              tips: [
                'Keep gold away from harsh chemicals like chlorine and bleach.',
                'Use a soft cloth and warm soapy water for gentle cleaning.',
                'Store pieces in separate pouches to avoid scratches.',
              ],
            ),
            _CareSection(
              title: 'Diamonds & Gemstones',
              icon: Icons.diamond,
              tips: [
                'Diamonds attract grease, so clean them regularly with a soft brush.',
                'Avoid wearing gemstones while performing heavy manual work.',
                'Check settings periodically to ensure stones are secure.',
              ],
            ),
            _CareSection(
              title: 'Sterling Silver',
              icon: Icons.auto_awesome,
              tips: [
                'Sterling silver tarnishes naturally; use a polishing cloth frequently.',
                'Store in an airtight container or anti-tarnish bag.',
                'Wear your silver often—the natural oils in your skin help prevent tarnish.',
              ],
            ),
            const SizedBox(height: 40),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.accentGold.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: AppColors.accentGold),
                  SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      'For professional cleaning, visit any of our stores every 6 months.',
                      style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.primaryNavy),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CareSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<String> tips;

  const _CareSection({required this.title, required this.icon, required this.tips});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 32.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.accentGold, size: 24),
              const SizedBox(width: 12),
              Text(
                title,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.primaryNavy),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...tips.map((tip) => Padding(
            padding: const EdgeInsets.only(bottom: 8.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('• ', style: TextStyle(fontWeight: FontWeight.bold)),
                Expanded(child: Text(tip, style: TextStyle(color: Colors.grey[700], height: 1.4))),
              ],
            ),
          )),
        ],
      ),
    );
  }
}
