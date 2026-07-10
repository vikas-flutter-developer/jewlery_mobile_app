class JobSheet {
  final int? id;
  final String jobNumber;
  final String designCode;
  final int? karigarId;
  final String karigarName;
  final String metalType;
  final int karat;
  final double issuedWeight;
  final double? dustLossGrams;
  final double? returnedWeight;
  final double? finishedWeight;
  final String stage; // melting | casting | polishing | setting | finishing | completed
  final DateTime issueDate;
  final DateTime? dueDate;
  final DateTime? completedDate;
  final String? notes;
  final String? imagePath;
  final String qcStatus;
  final String? qcApprovedBy;

  JobSheet({
    this.id,
    required this.jobNumber,
    required this.designCode,
    this.karigarId,
    required this.karigarName,
    required this.metalType,
    required this.karat,
    required this.issuedWeight,
    this.dustLossGrams,
    this.returnedWeight,
    this.finishedWeight,
    required this.stage,
    required this.issueDate,
    this.dueDate,
    this.completedDate,
    this.notes,
    this.imagePath,
    this.qcStatus = 'pending',
    this.qcApprovedBy,
  });

  double get wastageWeight => returnedWeight != null
      ? issuedWeight - returnedWeight!
      : 0.0;

  double get wastagePercent =>
      issuedWeight > 0 ? (wastageWeight / issuedWeight) * 100 : 0.0;

  Map<String, dynamic> toMap() => {
        'id': id,
        'job_number': jobNumber,
        'design_code': designCode,
        'karigar_id': karigarId,
        'karigar_name': karigarName,
        'metal_type': metalType,
        'karat': karat,
        'issued_weight': issuedWeight,
        'dust_loss_grams': dustLossGrams,
        'returned_weight': returnedWeight,
        'finished_weight': finishedWeight,
        'stage': stage,
        'issue_date': issueDate.toIso8601String(),
        'due_date': dueDate?.toIso8601String(),
        'completed_date': completedDate?.toIso8601String(),
        'notes': notes,
        'image_path': imagePath,
        'qc_status': qcStatus,
        'qc_approved_by': qcApprovedBy,
      };

  factory JobSheet.fromMap(Map<String, dynamic> map) => JobSheet(
        id: map['id'],
        jobNumber: map['job_number'],
        designCode: map['design_code'],
        karigarId: map['karigar_id'],
        karigarName: map['karigar_name'],
        metalType: map['metal_type'],
        karat: map['karat'],
        issuedWeight: map['issued_weight'],
        dustLossGrams: map['dust_loss_grams'],
        returnedWeight: map['returned_weight'],
        finishedWeight: map['finished_weight'],
        stage: map['stage'],
        issueDate: DateTime.parse(map['issue_date']),
        dueDate: map['due_date'] != null ? DateTime.parse(map['due_date']) : null,
        completedDate: map['completed_date'] != null
            ? DateTime.parse(map['completed_date'])
            : null,
        notes: map['notes'],
        imagePath: map['image_path'],
        qcStatus: map['qc_status'] ?? 'pending',
        qcApprovedBy: map['qc_approved_by'],
      );
}
