import { Request, Response } from "express";
import { Branch, Sale } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { mockBranches, mockSales } from "../../../data/mockData.js";

// Helper to normalize strings
const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

// ================= CORE BRANCH REGISTRY HANDLERS =================

export const getBranches = async (req: Request, res: Response) => {
  try {
    let list: any[];
    if (isDbConnected()) {
      list = await Branch.find({ status: "ACTIVE" } as any).populate("managerId", "name email").lean();
    } else {
      list = mockBranches;
    }
    return res.json({
      success: true,
      data: list
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch branches" });
  }
};

export const createBranch = async (req: Request, res: Response) => {
  try {
    const { name, code, address, city, state, pincode, phone, email, managerName, isMainBranch } = req.body;

    const parsedCode = normalizeString(code).toUpperCase();
    const parsedName = normalizeString(name);

    if (!parsedCode || !parsedName) {
      return res.status(400).json({ success: false, error: "Name and code are required" });
    }

    const branchData = {
      name: parsedName,
      code: parsedCode,
      address: normalizeString(address),
      city: normalizeString(city),
      state: normalizeString(state),
      pincode: normalizeString(pincode),
      phone: normalizeString(phone),
      email: normalizeString(email),
      managerName: normalizeString(managerName),
      isMainBranch: isMainBranch || false,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let created: any;
    if (isDbConnected()) {
      const existingBranch = await Branch.findOne({ code: parsedCode } as any);
      if (existingBranch) {
        return res.status(409).json({ success: false, error: "Branch code already exists" });
      }
      created = new Branch(branchData);
      await created.save();
    } else {
      const existing = mockBranches.find(b => b.code === parsedCode);
      if (existing) {
        return res.status(409).json({ success: false, error: "Branch code already exists" });
      }
      created = { _id: `branch_${Date.now()}`, ...branchData };
      mockBranches.push(created);
    }

    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      data: created
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to create branch" });
  }
};

export const updateBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    let updated: any;
    if (isDbConnected()) {
      updated = await Branch.findByIdAndUpdate(id as any, updates as any, { new: true } as any);
      if (!updated) {
        return res.status(404).json({ success: false, error: "Branch not found" });
      }
    } else {
      const index = mockBranches.findIndex(b => b._id === id || b.code === id);
      if (index === -1) {
        return res.status(404).json({ success: false, error: "Branch not found" });
      }
      mockBranches[index] = { ...mockBranches[index], ...updates, updatedAt: new Date().toISOString() };
      updated = mockBranches[index];
    }

    return res.json({
      success: true,
      message: "Branch details successfully updated",
      data: updated
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to update branch" });
  }
};

// ================= ANALYTICS & CONSOLIDATED REPORTS (Features 110, 112, 113) =================

// Feature 110: Consolidated Owner Dashboard Metrics
export const getConsolidatedDashboard = async (req: Request, res: Response) => {
  try {
    let sales: any[];
    let branches: any[];

    if (isDbConnected()) {
      sales = await Sale.find({ status: "completed" }).lean();
      branches = await Branch.find({ status: "ACTIVE" } as any).lean();
    } else {
      sales = mockSales;
      branches = mockBranches;
    }

    let totalRevenue = 0;
    let totalTransactions = sales.length;
    
    // Group sales by branch
    const branchBreakdowns: Record<string, { salesValue: number; transactionCount: number }> = {};
    
    // Initialize groups for all active branches
    branches.forEach(b => {
      branchBreakdowns[b.code] = { salesValue: 0, transactionCount: 0 };
    });
    
    sales.forEach(sale => {
      const branchCode = sale.branchCode || "MAIN";
      const saleVal = Number(sale.payable || sale.total || 0);
      
      totalRevenue += saleVal;
      
      if (!branchBreakdowns[branchCode]) {
        branchBreakdowns[branchCode] = { salesValue: 0, transactionCount: 0 };
      }
      
      branchBreakdowns[branchCode].salesValue += saleVal;
      branchBreakdowns[branchCode].transactionCount += 1;
    });

    const averageTicket = totalTransactions > 0 ? (totalRevenue / totalTransactions) : 0;

    // Build responsive list format
    const breakdownArray = branches.map(b => {
      const metrics = branchBreakdowns[b.code] || { salesValue: 0, transactionCount: 0 };
      const sharePercentage = totalRevenue > 0 ? ((metrics.salesValue / totalRevenue) * 100) : 0;
      
      return {
        branchCode: b.code,
        branchName: b.name,
        managerName: b.managerName,
        salesValue: metrics.salesValue,
        transactionCount: metrics.transactionCount,
        sharePercentage: Number(sharePercentage.toFixed(2))
      };
    });

    return res.json({
      success: true,
      data: {
        totalRevenue,
        totalTransactions,
        averageTicket: Number(averageTicket.toFixed(2)),
        branchBreakdowns: breakdownArray
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate consolidated dashboard report"
    });
  }
};

// Feature 112: Branch-wise Profit & Loss (P&L) Comparison
export const getPLComparison = async (req: Request, res: Response) => {
  try {
    let sales: any[];
    let branches: any[];

    if (isDbConnected()) {
      sales = await Sale.find({ status: "completed" }).lean();
      branches = await Branch.find({ status: "ACTIVE" } as any).lean();
    } else {
      sales = mockSales;
      branches = mockBranches;
    }

    // Static Simulated Expenses per Branch Code to demonstrate premium P&L side-by-side grids
    const simulatedExpenses: Record<string, { rent: number; payroll: number; utilities: number }> = {
      MAIN: { rent: 45000, payroll: 35000, utilities: 8000 },
      DELHI: { rent: 35000, payroll: 25000, utilities: 6000 },
      BLR: { rent: 30000, payroll: 20000, utilities: 5000 },
    };

    const plReports = branches.map(b => {
      const code = b.code;
      const branchSales = sales.filter(s => (s.branchCode || "MAIN") === code);
      
      const grossRevenue = branchSales.reduce((acc, s) => acc + Number(s.subtotal || s.total || 0), 0);
      const discountAllowed = branchSales.reduce((acc, s) => acc + Number(s.discount || 0), 0);
      const netRevenue = grossRevenue - discountAllowed;

      // Estimating Cost of Goods Sold (Metal materials, gems) roughly at 72% of subtotal
      const costOfMaterials = Number((netRevenue * 0.72).toFixed(2));
      const makingChargesPaid = branchSales.reduce((acc, s) => {
        const itemMaking = s.items?.reduce((itemAcc: number, item: any) => itemAcc + Number(item.makingCharge || 0), 0) || 0;
        return acc + itemMaking;
      }, 0);

      const totalCOGS = costOfMaterials + makingChargesPaid;
      const grossProfit = netRevenue - totalCOGS;

      // Operating Expenses
      const opExSeeds = simulatedExpenses[code] || { rent: 25000, payroll: 15000, utilities: 4000 };
      const totalOpEx = opExSeeds.rent + opExSeeds.payroll + opExSeeds.utilities;
      
      const netProfit = grossProfit - totalOpEx;
      const marginPercentage = netRevenue > 0 ? ((netProfit / netRevenue) * 100) : 0;

      return {
        branchCode: code,
        branchName: b.name,
        revenue: {
          grossRevenue,
          discountAllowed,
          netRevenue
        },
        cogs: {
          materialsCost: costOfMaterials,
          makingCharges: makingChargesPaid,
          totalCOGS
        },
        grossProfit,
        expenses: {
          rent: opExSeeds.rent,
          payroll: opExSeeds.payroll,
          utilities: opExSeeds.utilities,
          totalOpEx
        },
        netProfit: Number(netProfit.toFixed(2)),
        marginPercentage: Number(marginPercentage.toFixed(2))
      };
    });

    return res.json({
      success: true,
      data: plReports
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate P&L comparison report"
    });
  }
};

// Feature 113: Branch-wise GST input/output filing logs separation
export const getGSTFiling = async (req: Request, res: Response) => {
  try {
    let sales: any[];
    let branches: any[];

    if (isDbConnected()) {
      sales = await Sale.find({ status: "completed" }).lean();
      branches = await Branch.find({ status: "ACTIVE" } as any).lean();
    } else {
      sales = mockSales;
      branches = mockBranches;
    }

    const gstReports = branches.map(b => {
      const code = b.code;
      const branchSales = sales.filter(s => (s.branchCode || "MAIN") === code);

      // Output tax calculated on Sales
      const taxableBase = branchSales.reduce((acc, s) => acc + Number(s.subtotal - (s.discount || 0)), 0);
      const totalOutputGST = branchSales.reduce((acc, s) => acc + Number(s.tax || 0), 0);

      // Indian standard: split total 3% GST on jewellery into 1.5% CGST and 1.5% SGST
      const cgstOutput = Number((totalOutputGST / 2).toFixed(2));
      const sgstOutput = Number((totalOutputGST / 2).toFixed(2));
      const igstOutput = 0; // Simulated intra-state

      // Input tax credits (from supplier purchases). 
      // Seeding input tax credit (ITC) offsets roughly at 60% of output tax to demonstrate filing data separation.
      const taxablePurchaseBase = Number((taxableBase * 0.55).toFixed(2));
      const totalInputGST = Number((totalOutputGST * 0.60).toFixed(2));
      const cgstInput = Number((totalInputGST / 2).toFixed(2));
      const sgstInput = Number((totalInputGST / 2).toFixed(2));

      // Net Tax Payable
      const netCGST = Number((cgstOutput - cgstInput).toFixed(2));
      const netSGST = Number((sgstOutput - sgstInput).toFixed(2));
      const netTaxPayable = Number((totalOutputGST - totalInputGST).toFixed(2));

      return {
        branchCode: code,
        branchName: b.name,
        salesGst: {
          taxableBase,
          cgst: cgstOutput,
          sgst: sgstOutput,
          igst: igstOutput,
          totalOutputGST
        },
        purchaseGst: {
          taxableBase: taxablePurchaseBase,
          cgst: cgstInput,
          sgst: sgstInput,
          totalInputGST
        },
        netFilingDue: {
          cgst: netCGST,
          sgst: netSGST,
          payableAmount: netTaxPayable
        }
      };
    });

    return res.json({
      success: true,
      data: gstReports
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate GST filing report"
    });
  }
};


