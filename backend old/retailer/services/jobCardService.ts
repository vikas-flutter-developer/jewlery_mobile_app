import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { RepairJob, JobCard as JobCardModel, Karikar, Notification, Branch } from "../models/index.js";
import { storageService } from "./storage/storageService.js";
import { withMongoTransaction } from "../../lib/mongoTransaction.js";
import { logSecurityEvent } from "../../lib/securityAudit.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildQrBuffer = async (text: string): Promise<Buffer> => {
  return QRCode.toBuffer(text, { type: "png", width: 160, margin: 1 });
};

/** Simple Code-128 text barcode representation drawn as vertical bars */
const drawBarcodeText = (doc: InstanceType<typeof PDFDocument>, code: string, x: number, y: number, w = 180, h = 36) => {
  const chars = String(code);
  const barWidth = w / (chars.length * 11 + 22); // rough estimate per char
  let cursor = x;
  doc.save();
  // Draw a series of thin/thick bars using character byte values
  for (const ch of chars) {
    const byte = ch.charCodeAt(0) % 10;
    const isThin = byte < 5;
    doc.rect(cursor, y, barWidth * (isThin ? 1 : 2), h).fill("#000000");
    cursor += barWidth * (isThin ? 3 : 4);
  }
  doc.restore();
  doc.fontSize(7).fillColor("#000000").text(code, x, y + h + 2, { width: w, align: "center" });
};

const drawDivider = (doc: InstanceType<typeof PDFDocument>) => {
  const margins = doc.page.margins || { left: 40, right: 40 };
  const left = margins.left ?? 40;
  const right = margins.right ?? 40;
  const pageW = doc.page.width;
  doc
    .moveTo(left, doc.y)
    .lineTo(pageW - right, doc.y)
    .strokeColor("#e2e8f0")
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.4);
};

const sectionHeader = (doc: InstanceType<typeof PDFDocument>, title: string) => {
  drawDivider(doc);
  doc
    .fontSize(9)
    .fillColor("#1e40af")
    .font("Helvetica-Bold")
    .text(title.toUpperCase(), { characterSpacing: 0.5 });
  doc.moveDown(0.2);
  doc.font("Helvetica").fillColor("#1a1a1a");
};

const labelValue = (doc: InstanceType<typeof PDFDocument>, label: string, value: string | number | undefined, options: { lineBreak?: boolean } = {}) => {
  const val = value !== undefined && value !== null && value !== "" ? String(value) : "—";
  doc.fontSize(9);
  doc.font("Helvetica-Bold").fillColor("#475569").text(`${label}: `, { continued: true });
  doc.font("Helvetica").fillColor("#0f172a").text(val, { lineBreak: options.lineBreak ?? false });
  doc.moveDown(0.15);
};

// ─── PDF Builder ──────────────────────────────────────────────────────────────

