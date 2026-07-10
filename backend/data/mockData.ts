import fs from "fs";
import path from "path";

const storePath = path.resolve(process.cwd(), "backend", "data", "fallbackStore.json");

function readStoreSync(): any {
  try {
    if (!fs.existsSync(storePath)) return {};
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  } catch (e) {
    return {};
  }
}

function writeStoreSync(data: any) {
  try {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Error writing fallback store synchronously:", e);
  }
}

function createPersistentObjectProxy(obj: any, onChange: () => void): any {
  if (obj === null || typeof obj !== "object") return obj;
  return new Proxy(obj, {
    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      onChange();
      return result;
    },
    deleteProperty(target, prop) {
      const result = Reflect.deleteProperty(target, prop);
      onChange();
      return result;
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (value !== null && typeof value === "object" && !(value instanceof Date)) {
        return createPersistentObjectProxy(value, onChange);
      }
      return value;
    }
  });
}

function createPersistentArrayProxy<T>(key: string, defaultData: T[]): T[] {
  const store = readStoreSync();
  let initialData = store[key];
  if (!Array.isArray(initialData)) {
    initialData = defaultData;
    store[key] = initialData;
    writeStoreSync(store);
  }

  const persist = (targetArray: T[]) => {
    const currentStore = readStoreSync();
    currentStore[key] = targetArray;
    writeStoreSync(currentStore);
  };

  return new Proxy(initialData, {
    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      persist(target);
      return result;
    },
    deleteProperty(target, prop) {
      const result = Reflect.deleteProperty(target, prop);
      persist(target);
      return result;
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        const mutatingMethods = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"];
        if (mutatingMethods.includes(prop as string)) {
          return function(this: any, ...args: any[]) {
            const result = value.apply(target, args);
            persist(target);
            return result;
          };
        }
      }
      if (typeof prop === "string" && !isNaN(Number(prop)) && value !== null && typeof value === "object") {
        return createPersistentObjectProxy(value, () => persist(target));
      }
      return value;
    }
  }) as T[];
}

export const mockRates = createPersistentArrayProxy("mockRates", [
  { metal: "GOLD_24K", rate: 6200 },
  { metal: "GOLD_22K", rate: 5600 },
  { metal: "SILVER", rate: 75 },
]);

export const mockInventory = createPersistentArrayProxy("mockInventory", [
  { _id: "mock1", barcode: "MOCK1", name: "Gold Necklace", weight: 120, purity: "22K", type: "Necklace", stock: 1, status: "In Stock", price: 672000, designCode: "DSGN-101", showcase: "Showcase A", tray: "Tray 1", inwardDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), sku: "SKU-N-001" },
  { _id: "mock2", barcode: "MOCK2", name: "Silver Coin", weight: 50, purity: "Fine", type: "Coin", stock: 10, status: "In Stock", price: 3750, designCode: "DSGN-102", showcase: "Showcase B", tray: "Tray 3", inwardDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), sku: "SKU-C-002" },
  { _id: "mock_bar_001", barcode: "BAR001", name: "Gold Item", weight: 10, purity: "80%", type: "Ring", stock: 1, status: "In Stock", price: 52000, designCode: "DSGN-103", showcase: "Showcase A", tray: "Tray 2", inwardDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), sku: "SKU-R-003" },
  { _id: "mock_huid_001", barcode: "HUID1", sku: "HUID-TEST-001", huid: "HUID-TEST-001", branchId: "MAIN", status: "In Stock", name: "Gold Pendant", weight: 5, purity: "22K", type: "Necklace", stock: 1, price: 40000, designCode: "DSGN-101", showcase: "Showcase C", tray: "Tray 1", inwardDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: "mock_diamond_001", barcode: "BAR_DIA_001", name: "Loose Round Solitaire", weight: 0.25, purity: "VVS1", type: "DIAMOND", stock: 1, status: "In Stock", price: 45000, designCode: "DSGN-DIA-001", showcase: "HQ Vault", tray: "Diamond Tray 1", inwardDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), sku: "SKU-DIA-001", branchId: "MAIN", grossWeight: 0.25, netWeight: 0.25, fineWeight: 0.25, diamondWeight: 0.25, huid: "HUID-DIA-001", diamondCarat: 1.25, diamondCut: "Excellent", diamondColor: "F", diamondClarity: "VVS1", diamondType: "Natural" },
  { _id: "mock_diamond_002", barcode: "BAR_DIA_002", name: "Loose Cushion Cut Diamond", weight: 0.4, purity: "VS2", type: "DIAMOND", stock: 1, status: "In Stock", price: 85000, designCode: "DSGN-DIA-002", showcase: "HQ Vault", tray: "Diamond Tray 2", inwardDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), sku: "SKU-DIA-002", branchId: "MAIN", grossWeight: 0.4, netWeight: 0.4, fineWeight: 0.4, diamondWeight: 0.4, huid: "HUID-DIA-002", diamondCarat: 2.0, diamondCut: "Very Good", diamondColor: "G", diamondClarity: "VS2", diamondType: "Lab-Grown" },
]);

