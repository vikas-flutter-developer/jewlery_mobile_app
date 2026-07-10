# AuraJewel – Unified Jewelry Retail & Workshop Platform

A modern, consolidated cross-platform Flutter application integrated with a Node.js Express backend. AuraJewel unifies the entire jewelry retail ecosystem into a single application codebase supporting customers, showroom staff, owners, and workshop artisans.

---

## 🌟 Key Modules & Features

### 1. Artisan Workshop Portal (Karigar Dashboard)
*   **Inventory & Metal Trackers**: Real-time monitoring of raw pending metal (weight in grams) and ledger balance.
*   **Tappable Detail Insights**: 
    *   *Pending Metal Screen*: Breakdown by gold purity (18K, 22K, 24K) with visual progress bars, active work order weights, and historical metal return logs.
    *   *Ledger Balance Screen*: Detailed credit/debit activity history, earnings summary (TDS deductions), and estimated karigar fees per job.
*   **Self-Service Submissions**: Quick actions to log completed metal returns to the showroom and submit wastage reconciliation audits.
*   **Security & Profile**: Edit contact coordinates (Emergency Phone, Address) and change account password with robust strength checks.

### 2. Owner Console
*   **Inventory & Stock Manager**: Consolidated view of all jewelry catalog metrics, weights, and counts.
*   **BOM (Bill of Materials) Planner**: Manage composite item assembly specifications, alloy ratios, and design components.
*   **Karigar Payroll & Wage Ledger**: Authorize artisan wage payouts, track deductions, and approve wastage reconciliations.

### 3. Staff POS & Showroom
*   **Retail Sales**: Check product catalogs, generate digital invoices, scan barcodes/QR codes, and manage point-of-sale customer flows.
*   **Stock Transfers**: Log physical item transfers across multiple showroom branches safely.

### 4. Customer Portal
*   **Virtual AR Try-On**: Augmented reality module to preview necklaces, rings, and earrings on device camera.
*   **Purchase & Repair Order Tracking**: Real-time status tracker for custom order fabrications and repairs.
*   **Catalog & Cart**: Interactive catalog with smart filters, wishlist, and address books.

---

## 🛠️ Project Architecture

```
├── backend/                       # Node.js Express REST Backend API
│   ├── karikar/                   # Karigar controllers & services
│   ├── retailer/                  # Retail POS, dashboard & catalog API
│   ├── routes/                    # Consolidated routes (Owner console endpoints)
│   ├── models/                    # MongoDB schemas (fallback local persistence)
│   └── apiRoutes.ts               # Root router definition
│
├── lib/                           # Flutter Application Codebase
│   ├── core/                      # Global Routing, App Theme & Unified Database Services
│   └── features/
│       ├── auth/                  # Authentication Providers
│       ├── customer_portal/       # Customer facing UI & Providers
│       ├── karikar_portal/        # Artisan Dashboard & Detail screens
│       ├── owner_console/         # Owner inventory & dashboard views
│       └── staff_pos/             # Retailer & Showroom staff views
```

*   **Offline/Online Syncing**: Uses a hybrid data layer. On mobile devices (`kIsWeb == false`), the app runs on a local SQLite repository; on Web or connected systems, data operations seamlessly route through a Remote API server.

---

## 🚀 Setup & Launch Instructions

### Prerequisites
*   [Flutter SDK](https://docs.flutter.dev/get-started/install) (Stable Channel)
*   [Node.js](https://nodejs.org/) (v16+) & `npm`

### 1. Spin Up the Backend Server
Navigate to the backend directory, install packages, and boot the API server:
```bash
cd backend
npm install
npm run dev
```
The server will run on `http://localhost:5000` (or as configured in your port variables).

### 2. Run the Flutter App
Initialize app packages and launch the dev environment:
```bash
flutter pub get
flutter run -d chrome  # To run the Web layout
# OR
flutter run            # To run on a connected emulator or device
```

---

## 🎨 Theme & Styling System
*   **Warm Light Aesthetic**: Curated warm ivory background (`#FAF7F2`), premium gold gradient accents (`#C8943A` to `#9B6E1E`), contrasting deep charcoal text (`#2A1F0E`), and clean card-based layouts.
*   **Responsive Screens**: Adapts dynamically for desktop browsers, tablet displays, and mobile device portals.
