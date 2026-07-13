import fs from "fs";
import path from "path";
import os from "os";
import mongoose from "mongoose";
import { registerRetailerModels } from "../setup.js";
import { inventoryPhotoService, CatalogueValidationError } from "../../retailer/services/catalogue/inventoryPhotoService.js";
import { bulkImportService } from "../../retailer/services/catalogue/bulkImportService.js";
import { inventorySearchService } from "../../retailer/services/catalogue/inventorySearchService.js";
import { barcodeTagPdfService } from "../../retailer/services/catalogue/barcodeTagPdfService.js";
import { CATALOGUE_ROLES } from "../../retailer/middleware/catalogueAuth.js";
import { validateBarcodePrintRequest } from "../../retailer/validation/catalogueSchemas.js";

const getInventoryModel = () => registerRetailerModels().model("Inventory");
const getBranchModel = () => registerRetailerModels().model("Branch");
const getVendorModel = () => registerRetailerModels().model("Vendor");

const audit = { userId: "user-1", userEmail: "admin@test.com", userRole: "ADMIN" };

const seedInventory = async (overrides: Record<string, unknown> = {}) => {
  const Inventory = getInventoryModel();
  return Inventory.create({
    sku: "SKU-TEST-001",
    barcode: "8901234567890",
    tag: "TAG-SKU-TEST-001-8901234567890",
    name: "Gold Ring",
    grossWeight: 10,
    netWeight: 9.5,
    purity: "22K",
    fineWeight: 8.7,
    diamondWeight: 0,
    huid: "HUID123",
    branchId: "MAIN",
    category: "Ring",
    metal: "Gold",
    sellingRate: 75000,
    price: 75000,
    ...overrides,
  });
};