const generateJobCardBuffer = async (job: any, karikar: any, storeInfo: any): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 45, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const pageW = doc.page.width;
  const marginX = 45;
  const contentW = pageW - marginX * 2;

  // ── Header Band ──────────────────────────────────────────────────────────
  doc.rect(marginX, 40, contentW, 60).fill("#1e3a5f");

  // Company logo placeholder or name
  if (storeInfo?.logoPath) {
    try {
      doc.image(storeInfo.logoPath, marginX + 10, 48, { height: 44, fit: [120, 44] });
    } catch {
      // ignore missing logo
    }
  }

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor("#ffffff")
    .text(storeInfo?.name || "AuraJewel", marginX + 140, 52, { width: contentW - 160, align: "left" });

  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#93c5fd")
    .text(storeInfo?.address || "", marginX + 140, 72, { width: contentW - 160, align: "left" });

  // "JOB CARD" badge on right
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor("#fbbf24")
    .text("JOB CARD", pageW - marginX - 90, 52, { width: 85, align: "right" });

  if (storeInfo?.branchName) {
    doc
      .fontSize(7.5)
      .font("Helvetica")
      .fillColor("#bfdbfe")
      .text(`Branch: ${storeInfo.branchName}`, pageW - marginX - 90, 66, { width: 85, align: "right" });
  }

  doc.y = 115;
  doc.fillColor("#1a1a1a");

  // ── Job card number + version pill ───────────────────────────────────────
  const jcNum = job.jobCardNumber || job.repairJobId || String(job._id);
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor("#1e3a5f")
    .text(`# ${jcNum}`, marginX, doc.y, { continued: true });
  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#64748b")
    .text(`  v${storeInfo.version || 1}  •  ${new Date().toLocaleDateString("en-IN")}`, { align: "left" });
  doc.moveDown(0.6);

  // ── Section: Job Information ─────────────────────────────────────────────
  sectionHeader(doc, "Job Information");
  const col1X = marginX;
  const col2X = marginX + contentW / 2;

  const yBeforeJob = doc.y;
  doc.y = yBeforeJob;
  labelValue(doc, "Job Number", job.repairJobId || jcNum);
  labelValue(doc, "Job Date", job.issueDate ? new Date(job.issueDate).toLocaleDateString("en-IN") : "");
  labelValue(doc, "Due Date", job.dueDate ? new Date(job.dueDate).toLocaleDateString("en-IN") : "");

  // Priority badge
  const priority = (job.priority || "NORMAL").toUpperCase();
  const priorityColor: Record<string, string> = {
    URGENT: "#dc2626",
    HIGH: "#f97316",
    NORMAL: "#2563eb",
    LOW: "#16a34a",
  };
  const prColor = priorityColor[priority] || "#2563eb";
  doc.fontSize(8).font("Helvetica-Bold").fillColor(prColor).text(`● Priority: ${priority}`, { lineBreak: true });
  doc.moveDown(0.15);
  doc.font("Helvetica").fillColor("#1a1a1a");
  labelValue(doc, "Status", job.status || "");
  doc.moveDown(0.5);

  // ── Section: Customer Information ────────────────────────────────────────
  sectionHeader(doc, "Customer Information");
  labelValue(doc, "Customer Name", job.customerName || "");
  labelValue(doc, "Customer Code", job.customerCode || "");
  labelValue(doc, "Mobile", job.customerPhone || job.customerMobile || "");
  doc.moveDown(0.5);

  // ── Section: Product Information ─────────────────────────────────────────
  sectionHeader(doc, "Product Information");
  labelValue(doc, "Product Name", job.productName || "");
  labelValue(doc, "Category", job.category || "");
  labelValue(doc, "Design Code", job.designCode || "");
  if (job.itemDescription || job.designDescription) {
    labelValue(doc, "Description", job.itemDescription || job.designDescription || "");
  }
  doc.moveDown(0.5);

  // ── Section: Karikar Information ─────────────────────────────────────────
  sectionHeader(doc, "Karikar (Artisan) Information");
  labelValue(doc, "Karikar Name", karikar?.name || job.karikarId || "N/A");
  labelValue(doc, "Karikar Code", karikar?.karikarCode || karikar?._id || "");
  labelValue(doc, "Specialization", karikar?.specialization || "");
  doc.moveDown(0.5);

  // ── Section: Metal Details ───────────────────────────────────────────────
  sectionHeader(doc, "Metal Details");
  labelValue(doc, "Metal Type", job.metalType || "");
  labelValue(doc, "Purity", job.issuedPurity || job.purity || "");
  labelValue(doc, "Issued Weight (g)", job.issuedGoldWeight ?? job.issuedWeight ?? job.estimatedWeight ?? "");
  labelValue(doc, "Stone Weight (g)", job.stoneWeight ?? "");
  labelValue(doc, "Diamond Weight (ct)", job.diamondWeight ?? "");
  doc.moveDown(0.5);

  // ── Section: Production Details ──────────────────────────────────────────
  sectionHeader(doc, "Production Details");
  labelValue(doc, "Quantity", job.quantity ?? 1);
  labelValue(doc, "Size", job.size || "");
  if (job.customInstructions || job.notes) {
    labelValue(doc, "Custom Instructions", job.customInstructions || "");
    labelValue(doc, "Remarks", job.notes || job.remarks || "");
  }
  doc.moveDown(0.6);

  // ── QR Code + Barcode row ────────────────────────────────────────────────
  drawDivider(doc);
  const trackerY = doc.y;
  const qrText = `${storeInfo?.url || ""}/jobs/${jcNum}`;

  try {
    const qrBuf = await buildQrBuffer(qrText);
    doc.image(qrBuf, marginX, trackerY, { width: 90 });
  } catch {
    // ignore
  }

  // Barcode (right side)
  const barcodeVal = job.repairJobId || jcNum;
  try {
    drawBarcodeText(doc, barcodeVal, marginX + 110, trackerY, 200, 40);
  } catch {
    // ignore
  }

  doc.y = trackerY + 100;
  doc.moveDown(0.3);

  doc
    .fontSize(7.5)
    .fillColor("#64748b")
    .font("Helvetica")
    .text(`QR: ${qrText}`, marginX, doc.y, { width: contentW / 2 });
  doc.moveDown(1);

  // ── Signature Line ───────────────────────────────────────────────────────
  drawDivider(doc);
  const sigY = doc.y;
  doc
    .moveTo(marginX, sigY + 30)
    .lineTo(marginX + 150, sigY + 30)
    .strokeColor("#94a3b8")
    .lineWidth(0.5)
    .stroke();
  doc.moveTo(pageW - marginX - 150, sigY + 30).lineTo(pageW - marginX, sigY + 30).stroke();

  doc.fontSize(8).fillColor("#64748b");
  doc.text("Karikar Signature", marginX, sigY + 33, { width: 150, align: "center" });
  doc.text("Authorised By", pageW - marginX - 150, sigY + 33, { width: 150, align: "center" });

  doc.y = sigY + 55;

  // ── Footer ───────────────────────────────────────────────────────────────
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(7)
      .fillColor("#94a3b8")
      .text(
        storeInfo?.footerNotes ||
          `${storeInfo?.name || "AuraJewel"} | This is a computer-generated Job Card`,
        marginX,
        doc.page.height - 40,
        { width: contentW, align: "center" }
      );
    doc
      .text(`Page ${i + 1} of ${totalPages} | Job #${jcNum} | Generated: ${new Date().toLocaleString("en-IN")}`, marginX, doc.page.height - 28, {
        width: contentW,
        align: "center",
      });
  }

  doc.end();
  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
};