export const mockKhata = createPersistentArrayProxy("mockKhata", [
  { _id: "k1", customerName: "Raj Kumar", customerPhone: "9999999999", balance: 5000, transactions: [] },
]);

export const mockOrders: any[] = createPersistentArrayProxy("mockOrders", [
  {
    _id: "mock_order_1",
    customer: "Rajesh Sharma",
    customerName: "Rajesh Sharma",
    customerPhone: "9876543299",
    customerEmail: "rajesh@gmail.com",
    metalType: "GOLD",
    carat: "22K",
    priority: "High",
    status: "PROCESSING",
    items: [
      { category: "Necklace", weight: 45, description: "Bridal choker gold necklace" }
    ],
    billingSummary: {
      issuedGrams: 45,
      sellingPrice: 250000,
      totalPrice: 257500,
      gstRate: 3,
      gstAmount: 7500
    },
    deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "mock_order_2",
    customer: "Raj Kumar",
    customerName: "Raj Kumar",
    customerPhone: "9999999999",
    metalType: "GOLD",
    carat: "22K",
    priority: "Normal",
    status: "PENDING",
    items: [
      { category: "Ring", weight: 6, description: "Men's polished gold band" }
    ],
    billingSummary: {
      issuedGrams: 6,
      sellingPrice: 34000,
      totalPrice: 35020,
      gstRate: 3,
      gstAmount: 1020
    },
    deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
]);


export const mockSales: any[] = createPersistentArrayProxy("mockSales", [
  {
    _id: "sale_1",
    orderId: "INV-2026-001",
    estimateId: "EST-901",
    customerId: "cust_1",
    customerName: "Anil Mehta",
    customerPhone: "9876543210",
    customerEmail: "anil@example.com",
    items: [
      { barcode: "MOCK1", name: "Gold Temple Necklace", weight: 50, purity: "22K", price: 280000, total: 280000, makingCharge: 12000 }
    ],
    subtotal: 280000,
    discount: 10000,
    tax: 8100, // 3% of 270000
    total: 278100,
    exchangeDiscount: 0,
    payable: 278100,
    paymentMethod: "Bank Transfer",
    payments: [{ method: "Bank Transfer", amount: 278100 }],
    status: "completed",
    branchCode: "MAIN",
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "sale_2",
    orderId: "INV-2026-002",
    estimateId: "EST-902",
    customerId: "cust_2",
    customerName: "Priyanka Sen",
    customerPhone: "9811223344",
    items: [
      { barcode: "MOCK2", name: "Victorian Silver Coins", weight: 80, purity: "Fine", price: 60000, total: 60000, makingCharge: 2000 }
    ],
    subtotal: 60000,
    discount: 2000,
    tax: 1740, // 3% of 58000
    total: 59740,
    exchangeDiscount: 0,
    payable: 59740,
    paymentMethod: "UPI",
    payments: [{ method: "UPI", amount: 59740 }],
    status: "completed",
    branchCode: "DELHI",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "sale_3",
    orderId: "INV-2026-003",
    estimateId: "EST-903",
    customerId: "cust_3",
    customerName: "Rahul Hegde",
    customerPhone: "9845098450",
    items: [
      { barcode: "BAR001", name: "Solitaire Diamond Ring", weight: 8, purity: "18K", price: 150000, total: 150000, makingCharge: 8000 }
    ],
    subtotal: 150000,
    discount: 5000,
    tax: 4350, // 3% of 145000
    total: 149350,
    exchangeDiscount: 0,
    payable: 149350,
    paymentMethod: "Credit Card",
    payments: [{ method: "Credit Card", amount: 149350 }],
    status: "completed",
    branchCode: "BLR",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "sale_4",
    orderId: "INV-2026-004",
    estimateId: "EST-904",
    customerId: "cust_1",
    customerName: "Anil Mehta",
    customerPhone: "9876543210",
    items: [
      { barcode: "HUID1", name: "Gold Kada Bangles", weight: 30, purity: "22K", price: 168000, total: 168000, makingCharge: 6000 }
    ],
    subtotal: 168000,
    discount: 8000,
    tax: 4800, // 3% of 160000
    total: 164800,
    exchangeDiscount: 15000,
    payable: 149800,
    paymentMethod: "Mixed",
    payments: [
      { method: "Cash", amount: 49800 },
      { method: "UPI", amount: 100000 }
    ],
    status: "completed",
    branchCode: "MAIN",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "sale_5",
    orderId: "INV-2026-005",
    estimateId: "EST-905",
    customerId: "cust_4",
    customerName: "Sonia Sharma",
    customerPhone: "9988776655",
    items: [
      { barcode: "BAR002", name: "Gold Floral Choker", weight: 15, purity: "22K", price: 84000, total: 84000, makingCharge: 4000 }
    ],
    subtotal: 84000,
    discount: 0,
    tax: 2520, // 3% of 84000
    total: 86520,
    exchangeDiscount: 0,
    payable: 86520,
    paymentMethod: "UPI",
    payments: [{ method: "UPI", amount: 86520 }],
    status: "completed",
    branchCode: "DELHI",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
]);

export const mockKarikars: any[] = createPersistentArrayProxy("mockKarikars", [
  {
    _id: "mock_karikar_1",
    name: "Bhavesh Goldsmith",
    email: "bhaveshkarikar@gmail.com",
    password: "karikar_pass",
    aadhar: "1111-2222-3333",
    goldStock: 25.5,
    ledgerBalance: 4500,
    jobCards: [
      {
        _id: "JC-101",
        orderId: "mock_order_1",
        issuedGrossWeight: 45.0,
        issuedAlloy: 1.5,
        issuedGoldWeight: 43.5,
        issuedPurity: "22K",
        issuedStones: [],
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        status: "OPEN",
        issuedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    settlements: [
      {
        _id: "settle_1",
        amount: 2000,
        type: "DEBIT",
        paymentMethod: "CASH",
        note: "Weekly wage advance",
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    metalReturns: [],
    assignedWork: "mock_order_1",
    workDescription: "Gold bridal necklace polishing",
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  }
]);

export const mockOldGoldPurchases: any[] = createPersistentArrayProxy("mockOldGoldPurchases", [
  {
    purchaseId: "OGP-9081",
    customerName: "Sonia Sharma",
    customerPhone: "9988776655",
    metalType: "GOLD",
    grossWeight: 18.5,
    evaluationPurity: "20K",
    netFineGoldWeight: 15.4,
    purchaseRate: 5400,
    totalPaid: 83160,
    paymentMethod: "Bank Transfer",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
]);
export const mockOldGoldStock: any[] = createPersistentArrayProxy("mockOldGoldStock", [
  {
    _id: "ogs_1",
    itemType: "Bangles",
    grossWeight: 18.5,
    purity: "20K",
    status: "In Vault",
    inwardDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
]);
export const mockOldGoldDeductions: any[] = createPersistentArrayProxy("mockOldGoldDeductions", []);
export const mockOldGoldIssuances: any[] = createPersistentArrayProxy("mockOldGoldIssuances", []);
export const mockOldGoldMeltingLogs: any[] = createPersistentArrayProxy("mockOldGoldMeltingLogs", [
  {
    meltLogId: "ML-2026-001",
    itemsMelted: [
      { itemType: "Old Gold Rings", grossWeight: 35.0, purity: "22K" }
    ],
    totalWeightBeforeMelt: 35.0,
    barWeightReceived: 34.6,
    meltingLoss: 0.4,
    receivedPurity: "995 Fine",
    furnaceTemp: 1064,
    meltedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  }
]);

export const mockDesigns: any[] = createPersistentArrayProxy("mockDesigns", [
  { _id: "design_1", designCode: "DSGN-101", name: "Bridal Temple Necklace", category: "Necklace", metalType: "GOLD", standardPurity: "22K", minStockThreshold: 3, description: "Elegant traditional wedding temple necklace", image: "", units: 0, createdAt: new Date().toISOString() },
  { _id: "design_2", designCode: "DSGN-102", name: "Victoria Silver Coin", category: "Coin", metalType: "SILVER", standardPurity: "Fine", minStockThreshold: 5, description: "999 Fine Silver Coin with Victorian engraving", image: "", units: 0, createdAt: new Date().toISOString() },
  { _id: "design_3", designCode: "DSGN-103", name: "Solitaire Diamond Ring", category: "Ring", metalType: "GOLD", standardPurity: "18K", minStockThreshold: 2, description: "Classic 1-carat diamond solitaire gold ring", image: "", units: 0, createdAt: new Date().toISOString() }
]);

export const mockWishlists: any[] = createPersistentArrayProxy("mockWishlists", [
  {
    _id: "wish_1",
    customerId: "cust_1",
    customerName: "Anil Mehta",
    designCode: "DSGN-101",
    designName: "Bridal Temple Necklace",
    addedAt: new Date().toISOString()
  }
]);

export const mockBranches = createPersistentArrayProxy("mockBranches", [
  { 
    _id: "branch_main", 
    name: "Main HQ - Mumbai", 
    code: "MAIN", 
    address: "101 Gold Plaza, Zaveri Bazaar", 
    city: "Mumbai", 
    state: "Maharashtra", 
    pincode: "400002", 
    phone: "9876543210", 
    email: "hq@aurajewel.com", 
    managerName: "Aditya Mehta", 
    isMainBranch: true, 
    status: "ACTIVE" 
  },
  { 
    _id: "branch_delhi", 
    name: "Delhi - Connaught Place", 
    code: "DELHI", 
    address: "G-12 Regal Building, CP", 
    city: "New Delhi", 
    state: "Delhi", 
    pincode: "110001", 
    phone: "9876543211", 
    email: "delhi@aurajewel.com", 
    managerName: "Rajesh Sharma", 
    isMainBranch: false, 
    status: "ACTIVE" 
  },
  { 
    _id: "branch_blr", 
    name: "Bangalore - Indiranagar", 
    code: "BLR", 
    address: "404 100ft Road, Indiranagar", 
    city: "Bangalore", 
    state: "Karnataka", 
    pincode: "560038", 
    phone: "9876543212", 
    email: "blr@aurajewel.com", 
    managerName: "Karan Hegde", 
    isMainBranch: false, 
    status: "ACTIVE" 
  }
]);

export const mockTransfers: any[] = createPersistentArrayProxy("mockTransfers", [
  {
    transferId: "TRF-A183K",
    fromBranchCode: "MAIN",
    toBranchCode: "DELHI",
    status: "PENDING_APPROVAL",
    items: [
      { sku: "SKU-N-001", name: "Gold Temple Necklace", quantity: 2, unit: "units" }
    ],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Restocking requested due to upcoming wedding season showcase."
  },
  {
    transferId: "TRF-B928J",
    fromBranchCode: "MAIN",
    toBranchCode: "BLR",
    status: "APPROVED",
    items: [
      { sku: "SKU-C-002", name: "Victorian Silver Coins", quantity: 15, unit: "units" }
    ],
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Approved bulk silver inventory dispatch."
  },
  {
    transferId: "TRF-C837D",
    fromBranchCode: "DELHI",
    toBranchCode: "MAIN",
    status: "RECEIVED",
    items: [
      { sku: "SKU-R-003", name: "Solitaire Diamond Ring", quantity: 1, unit: "units" }
    ],
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    receivedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    receivedBy: "Aditya Mehta",
    notes: "Surplus stock return transfer."
  }
]);

export const mockAmlLogs: any[] = createPersistentArrayProxy("mockAmlLogs", [
  {
    logId: "AML-2026-001",
    customerName: "Anil Mehta",
    customerPhone: "9876543210",
    amount: 278100,
    paymentMethod: "Bank Transfer",
    panNumber: "ABCDE1234F",
    flaggedReason: "High-value sale transaction exceeding ₹2 Lakhs limit",
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  }
]);

export const mockGoldLoans: any[] = createPersistentArrayProxy("mockGoldLoans", [
  {
    loanId: "L-2026-001",
    customerName: "Suresh Kumar",
    customerPhone: "9988776655",
    weightGrams: 45,
    purity: "22K",
    evaluatedValue: 240000,
    loanAmount: 180000, // Capped at 75% LTV under standard RBI rules
    interestRate: 9.5, // RBI Capped gold loan interest rate
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    loanId: "L-2026-002",
    customerName: "Ramesh Patel",
    customerPhone: "9822334455",
    weightGrams: 30,
    purity: "22K",
    evaluatedValue: 180000,
    loanAmount: 135000,
    interestRate: 9.5,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 155 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    loanId: "L-2026-003",
    customerName: "Priya Nair",
    customerPhone: "9744556677",
    weightGrams: 60,
    purity: "22K",
    evaluatedValue: 360000,
    loanAmount: 250000,
    interestRate: 9.5,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 160 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    loanId: "L-2026-004",
    customerName: "Amit Shah",
    customerPhone: "9122334455",
    weightGrams: 100,
    purity: "24K",
    evaluatedValue: 650000,
    loanAmount: 480000,
    interestRate: 9.5,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 165 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    loanId: "L-2026-005",
    customerName: "Vikram Malhotra",
    customerPhone: "9899112233",
    weightGrams: 15,
    purity: "22K",
    evaluatedValue: 90000,
    loanAmount: 65000,
    interestRate: 9.5,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 170 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    loanId: "L-2026-006",
    customerName: "Deepa Rao",
    customerPhone: "9344551122",
    weightGrams: 40,
    purity: "18K",
    evaluatedValue: 200000,
    loanAmount: 140000,
    interestRate: 9.5,
    status: "ACTIVE",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 175 * 24 * 60 * 60 * 1000).toISOString()
  }
]);

export const mockManufacturerBarcodes: any[] = createPersistentArrayProxy("mockManufacturerBarcodes", []);
export const mockRetailerBarcodes: any[] = createPersistentArrayProxy("mockRetailerBarcodes", []);
