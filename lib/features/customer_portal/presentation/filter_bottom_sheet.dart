import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/models/product.dart';
import '../providers/app_providers.dart';

class FilterBottomSheet extends ConsumerWidget {
  const FilterBottomSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedCategory = ref.watch(selectedCategoryProvider);
    final selectedSort = ref.watch(sortOptionProvider);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Filters & Sort',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, fontFamily: 'serif'),
              ),
              TextButton(
                onPressed: () {
                  ref.read(selectedCategoryProvider.notifier).state = null;
                  ref.read(sortOptionProvider.notifier).state = 'Trending';
                },
                child: const Text('Reset', style: TextStyle(color: AppColors.accentGold)),
              ),
            ],
          ),
          const SizedBox(height: 24),
          
          const Text('Category', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              FilterChip(
                label: const Text('ALL'),
                selected: selectedCategory == null,
                onSelected: (val) {
                  ref.read(selectedCategoryProvider.notifier).state = null;
                },
                selectedColor: AppColors.accentGold.withOpacity(0.2),
                checkmarkColor: AppColors.accentGold,
              ),
              ...JewelryCategory.values.map((cat) {
                final isSelected = selectedCategory == cat;
                return FilterChip(
                  label: Text(cat.name.toUpperCase()),
                  selected: isSelected,
                  onSelected: (val) {
                    ref.read(selectedCategoryProvider.notifier).state = val ? cat : null;
                  },
                  selectedColor: AppColors.accentGold.withOpacity(0.2),
                  checkmarkColor: AppColors.accentGold,
                );
              }),
            ],
          ),
          const SizedBox(height: 24),

          const Text('Sort By', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: ['Trending', 'New Arrivals', 'Price: Low to High', 'Price: High to Low', 'Rating'].map((opt) {
              final isSelected = selectedSort == opt;
              return ChoiceChip(
                label: Text(opt),
                selected: isSelected,
                onSelected: (val) {
                  if (val) {
                    ref.read(sortOptionProvider.notifier).state = opt;
                  }
                },
                selectedColor: AppColors.accentGold.withOpacity(0.2),
              );
            }).toList(),
          ),
          const SizedBox(height: 32),
          
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(double.infinity, 56),
              backgroundColor: AppColors.primaryNavy,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: const Text('APPLY FILTERS', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.0)),
          ),
        ],
      ),
    );
  }
}
