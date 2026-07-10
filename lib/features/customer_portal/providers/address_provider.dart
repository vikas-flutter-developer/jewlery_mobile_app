import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/address_model.dart';

final addressProvider = StateNotifierProvider<AddressNotifier, List<AddressModel>>((ref) {
  return AddressNotifier();
});

class AddressNotifier extends StateNotifier<List<AddressModel>> {
  AddressNotifier() : super([
    AddressModel(
      id: '1',
      name: 'Vikas Kumar',
      phone: '9876543210',
      street: 'H.No 123, Sector 45, Luxury Heights',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122003',
      isDefault: true,
    ),
    AddressModel(
      id: '2',
      name: 'Vikas Kumar',
      phone: '9876543210',
      street: 'Office 4B, Diamond Plaza, MG Road',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122002',
      isDefault: false,
    ),
  ]);

  void addAddress(AddressModel address) {
    state = [...state, address];
  }

  void removeAddress(String id) {
    state = state.where((AddressModel a) => a.id != id).toList();
  }

  void setDefault(String id) {
    state = state.map((AddressModel a) {
      if (a.id == id) return a.copyWith(isDefault: true);
      return a.copyWith(isDefault: false);
    }).toList();
  }
}
