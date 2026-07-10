class Warehouse {
  final int? id;
  final String name;
  final String location;
  final String? managerName;

  Warehouse({
    this.id,
    required this.name,
    required this.location,
    this.managerName,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'location': location,
        'manager_name': managerName,
      };

  factory Warehouse.fromMap(Map<String, dynamic> map) => Warehouse(
        id: map['id'],
        name: map['name'],
        location: map['location'],
        managerName: map['manager_name'],
      );
}
