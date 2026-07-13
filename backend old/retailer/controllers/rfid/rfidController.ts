import { Request, Response } from "express";
import { RFIDTag, Inventory } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { mockInventory } from "../../../data/mockData.js";

// In-Memory/Fallback Store for RFID operations
let mockRfidTags: any[] = [
  {
    epc: "E2801130200078A1B2C3D401",
    inventoryId: "INV-GOLD-001", // Links to a barcode/SKU
    status: "In Stock",
    auditHistory: [
      {
        timestamp: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        status: "Assigned",
        userId: "staff_1",
        notes: "Linked at Inward",
        branchId: "BR-HQ"
      },
      {
        timestamp: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        status: "In Stock",
        userId: "staff_1",
        notes: "Placed in HQ Vault Showcase A",
        branchId: "BR-HQ"
      }
    ],
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
  },
  {
    epc: "E2801130200078A1B2C3D402",
    inventoryId: "INV-GOLD-002",
    status: "In Stock",
    auditHistory: [
      {
        timestamp: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        status: "Assigned",
        userId: "staff_1",
        notes: "Linked at Inward",
        branchId: "BR-HQ"
      }
    ],
    createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
  },
  {
    epc: "E2801130200078A1B2C3D403",
    inventoryId: "INV-SILVER-001",
    status: "Sold",
    auditHistory: [
      {
        timestamp: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
        status: "Assigned",
        userId: "staff_2",
        notes: "Inward linking completed",
        branchId: "BR-MUMBAI"
      },
      {
        timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        status: "POS Scanned",
        userId: "pos_user_1",
        notes: "Scanned at POS terminal 2",
        branchId: "BR-MUMBAI"
      },
      {
        timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        status: "Sold",
        userId: "pos_user_1",
        notes: "Checked out with Invoice INV-900821",
        branchId: "BR-MUMBAI"
      }
    ],
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  }
];

// 1. LINK RFID TAG TO ITEM AT INWARD (Feature 6)
export const linkTag = async (req: Request, res: Response) => {
  try {
    const { epc, inventoryId, branchId, userId } = req.body;

    if (!epc || !inventoryId) {
      return res.status(400).json({
        success: false,
        error: "Both RFID EPC code and Inventory Item code (SKU/Barcode) are required."
      });
    }

    const formattedEpc = String(epc).toUpperCase().trim();
    const formattedInvId = String(inventoryId).trim();

    // Check if tag already linked
    let tagExists = false;
    if (isDbConnected()) {
      const existing = await RFIDTag.findOne({ epc: formattedEpc });
      if (existing) tagExists = true;
    } else {
      tagExists = mockRfidTags.some(t => t.epc === formattedEpc);
    }

    if (tagExists) {
      return res.status(400).json({
        success: false,
        error: "This RFID EPC is already assigned to another jewelry item."
      });
    }

    // Link tag
    const newTagData = {
      epc: formattedEpc,
      inventoryId: formattedInvId,
      status: "In Stock",
      auditHistory: [
        {
          timestamp: new Date().toISOString(),
          status: "Assigned",
          userId: userId || "system_inward",
          notes: "RFID assigned to item at Inward",
          branchId: branchId || "HQ"
        },
        {
          timestamp: new Date().toISOString(),
          status: "In Stock",
          userId: userId || "system_inward",
          notes: "Ornament received in stock",
          branchId: branchId || "HQ"
        }
      ]
    };

    let linkedTag: any;
    if (isDbConnected()) {
      linkedTag = await RFIDTag.create(newTagData);
    } else {
      linkedTag = { _id: `rfid_${Date.now()}`, ...newTagData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      mockRfidTags.push(linkedTag);
    }

    return res.status(201).json({
      success: true,
      message: "RFID Tag linked successfully to jewelry item!",
      data: linkedTag
    });
  } catch (error: any) {
    console.error("RFID tag assignment failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to assign RFID tag" });
  }
};

// 2. BULK RECONCILIATION FOR STOCK AUDIT (Feature 8)
export const bulkAudit = async (req: Request, res: Response) => {
  try {
    const { scannedEpcs, branchId } = req.body;

    if (!Array.isArray(scannedEpcs)) {
      return res.status(400).json({
        success: false,
        error: "scannedEpcs must be a non-empty array of EPC strings."
      });
    }

    const branch = branchId || "BR-HQ";
    const cleanScanned = scannedEpcs.map(e => String(e).toUpperCase().trim());

    // 1. Get all active tags expected to be "In Stock" at this branch
    let expectedTags: any[] = [];
    if (isDbConnected()) {
      expectedTags = await RFIDTag.find({ status: "In Stock" }).lean();
    } else {
      expectedTags = mockRfidTags.filter(t => t.status === "In Stock");
    }

    const matched: any[] = [];
    const missing: any[] = [];
    const extra: string[] = [];

    // Map expected items to easily look up
    const expectedMap = new Map<string, any>();
    expectedTags.forEach(t => expectedMap.set(t.epc, t));

    // Scanned tags lookup
    const scannedSet = new Set(cleanScanned);

    // Identify Matched vs Missing
    expectedTags.forEach(t => {
      if (scannedSet.has(t.epc)) {
        matched.push(t);
      } else {
        missing.push(t);
      }
    });

    // Identify Extra scanned tags (not expected to be in stock at this branch)
    cleanScanned.forEach(epc => {
      if (!expectedMap.has(epc)) {
        extra.push(epc);
      }
    });

    return res.json({
      success: true,
      data: {
        totalExpected: expectedTags.length,
        totalScanned: cleanScanned.length,
        counts: {
          matched: matched.length,
          missing: missing.length,
          extra: extra.length
        },
        matchedList: matched,
        missingList: missing,
        extraList: extra
      }
    });
  } catch (error: any) {
    console.error("RFID bulk audit failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to process bulk audit" });
  }
};

