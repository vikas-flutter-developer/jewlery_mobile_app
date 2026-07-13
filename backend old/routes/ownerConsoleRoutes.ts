import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();
const storePath = path.resolve(process.cwd(), "backend", "data", "fallbackStore.json");

async function readStore() {
  if (!fs.existsSync(storePath)) {
    return {};
  }
  const raw = await fs.promises.readFile(storePath, "utf8");
  return JSON.parse(raw);
}

async function writeStore(store: any) {
  await fs.promises.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

const ensureSeed = async (store: any) => {
  const now = new Date().toISOString();
  let changed = false;

  if (!store.ownerStockItems || store.ownerStockItems.length === 0) {
    store.ownerStockItems = [
      { id: 1, name: 'Gold Bullion Bar', category: 'raw', metal_type: 'gold', karat: 24, weight_grams: 500.0, pieces: 2, location: 'Vault A', cost_per_gram: 7290.0, updated_at: now },
      { id: 2, name: '22K Gold Ingot', category: 'raw', metal_type: 'gold', karat: 22, weight_grams: 250.0, pieces: 5, location: 'Vault A', cost_per_gram: 6682.0, updated_at: now },
      { id: 3, name: 'Silver Granules Fine', category: 'raw', metal_type: 'silver', karat: 999, weight_grams: 1200.0, pieces: 1, location: 'Vault B', cost_per_gram: 93.0, updated_at: now },
      { id: 4, name: '18K Alloy Wire', category: 'raw', metal_type: 'gold', karat: 18, weight_grams: 80.0, pieces: 10, location: 'Workshop', cost_per_gram: 5470.0, updated_at: now },
      { id: 5, name: 'Platinum Casting Grains', category: 'raw', metal_type: 'platinum', karat: 950, weight_grams: 150.0, pieces: 1, location: 'Vault B', cost_per_gram: 3120.0, updated_at: now },
      { id: 6, name: 'Gold Wire Fine 24K', category: 'raw', metal_type: 'gold', karat: 24, weight_grams: 50.0, pieces: 3, location: 'Vault A', cost_per_gram: 7290.0, updated_at: now },
      
      { id: 7, name: 'Cast Necklace Frame', category: 'semi_finished', metal_type: 'gold', karat: 22, weight_grams: 42.5, pieces: 1, location: 'Workshop', design_code: 'NK-101', cost_per_gram: 6682.0, updated_at: now },
      { id: 8, name: 'Polished Bangle Base', category: 'semi_finished', metal_type: 'gold', karat: 18, weight_grams: 28.3, pieces: 3, location: 'Workshop', design_code: 'BG-202', cost_per_gram: 5470.0, updated_at: now },
      { id: 9, name: 'Silver Pendant Base', category: 'semi_finished', metal_type: 'silver', karat: 999, weight_grams: 15.5, pieces: 6, location: 'Workshop', design_code: 'PD-305', cost_per_gram: 93.0, updated_at: now },
      { id: 10, name: 'Ring Shank (Unset)', category: 'semi_finished', metal_type: 'gold', karat: 18, weight_grams: 6.2, pieces: 4, location: 'Workshop', design_code: 'RG-312', cost_per_gram: 5470.0, updated_at: now },
      { id: 11, name: 'Unpolished Pendant Frame', category: 'semi_finished', metal_type: 'gold', karat: 18, weight_grams: 12.4, pieces: 5, location: 'Workshop', design_code: 'PD-308', cost_per_gram: 5470.0, updated_at: now },
      { id: 12, name: 'Earring Posts and Backs', category: 'semi_finished', metal_type: 'gold', karat: 22, weight_grams: 8.5, pieces: 20, location: 'Workshop', design_code: 'ER-701', cost_per_gram: 6682.0, updated_at: now },
      { id: 13, name: 'Ruby Stone Settings', category: 'semi_finished', metal_type: 'gold', karat: 18, weight_grams: 4.8, pieces: 8, location: 'Workshop', design_code: 'RG-302', cost_per_gram: 5470.0, updated_at: now },
      
      { id: 14, name: 'Gold Necklace Set', category: 'finished', metal_type: 'gold', karat: 22, weight_grams: 38.5, pieces: 1, location: 'Display Case 1', design_code: 'NK-101', cost_per_gram: 6682.0, updated_at: now },
      { id: 15, name: 'Diamond Ring', category: 'finished', metal_type: 'gold', karat: 18, weight_grams: 7.8, pieces: 1, location: 'Display Case 2', design_code: 'RG-312', cost_per_gram: 5470.0, updated_at: now },
      { id: 16, name: 'Gold Mangalsutra', category: 'finished', metal_type: 'gold', karat: 22, weight_grams: 53.5, pieces: 1, location: 'Display Case 1', design_code: 'MG-701', cost_per_gram: 6682.0, updated_at: now },
      { id: 17, name: 'Gold Bangles Set (6pc)', category: 'finished', metal_type: 'gold', karat: 22, weight_grams: 62.0, pieces: 6, location: 'Display Case 3', design_code: 'BG-500', cost_per_gram: 6682.0, updated_at: now },
      { id: 18, name: 'Silver Anklet Set', category: 'finished', metal_type: 'silver', karat: 999, weight_grams: 85.0, pieces: 2, location: 'Display Case 4', design_code: 'SL-601', cost_per_gram: 93.0, updated_at: now },
      { id: 19, name: 'Platinum Wedding Band', category: 'finished', metal_type: 'platinum', karat: 950, weight_grams: 9.5, pieces: 1, location: 'Display Case 2', design_code: 'PT-950', cost_per_gram: 3120.0, updated_at: now },
      { id: 20, name: 'Emerald Gold Studs', category: 'finished', metal_type: 'gold', karat: 18, weight_grams: 6.2, pieces: 2, location: 'Display Case 3', design_code: 'ER-701', cost_per_gram: 5470.0, updated_at: now },
    ];
    changed = true;
  }

  if (!store.ownerBoms || store.ownerBoms.length === 0) {
    store.ownerBoms = [
      { id: 1, design_code: 'NK-101', metal_type: 'gold', karat: 22, cad_file_path: 'https://3d.aurajewel.com/nk-101.gltf', designer_name: 'Aniket Mehta', created_at: now },
      { id: 2, design_code: 'RG-302', metal_type: 'gold', karat: 18, cad_file_path: 'https://3d.aurajewel.com/rg-302.gltf', designer_name: 'Sarah Khan', created_at: now },
      { id: 3, design_code: 'BG-500', metal_type: 'gold', karat: 22, cad_file_path: 'https://3d.aurajewel.com/bg-500.gltf', designer_name: 'Aniket Mehta', created_at: now },
      { id: 4, design_code: 'ER-701', metal_type: 'gold', karat: 18, cad_file_path: 'https://3d.aurajewel.com/er-701.gltf', designer_name: 'Sarah Khan', created_at: now },
      { id: 5, design_code: 'PT-950', metal_type: 'platinum', karat: 950, cad_file_path: 'https://3d.aurajewel.com/pt-950.gltf', designer_name: 'In-House', created_at: now },
    ];
    changed = true;
  }

  if (!store.ownerBomComponents || store.ownerBomComponents.length === 0) {
    store.ownerBomComponents = [
      { id: 1, recipe_id: 1, component_type: 'metal', name: '22K Gold casting alloy', quantity: 1, weight_grams: 35.5 },
      { id: 2, recipe_id: 1, component_type: 'stone', name: '2.5mm Round Uncut Diamond', quantity: 24, weight_grams: 1.2 },
      { id: 3, recipe_id: 1, component_type: 'finding', name: 'Gold clasp medium', quantity: 1, weight_grams: 1.8 },
      { id: 4, recipe_id: 2, component_type: 'metal', name: '18K White Gold ring band', quantity: 1, weight_grams: 5.2 },
      { id: 5, recipe_id: 2, component_type: 'stone', name: '0.8ct Round Solitaire Diamond', quantity: 1, weight_grams: 0.8 },
      { id: 6, recipe_id: 3, component_type: 'metal', name: '22K Gold casting alloy', quantity: 1, weight_grams: 58.0 },
      { id: 7, recipe_id: 4, component_type: 'metal', name: '18K Yellow Gold wire', quantity: 2, weight_grams: 4.5 },
      { id: 8, recipe_id: 4, component_type: 'stone', name: '4x3mm Oval Emerald', quantity: 2, weight_grams: 1.2 },
      { id: 9, recipe_id: 4, component_type: 'finding', name: 'Push back scroll', quantity: 2, weight_grams: 0.5 },
      { id: 10, recipe_id: 5, component_type: 'metal', name: 'Platinum 950 wire', quantity: 1, weight_grams: 8.8 },
    ];
    changed = true;
  }

  if (!store.ownerLedgerEntries || store.ownerLedgerEntries.length === 0) {
    store.ownerLedgerEntries = [
      { id: 1, party_name: 'Ramesh Kumar', party_type: 'karigar', transaction_type: 'debit', amount: 301410.0, description: 'Gold issued for JB-2025-001 necklace', reference_no: 'JB-2025-001', date: now, created_at: now },
      { id: 2, party_name: 'Suresh Sonar', party_type: 'karigar', transaction_type: 'debit', amount: 152664.0, description: 'Gold issued for JB-2025-002 bracelet', reference_no: 'JB-2025-002', date: now, created_at: now },
      { id: 3, party_name: 'Ramesh Kumar', party_type: 'karigar', transaction_type: 'credit', amount: 248394.0, description: 'JB-2025-005 gold chain returned (completed)', reference_no: 'JB-2025-005', date: now, created_at: now },
      { id: 4, party_name: 'M/s Patel Ornaments', party_type: 'customer', transaction_type: 'debit', amount: 620000.0, description: 'Invoice: Bridal set order INV-002', reference_no: 'INV-002', date: now, created_at: now },
      { id: 5, party_name: 'M/s Patel Ornaments', party_type: 'customer', transaction_type: 'credit', amount: 310000.0, description: 'Advance 50% received for ORD-002', reference_no: 'ADV-002', date: now, created_at: now },
      { id: 6, party_name: 'Shah Gold Suppliers', party_type: 'supplier', transaction_type: 'debit', amount: 364500.0, description: 'Received 50g 24K gold bullion from Shah', reference_no: 'PO-2501', date: now, created_at: now },
      { id: 7, party_name: 'Anil Patil', party_type: 'karigar', transaction_type: 'debit', amount: 84000.0, description: 'Silver issues for anklets fabrication', reference_no: 'JB-2025-010', date: now, created_at: now },
      { id: 8, party_name: 'Mohan Lal', party_type: 'karigar', transaction_type: 'credit', amount: 95000.0, description: 'Payroll settlement for job order JB-2025-003', reference_no: 'PY-2025-004', date: now, created_at: now },
      { id: 9, party_name: 'Vikas Soni', party_type: 'karigar', transaction_type: 'debit', amount: 185000.0, description: 'Ruby stones & gold issued for setting', reference_no: 'JB-2025-012', date: now, created_at: now },
      { id: 10, party_name: 'Rajesh Shah', party_type: 'customer', transaction_type: 'credit', amount: 250000.0, description: 'Payment received via UPI for diamond ring', reference_no: 'UPI-9831', date: now, created_at: now },
    ];
    changed = true;
  }

  if (!store.ownerPayrolls || store.ownerPayrolls.length === 0) {
    store.ownerPayrolls = [
      { id: 1, karigar_id: 1, period_start: now, period_end: now, total_amount: 45000.0, tds_deducted: 450.0, net_payable: 44550.0, status: 'paid' },
      { id: 2, karigar_id: 1, period_start: now, period_end: now, total_amount: 48000.0, tds_deducted: 480.0, net_payable: 47520.0, status: 'pending' },
      { id: 3, karigar_id: 2, period_start: now, period_end: now, total_amount: 38000.0, tds_deducted: 380.0, net_payable: 37620.0, status: 'paid' },
      { id: 4, karigar_id: 3, period_start: now, period_end: now, total_amount: 42000.0, tds_deducted: 420.0, net_payable: 41580.0, status: 'paid' },
      { id: 5, karigar_id: 4, period_start: now, period_end: now, total_amount: 51000.0, tds_deducted: 510.0, net_payable: 50490.0, status: 'pending' },
      { id: 6, karigar_id: 5, period_start: now, period_end: now, total_amount: 32000.0, tds_deducted: 320.0, net_payable: 31680.0, status: 'paid' },
    ];
    changed = true;
  }

  if (!store.ownerAlloyCompositions || store.ownerAlloyCompositions.length === 0) {
    store.ownerAlloyCompositions = [];
  }

  if (!store.ownerKarigars || store.ownerKarigars.length === 0) {
    store.ownerKarigars = [
      { id: 1, name: 'Ramesh Kumar', phone: '9876543210', address: 'Zaveri Bazaar, Mumbai', specialization: 'goldsmith', is_active: 1, created_at: now },
      { id: 2, name: 'Suresh Sonar', phone: '9812345678', address: 'Dharavi, Mumbai', specialization: 'casting', is_active: 1, created_at: now },
      { id: 3, name: 'Mohan Lal', phone: '9823456789', address: 'Bhendi Bazaar, Mumbai', specialization: 'polishing', is_active: 1, created_at: now },
      { id: 4, name: 'Vikas Soni', phone: '9801234567', address: 'Surat, Gujarat', specialization: 'setting', is_active: 1, created_at: now },
      { id: 5, name: 'Anil Patil', phone: '9878901234', address: 'Pune, Maharashtra', specialization: 'finishing', is_active: 1, created_at: now },
    ];
    changed = true;
  }

  if (changed) {
    await writeStore(store);
  }
};

// GET Stock
router.get("/stock", async (req, res) => {
  try {
    const store = await readStore();
    await ensureSeed(store);
    res.json({ success: true, data: store.ownerStockItems });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Stock
router.post("/stock", async (req, res) => {
  try {
    const store = await readStore();
    const newItem = req.body;
    const newId = store.ownerStockItems.length > 0 ? Math.max(...store.ownerStockItems.map((i: any) => i.id || 0)) + 1 : 1;
    newItem.id = newId;
    newItem.updated_at = new Date().toISOString();
    store.ownerStockItems.push(newItem);
    await writeStore(store);
    res.json({ success: true, data: newItem });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT Stock
router.put("/stock/:id", async (req, res) => {
  try {
    const store = await readStore();
    const id = Number(req.params.id);
    const idx = store.ownerStockItems.findIndex((i: any) => i.id === id);
    if (idx !== -1) {
      store.ownerStockItems[idx] = { ...store.ownerStockItems[idx], ...req.body, id };
      await writeStore(store);
      res.json({ success: true, data: store.ownerStockItems[idx] });
    } else {
      res.status(404).json({ success: false, error: "Item not found" });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE Stock
router.delete("/stock/:id", async (req, res) => {
  try {
    const store = await readStore();
    const id = Number(req.params.id);
    store.ownerStockItems = store.ownerStockItems.filter((i: any) => i.id !== id);
    await writeStore(store);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET BOM Recipes
router.get("/bom", async (req, res) => {
  try {
    const store = await readStore();
    await ensureSeed(store);
    res.json({ success: true, data: store.ownerBoms });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST BOM Recipe
router.post("/bom", async (req, res) => {
  try {
    const store = await readStore();
    const newRecipe = req.body;
    const newId = store.ownerBoms.length > 0 ? Math.max(...store.ownerBoms.map((r: any) => r.id || 0)) + 1 : 1;
    newRecipe.id = newId;
    newRecipe.created_at = new Date().toISOString();
    store.ownerBoms.push(newRecipe);
    await writeStore(store);
    res.json({ success: true, data: newRecipe });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET BOM Components
router.get("/bom-components/:recipeId", async (req, res) => {
  try {
    const store = await readStore();
    await ensureSeed(store);
    const recipeId = Number(req.params.recipeId);
    const filtered = store.ownerBomComponents.filter((c: any) => c.recipe_id === recipeId);
    res.json({ success: true, data: filtered });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST BOM Component
router.post("/bom-components", async (req, res) => {
  try {
    const store = await readStore();
    const newComponent = req.body;
    const newId = store.ownerBomComponents.length > 0 ? Math.max(...store.ownerBomComponents.map((c: any) => c.id || 0)) + 1 : 1;
    newComponent.id = newId;
    store.ownerBomComponents.push(newComponent);
    await writeStore(store);
    res.json({ success: true, data: newComponent });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Ledger Entries
router.get("/ledger", async (req, res) => {
  try {
    const store = await readStore();
    await ensureSeed(store);
    res.json({ success: true, data: store.ownerLedgerEntries });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Ledger Entry
router.post("/ledger", async (req, res) => {
  try {
    const store = await readStore();
    const newEntry = req.body;
    const newId = store.ownerLedgerEntries.length > 0 ? Math.max(...store.ownerLedgerEntries.map((e: any) => e.id || 0)) + 1 : 1;
    newEntry.id = newId;
    newEntry.date = newEntry.date || new Date().toISOString();
    newEntry.created_at = new Date().toISOString();
    store.ownerLedgerEntries.push(newEntry);
    await writeStore(store);
    res.json({ success: true, data: newEntry });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT Ledger Entry
router.put("/ledger/:id", async (req, res) => {
  try {
    const store = await readStore();
    const id = Number(req.params.id);
    const idx = store.ownerLedgerEntries.findIndex((e: any) => e.id === id);
    if (idx !== -1) {
      store.ownerLedgerEntries[idx] = { ...store.ownerLedgerEntries[idx], ...req.body, id };
      await writeStore(store);
      res.json({ success: true, data: store.ownerLedgerEntries[idx] });
    } else {
      res.status(404).json({ success: false, error: "Entry not found" });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE Ledger Entry
router.delete("/ledger/:id", async (req, res) => {
  try {
    const store = await readStore();
    const id = Number(req.params.id);
    store.ownerLedgerEntries = store.ownerLedgerEntries.filter((e: any) => e.id !== id);
    await writeStore(store);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Karigar Payroll
router.get("/karigar-payroll/:karigarId", async (req, res) => {
  try {
    const store = await readStore();
    await ensureSeed(store);
    const karigarId = Number(req.params.karigarId);
    const filtered = store.ownerPayrolls.filter((p: any) => p.karigar_id === karigarId);
    res.json({ success: true, data: filtered });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Karigar Payroll
router.post("/karigar-payroll", async (req, res) => {
  try {
    const store = await readStore();
    const newPayroll = req.body;
    const newId = store.ownerPayrolls.length > 0 ? Math.max(...store.ownerPayrolls.map((p: any) => p.id || 0)) + 1 : 1;
    newPayroll.id = newId;
    store.ownerPayrolls.push(newPayroll);
    await writeStore(store);
    res.json({ success: true, data: newPayroll });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Alloy Compositions
router.get("/alloy-compositions", async (req, res) => {
  try {
    const store = await readStore();
    await ensureSeed(store);
    res.json({ success: true, data: store.ownerAlloyCompositions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Alloy Composition
router.post("/alloy-compositions", async (req, res) => {
  try {
    const store = await readStore();
    const newAlloy = req.body;
    const newId = store.ownerAlloyCompositions.length > 0 ? Math.max(...store.ownerAlloyCompositions.map((a: any) => a.id || 0)) + 1 : 1;
    newAlloy.id = newId;
    newAlloy.created_date = new Date().toISOString();
    store.ownerAlloyCompositions.push(newAlloy);
    await writeStore(store);
    res.json({ success: true, data: newAlloy });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Karigars
router.get("/karigars", async (req, res) => {
  try {
    const store = await readStore();
    await ensureSeed(store);
    const activeOnly = req.query.active === 'true';
    const data = activeOnly
      ? store.ownerKarigars.filter((k: any) => k.is_active === 1 || k.is_active === true)
      : store.ownerKarigars;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Single Karigar
router.get("/karigars/:id", async (req, res) => {
  try {
    const store = await readStore();
    await ensureSeed(store);
    const id = Number(req.params.id);
    const karigar = store.ownerKarigars.find((k: any) => k.id === id);
    if (karigar) {
      res.json({ success: true, data: karigar });
    } else {
      res.status(404).json({ success: false, error: 'Karigar not found' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST Karigar
router.post("/karigars", async (req, res) => {
  try {
    const store = await readStore();
    await ensureSeed(store);
    const newKarigar = req.body;
    const newId = store.ownerKarigars.length > 0 ? Math.max(...store.ownerKarigars.map((k: any) => k.id || 0)) + 1 : 1;
    newKarigar.id = newId;
    newKarigar.created_at = new Date().toISOString();
    newKarigar.is_active = newKarigar.is_active ?? 1;
    store.ownerKarigars.push(newKarigar);
    await writeStore(store);
    res.json({ success: true, data: newKarigar });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT Karigar
router.put("/karigars/:id", async (req, res) => {
  try {
    const store = await readStore();
    const id = Number(req.params.id);
    const idx = store.ownerKarigars.findIndex((k: any) => k.id === id);
    if (idx !== -1) {
      store.ownerKarigars[idx] = { ...store.ownerKarigars[idx], ...req.body, id };
      await writeStore(store);
      res.json({ success: true, data: store.ownerKarigars[idx] });
    } else {
      res.status(404).json({ success: false, error: 'Karigar not found' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE Karigar
router.delete("/karigars/:id", async (req, res) => {
  try {
    const store = await readStore();
    const id = Number(req.params.id);
    store.ownerKarigars = store.ownerKarigars.filter((k: any) => k.id !== id);
    await writeStore(store);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
