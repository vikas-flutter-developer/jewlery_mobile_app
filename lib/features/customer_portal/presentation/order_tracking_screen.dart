import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/models/order.dart';
import '../../../core/mock_data.dart';
import 'package:share_plus/share_plus.dart';

class OrderTrackingScreen extends StatefulWidget {
  final String orderId;
  const OrderTrackingScreen({super.key, required this.orderId});

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _slideController;
  late Animation<double> _slide;

  static const _trackingSteps = [
    (Icons.check_circle_outline, 'Design Approved', OrderStatus.designApproved),
    (Icons.hardware, 'Metal Issued', OrderStatus.metalIssued),
    (Icons.local_fire_department_outlined, 'Casting', OrderStatus.casting),
    (Icons.diamond_outlined, 'Stone Setting', OrderStatus.stoneSetting),
    (Icons.auto_fix_high, 'Polishing', OrderStatus.polishing),
    (Icons.verified_outlined, 'Quality Check', OrderStatus.qualityCheck),
    (Icons.inventory_2_outlined, 'Ready for Dispatch', OrderStatus.readyForDispatch),
    (Icons.local_shipping_outlined, 'Dispatched', OrderStatus.dispatched),
    (Icons.home_outlined, 'Delivered', OrderStatus.delivered),
  ];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _slide = CurvedAnimation(parent: _slideController, curve: Curves.easeOut);
    _slideController.forward();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _slideController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final order = MockDataService.orders.firstWhere(
      (o) => o.id == widget.orderId,
      orElse: () => MockDataService.orders.first,
    );
    final dateFmt = DateFormat('dd MMM, yy • hh:mm a');
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final currentStep = order.statusStep;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: AppColors.textPrimary, size: 18),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/customer/dashboard');
            }
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(order.orderNumber,
                style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 16)),
            const Text('Order Tracking', style: TextStyle(color: AppColors.textHint, fontSize: 11)),
          ],
        ),
        actions: [
          // WhatsApp share
          GestureDetector(
            onTap: () => _shareWhatsApp(order),
            child: Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF25D366).withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF25D366).withOpacity(0.4)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.chat_bubble_outline, color: Color(0xFF25D366), size: 14),
                  SizedBox(width: 4),
                  Text('Share', style: TextStyle(color: Color(0xFF25D366), fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ],
      ),
      body: FadeTransition(
        opacity: _slide,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Summary Card ────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.gold.withOpacity(0.12), AppColors.gold.withOpacity(0.04)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.gold.withOpacity(0.25)),
                ),
                child: Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total Value', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
                        const SizedBox(height: 2),
                        Text(fmt.format(order.totalAmount),
                            style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w800, fontSize: 22)),
                        if (order.expectedDelivery != null) ...[
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              const Icon(Icons.access_time, color: AppColors.textHint, size: 12),
                              const SizedBox(width: 4),
                              Text(
                                'ETA: ${DateFormat('dd MMM').format(order.expectedDelivery!)}',
                                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                    const Spacer(),
                    if (order.karigarName != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceElevated,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            const Icon(Icons.person, color: AppColors.gold, size: 24),
                            const SizedBox(height: 4),
                            Text(order.karigarName!.split(' ').first,
                                style: const TextStyle(color: AppColors.textPrimary, fontSize: 11, fontWeight: FontWeight.w600)),
                            const Text('Karigar', style: TextStyle(color: AppColors.textHint, fontSize: 10)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              const Text('Production Progress',
                  style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 16),

              // ── Tracking Stepper ────────────────────────────
              ...List.generate(_trackingSteps.length, (i) {
                final (icon, label, status) = _trackingSteps[i];
                final isDone = i <= currentStep;
                final isCurrent = i == currentStep;
                final isLast = i == _trackingSteps.length - 1;

                // Find matching history entry
                final histEntry = order.statusHistory
                    .where((h) => h.status == status)
                    .isNotEmpty
                    ? order.statusHistory.firstWhere((h) => h.status == status)
                    : null;

                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Left: Circle + Line ──────────────────
                      SizedBox(
                        width: 40,
                        child: Column(
                          children: [
                            AnimatedBuilder(
                              animation: _pulseController,
                              builder: (ctx, child) {
                                return Container(
                                  width: 34,
                                  height: 34,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: isDone ? AppColors.goldGradient : null,
                                    color: isDone ? null : AppColors.surfaceBorder,
                                    boxShadow: isCurrent
                                        ? [
                                            BoxShadow(
                                              color: AppColors.gold.withOpacity(
                                                  0.3 + _pulseController.value * 0.3),
                                              blurRadius: 12 + _pulseController.value * 8,
                                              spreadRadius: 2,
                                            ),
                                          ]
                                        : null,
                                  ),
                                  child: Icon(
                                    isDone ? Icons.check : icon,
                                    size: 16,
                                    color: isDone
                                        ? AppColors.textOnGold
                                        : AppColors.textHint,
                                  ),
                                );
                              },
                            ),
                            if (!isLast)
                              Expanded(
                                child: Container(
                                  width: 2,
                                  color: i < currentStep
                                      ? AppColors.gold
                                      : AppColors.surfaceBorder,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      // ── Right: Label + Note ──────────────────
                      Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 6),
                              Text(
                                label,
                                style: TextStyle(
                                  color: isDone ? AppColors.textPrimary : AppColors.textHint,
                                  fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                                  fontSize: 14,
                                ),
                              ),
                              if (histEntry != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  dateFmt.format(histEntry.timestamp),
                                  style: const TextStyle(color: AppColors.textHint, fontSize: 11),
                                ),
                                if (histEntry.note != null)
                                  Container(
                                    margin: const EdgeInsets.only(top: 6),
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: AppColors.surfaceElevated,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      histEntry.note!,
                                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                    ),
                                  ),
                              ] else if (isCurrent) ...[
                                const SizedBox(height: 4),
                                const Text('In progress...', style: TextStyle(color: AppColors.gold, fontSize: 11)),
                              ],
                              const SizedBox(height: 8),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),

              const SizedBox(height: 24),
              // ── Items in this order ──────────────────────────
              const Text('Items', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 12),
              ...order.items.map((item) => Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.surfaceBorder),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.productName,
                                  style: const TextStyle(
                                      color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                              Text('${item.sku}  •  ${item.purity}  •  Qty: ${item.quantity}',
                                  style: const TextStyle(color: AppColors.textHint, fontSize: 11)),
                            ],
                          ),
                        ),
                        Text(fmt.format(item.total),
                            style: const TextStyle(
                                color: AppColors.gold, fontWeight: FontWeight.w700, fontSize: 14)),
                      ],
                    ),
                  )),

              const SizedBox(height: 80),
            ],
          ),
        ),
      ),
    );
  }

  void _shareWhatsApp(Order order) {
    String currentStatus = 'Unknown';
    if (order.statusStep >= 0 && order.statusStep < _trackingSteps.length) {
      currentStatus = _trackingSteps[order.statusStep].$2;
    }
    
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final dateFmt = DateFormat('dd MMM, yy');
    
    String shareText = '''
📦 Order Tracking Update
-----------------------
Order Number: ${order.orderNumber}
Current Status: $currentStatus
Total Value: ${fmt.format(order.totalAmount)}
''';

    if (order.expectedDelivery != null) {
      shareText += 'Expected Delivery: ${dateFmt.format(order.expectedDelivery!)}\n';
    }

    shareText += '\nTrack your order live on our Premium B2B Wholesale App!';

    Share.share(shareText, subject: 'Order ${order.orderNumber} Tracking Details');
  }
}