// 3. RFID ANTI-THEFT GATE BREACH LOGGER (Feature 9)
export const antiTheftGate = async (req: Request, res: Response) => {
  try {
    const { epc, gateId } = req.body;

    if (!epc) {
      return res.status(400).json({ success: false, error: "Scanned tag EPC is required." });
    }

    const formattedEpc = String(epc).toUpperCase().trim();
    
    // Find tag status
    let tag: any;
    if (isDbConnected()) {
      tag = await RFIDTag.findOne({ epc: formattedEpc });
    } else {
      tag = mockRfidTags.find(t => t.epc === formattedEpc);
    }

    if (!tag) {
      // Unrecognized tag passing
      return res.json({
        success: true,
        alarmTriggered: true,
        alertType: "UNREGISTERED_TAG",
        message: "🚨 Alarm! Unregistered RFID tag detected passing exit gate!",
        data: { epc: formattedEpc, status: "Unknown" }
      });
    }

    const alarmTriggered = tag.status === "In Stock" || tag.status === "Assigned";
    
    // Log audit breach in history if alarm is triggered
    if (alarmTriggered) {
      const auditEntry = {
        timestamp: new Date().toISOString(),
        status: "Defective", // temporary flag or custom status for security alert
        userId: "exit_gate_scanner",
        notes: `🚨 BREACH TRIGGERED: Unsold stock scanned at Exit Gate: ${gateId || "Gate-A"}`,
        branchId: tag.branchId || "HQ"
      };

      if (isDbConnected()) {
        await RFIDTag.findOneAndUpdate(
          { epc: formattedEpc },
          { $push: { auditHistory: auditEntry } }
        );
      } else {
        tag.auditHistory.push(auditEntry);
      }
    }

    return res.json({
      success: true,
      alarmTriggered,
      alertType: alarmTriggered ? "SECURITY_BREACH" : "AUTHORIZED_EXIT",
      message: alarmTriggered 
        ? "🚨 SECURITY ALERT: Unsold item detected passing exit gate! Sounding alarms."
        : "✅ Authorized: Sold item exit cleared.",
      data: tag
    });
  } catch (error: any) {
    console.error("RFID gate check failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed exit gate verification" });
  }
};

// 4. RFID LIFECYCLE LOG TIMELINE (Feature 10)
export const getLifecycle = async (req: Request, res: Response) => {
  try {
    const { epc } = req.params;

    if (!epc) {
      return res.status(400).json({ success: false, error: "RFID EPC parameter is required." });
    }

    const formattedEpc = String(epc).toUpperCase().trim();

    let tag: any;
    if (isDbConnected()) {
      tag = await RFIDTag.findOne({ epc: formattedEpc }).lean();
    } else {
      tag = mockRfidTags.find(t => t.epc === formattedEpc);
    }

    if (!tag) {
      return res.status(404).json({
        success: false,
        error: "RFID tag records not found in our database."
      });
    }

    return res.json({
      success: true,
      data: tag
    });
  } catch (error: any) {
    console.error("RFID lifecycle query failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to query tag lifecycle" });
  }
};

// 5. INTER-BRANCH TRANSFER CONFIRMATION SWEEP (Feature 11)
export const confirmTransfer = async (req: Request, res: Response) => {
  try {
    const { transferId, scannedEpcs, branchId, userId } = req.body;

    if (!transferId || !Array.isArray(scannedEpcs)) {
      return res.status(400).json({
        success: false,
        error: "transferId and scannedEpcs array are required."
      });
    }

    const cleanEpcs = scannedEpcs.map(e => String(e).toUpperCase().trim());
    const targetBranch = branchId || "BR-MUMBAI";

    const updateLog = {
      timestamp: new Date().toISOString(),
      status: "In Stock",
      userId: userId || "staff_recv",
      notes: `Branch stock transfer confirmed via RFID container sweep. Received at: ${targetBranch}`,
      branchId: targetBranch
    };

    // Auto update status of matched tags to "In Stock" at the destination branch
    if (isDbConnected()) {
      await RFIDTag.updateMany(
        { epc: { $in: cleanEpcs } },
        { 
          $set: { status: "In Stock" },
          $push: { auditHistory: updateLog }
        }
      );
    } else {
      mockRfidTags.forEach(t => {
        if (cleanEpcs.includes(t.epc)) {
          t.status = "In Stock";
          t.auditHistory.push(updateLog);
          t.updatedAt = new Date().toISOString();
        }
      });
    }

    return res.json({
      success: true,
      message: `Container sweep registered! ${cleanEpcs.length} tags verified. Inter-branch stock transfer ${transferId} confirmed successfully.`,
      confirmedCount: cleanEpcs.length
    });
  } catch (error: any) {
    console.error("RFID transfer confirmation failed", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to confirm RFID transfer" });
  }
};

// 6. GET ALL ACTIVE RFID TAGS LIST (Auxiliary)
export const getAllTags = async (req: Request, res: Response) => {
  try {
    let list: any[];
    if (isDbConnected()) {
      list = await RFIDTag.find({}).lean();
    } else {
      list = mockRfidTags;
    }
    return res.json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};