describe("Catalogue Module", () => {
  beforeEach(() => {
    registerRetailerModels();
  });

  describe("inventoryPhotoService", () => {
    test("uploads valid image and sets thumbnail", async () => {
      const item = await seedInventory();
      const buffer = Buffer.from("fake-image-content");
      const result = await inventoryPhotoService.uploadPhotos(
        String(item._id),
        [{ buffer, originalname: "ring.jpg", mimetype: "image/jpeg", size: buffer.length }],
        audit.userId,
        audit
      );

      expect(result.uploaded).toBe(1);
      expect(result.inventory.photoCount).toBe(1);
      expect(result.inventory.thumbnail).toContain("/uploads/inventory-photos/");
    });

    test("rejects invalid image mime type", async () => {
      const item = await seedInventory({ sku: "SKU-IMG-2", barcode: "8901234567891", tag: "TAG-2" });
      await expect(
        inventoryPhotoService.uploadPhotos(
          String(item._id),
          [{ buffer: Buffer.from("x"), originalname: "bad.gif", mimetype: "image/gif", size: 1 }],
          audit.userId,
          audit
        )
      ).rejects.toThrow(CatalogueValidationError);
    });

    test("rejects oversized image", () => {
      expect(() =>
        inventoryPhotoService.validateImage({
          buffer: Buffer.alloc(0),
          originalname: "big.jpg",
          mimetype: "image/jpeg",
          size: 6 * 1024 * 1024,
        })
      ).toThrow("5 MB");
    });
  });

  describe("bulkImportService", () => {
    test("imports valid CSV rows", async () => {
      await getBranchModel().create({ name: "Main", code: "MAIN", phone: "9999999999" });
      await getVendorModel().create({ name: "Gold Vendor", phone: "8888888888" });

      const csv = [
        "SKU Code,Barcode,Product Name,Category,Sub Category,Metal,Purity,Gross Weight,Net Weight,Stone Weight,Making Charges,Stone Charges,Purchase Rate,Selling Rate,Vendor,Branch,Location,RFID,Hallmark Number,Description",
        "SKU-IMP-001,8901111111111,Test Bangle,Bangle,,Gold,22K,12,11,0,500,0,60000,75000,Gold Vendor,MAIN,Vault A,RFID001,HM001,Test item",
        "SKU-IMP-002,8901111111112,Test Chain,Chain,,Gold,22K,8,7.5,0,400,0,50000,62000,Gold Vendor,MAIN,Vault B,,HM002,",
      ].join("\n");

      const tempFile = path.join(os.tmpdir(), `import-${Date.now()}.csv`);
      fs.writeFileSync(tempFile, csv);

      const result = await bulkImportService.processImport(tempFile, "import.csv", audit.userId, audit);
      fs.unlinkSync(tempFile);

      expect(result.importedCount).toBe(2);
      expect(result.failedCount).toBe(0);

      const Inventory = getInventoryModel();
      const count = await Inventory.countDocuments({ sku: /^SKU-IMP-/ });
      expect(count).toBe(2);
    });

    test("detects duplicate SKU in import file", async () => {
      await getBranchModel().create({ name: "Main", code: "MAIN", phone: "9999999999" });

      const csv = [
        "SKU Code,Barcode,Product Name,Purity,Gross Weight,Net Weight,Branch",
        "SKU-DUP,8902222222221,Item A,22K,10,9,MAIN",
        "SKU-DUP,8902222222222,Item B,22K,10,9,MAIN",
      ].join("\n");

      const tempFile = path.join(os.tmpdir(), `dup-${Date.now()}.csv`);
      fs.writeFileSync(tempFile, csv);

      const result = await bulkImportService.processImport(tempFile, "dup.csv", audit.userId, audit);
      fs.unlinkSync(tempFile);

      expect(result.importedCount).toBe(1);
      expect(result.skippedCount).toBeGreaterThanOrEqual(1);
    });

    test("fails validation for missing mandatory fields", async () => {
      const csv = "SKU Code,Barcode,Product Name\nSKU-BAD,,,\n";
      const tempFile = path.join(os.tmpdir(), `bad-${Date.now()}.csv`);
      fs.writeFileSync(tempFile, csv);

      const result = await bulkImportService.processImport(tempFile, "bad.csv", audit.userId, audit);
      fs.unlinkSync(tempFile);

      expect(result.importedCount).toBe(0);
      expect(result.failedCount).toBeGreaterThan(0);
    });

    test("rejects empty file", async () => {
      const tempFile = path.join(os.tmpdir(), `empty-${Date.now()}.csv`);
      fs.writeFileSync(tempFile, "SKU Code,Barcode\n");

      await expect(
        bulkImportService.processImport(tempFile, "empty.csv", audit.userId, audit)
      ).rejects.toThrow("no data rows");
      fs.unlinkSync(tempFile);
    });
  });

  describe("inventorySearchService", () => {
    test("filters by barcode and returns thumbnail", async () => {
      await seedInventory({
        sku: "SKU-SRCH",
        barcode: "8903333333333",
        tag: "TAG-SRCH",
        thumbnail: "/uploads/inventory-photos/test.jpg",
      });

      const result = await inventorySearchService.search({ barcode: "8903333333333" });
      expect(result.items.length).toBe(1);
      expect(result.items[0].thumbnail).toBe("/uploads/inventory-photos/test.jpg");
    });

    test("searches by RFID", async () => {
      await seedInventory({
        sku: "SKU-RFID",
        barcode: "8904444444444",
        tag: "TAG-RFID",
        rfid: "RFID-UNIQUE-99",
      });

      const result = await inventorySearchService.search({ rfid: "RFID-UNIQUE-99" });
      expect(result.items.length).toBe(1);
      expect(result.items[0].rfid).toBe("RFID-UNIQUE-99");
    });
  });

  describe("barcodeTagPdfService", () => {
    test("generates PDF for SKU filter", async () => {
      await seedInventory({
        sku: "SKU-PDF",
        barcode: "8905555555555",
        tag: "TAG-PDF",
        hallmarkNumber: "HM-PDF-1",
      });

      const result = await barcodeTagPdfService.bulkPrint(
        { skuIds: ["SKU-PDF"] },
        "A4_SHEET",
        audit,
        false
      );

      expect(result.numberOfTags).toBe(1);
      expect(result.pdfUrl).toContain("/uploads/barcode-pdfs/");
    });

    test("preview returns sample items", async () => {
      await seedInventory({ sku: "SKU-PREV", barcode: "8906666666666", tag: "TAG-PREV" });
      const preview = await barcodeTagPdfService.preview({ skuIds: ["SKU-PREV"] }, "JEWELLERY_TAG", audit);
      expect(preview.totalTags).toBe(1);
      expect(preview.preview[0].sku).toBe("SKU-PREV");
    });
  });

  describe("authorization & validation schemas", () => {
    test("catalogue roles include required roles", () => {
      expect(CATALOGUE_ROLES).toEqual(
        expect.arrayContaining(["SUPER_ADMIN", "ADMIN", "RETAILER", "STORE_MANAGER"])
      );
    });

    test("barcode print request validation", () => {
      expect(validateBarcodePrintRequest({})).toMatch(/Provide skuIds/);
      expect(validateBarcodePrintRequest({ skuIds: ["SKU-1"] })).toBeNull();
      expect(validateBarcodePrintRequest({ skuIds: ["SKU-1"], printerType: "INVALID" })).toMatch(
        /Invalid printerType/
      );
    });
  });
});
