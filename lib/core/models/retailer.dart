class Retailer {
  final String id;
  final String name;
  final String businessName;
  final String phone;
  final String email;
  final String city;
  final String state;
  final String gstNumber;
  final String? panNumber;
  final double creditLimit;
  final double outstandingBalance;
  final DateTime memberSince;
  final bool isApproved;
  final List<String> allowedCategories;
  final bool canViewPrices;
  final bool canPlaceOrders;
  final String profileImageUrl;
  final int totalOrders;
  final double totalPurchaseValue;
  final int loyaltyPoints;

  const Retailer({
    required this.id,
    required this.name,
    required this.businessName,
    required this.phone,
    required this.email,
    required this.city,
    required this.state,
    required this.gstNumber,
    this.panNumber,
    required this.creditLimit,
    required this.outstandingBalance,
    required this.memberSince,
    this.isApproved = true,
    this.allowedCategories = const ['Gold', 'Diamond', 'Platinum', 'Gemstone'],
    this.canViewPrices = true,
    this.canPlaceOrders = true,
    this.profileImageUrl = '',
    this.totalOrders = 0,
    this.totalPurchaseValue = 0,
    this.loyaltyPoints = 0,
  });

  Retailer copyWith({
    String? phone,
    String? email,
    String? gstNumber,
    String? panNumber,
  }) {
    return Retailer(
      id: id,
      name: name,
      businessName: businessName,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      city: city,
      state: this.state,
      gstNumber: gstNumber ?? this.gstNumber,
      panNumber: panNumber ?? this.panNumber,
      creditLimit: creditLimit,
      outstandingBalance: outstandingBalance,
      memberSince: memberSince,
      isApproved: isApproved,
      allowedCategories: allowedCategories,
      canViewPrices: canViewPrices,
      canPlaceOrders: canPlaceOrders,
      profileImageUrl: profileImageUrl,
      totalOrders: totalOrders,
      totalPurchaseValue: totalPurchaseValue,
      loyaltyPoints: loyaltyPoints,
    );
  }

  double get availableCredit => creditLimit - outstandingBalance;
  double get creditUtilization =>
      creditLimit > 0 ? (outstandingBalance / creditLimit) * 100 : 0;

  String get initials {
    final parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}