// ─── Store Info Builder ───────────────────────────────────────────────────────

const buildStoreInfo = async (options: any) => {
  let branch: any = null;
  if (options.storeId) {
    try {
      branch = await Branch.findOne({ tenantId: options.storeId }).lean();
    } catch {
      // ignore
    }
  }
  return {
    name: options.storeName || branch?.name || "AuraJewel",
    address: options.storeAddress || branch?.address || "",
    url: options.storeUrl || "",
    logoPath: options.logoPath || branch?.logoPath || null,
    branchName: options.branchName || branch?.name || "",
    branchCode: options.branchCode || branch?.branchCode || "",
    footerNotes: options.footerNotes || "",
    version: 1, // updated below
  };
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const generateJobCard = async (jobId: string, generatedBy: string, options: any = {}) => {
  const job = await RepairJob.findOne({ repairJobId: jobId }).lean();
  if (!job) throw new Error("Job not found");

  // Prevent re-generation if latest exists and no force
  const latest = await JobCardModel.findOne({ jobId }).sort({ version: -1 }).lean();
  if (latest && !options.force) {
    return latest;
  }

  const version = latest ? (latest as any).version + 1 : 1;

  // Lookup karikar details
  let karikar: any = null;
  if ((job as any).karikarId) {
    try {
      karikar = await Karikar.findById((job as any).karikarId).lean();
    } catch {
      // ignore
    }
  }

  const storeInfo = await buildStoreInfo(options);
  storeInfo.version = version;

  // Build PDF buffer
  const buf = await generateJobCardBuffer(job, karikar, storeInfo);

  // Generate job card number
  const jobCardNumber = `JC-${String(jobId).slice(-6).toUpperCase()}-V${version}-${Date.now().toString(36).toUpperCase()}`;

  // Save PDF to storage
  const jobCardId = `${jobId}-v${version}`;
  const stored = await storageService.saveJobCardPdf(buf, jobCardId);

  const storeId = options.storeId || "default-shop";

  // Persist history and notify inside transaction
  const result = await withMongoTransaction(async (session: any) => {
    const rec = await JobCardModel.create(
      [
        {
          jobId,
          jobCardNumber,
          version,
          generatedBy,
          generatedAt: new Date(),
          pdfPath: stored.path,
          pdfUrl: stored.url,
          qrData: `${storeInfo.url}/jobs/${(job as any).repairJobId || (job as any)._id}`,
          barcode: (job as any).repairJobId || String((job as any)._id),

          // Job info
          jobNumber: (job as any).repairJobId,
          jobDate: (job as any).issueDate,
          dueDate: (job as any).dueDate,
          status: (job as any).status,
          priority: (job as any).priority || "NORMAL",

          // Customer
          customerName: (job as any).customerName,
          customerCode: (job as any).customerCode || "",
          customerMobile: (job as any).customerPhone,

          // Product
          productName: (job as any).productName || (job as any).itemDescription,
          category: (job as any).category || "",
          designCode: (job as any).designCode || "",
          designDescription: (job as any).itemDescription || "",

          // Karikar
          karikarId: karikar ? String(karikar._id) : (job as any).karikarId,
          karikarName: karikar?.name || "",
          karikarCode: karikar?.karikarCode || karikar?._id || "",
          karikarSpecialization: karikar?.specialization || "",

          // Metal
          metalType: (job as any).metalType || "Gold",
          purity: (job as any).issuedPurity || "",
          issuedWeight: (job as any).issuedGoldWeight || (job as any).estimatedWeight || 0,
          stoneWeight: (job as any).stoneWeight || 0,
          diamondWeight: (job as any).diamondWeight || 0,

          // Production
          quantity: (job as any).quantity || 1,
          size: (job as any).size || "",
          customInstructions: (job as any).customInstructions || "",
          remarks: (job as any).notes || "",

          // Branding
          storeName: storeInfo.name,
          storeAddress: storeInfo.address,
          branchName: storeInfo.branchName,
          branchCode: storeInfo.branchCode,
          footerNotes: storeInfo.footerNotes,

          tenantId: storeId,
        },
      ],
      { session }
    );

    const notifType = version === 1 ? "JOB_CARD_GENERATED" : "JOB_CARD_REGENERATED";
    const notifTitle = version === 1 ? "Job Card Generated" : "Job Card Regenerated";
    await Notification.create(
      [
        {
          notificationId: `JOBCARD_${notifType}_${jobId}_${version}_${Date.now()}`,
          tenantId: storeId,
          storeId,
          type: notifType,
          title: notifTitle,
          message: `Job card v${version} ${version === 1 ? "generated" : "regenerated"} for job ${jobId}`,
          category: "Jobs",
          severity: "INFO",
          channels: ["IN_APP"],
          reference: jobId,
          relatedEntityId: jobId,
          sendAt: new Date(),
          status: "PENDING",
        },
      ],
      { session }
    );

    return (rec[0] as any).toObject();
  });

  // Audit log outside transaction
  const auditAction = version === 1 ? "job-card-generated" : "job-card-regenerated";
  await logSecurityEvent(generatedBy, auditAction, jobId, `Job card ${jobCardNumber} v${version} ${version === 1 ? "generated" : "regenerated"}`);

  return result;
};

export const listJobCardHistory = async (jobId: string, opts: { page?: number; limit?: number } = {}) => {
  const page = Math.max(1, Number(opts.page || 1));
  const limit = Math.max(1, Number(opts.limit || 20));
  const skip = (page - 1) * limit;
  const query: any = { jobId };
  const total = await JobCardModel.countDocuments(query);
  const items = await JobCardModel.find(query).sort({ version: -1 }).skip(skip).limit(limit).lean();
  return { total, items, page, limit };
};

export const getLatestJobCard = async (jobId: string) => {
  return JobCardModel.findOne({ jobId }).sort({ version: -1 }).lean();
};

export const incrementDownloadCount = async (jobId: string) => {
  const card = await JobCardModel.findOne({ jobId }).sort({ version: -1 });
  if (card) {
    card.downloadCount = (card.downloadCount || 0) + 1;
    await card.save();
  }
};

export const incrementPrintCount = async (jobId: string) => {
  const card = await JobCardModel.findOne({ jobId }).sort({ version: -1 });
  if (card) {
    card.printCount = (card.printCount || 0) + 1;
    await card.save();
  }
};

export default {
  generateJobCard,
  listJobCardHistory,
  getLatestJobCard,
  incrementDownloadCount,
  incrementPrintCount,
};
