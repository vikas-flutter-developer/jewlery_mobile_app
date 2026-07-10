import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../network/api_client.dart';
import '../models/metal_rate.dart';
import '../models/karigar.dart';
import '../models/job_sheet.dart';
import '../models/stock_item.dart';
import '../models/ledger_entry.dart';
import '../models/retail_order.dart';
import '../models/customer.dart';
import '../models/metal_batch.dart';
import '../models/alloy_composition.dart';
import '../models/karigar_payroll.dart';
import '../models/warehouse.dart';
import '../models/bom_recipe.dart';
import '../models/bom_component.dart';
import '../models/stock_transfer.dart';
import '../models/girvi_loan.dart';
import '../models/kitty_scheme.dart';

class DatabaseService {
  static DatabaseService? _instance;
  static Database? _database;

  DatabaseService._();

  static DatabaseService get instance {
    _instance ??= DatabaseService._();
    return _instance!;
  }


  Future<Database> get database async {
    if (kIsWeb) {
      throw UnsupportedError('sqflite is not supported on web');
    }
    _database ??= await _initDB();
    return _database!;
  }

  Future<Database> _initDB() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'swarna_erp.db');

    return await openDatabase(
      path,
      version: 10,
      onCreate: _createTables,
      onUpgrade: (db, oldVersion, newVersion) async {
        // Drop and recreate on upgrade (dev mode)
        await db.execute('DROP TABLE IF EXISTS customers');
        await db.execute('DROP TABLE IF EXISTS ledger_entries');
        await db.execute('DROP TABLE IF EXISTS orders');
        await db.execute('DROP TABLE IF EXISTS users');
        await db.execute('DROP TABLE IF EXISTS job_sheets');
        await db.execute('DROP TABLE IF EXISTS stock_items');
        await db.execute('DROP TABLE IF EXISTS karigar');
        await db.execute('DROP TABLE IF EXISTS metal_rates');
        await db.execute('DROP TABLE IF EXISTS metal_batches');
        await db.execute('DROP TABLE IF EXISTS alloy_compositions');
        await db.execute('DROP TABLE IF EXISTS karigar_payroll');
        await db.execute('DROP TABLE IF EXISTS bom_recipes');
        await db.execute('DROP TABLE IF EXISTS bom_components');
        await db.execute('DROP TABLE IF EXISTS warehouses');
        await db.execute('DROP TABLE IF EXISTS stock_transfers');
        await db.execute('DROP TABLE IF EXISTS girvi_loans');
        await db.execute('DROP TABLE IF EXISTS kitty_schemes');
        await _createTables(db, newVersion);
      },
    );
  }

  Future<void> _createTables(Database db, int version) async {
    // Metal Rates
    await db.execute('''
      CREATE TABLE metal_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metal_type TEXT NOT NULL,
        karat INTEGER NOT NULL,
        rate_per_gram REAL NOT NULL,
        date TEXT NOT NULL,
        note TEXT
      )
    ''');

    // Karigar
    await db.execute('''
      CREATE TABLE karigar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT,
        specialization TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        biometric_enabled INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )
    ''');

    // Job Sheets
    await db.execute('''
      CREATE TABLE job_sheets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_number TEXT NOT NULL UNIQUE,
        design_code TEXT NOT NULL,
        karigar_id INTEGER,
        karigar_name TEXT NOT NULL,
        metal_type TEXT NOT NULL,
        karat INTEGER NOT NULL,
        issued_weight REAL NOT NULL,
        dust_loss_grams REAL,
        returned_weight REAL,
        finished_weight REAL,
        stage TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        due_date TEXT,
        completed_date TEXT,
        notes TEXT,
        image_path TEXT,
        qc_status TEXT DEFAULT 'pending',
        qc_approved_by TEXT,
        FOREIGN KEY (karigar_id) REFERENCES karigar(id)
      )
    ''');

    // Metal Batches
    await db.execute('''
      CREATE TABLE metal_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_number TEXT NOT NULL UNIQUE,
        metal_type TEXT NOT NULL,
        karat INTEGER NOT NULL,
        weight_grams REAL NOT NULL,
        purity_percentage REAL NOT NULL,
        source TEXT,
        received_date TEXT NOT NULL
      )
    ''');

    // Alloy Compositions
    await db.execute('''
      CREATE TABLE alloy_compositions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_karat INTEGER NOT NULL,
        total_weight REAL NOT NULL,
        pure_metal_weight REAL NOT NULL,
        alloy_weight REAL NOT NULL,
        created_date TEXT NOT NULL
      )
    ''');

    // Karigar Payroll
    await db.execute('''
      CREATE TABLE karigar_payroll (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        karigar_id INTEGER NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        total_amount REAL NOT NULL,
        tds_deducted REAL NOT NULL,
        net_payable REAL NOT NULL,
        status TEXT NOT NULL,
        payment_date TEXT,
        FOREIGN KEY (karigar_id) REFERENCES karigar(id)
      )
    ''');

    // Warehouses
    await db.execute('''
      CREATE TABLE warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        manager_name TEXT
      )
    ''');

    // Stock Items
    await db.execute('''
      CREATE TABLE stock_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        metal_type TEXT NOT NULL,
        karat INTEGER NOT NULL,
        weight_grams REAL NOT NULL,
        pieces INTEGER NOT NULL,
        location TEXT,
        barcode_id TEXT,
        design_code TEXT,
        cost_per_gram REAL,
        image_path TEXT,
        warehouse_id INTEGER,
        rfid_tag TEXT,
        huid_code TEXT,
        memo_status TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    ''');

    // Stock Transfers
    await db.execute('''
      CREATE TABLE stock_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        from_warehouse_id INTEGER,
        to_warehouse_id INTEGER NOT NULL,
        transfer_date TEXT NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES stock_items(id)
      )
    ''');

    // BOM Recipes
    await db.execute('''
      CREATE TABLE bom_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        design_code TEXT NOT NULL UNIQUE,
        metal_type TEXT NOT NULL,
        karat INTEGER NOT NULL,
        cad_file_path TEXT,
        designer_name TEXT,
        created_at TEXT NOT NULL
      )
    ''');

    // BOM Components
    await db.execute('''
      CREATE TABLE bom_components (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        component_type TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        weight_grams REAL,
        FOREIGN KEY (recipe_id) REFERENCES bom_recipes(id)
      )
    ''');

    // Orders (Retail Requests)
    await db.execute('''
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        party_id INTEGER,
        details TEXT NOT NULL,
        status TEXT NOT NULL,
        target_date TEXT,
        created_at TEXT NOT NULL
      )
    ''');

    // Users (Auth & Roles)
    await db.execute('''
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL
      )
    ''');

    // Customers (CRM)
    await db.execute('''
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        dob TEXT,
        anniversary TEXT,
        loyalty_points INTEGER DEFAULT 0,
        total_purchase_value REAL DEFAULT 0.0,
        created_at TEXT NOT NULL
      )
    ''');

    // Girvi (Gold Loan)
    await db.execute('''
      CREATE TABLE girvi_loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        loan_amount REAL NOT NULL,
        interest_rate REAL NOT NULL,
        pledged_items_details TEXT NOT NULL,
        start_date TEXT NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    ''');

    // Kitty Scheme
    await db.execute('''
      CREATE TABLE kitty_schemes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        monthly_amount REAL NOT NULL,
        total_months INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    ''');

    // Ledger Entries
    await db.execute('''
      CREATE TABLE ledger_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        party_name TEXT NOT NULL,
        party_id INTEGER,
        party_type TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        amount REAL NOT NULL,
        metal_weight REAL,
        metal_type TEXT,
        karat INTEGER,
        description TEXT NOT NULL,
        reference_no TEXT,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    ''');

    await _seedData(db);
  }

  Future<void> _seedData(Database db) async {
    final now = DateTime.now();

    // ── Metal Rates: 15-day history ─────────────────────────
    final rates24  = [7200,7180,7220,7150,7275,7300,7250,7100,7120,7080,7060,7200,7310,7330,7290];
    final rates22  = [6600,6583,6618,6554,6669,6691,6646,6508,6526,6490,6472,6600,6701,6719,6682];
    final rates18  = [5400,5385,5415,5363,5456,5475,5438,5325,5340,5310,5295,5400,5483,5498,5470];
    final ratesSil = [90,89,91,87,92,94,91,86,88,85,84,90,94,96,93];
    final ratesDia = [45000, 45200, 45100, 45300, 45500, 45400, 45600, 45800, 45700, 45900, 46000, 46200, 46100, 46300, 46500];

    for (int i = 14; i >= 0; i--) {
      final d = now.subtract(Duration(days: i)).toIso8601String();
      final idx = 14 - i;
      await db.insert('metal_rates', {'metal_type': 'gold',   'karat': 24,  'rate_per_gram': rates24[idx].toDouble(),  'date': d, 'note': null});
      await db.insert('metal_rates', {'metal_type': 'gold',   'karat': 22,  'rate_per_gram': rates22[idx].toDouble(),  'date': d, 'note': null});
      await db.insert('metal_rates', {'metal_type': 'gold',   'karat': 18,  'rate_per_gram': rates18[idx].toDouble(),  'date': d, 'note': null});
      await db.insert('metal_rates', {'metal_type': 'silver', 'karat': 999, 'rate_per_gram': ratesSil[idx].toDouble(), 'date': d, 'note': null});
      await db.insert('metal_rates', {'metal_type': 'diamond','karat': 1, 'rate_per_gram': ratesDia[idx].toDouble(), 'date': d, 'note': null});
    }

    // ── Karigar ─────────────────────────────────────────────
    final karigarRows = [
      {'name': 'Ramesh Kumar',  'phone': '9876543210', 'address': 'Zaveri Bazaar, Mumbai',   'specialization': 'goldsmith',  'is_active': 1},
      {'name': 'Suresh Sonar',  'phone': '9812345678', 'address': 'Dharavi, Mumbai',          'specialization': 'casting',    'is_active': 1},
      {'name': 'Mohan Lal',     'phone': '9823456789', 'address': 'Bhendi Bazaar, Mumbai',    'specialization': 'polishing',  'is_active': 1},
      {'name': 'Vikas Soni',    'phone': '9801234567', 'address': 'Surat, Gujarat',           'specialization': 'setting',    'is_active': 1},
      {'name': 'Anil Patil',    'phone': '9878901234', 'address': 'Pune, Maharashtra',        'specialization': 'finishing',  'is_active': 1},
      {'name': 'Deepak Yadav',  'phone': '9834567890', 'address': 'Jaipur, Rajasthan',        'specialization': 'engraving',  'is_active': 0},
    ];
    for (final k in karigarRows) {
      await db.insert('karigar', {...k, 'created_at': now.subtract(const Duration(days: 60)).toIso8601String()});
    }

    // ── Job Sheets ───────────────────────────────────────────
    final jobs = [
      {'job_number': 'JB-2025-001', 'design_code': 'NK-101', 'karigar_id': 1, 'karigar_name': 'Ramesh Kumar', 'metal_type': 'gold',   'karat': 22,  'issued_weight': 45.5,  'returned_weight': null, 'finished_weight': null, 'stage': 'casting',   'issue_date': now.subtract(const Duration(days: 10)).toIso8601String(), 'due_date': now.add(const Duration(days: 5)).toIso8601String(),  'completed_date': null, 'notes': 'Necklace set for Diwali collection'},
      {'job_number': 'JB-2025-002', 'design_code': 'BR-205', 'karigar_id': 2, 'karigar_name': 'Suresh Sonar', 'metal_type': 'gold',   'karat': 18,  'issued_weight': 22.8,  'returned_weight': null, 'finished_weight': null, 'stage': 'polishing', 'issue_date': now.subtract(const Duration(days: 7)).toIso8601String(),  'due_date': now.add(const Duration(days: 3)).toIso8601String(),  'completed_date': null, 'notes': 'Bracelet pair - urgent'},
      {'job_number': 'JB-2025-003', 'design_code': 'RG-312', 'karigar_id': 3, 'karigar_name': 'Mohan Lal',   'metal_type': 'gold',   'karat': 22,  'issued_weight': 8.2,   'returned_weight': null, 'finished_weight': null, 'stage': 'setting',   'issue_date': now.subtract(const Duration(days: 5)).toIso8601String(),  'due_date': now.add(const Duration(days: 7)).toIso8601String(),  'completed_date': null, 'notes': 'Diamond ring setting'},
      {'job_number': 'JB-2025-004', 'design_code': 'EA-418', 'karigar_id': 4, 'karigar_name': 'Vikas Soni',  'metal_type': 'gold',   'karat': 18,  'issued_weight': 12.4,  'returned_weight': null, 'finished_weight': null, 'stage': 'finishing', 'issue_date': now.subtract(const Duration(days: 3)).toIso8601String(),  'due_date': now.add(const Duration(days: 2)).toIso8601String(),  'completed_date': null, 'notes': 'Earring pair with kundan work'},
      {'job_number': 'JB-2025-005', 'design_code': 'CH-520', 'karigar_id': 1, 'karigar_name': 'Ramesh Kumar', 'metal_type': 'gold',  'karat': 24,  'issued_weight': 35.0,  'returned_weight': 34.2, 'finished_weight': 33.8, 'stage': 'completed', 'issue_date': now.subtract(const Duration(days: 20)).toIso8601String(), 'due_date': now.subtract(const Duration(days: 8)).toIso8601String(), 'completed_date': now.subtract(const Duration(days: 6)).toIso8601String(), 'notes': 'Gold chain 24K - completed'},
      {'job_number': 'JB-2025-006', 'design_code': 'BG-615', 'karigar_id': 5, 'karigar_name': 'Anil Patil',  'metal_type': 'silver', 'karat': 999, 'issued_weight': 120.0, 'returned_weight': null, 'finished_weight': null, 'stage': 'melting',   'issue_date': now.subtract(const Duration(days: 2)).toIso8601String(),  'due_date': now.add(const Duration(days: 10)).toIso8601String(), 'completed_date': null, 'notes': 'Silver bangles set'},
      {'job_number': 'JB-2025-007', 'design_code': 'MG-701', 'karigar_id': 2, 'karigar_name': 'Suresh Sonar', 'metal_type': 'gold',  'karat': 22,  'issued_weight': 55.0,  'returned_weight': 54.0, 'finished_weight': 53.5, 'stage': 'completed', 'issue_date': now.subtract(const Duration(days: 30)).toIso8601String(), 'due_date': now.subtract(const Duration(days: 15)).toIso8601String(), 'completed_date': now.subtract(const Duration(days: 13)).toIso8601String(), 'notes': 'Mangalsutra heavy design'},
      {'job_number': 'JB-2025-008', 'design_code': 'PD-802', 'karigar_id': 3, 'karigar_name': 'Mohan Lal',   'metal_type': 'gold',   'karat': 18,  'issued_weight': 18.5,  'returned_weight': null, 'finished_weight': null, 'stage': 'casting',   'issue_date': now.subtract(const Duration(days: 1)).toIso8601String(),  'due_date': now.add(const Duration(days: 12)).toIso8601String(), 'completed_date': null, 'notes': 'Pendant with ruby stone'},
      {'job_number': 'JB-2025-EX1', 'design_code': 'TEST-CHAIN', 'karigar_id': 1, 'karigar_name': 'Ramesh Kumar',   'metal_type': 'gold',   'karat': 22,  'issued_weight': 10.0,  'returned_weight': null, 'finished_weight': null, 'stage': 'finishing',   'issue_date': now.subtract(const Duration(days: 1)).toIso8601String(),  'due_date': now.add(const Duration(days: 5)).toIso8601String(), 'completed_date': null, 'notes': 'TEST JOB: Enter 9g finished chain and 0.5g scrap dust.'},
    ];
    for (final j in jobs) {
      await db.insert('job_sheets', j);
    }

    // ── Retail Orders ───────────────────────────────────────
    final orders = [
      {'customer_name': 'M/s Fake Client Jewellers', 'party_id': null, 'details': 'Need 5 diamond rings by next Tuesday', 'status': 'pending',     'target_date': now.add(const Duration(days: 7)).toIso8601String(), 'created_at': now.subtract(const Duration(hours: 2)).toIso8601String()},
      {'customer_name': 'Rajesh Traders',            'party_id': null, 'details': '10 Gold Chains 22K (Urgent)',        'status': 'pending',     'target_date': now.add(const Duration(days: 2)).toIso8601String(), 'created_at': now.subtract(const Duration(days: 1)).toIso8601String()},
      {'customer_name': 'Mehta Jewels',              'party_id': null, 'details': '5 Diamond Engagement Rings',         'status': 'in_progress', 'target_date': now.add(const Duration(days: 5)).toIso8601String(), 'created_at': now.subtract(const Duration(days: 3)).toIso8601String()},
      {'customer_name': 'Surat Silver House',        'party_id': null, 'details': '20 Silver Anklets 999',              'status': 'in_progress', 'target_date': now.add(const Duration(days: 10)).toIso8601String(), 'created_at': now.subtract(const Duration(days: 4)).toIso8601String()},
      {'customer_name': 'Vogue Ornaments',           'party_id': null, 'details': 'Extravagant Platinum Necklace',      'status': 'completed',   'target_date': now.subtract(const Duration(days: 1)).toIso8601String(), 'created_at': now.subtract(const Duration(days: 15)).toIso8601String()},
    ];
    for (final o in orders) {
      await db.insert('orders', o);
    }

    // ── Stock Items ──────────────────────────────────────────
    final stock = [
      // RAW
      {'name': 'Gold Bullion Bar',      'category': 'raw',           'metal_type': 'gold',   'karat': 24,  'weight_grams': 500.0,  'pieces': 2,  'location': 'Vault A',       'barcode_id': 'GLD-24-001',  'design_code': null,    'cost_per_gram': 7290.0, 'updated_at': now.toIso8601String()},
      {'name': '22K Gold Ingot',         'category': 'raw',           'metal_type': 'gold',   'karat': 22,  'weight_grams': 250.0,  'pieces': 5,  'location': 'Vault A',       'barcode_id': 'GLD-22-002',  'design_code': null,    'cost_per_gram': 6682.0, 'updated_at': now.toIso8601String()},
      {'name': 'Silver Granules Fine',   'category': 'raw',           'metal_type': 'silver', 'karat': 999, 'weight_grams': 1200.0, 'pieces': 1,  'location': 'Vault B',       'barcode_id': 'SLV-999-001', 'design_code': null,    'cost_per_gram': 93.0,   'updated_at': now.toIso8601String()},
      {'name': '18K Alloy Wire',         'category': 'raw',           'metal_type': 'gold',   'karat': 18,  'weight_grams': 80.0,   'pieces': 10, 'location': 'Workshop',      'barcode_id': 'GLD-18-003',  'design_code': null,    'cost_per_gram': 5470.0, 'updated_at': now.toIso8601String()},
      // SEMI-FINISHED
      {'name': 'Cast Necklace Frame',    'category': 'semi_finished', 'metal_type': 'gold',   'karat': 22,  'weight_grams': 42.5,   'pieces': 1,  'location': 'Workshop',      'barcode_id': 'SF-NK-001',   'design_code': 'NK-101', 'cost_per_gram': 6682.0, 'updated_at': now.toIso8601String()},
      {'name': 'Polished Bangle Base',   'category': 'semi_finished', 'metal_type': 'gold',   'karat': 18,  'weight_grams': 28.3,   'pieces': 3,  'location': 'Workshop',      'barcode_id': 'SF-BG-002',   'design_code': 'BG-202', 'cost_per_gram': 5470.0, 'updated_at': now.toIso8601String()},
      {'name': 'Silver Pendant Base',    'category': 'semi_finished', 'metal_type': 'silver', 'karat': 999, 'weight_grams': 15.5,   'pieces': 6,  'location': 'Workshop',      'barcode_id': 'SF-PD-003',   'design_code': 'PD-305', 'cost_per_gram': 93.0,   'updated_at': now.toIso8601String()},
      {'name': 'Ring Shank (Unset)',     'category': 'semi_finished', 'metal_type': 'gold',   'karat': 18,  'weight_grams': 6.2,    'pieces': 4,  'location': 'Workshop',      'barcode_id': 'SF-RG-004',   'design_code': 'RG-312', 'cost_per_gram': 5470.0, 'updated_at': now.toIso8601String()},
      // FINISHED
      {'name': 'Gold Necklace Set',      'category': 'finished',      'metal_type': 'gold',   'karat': 22,  'weight_grams': 38.5,   'pieces': 1,  'location': 'Display Case 1','barcode_id': 'FN-NK-001',   'design_code': 'NK-101', 'cost_per_gram': 6682.0, 'updated_at': now.toIso8601String()},
      {'name': 'Diamond Ring',           'category': 'finished',      'metal_type': 'gold',   'karat': 18,  'weight_grams': 7.8,    'pieces': 1,  'location': 'Display Case 2','barcode_id': 'FN-RG-001',   'design_code': 'RG-312', 'cost_per_gram': 5470.0, 'updated_at': now.toIso8601String()},
      {'name': 'Gold Mangalsutra',       'category': 'finished',      'metal_type': 'gold',   'karat': 22,  'weight_grams': 53.5,   'pieces': 1,  'location': 'Display Case 1','barcode_id': 'FN-MG-001',   'design_code': 'MG-701', 'cost_per_gram': 6682.0, 'updated_at': now.toIso8601String()},
      {'name': 'Gold Bangles Set (6pc)', 'category': 'finished',      'metal_type': 'gold',   'karat': 22,  'weight_grams': 62.0,   'pieces': 6,  'location': 'Display Case 3','barcode_id': 'FN-BG-001',   'design_code': 'BG-500', 'cost_per_gram': 6682.0, 'updated_at': now.toIso8601String()},
      {'name': 'Silver Anklet Set',      'category': 'finished',      'metal_type': 'silver', 'karat': 999, 'weight_grams': 85.0,   'pieces': 2,  'location': 'Display Case 4','barcode_id': 'FN-SL-001',   'design_code': 'SL-601', 'cost_per_gram': 93.0,   'updated_at': now.toIso8601String()},
    ];
    for (final s in stock) {
      await db.insert('stock_items', s);
    }

    // ── Ledger Entries ───────────────────────────────────────
    final ledger = [
      {'party_name': 'Ramesh Kumar',       'party_id': 1,    'party_type': 'karigar',  'transaction_type': 'debit',  'amount': 301410.0, 'metal_weight': 45.5,   'metal_type': 'gold',   'karat': 22,  'description': 'Gold issued for JB-2025-001 necklace',      'reference_no': 'JB-2025-001', 'date': now.subtract(const Duration(days: 10)).toIso8601String(), 'created_at': now.subtract(const Duration(days: 10)).toIso8601String()},
      {'party_name': 'Suresh Sonar',       'party_id': 2,    'party_type': 'karigar',  'transaction_type': 'debit',  'amount': 152664.0, 'metal_weight': 22.8,   'metal_type': 'gold',   'karat': 18,  'description': 'Gold issued for JB-2025-002 bracelet',      'reference_no': 'JB-2025-002', 'date': now.subtract(const Duration(days: 7)).toIso8601String(),  'created_at': now.subtract(const Duration(days: 7)).toIso8601String()},
      {'party_name': 'Ramesh Kumar',       'party_id': 1,    'party_type': 'karigar',  'transaction_type': 'credit', 'amount': 248394.0, 'metal_weight': 33.8,   'metal_type': 'gold',   'karat': 24,  'description': 'JB-2025-005 gold chain returned (completed)', 'reference_no': 'JB-2025-005', 'date': now.subtract(const Duration(days: 6)).toIso8601String(),  'created_at': now.subtract(const Duration(days: 6)).toIso8601String()},
      {'party_name': 'Suresh Sonar',       'party_id': 2,    'party_type': 'karigar',  'transaction_type': 'credit', 'amount': 357985.0, 'metal_weight': 53.5,   'metal_type': 'gold',   'karat': 22,  'description': 'JB-2025-007 mangalsutra returned (done)',    'reference_no': 'JB-2025-007', 'date': now.subtract(const Duration(days: 13)).toIso8601String(), 'created_at': now.subtract(const Duration(days: 13)).toIso8601String()},
      {'party_name': 'M/s Mehta Jewellers','party_id': null, 'party_type': 'customer', 'transaction_type': 'debit',  'amount': 485000.0, 'metal_weight': null,   'metal_type': null,     'karat': null,'description': 'Invoice: Necklace set + Mangalsutra (INV-001)','reference_no': 'INV-001',     'date': now.subtract(const Duration(days: 6)).toIso8601String(),  'created_at': now.subtract(const Duration(days: 6)).toIso8601String()},
      {'party_name': 'M/s Mehta Jewellers','party_id': null, 'party_type': 'customer', 'transaction_type': 'credit', 'amount': 285000.0, 'metal_weight': null,   'metal_type': null,     'karat': null,'description': 'Payment received for Diwali order ORD-001',  'reference_no': 'ORD-001',     'date': now.subtract(const Duration(days: 5)).toIso8601String(),  'created_at': now.subtract(const Duration(days: 5)).toIso8601String()},
      {'party_name': 'Shah Gold Suppliers','party_id': null, 'party_type': 'supplier', 'transaction_type': 'debit',  'amount': 364500.0, 'metal_weight': 50.0,   'metal_type': 'gold',   'karat': 24,  'description': 'Received 50g 24K gold bullion from Shah',    'reference_no': 'PO-2501',     'date': now.subtract(const Duration(days: 15)).toIso8601String(), 'created_at': now.subtract(const Duration(days: 15)).toIso8601String()},
      {'party_name': 'Shah Gold Suppliers','party_id': null, 'party_type': 'supplier', 'transaction_type': 'credit', 'amount': 364500.0, 'metal_weight': null,   'metal_type': null,     'karat': null,'description': 'Payment done to Shah Gold for PO-2501',      'reference_no': 'PO-2501',     'date': now.subtract(const Duration(days: 14)).toIso8601String(), 'created_at': now.subtract(const Duration(days: 14)).toIso8601String()},
      {'party_name': 'Anil Patil',         'party_id': 5,    'party_type': 'karigar',  'transaction_type': 'debit',  'amount': 11160.0,  'metal_weight': 120.0,  'metal_type': 'silver', 'karat': 999, 'description': 'Silver issued for JB-2025-006 bangles',     'reference_no': 'JB-2025-006', 'date': now.subtract(const Duration(days: 2)).toIso8601String(),  'created_at': now.subtract(const Duration(days: 2)).toIso8601String()},
      {'party_name': 'Vikas Soni',         'party_id': 4,    'party_type': 'karigar',  'transaction_type': 'debit',  'amount': 67828.0,  'metal_weight': 12.4,   'metal_type': 'gold',   'karat': 18,  'description': 'Gold issued for JB-2025-004 earrings',      'reference_no': 'JB-2025-004', 'date': now.subtract(const Duration(days: 3)).toIso8601String(),  'created_at': now.subtract(const Duration(days: 3)).toIso8601String()},
      {'party_name': 'M/s Patel Ornaments','party_id': null, 'party_type': 'customer', 'transaction_type': 'debit',  'amount': 620000.0, 'metal_weight': null,   'metal_type': null,     'karat': null,'description': 'Invoice: Bridal set order INV-002',          'reference_no': 'INV-002',     'date': now.subtract(const Duration(days: 3)).toIso8601String(),  'created_at': now.subtract(const Duration(days: 3)).toIso8601String()},
      {'party_name': 'M/s Patel Ornaments','party_id': null, 'party_type': 'customer', 'transaction_type': 'credit', 'amount': 310000.0, 'metal_weight': null,   'metal_type': null,     'karat': null,'description': 'Advance 50% received for ORD-002',          'reference_no': 'ADV-002',     'date': now.subtract(const Duration(days: 2)).toIso8601String(),  'created_at': now.subtract(const Duration(days: 2)).toIso8601String()},
      {'party_name': 'Silver House India', 'party_id': null, 'party_type': 'supplier', 'transaction_type': 'debit',  'amount': 111600.0, 'metal_weight': 1200.0, 'metal_type': 'silver', 'karat': 999, 'description': 'Received 1200g fine silver granules',        'reference_no': 'PO-2502',     'date': now.subtract(const Duration(days: 20)).toIso8601String(), 'created_at': now.subtract(const Duration(days: 20)).toIso8601String()},
      {'party_name': 'Silver House India', 'party_id': null, 'party_type': 'supplier', 'transaction_type': 'credit', 'amount': 111600.0, 'metal_weight': null,   'metal_type': null,     'karat': null,'description': 'Payment for silver granules PO-2502',        'reference_no': 'PO-2502',     'date': now.subtract(const Duration(days: 18)).toIso8601String(), 'created_at': now.subtract(const Duration(days: 18)).toIso8601String()},
    ];
    for (final l in ledger) {
      await db.insert('ledger_entries', l);
    }

    // ── Users ───────────────────────────────────────────────
    await db.insert('users', {
      'username': 'admin',
      'password_hash': 'admin123',
      'role': 'admin',
    });

    // ── Customers ───────────────────────────────────────────
    final customers = [
      {'name': 'M/s Patel Ornaments', 'phone': '9876123450', 'email': 'contact@patel.com', 'address': 'Zaveri Bazaar, Mumbai', 'dob': DateTime.now().toIso8601String(), 'anniversary': null, 'loyalty_points': 450, 'total_purchase_value': 930000.0, 'created_at': now.subtract(const Duration(days: 90)).toIso8601String()},
      {'name': 'Mehta Jewels',        'phone': '9812983476', 'email': 'sales@mehtaj.com',  'address': 'Surat, Gujarat',        'dob': now.subtract(const Duration(days: 30)).toIso8601String(), 'anniversary': now.subtract(const Duration(days: 5)).toIso8601String(), 'loyalty_points': 120, 'total_purchase_value': 285000.0, 'created_at': now.subtract(const Duration(days: 60)).toIso8601String()},
    ];
    for (final c in customers) {
      await db.insert('customers', c);
    }
  }

  // ────────────────────────────────────────────────────────
  //  METAL RATES
  // ────────────────────────────────────────────────────────

  Future<int> insertMetalRate(MetalRate rate) async {
    final db = await database;
    return db.insert('metal_rates', rate.toMap()..remove('id'));
  }

  Future<List<MetalRate>> getLatestRates() async {
    final db = await database;
    final maps = await db.rawQuery('''
      SELECT * FROM metal_rates
      WHERE id IN (
        SELECT MAX(id) FROM metal_rates GROUP BY metal_type, karat
      )
      ORDER BY metal_type, karat DESC
    ''');
    return maps.map((m) => MetalRate.fromMap(m)).toList();
  }

  Future<MetalRate?> getLatestRateForKarat(String metalType, int karat) async {
    final db = await database;
    final maps = await db.query(
      'metal_rates',
      where: 'metal_type = ? AND karat = ?',
      whereArgs: [metalType, karat],
      orderBy: 'id DESC',
      limit: 1,
    );
    return maps.isNotEmpty ? MetalRate.fromMap(maps.first) : null;
  }

  Future<List<MetalRate>> getRateHistory(String metalType, int karat,
      {int limit = 30}) async {
    final db = await database;
    final maps = await db.query(
      'metal_rates',
      where: 'metal_type = ? AND karat = ?',
      whereArgs: [metalType, karat],
      orderBy: 'date DESC',
      limit: limit,
    );
    return maps.map((m) => MetalRate.fromMap(m)).toList();
  }

  Future<int> updateMetalRate(MetalRate rate) async {
    final db = await database;
    return db.update('metal_rates', rate.toMap(),
        where: 'id = ?', whereArgs: [rate.id]);
  }

  Future<int> deleteMetalRate(int id) async {
    final db = await database;
    return db.delete('metal_rates', where: 'id = ?', whereArgs: [id]);
  }

  // ────────────────────────────────────────────────────────
  //  KARIGAR
  // ────────────────────────────────────────────────────────

  Future<int> insertKarigar(Karigar karigar) async {
    if (kIsWeb) {
      try {
        final res = await api.post('/owner-console/karigars', data: karigar.toMap()..remove('id'));
        if (res.statusCode == 200 && res.data != null) {
          return res.data['data']['id'] as int;
        }
      } catch (e) {
        print('[DatabaseService] insertKarigar web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.insert('karigar', karigar.toMap()..remove('id'));
  }

  Future<List<Karigar>> getAllKarigar({bool activeOnly = false}) async {
    if (kIsWeb) {
      try {
        final res = await api.get('/owner-console/karigars',
            queryParameters: activeOnly ? {'active': 'true'} : null);
        if (res.statusCode == 200 && res.data != null) {
          final List<dynamic> list = res.data['data'] as List<dynamic>;
          return list.map((m) => Karigar.fromMap(m)).toList();
        }
      } catch (e) {
        print('[DatabaseService] getAllKarigar web error: $e');
      }
      return [];
    }
    final db = await database;
    final maps = await db.query(
      'karigar',
      where: activeOnly ? 'is_active = 1' : null,
      orderBy: 'name ASC',
    );
    return maps.map((m) => Karigar.fromMap(m)).toList();
  }

  Future<Karigar?> getKarigarById(int id) async {
    if (kIsWeb) {
      try {
        final res = await api.get('/owner-console/karigars/$id');
        if (res.statusCode == 200 && res.data != null) {
          return Karigar.fromMap(res.data['data']);
        }
      } catch (e) {
        print('[DatabaseService] getKarigarById web error: $e');
      }
      return null;
    }
    final db = await database;
    final maps = await db.query('karigar', where: 'id = ?', whereArgs: [id]);
    return maps.isNotEmpty ? Karigar.fromMap(maps.first) : null;
  }

  Future<int> updateKarigar(Karigar karigar) async {
    if (kIsWeb) {
      try {
        final res = await api.put('/owner-console/karigars/${karigar.id}', data: karigar.toMap());
        if (res.statusCode == 200) return 1;
      } catch (e) {
        print('[DatabaseService] updateKarigar web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.update('karigar', karigar.toMap(),
        where: 'id = ?', whereArgs: [karigar.id]);
  }

  Future<int> deleteKarigar(int id) async {
    if (kIsWeb) {
      try {
        final res = await api.delete('/owner-console/karigars/$id');
        if (res.statusCode == 200) return 1;
      } catch (e) {
        print('[DatabaseService] deleteKarigar web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.delete('karigar', where: 'id = ?', whereArgs: [id]);
  }

  // ────────────────────────────────────────────────────────
  //  JOB SHEETS
  // ────────────────────────────────────────────────────────

  Future<int> insertJobSheet(JobSheet sheet) async {
    final db = await database;
    return db.insert('job_sheets', sheet.toMap()..remove('id'));
  }

  Future<List<JobSheet>> getAllJobSheets({String? stage}) async {
    final db = await database;
    final maps = await db.query(
      'job_sheets',
      where: stage != null ? 'stage = ?' : null,
      whereArgs: stage != null ? [stage] : null,
      orderBy: 'issue_date DESC',
    );
    return maps.map((m) => JobSheet.fromMap(m)).toList();
  }

  Future<List<JobSheet>> getJobSheetsByKarigar(int karigarId) async {
    final db = await database;
    final maps = await db.query(
      'job_sheets',
      where: 'karigar_id = ?',
      whereArgs: [karigarId],
      orderBy: 'issue_date DESC',
    );
    return maps.map((m) => JobSheet.fromMap(m)).toList();
  }

  Future<int> updateJobSheet(JobSheet sheet) async {
    final db = await database;
    return db.update('job_sheets', sheet.toMap(),
        where: 'id = ?', whereArgs: [sheet.id]);
  }

  Future<int> deleteJobSheet(int id) async {
    final db = await database;
    return db.delete('job_sheets', where: 'id = ?', whereArgs: [id]);
  }

  // ────────────────────────────────────────────────────────
  //  STOCK ITEMS
  // ────────────────────────────────────────────────────────

  Future<int> insertStockItem(StockItem item) async {
    if (kIsWeb) {
      try {
        final res = await api.post('/owner-console/stock', data: item.toMap()..remove('id'));
        if (res.statusCode == 200 && res.data != null) {
          final data = res.data['data'];
          return data['id'] as int;
        }
      } catch (e) {
        print('[DatabaseService] insertStockItem web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.insert('stock_items', item.toMap()..remove('id'));
  }

  Future<List<StockItem>> getAllStock({String? category}) async {
    if (kIsWeb) {
      try {
        final res = await api.get('/owner-console/stock');
        if (res.statusCode == 200 && res.data != null) {
          final List<dynamic> list = res.data['data'] as List<dynamic>;
          final items = list.map((m) => StockItem.fromMap(m)).toList();
          if (category != null) {
            return items.where((i) => i.category == category).toList();
          }
          return items;
        }
      } catch (e) {
        print('[DatabaseService] getAllStock web error: $e');
      }
      return [];
    }
    final db = await database;
    final maps = await db.query(
      'stock_items',
      where: category != null ? 'category = ?' : null,
      whereArgs: category != null ? [category] : null,
      orderBy: 'name ASC',
    );
    return maps.map((m) => StockItem.fromMap(m)).toList();
  }

  Future<int> updateStockItem(StockItem item) async {
    if (kIsWeb) {
      try {
        final res = await api.put('/owner-console/stock/${item.id}', data: item.toMap());
        if (res.statusCode == 200) {
          return 1;
        }
      } catch (e) {
        print('[DatabaseService] updateStockItem web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.update('stock_items', item.toMap(),
        where: 'id = ?', whereArgs: [item.id]);
  }

  Future<int> deleteStockItem(int id) async {
    if (kIsWeb) {
      try {
        final res = await api.delete('/owner-console/stock/$id');
        if (res.statusCode == 200) {
          return 1;
        }
      } catch (e) {
        print('[DatabaseService] deleteStockItem web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.delete('stock_items', where: 'id = ?', whereArgs: [id]);
  }

  // ────────────────────────────────────────────────────────
  //  LEDGER ENTRIES
  // ────────────────────────────────────────────────────────

  Future<int> insertLedgerEntry(LedgerEntry entry) async {
    if (kIsWeb) {
      try {
        final res = await api.post('/owner-console/ledger', data: entry.toMap()..remove('id'));
        if (res.statusCode == 200 && res.data != null) {
          final data = res.data['data'];
          return data['id'] as int;
        }
      } catch (e) {
        print('[DatabaseService] insertLedgerEntry web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.insert('ledger_entries', entry.toMap()..remove('id'));
  }

  Future<int> updateLedgerEntry(LedgerEntry entry) async {
    if (kIsWeb) {
      try {
        final res = await api.put('/owner-console/ledger/${entry.id}', data: entry.toMap());
        if (res.statusCode == 200) {
          return 1;
        }
      } catch (e) {
        print('[DatabaseService] updateLedgerEntry web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.update('ledger_entries', entry.toMap(),
        where: 'id = ?', whereArgs: [entry.id]);
  }

  Future<int> deleteLedgerEntry(int id) async {
    if (kIsWeb) {
      try {
        final res = await api.delete('/owner-console/ledger/$id');
        if (res.statusCode == 200) {
          return 1;
        }
      } catch (e) {
        print('[DatabaseService] deleteLedgerEntry web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.delete('ledger_entries', where: 'id = ?', whereArgs: [id]);
  }

  // ────────────────────────────────────────────────────────
  //  ORDERS
  // ────────────────────────────────────────────────────────

  Future<int> insertOrder(RetailOrder order) async {
    final db = await database;
    return db.insert('orders', order.toMap()..remove('id'));
  }

  Future<int> updateOrder(RetailOrder order) async {
    final db = await database;
    return db.update('orders', order.toMap(), where: 'id = ?', whereArgs: [order.id]);
  }

  Future<List<RetailOrder>> getOrdersByStatus(String status) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('orders', where: 'status = ?', whereArgs: [status], orderBy: 'created_at DESC');
    return maps.map((e) => RetailOrder.fromMap(e)).toList();
  }

  // --- Users ---
  Future<Map<String, dynamic>?> getUser(String username) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('users', where: 'username = ?', whereArgs: [username]);
    if (maps.isNotEmpty) return maps.first;
    return null;
  }

  Future<List<RetailOrder>> getAllOrders() async {
    final db = await database;
    final maps = await db.query('orders', orderBy: 'created_at DESC');
    return maps.map((m) => RetailOrder.fromMap(m)).toList();
  }

  Future<int> deleteOrder(int id) async {
    final db = await database;
    return db.delete('orders', where: 'id = ?', whereArgs: [id]);
  }

  Future<List<LedgerEntry>> getLedgerForParty(String partyName,
      {String? partyType}) async {
    if (kIsWeb) {
      final all = await getAllLedgerEntries();
      return all.where((e) => e.partyName == partyName && (partyType == null || e.partyType == partyType)).toList();
    }
    final db = await database;
    final maps = await db.query(
      'ledger_entries',
      where: partyType != null
          ? 'party_name = ? AND party_type = ?'
          : 'party_name = ?',
      whereArgs: partyType != null ? [partyName, partyType] : [partyName],
      orderBy: 'date DESC',
    );
    return maps.map((m) => LedgerEntry.fromMap(m)).toList();
  }

  Future<List<LedgerEntry>> getAllLedgerEntries(
      {int limit = 100, String? partyType}) async {
    if (kIsWeb) {
      try {
        final res = await api.get('/owner-console/ledger');
        if (res.statusCode == 200 && res.data != null) {
          final List<dynamic> list = res.data['data'] as List<dynamic>;
          var items = list.map((m) => LedgerEntry.fromMap(m)).toList();
          if (partyType != null) {
            items = items.where((e) => e.partyType == partyType).toList();
          }
          items.sort((a, b) => b.date.compareTo(a.date));
          return items.take(limit).toList();
        }
      } catch (e) {
        print('[DatabaseService] getAllLedgerEntries web error: $e');
      }
      return [];
    }
    final db = await database;
    final maps = await db.query(
      'ledger_entries',
      where: partyType != null ? 'party_type = ?' : null,
      whereArgs: partyType != null ? [partyType] : null,
      orderBy: 'date DESC',
      limit: limit,
    );
    return maps.map((m) => LedgerEntry.fromMap(m)).toList();
  }

  Future<double> getPartyBalance(String partyName) async {
    final db = await database;
    final result = await db.rawQuery('''
      SELECT
        SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) as total_credit
      FROM ledger_entries
      WHERE party_name = ?
    ''', [partyName]);
    final debit  = (result.first['total_debit']  as num?)?.toDouble() ?? 0.0;
    final credit = (result.first['total_credit'] as num?)?.toDouble() ?? 0.0;
    return debit - credit;
  }

  // ────────────────────────────────────────────────────────
  //  DASHBOARD STATS
  // ────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getDashboardStats() async {
    final db = await database;

    final activeKarigar = Sqflite.firstIntValue(await db.rawQuery(
      'SELECT COUNT(*) FROM karigar WHERE is_active = 1',
    )) ?? 0;

    final pendingJobs = Sqflite.firstIntValue(await db.rawQuery(
      "SELECT COUNT(*) FROM job_sheets WHERE stage != 'completed'",
    )) ?? 0;

    final totalStockWeight = (await db.rawQuery(
      'SELECT SUM(weight_grams) as total FROM stock_items',
    )).first['total'] as double? ?? 0.0;

    final totalStockItems = Sqflite.firstIntValue(await db.rawQuery(
      'SELECT COUNT(*) FROM stock_items',
    )) ?? 0;

    return {
      'active_karigar': activeKarigar,
      'pending_jobs': pendingJobs,
      'total_stock_weight': totalStockWeight,
      'total_stock_items': totalStockItems,
    };
  }

  // ────────────────────────────────────────────────────────
  //  CUSTOMERS (CRM)
  // ────────────────────────────────────────────────────────

  Future<int> insertCustomer(Customer customer) async {
    final db = await database;
    return db.insert('customers', customer.toMap());
  }

  Future<int> updateCustomer(Customer customer) async {
    final db = await database;
    return db.update('customers', customer.toMap(), where: 'id = ?', whereArgs: [customer.id]);
  }

  Future<List<Customer>> getAllCustomers({String? searchQuery}) async {
    final db = await database;
    List<Map<String, dynamic>> maps;
    if (searchQuery != null && searchQuery.isNotEmpty) {
      maps = await db.query('customers', where: 'name LIKE ? OR phone LIKE ?', whereArgs: ['%$searchQuery%', '%$searchQuery%'], orderBy: 'name ASC');
    } else {
      maps = await db.query('customers', orderBy: 'name ASC');
    }
    return maps.map((c) => Customer.fromMap(c)).toList();
  }

  Future<List<Customer>> getCustomersWithBirthdaysToday() async {
    final db = await database;
    final now = DateTime.now();
    final todayStr = '-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    
    final maps = await db.query(
      'customers',
      where: 'dob LIKE ?',
      whereArgs: ['%$todayStr%'],
    );
    return maps.map((c) => Customer.fromMap(c)).toList();
  }

  // ────────────────────────────────────────────────────────
  //  METAL BATCHES
  // ────────────────────────────────────────────────────────

  Future<int> insertMetalBatch(MetalBatch batch) async {
    final db = await database;
    return db.insert('metal_batches', batch.toMap()..remove('id'));
  }

  Future<List<MetalBatch>> getAllMetalBatches() async {
    final db = await database;
    final maps = await db.query('metal_batches', orderBy: 'received_date DESC');
    return maps.map((m) => MetalBatch.fromMap(m)).toList();
  }

  // ────────────────────────────────────────────────────────
  //  ALLOY COMPOSITIONS
  // ────────────────────────────────────────────────────────

  Future<int> insertAlloyComposition(AlloyComposition alloy) async {
    if (kIsWeb) {
      try {
        final res = await api.post('/owner-console/alloy-compositions', data: alloy.toMap()..remove('id'));
        if (res.statusCode == 200 && res.data != null) {
          final data = res.data['data'];
          return data['id'] as int;
        }
      } catch (e) {
        print('[DatabaseService] insertAlloyComposition web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.insert('alloy_compositions', alloy.toMap()..remove('id'));
  }

  Future<List<AlloyComposition>> getAllAlloyCompositions() async {
    if (kIsWeb) {
      try {
        final res = await api.get('/owner-console/alloy-compositions');
        if (res.statusCode == 200 && res.data != null) {
          final List<dynamic> list = res.data['data'] as List<dynamic>;
          return list.map((m) => AlloyComposition.fromMap(m)).toList();
        }
      } catch (e) {
        print('[DatabaseService] getAllAlloyCompositions web error: $e');
      }
      return [];
    }
    final db = await database;
    final maps = await db.query('alloy_compositions', orderBy: 'created_date DESC');
    return maps.map((m) => AlloyComposition.fromMap(m)).toList();
  }

  // ────────────────────────────────────────────────────────
  //  KARIGAR PAYROLL
  // ────────────────────────────────────────────────────────

  Future<int> insertKarigarPayroll(KarigarPayroll payroll) async {
    if (kIsWeb) {
      try {
        final res = await api.post('/owner-console/karigar-payroll', data: payroll.toMap()..remove('id'));
        if (res.statusCode == 200 && res.data != null) {
          final data = res.data['data'];
          return data['id'] as int;
        }
      } catch (e) {
        print('[DatabaseService] insertKarigarPayroll web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.insert('karigar_payroll', payroll.toMap()..remove('id'));
  }

  Future<List<KarigarPayroll>> getPayrollByKarigar(int karigarId) async {
    if (kIsWeb) {
      try {
        final res = await api.get('/owner-console/karigar-payroll/$karigarId');
        if (res.statusCode == 200 && res.data != null) {
          final List<dynamic> list = res.data['data'] as List<dynamic>;
          final items = list.map((m) => KarigarPayroll.fromMap(m)).toList();
          items.sort((a, b) => b.periodEnd.compareTo(a.periodEnd));
          return items;
        }
      } catch (e) {
        print('[DatabaseService] getPayrollByKarigar web error: $e');
      }
      return [];
    }
    final db = await database;
    final maps = await db.query('karigar_payroll', where: 'karigar_id = ?', whereArgs: [karigarId], orderBy: 'period_end DESC');
    return maps.map((m) => KarigarPayroll.fromMap(m)).toList();
  }

  // ────────────────────────────────────────────────────────
  //  WAREHOUSES
  // ────────────────────────────────────────────────────────

  Future<int> insertWarehouse(Warehouse warehouse) async {
    final db = await database;
    return db.insert('warehouses', warehouse.toMap()..remove('id'));
  }

  Future<List<Warehouse>> getAllWarehouses() async {
    final db = await database;
    final maps = await db.query('warehouses', orderBy: 'name ASC');
    return maps.map((m) => Warehouse.fromMap(m)).toList();
  }

  // ────────────────────────────────────────────────────────
  //  STOCK TRANSFERS
  // ────────────────────────────────────────────────────────

  Future<int> insertStockTransfer(StockTransfer transfer) async {
    if (kIsWeb) {
      return 0; // Stock transfers are a mobile-only warehouse feature
    }
    final db = await database;
    return db.insert('stock_transfers', transfer.toMap()..remove('id'));
  }

  Future<List<StockTransfer>> getAllStockTransfers() async {
    if (kIsWeb) {
      return []; // Stock transfers are a mobile-only warehouse feature
    }
    final db = await database;
    final maps = await db.query('stock_transfers', orderBy: 'transfer_date DESC');
    return maps.map((m) => StockTransfer.fromMap(m)).toList();
  }

  // ────────────────────────────────────────────────────────
  //  BOM RECIPES & COMPONENTS
  // ────────────────────────────────────────────────────────

  Future<int> insertBomRecipe(BomRecipe recipe) async {
    if (kIsWeb) {
      try {
        final res = await api.post('/owner-console/bom', data: recipe.toMap()..remove('id'));
        if (res.statusCode == 200 && res.data != null) {
          return res.data['data']['id'] as int;
        }
      } catch (e) {
        print('[DatabaseService] insertBomRecipe web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.insert('bom_recipes', recipe.toMap()..remove('id'));
  }

  Future<List<BomRecipe>> getAllBomRecipes() async {
    if (kIsWeb) {
      try {
        final res = await api.get('/owner-console/bom');
        if (res.statusCode == 200 && res.data != null) {
          final List<dynamic> list = res.data['data'] as List<dynamic>;
          return list.map((m) => BomRecipe.fromMap(m)).toList();
        }
      } catch (e) {
        print('[DatabaseService] getAllBomRecipes web error: $e');
      }
      return [];
    }
    final db = await database;
    final maps = await db.query('bom_recipes', orderBy: 'created_at DESC');
    return maps.map((m) => BomRecipe.fromMap(m)).toList();
  }

  Future<int> insertBomComponent(BomComponent component) async {
    if (kIsWeb) {
      try {
        final res = await api.post('/owner-console/bom-components', data: component.toMap()..remove('id'));
        if (res.statusCode == 200 && res.data != null) {
          return res.data['data']['id'] as int;
        }
      } catch (e) {
        print('[DatabaseService] insertBomComponent web error: $e');
      }
      return 0;
    }
    final db = await database;
    return db.insert('bom_components', component.toMap()..remove('id'));
  }

  Future<List<BomComponent>> getComponentsForRecipe(int recipeId) async {
    if (kIsWeb) {
      try {
        final res = await api.get('/owner-console/bom-components/$recipeId');
        if (res.statusCode == 200 && res.data != null) {
          final List<dynamic> list = res.data['data'] as List<dynamic>;
          return list.map((m) => BomComponent.fromMap(m)).toList();
        }
      } catch (e) {
        print('[DatabaseService] getComponentsForRecipe web error: $e');
      }
      return [];
    }
    final db = await database;
    final maps = await db.query('bom_components', where: 'recipe_id = ?', whereArgs: [recipeId]);
    return maps.map((m) => BomComponent.fromMap(m)).toList();
  }

  // ────────────────────────────────────────────────────────
  //  GIRVI LOANS & KITTY SCHEMES
  // ────────────────────────────────────────────────────────

  Future<int> insertGirviLoan(GirviLoan loan) async {
    final db = await database;
    return db.insert('girvi_loans', loan.toMap()..remove('id'));
  }

  Future<List<GirviLoan>> getGirviLoansByCustomer(int customerId) async {
    final db = await database;
    final maps = await db.query('girvi_loans', where: 'customer_id = ?', whereArgs: [customerId], orderBy: 'start_date DESC');
    return maps.map((m) => GirviLoan.fromMap(m)).toList();
  }

  Future<int> insertKittyScheme(KittyScheme scheme) async {
    final db = await database;
    return db.insert('kitty_schemes', scheme.toMap()..remove('id'));
  }

  Future<List<KittyScheme>> getKittySchemesByCustomer(int customerId) async {
    final db = await database;
    final maps = await db.query('kitty_schemes', where: 'customer_id = ?', whereArgs: [customerId], orderBy: 'start_date DESC');
    return maps.map((m) => KittyScheme.fromMap(m)).toList();
  }
}
