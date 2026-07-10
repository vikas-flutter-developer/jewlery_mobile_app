class BomComponent {
  final int? id;
  final int recipeId;
  final String componentType; // metal, stone, finding
  final String name;
  final int quantity;
  final double? weightGrams;

  BomComponent({
    this.id,
    required this.recipeId,
    required this.componentType,
    required this.name,
    required this.quantity,
    this.weightGrams,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'recipe_id': recipeId,
        'component_type': componentType,
        'name': name,
        'quantity': quantity,
        'weight_grams': weightGrams,
      };

  factory BomComponent.fromMap(Map<String, dynamic> map) => BomComponent(
        id: map['id'],
        recipeId: map['recipe_id'],
        componentType: map['component_type'],
        name: map['name'],
        quantity: map['quantity'],
        weightGrams: map['weight_grams'],
      );
}
