import express from "express";
import fs from "fs";
import path from "path";
import { applyScheduleToCoupon } from "../../lib/festivalScheduler.js";

const router = express.Router();
const offersFile = path.resolve(process.cwd(), "backend", "data", "offersStore.json");

const ensureOffersFile = async () => {
  const dir = path.dirname(offersFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(offersFile)) {
    await fs.promises.writeFile(offersFile, JSON.stringify({ coupons: [] }, null, 2), "utf8");
  }
};

const readOffers = async () => {
  await ensureOffersFile();
  const raw = await fs.promises.readFile(offersFile, "utf8");
  const store = JSON.parse(raw) as { coupons: any[] };
  // apply schedules (do not persist here; compute on-the-fly)
  store.coupons = store.coupons.map((c: any) => {
    try { return applyScheduleToCoupon(Object.assign({}, c)); } catch (e) { return c; }
  });
  return store;
};

const writeOffers = async (store: { coupons: any[] }) => {
  await fs.promises.writeFile(offersFile, JSON.stringify(store, null, 2), "utf8");
};

const isValidDate = (value: string) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const normalizeOfferType = (value: unknown) => String(value || "").trim().toLowerCase();

const isFestiveOffer = (coupon: any) => {
  const offerType = normalizeOfferType(coupon?.type || coupon?.category || coupon?.offerType);
  const name = String(coupon?.name || "").toLowerCase();
  const description = String(coupon?.description || "").toLowerCase();

  return (
    offerType === "festive" ||
    offerType === "seasonal" ||
    name.includes("festival") ||
    name.includes("diwali") ||
    name.includes("raksha") ||
    name.includes("eid") ||
    name.includes("holi") ||
    name.includes("christmas") ||
    description.includes("festival") ||
    description.includes("diwali") ||
    description.includes("raksha") ||
    description.includes("eid") ||
    description.includes("holi") ||
    description.includes("christmas")
  );
};

const isOfferActive = (coupon: any, now = new Date()) => {
  if (!coupon?.validFrom || !coupon?.validTo) {
    return true;
  }

  const fromDate = new Date(coupon.validFrom);
  const toDate = new Date(coupon.validTo);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return true;
  }

  return now >= fromDate && now <= toDate;
};

router.get("/", async (_req, res) => {
  try {
    const store = await readOffers();
    res.json(store.coupons);
  } catch (error) {
    console.error("Failed to read coupons:", error);
    res.status(500).json({ success: false, error: "Unable to read coupon list" });
  }
});

router.get("/festive", async (_req, res) => {
  try {
    const store = await readOffers();
    const festiveOffers = store.coupons.filter((coupon) => isFestiveOffer(coupon) && isOfferActive(coupon));

    res.json({
      success: true,
      data: festiveOffers,
      total: festiveOffers.length,
    });
  } catch (error) {
    console.error("Failed to read festive offers:", error);
    res.status(500).json({ success: false, error: "Unable to read festive offers" });
  }
});

router.get("/validate/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, error: "Coupon code is required" });
    }

    const store = await readOffers();
    const coupon = store.coupons.find((item) => String(item.code || "").toUpperCase() === code);
    if (!coupon) {
      return res.status(404).json({ success: false, error: "Coupon not found" });
    }

    if (!isOfferActive(coupon)) {
      return res.status(400).json({ success: false, error: "Coupon is not valid today" });
    }

    res.json({ success: true, data: coupon });
  } catch (error) {
    console.error("Failed to validate coupon:", error);
    res.status(500).json({ success: false, error: "Unable to validate coupon" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { code, name, description, validFrom, validTo, discountPercent } = req.body;
    if (!code || !name || !validFrom || !validTo || discountPercent === undefined) {
      return res.status(400).json({ success: false, error: "Missing one or more required coupon fields" });
    }

    if (!isValidDate(validFrom) || !isValidDate(validTo)) {
      return res.status(400).json({ success: false, error: "Invalid date format for coupon validity" });
    }

    const fromDate = new Date(validFrom);
    const toDate = new Date(validTo);
    if (fromDate > toDate) {
      return res.status(400).json({ success: false, error: "Coupon start date must be before end date" });
    }

    const percent = Number(discountPercent);
    if (Number.isNaN(percent) || percent <= 0 || percent > 100) {
      return res.status(400).json({ success: false, error: "Discount percent must be a positive number between 1 and 100" });
    }

    const store = await readOffers();
    const newCoupon = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description?.trim() || "",
      validFrom: fromDate.toISOString(),
      validTo: toDate.toISOString(),
      discountPercent: percent,
      createdAt: new Date().toISOString(),
    };

    store.coupons.push(newCoupon);
    await writeOffers(store);
    res.status(201).json(newCoupon);
  } catch (error) {
    console.error("Failed to create coupon:", error);
    res.status(500).json({ success: false, error: "Unable to create coupon" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const couponId = decodeURIComponent(req.params.id);
    if (!couponId || couponId.trim() === "") {
      return res.status(400).json({ success: false, error: "Coupon ID is required" });
    }

    const store = await readOffers();
    const originalLength = store.coupons.length;

    let filtered = store.coupons.filter((coupon) => {
      if (coupon.id === couponId) return false;
      if (coupon.code?.toUpperCase() === couponId.toUpperCase()) return false;
      return true;
    });

    if (filtered.length === originalLength) {
      return res.status(404).json({ success: false, error: "Coupon not found" });
    }

    store.coupons = filtered;
    await writeOffers(store);
    res.status(200).json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Failed to delete coupon:", error);
    res.status(500).json({ success: false, error: "Unable to delete coupon" });
  }
});

export default router;



