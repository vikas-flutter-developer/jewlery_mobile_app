import PDFDocument from "pdfkit";
import QRCode from "qrcode";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfInvoiceDoc {
  invoiceNumber: string;
  type: "GST" | "ADVANCE" | "PROFORMA";
  createdAt?: Date | string;
  storeProfile?: {
    shopName?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    pan?: string;
    phone?: string;
    email?: string;
    bisLicence?: string;
    logo?: string;
  };
  customerInfo?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    pan?: string;
    aadhar?: string;
  };
  items: PdfInvoiceItem[];
  subtotal: number;
  discount?: number;
  exchangeDiscount?: number;
  taxableAmount: number;
  gstBreakup?: {
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    totalGst?: number;
    taxableValue?: number;
  };
  tcs?: number;
  roundOff?: number;
  grandTotal: number;
  payments?: Array<{ method: string; amount: number; reference?: string }>;
  advanceAmount?: number;
  advanceOrderRef?: string;
  financialYear?: string;
}

export interface PdfInvoiceItem {
  name: string;
  hsnCode?: string;
  purity?: string;
  grossWeight?: number;
  netWeight?: number;
  goldRate?: number;
  goldAmount?: number;
  makingCharge?: number;
  stoneCharge?: number;
  bisNumber?: string;
  qty?: number;
  price: number;
  taxableValue?: number;
  gstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  itemTotal?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | undefined | null): string => {
  const num = Number(n ?? 0);
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtW = (n: number | undefined | null): string =>
  `${Number(n ?? 0).toFixed(3)}g`;

const fmtNum = (n: number | undefined | null): string =>
  Number(n ?? 0).toFixed(2);

const invoiceDate = (d?: Date | string): string => {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

async function buildQrBuffer(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: "png", width: 120, margin: 1 });
}

function bufferToStream(buffer: Buffer) {
  const { Readable } = require("stream");
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

// ─── A4 GST Invoice (595 × 842 pt) ──────────────────────────────────────────

export async function generateA4GstPdf(invoice: PdfInvoiceDoc): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const chunks: Buffer[] = [];

    const doc = new PDFDocument({
      size: "A4",
      margin: 30,
      info: {
        Title: `Invoice ${invoice.invoiceNumber}`,
        Author: invoice.storeProfile?.shopName || "AuraJewel",
      },
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const P = doc.page;
    const W = P.width - P.margins.left - P.margins.right; // usable width
    const L = P.margins.left;

    const GOLD = "#B8860B";
    const DARK = "#1A1A2E";
    const LIGHT_BG = "#FFF8E7";
    const BORDER = "#D4AF37";
    const GRAY = "#6B7280";
    const WHITE = "#FFFFFF";

    // ── Header background ──
    doc.rect(0, 0, P.width, 110).fill(DARK);

    // ── Shop Name ──
    doc
      .fillColor(GOLD)
      .font("Helvetica-Bold")
      .fontSize(22)
      .text(invoice.storeProfile?.shopName || "AuraJewel Store", L, 18, {
        align: "center",
        width: W,
      });

    const sp = invoice.storeProfile || {};
    const shopAddress = [sp.address, sp.city, sp.state, sp.pincode]
      .filter(Boolean)
      .join(", ");
    doc
      .fillColor(WHITE)
      .font("Helvetica")
      .fontSize(8)
      .text(shopAddress || "India", L, 44, { align: "center", width: W });

    const shopContact = [sp.phone, sp.email].filter(Boolean).join("  |  ");
    if (shopContact)
      doc.text(shopContact, L, 55, { align: "center", width: W });

    const taxLine = [
      sp.gstin ? `GSTIN: ${sp.gstin}` : "",
      sp.pan ? `PAN: ${sp.pan}` : "",
      sp.bisLicence ? `BIS: ${sp.bisLicence}` : "",
    ]
      .filter(Boolean)
      .join("   |   ");
    if (taxLine)
      doc.text(taxLine, L, 65, { align: "center", width: W });

    // ── Invoice badge ──
    const badgeLabel =
      invoice.type === "ADVANCE"
        ? "ADVANCE RECEIPT"
        : invoice.type === "PROFORMA"
        ? "PROFORMA INVOICE"
        : "TAX INVOICE";
    doc
      .fillColor(GOLD)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(badgeLabel, L, 82, { align: "center", width: W });

    // ── Move below header ──
    let y = 120;

    // ── Invoice meta row ──
    doc.rect(L, y, W, 40).fill(LIGHT_BG).stroke(BORDER);
    doc
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Invoice No:", L + 8, y + 6)
      .font("Helvetica")
      .text(invoice.invoiceNumber, L + 65, y + 6);
    doc
      .font("Helvetica-Bold")
      .text("Date:", L + 8, y + 22)
      .font("Helvetica")
      .text(invoiceDate(invoice.createdAt), L + 65, y + 22);

    const ci = invoice.customerInfo || {};
    const custX = L + W / 2 + 5;
    doc
      .font("Helvetica-Bold")
      .text("Customer:", custX, y + 6)
      .font("Helvetica")
      .text(ci.name || "Walk-in Customer", custX + 60, y + 6, {
        width: W / 2 - 65,
      });
    if (ci.phone)
      doc.text(`Ph: ${ci.phone}`, custX, y + 18, { width: W / 2 - 5 });
    if (ci.gstin)
      doc.text(`GSTIN: ${ci.gstin}`, custX, y + 26, { width: W / 2 - 5 });
    if (ci.pan)
      doc.text(`PAN: ${ci.pan}`, custX + 110, y + 26, {
        width: W / 2 - 5,
      });

    y += 48;

    // ── Items table header ──
    const colWidths = {
      sno: 22,
      name: 105,
      hsn: 40,
      purity: 35,
      grossWt: 40,
      netWt: 40,
      goldRate: 48,
      making: 42,
      stone: 38,
      taxable: 48,
      gst: 32,
      total: 52,
    };
    const colKeys = Object.keys(colWidths) as (keyof typeof colWidths)[];
    const headers: Record<keyof typeof colWidths, string> = {
      sno: "#",
      name: "Description",
      hsn: "HSN",
      purity: "Purity",
      grossWt: "Gr.Wt(g)",
      netWt: "Net.Wt(g)",
      goldRate: "Gold Rate",
      making: "Making",
      stone: "Stone",
      taxable: "Taxable",
      gst: "GST%",
      total: "Amount",
    };

    const ROW_H = 16;
    const HDR_H = 18;

    // header row
    doc.rect(L, y, W, HDR_H).fill(DARK);
    let cx = L;
    for (const key of colKeys) {
      doc
        .fillColor(WHITE)
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(headers[key], cx + 2, y + 5, {
          width: colWidths[key] - 4,
          align: "center",
          lineBreak: false,
        });
      cx += colWidths[key];
    }
    y += HDR_H;

    // item rows
    invoice.items.forEach((item, idx) => {
      const isEven = idx % 2 === 0;
      doc.rect(L, y, W, ROW_H).fill(isEven ? WHITE : "#FDF6E3");

      let ix = L;
      const rowData: Record<keyof typeof colWidths, string> = {
        sno: String(idx + 1),
        name: item.name,
        hsn: item.hsnCode || "7113",
        purity: item.purity || "",
        grossWt: fmtW(item.grossWeight),
        netWt: fmtW(item.netWeight),
        goldRate: fmt(item.goldRate),
        making: fmt(item.makingCharge),
        stone: fmt(item.stoneCharge),
        taxable: fmt(item.taxableValue ?? item.price),
        gst: `${fmtNum(item.gstRate ?? 3)}%`,
        total: fmt(item.itemTotal ?? item.price),
      };

      for (const key of colKeys) {
        doc
          .fillColor(DARK)
          .font("Helvetica")
          .fontSize(7)
          .text(rowData[key], ix + 2, y + 4, {
            width: colWidths[key] - 4,
            align: key === "sno" || key === "gst" ? "center" : "right",
            lineBreak: false,
          });
        ix += colWidths[key];
      }
      y += ROW_H;
    });

    // table bottom border
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    y += 6;

    // ── GST Breakup + Totals ──
    const TOT_W = 210;
    const totX = L + W - TOT_W;

    const addTotRow = (
      label: string,
      value: string,
      bold = false,
      bg?: string
    ) => {
      if (bg) doc.rect(totX, y, TOT_W, 14).fill(bg);
      doc
        .fillColor(DARK)
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8)
        .text(label, totX + 4, y + 3, { width: 110 })
        .text(value, totX + 115, y + 3, {
          width: TOT_W - 120,
          align: "right",
        });
      y += 14;
    };

    const gb = invoice.gstBreakup || {};
    addTotRow("Subtotal", fmt(invoice.subtotal));
    if ((invoice.discount || 0) > 0)
      addTotRow("Discount", `- ${fmt(invoice.discount)}`);
    if ((invoice.exchangeDiscount || 0) > 0)
      addTotRow("Old Gold Exchange", `- ${fmt(invoice.exchangeDiscount)}`);
    addTotRow("Taxable Value", fmt(invoice.taxableAmount));

    if ((gb.cgstAmount || 0) > 0) {
      addTotRow(`CGST @ ${gb.cgstRate ?? 1.5}%`, fmt(gb.cgstAmount));
      addTotRow(`SGST @ ${gb.sgstRate ?? 1.5}%`, fmt(gb.sgstAmount));
    }
    if ((gb.igstAmount || 0) > 0)
      addTotRow(`IGST @ ${gb.igstRate ?? 3}%`, fmt(gb.igstAmount));

    if ((invoice.tcs || 0) > 0)
      addTotRow("TCS @ 1%", fmt(invoice.tcs));

    if ((invoice.roundOff || 0) !== 0)
      addTotRow("Round Off", fmt(invoice.roundOff));

    addTotRow("Grand Total", fmt(invoice.grandTotal), true, LIGHT_BG);
    y += 4;

    // GST breakup summary box
    const gstBoxX = L;
    const gstBoxW = W - TOT_W - 8;

    doc.rect(gstBoxX, y - 80, gstBoxW, 76).fill(LIGHT_BG).stroke(BORDER);
    doc
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("GST Summary", gstBoxX + 4, y - 76);

    const gstRows = [
      ["HSN", "Taxable", "CGST", "SGST", "IGST", "Total GST"],
    ];
    invoice.items.forEach((it) => {
      gstRows.push([
        it.hsnCode || "7113",
        fmt(it.taxableValue ?? it.price),
        fmt(it.cgstAmount),
        fmt(it.sgstAmount),
        fmt(it.igstAmount),
        fmt((it.cgstAmount || 0) + (it.sgstAmount || 0) + (it.igstAmount || 0)),
      ]);
    });

    gstRows.push([
      "Total",
      fmt(invoice.taxableAmount),
      fmt(gb.cgstAmount),
      fmt(gb.sgstAmount),
      fmt(gb.igstAmount),
      fmt(gb.totalGst),
    ]);

    let gstY = y - 64;
    gstRows.forEach((row, ri) => {
      const gColW = gstBoxW / row.length;
      row.forEach((cell, ci) => {
        doc
          .fillColor(DARK)
          .font(ri === 0 || ri === gstRows.length - 1 ? "Helvetica-Bold" : "Helvetica")
          .fontSize(6.5)
          .text(cell, gstBoxX + 4 + ci * gColW, gstY, {
            width: gColW - 4,
            align: ci === 0 ? "left" : "right",
            lineBreak: false,
          });
      });
      gstY += 9;
    });

    y += 8;

    // ── Payment details ──
    if (invoice.payments && invoice.payments.length > 0) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(DARK).text("Payment Mode:", L, y);
      y += 12;
      invoice.payments.forEach((p) => {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(DARK)
          .text(
            `${p.method}: ${fmt(p.amount)}${p.reference ? ` (Ref: ${p.reference})` : ""}`,
            L + 8,
            y
          );
        y += 12;
      });
    }

    y += 6;

    // ── Amount in words ──
    const totalWords = numberToWords(invoice.grandTotal);
    doc
      .rect(L, y, W, 16)
      .fill("#F0F9FF")
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(
        `Amount in Words: Rupees ${totalWords} Only`,
        L + 4,
        y + 4,
        { width: W - 8 }
      );
    y += 22;

    // ── QR Code ──
    try {
      const qrText = `${invoice.invoiceNumber}|${invoice.grandTotal}|${sp.gstin || ""}`;
      const qrBuf = await buildQrBuffer(qrText);
      const QR_SIZE = 70;
      doc.image(qrBuf, L + W - QR_SIZE, y, { width: QR_SIZE });
      doc
        .fontSize(6)
        .fillColor(GRAY)
        .text("Scan to verify", L + W - QR_SIZE, y + QR_SIZE + 2, {
          width: QR_SIZE,
          align: "center",
        });
    } catch (_) {
      // QR optional
    }

    // ── Terms & Conditions ──
    const store = invoice.storeProfile as any;
    const terms: string[] = store?.termsAndConditions || [
      "All goods once sold cannot be returned or exchanged.",
      "BIS hallmarked jewellery only.",
      "This is a computer generated invoice.",
    ];
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(DARK)
      .text("Terms & Conditions:", L, y);
    y += 12;
    terms.forEach((t) => {
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(GRAY)
        .text(`• ${t}`, L + 4, y, { width: W - 80 });
      y += 10;
    });

    // ── Footer ──
    const footerY = P.height - P.margins.bottom - 20;
    doc
      .moveTo(L, footerY - 4)
      .lineTo(L + W, footerY - 4)
      .lineWidth(0.5)
      .strokeColor(BORDER)
      .stroke();
    doc
      .fillColor(GRAY)
      .font("Helvetica")
      .fontSize(7)
      .text(
        "Thank you for shopping with us! | This is a computer generated invoice.",
        L,
        footerY,
        { align: "center", width: W }
      );

    // Authorised signature placeholder
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(DARK)
      .text("Authorised Signatory", L + W - 130, footerY - 24)
      .moveTo(L + W - 130, footerY - 8)
      .lineTo(L + W, footerY - 8)
      .lineWidth(0.5)
      .strokeColor(DARK)
      .stroke();

    doc.end();
  });
}

// ─── Thermal PDF (58mm / 80mm) ────────────────────────────────────────────────

export async function generateThermalPdf(
  invoice: PdfInvoiceDoc,
  widthMm: 58 | 80
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const chunks: Buffer[] = [];

    // Convert mm to points (1mm ≈ 2.835pt)
    const pxW = Math.round(widthMm * 2.835);
    const margin = 6;
    const usableW = pxW - margin * 2;

    // Thermal receipts are long — use a tall virtual page
    const PAGE_H = 2000;

    const doc = new PDFDocument({
      size: [pxW, PAGE_H],
      margin,
      info: { Title: `Thermal ${invoice.invoiceNumber}` },
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const DARK = "#000000";
    const GRAY = "#555555";

    let y = margin;

    const line = (text: string, opts: any = {}) => {
      doc
        .fillColor(opts.color || DARK)
        .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opts.size || 7)
        .text(text, margin, y, {
          align: opts.align || "left",
          width: usableW,
          ...opts,
        });
      y = doc.y + 1;
    };

    const divider = (char = "-") => {
      doc
        .fillColor(GRAY)
        .font("Helvetica")
        .fontSize(6.5)
        .text(char.repeat(Math.floor(usableW / 3.8)), margin, y, {
          width: usableW,
        });
      y = doc.y + 1;
    };

    const sp = invoice.storeProfile || {};

    // Shop header
    line(sp.shopName || "AuraJewel", { bold: true, size: 10, align: "center" });
    if (sp.address) line(sp.address, { size: 6, align: "center" });
    const shopSub = [sp.city, sp.state].filter(Boolean).join(", ");
    if (shopSub) line(shopSub, { size: 6, align: "center" });
    if (sp.phone) line(`Ph: ${sp.phone}`, { size: 6, align: "center" });
    if (sp.gstin) line(`GSTIN: ${sp.gstin}`, { size: 6, align: "center" });
    if (sp.bisLicence) line(`BIS: ${sp.bisLicence}`, { size: 6, align: "center" });

    divider("=");

    const badge =
      invoice.type === "ADVANCE"
        ? "ADVANCE RECEIPT"
        : invoice.type === "PROFORMA"
        ? "PROFORMA"
        : "TAX INVOICE";
    line(badge, { bold: true, size: 8, align: "center" });

    divider();

    line(`Invoice: ${invoice.invoiceNumber}`, { bold: true, size: 7 });
    line(`Date   : ${invoiceDate(invoice.createdAt)}`, { size: 7 });

    const ci = invoice.customerInfo || {};
    if (ci.name) line(`Customer: ${ci.name}`, { size: 7 });
    if (ci.phone) line(`Phone   : ${ci.phone}`, { size: 7 });
    if (ci.gstin) line(`GSTIN   : ${ci.gstin}`, { size: 6 });

    divider();

    // Items
    const nameW = Math.round(usableW * 0.5);
    const qtyW = Math.round(usableW * 0.1);
    const amtW = usableW - nameW - qtyW;

    // Header
    doc
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .text("Item", margin, y, { width: nameW, lineBreak: false })
      .text("Qty", margin + nameW, y, { width: qtyW, align: "center", lineBreak: false })
      .text("Amt", margin + nameW + qtyW, y, { width: amtW, align: "right" });
    y = doc.y + 1;
    divider();

    invoice.items.forEach((item) => {
      doc
        .fillColor(DARK)
        .font("Helvetica")
        .fontSize(6.5)
        .text(item.name, margin, y, { width: nameW, lineBreak: false })
        .text(String(item.qty || 1), margin + nameW, y, {
          width: qtyW,
          align: "center",
          lineBreak: false,
        })
        .text(fmt(item.itemTotal ?? item.price), margin + nameW + qtyW, y, {
          width: amtW,
          align: "right",
        });
      y = doc.y + 1;

      // Sub-details
      const sub: string[] = [];
      if (item.purity) sub.push(item.purity);
      if (item.netWeight) sub.push(`${fmtW(item.netWeight)}`);
      if (item.goldRate) sub.push(`@${fmt(item.goldRate)}/g`);
      if (item.bisNumber) sub.push(`BIS:${item.bisNumber}`);
      if (sub.length > 0) {
        line(`  ${sub.join(" | ")}`, { size: 5.5, color: GRAY });
      }
    });

    divider();

    // Totals
    const totRow = (label: string, value: string, bold = false) => {
      doc
        .fillColor(DARK)
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(7)
        .text(label, margin, y, {
          width: usableW * 0.6,
          lineBreak: false,
        })
        .text(value, margin + usableW * 0.6, y, {
          width: usableW * 0.4,
          align: "right",
        });
      y = doc.y + 1;
    };

    const gb = invoice.gstBreakup || {};
    totRow("Subtotal", fmt(invoice.subtotal));
    if ((invoice.discount || 0) > 0) totRow("Discount", `- ${fmt(invoice.discount)}`);
    if ((invoice.exchangeDiscount || 0) > 0)
      totRow("Old Gold Exch.", `- ${fmt(invoice.exchangeDiscount)}`);
    totRow("Taxable Amt", fmt(invoice.taxableAmount));
    if ((gb.cgstAmount || 0) > 0) {
      totRow(`CGST ${gb.cgstRate ?? 1.5}%`, fmt(gb.cgstAmount));
      totRow(`SGST ${gb.sgstRate ?? 1.5}%`, fmt(gb.sgstAmount));
    }
    if ((gb.igstAmount || 0) > 0)
      totRow(`IGST ${gb.igstRate ?? 3}%`, fmt(gb.igstAmount));
    if ((invoice.tcs || 0) > 0) totRow("TCS 1%", fmt(invoice.tcs));
    if ((invoice.roundOff || 0) !== 0) totRow("Round Off", fmt(invoice.roundOff));

    divider("=");
    totRow("TOTAL", fmt(invoice.grandTotal), true);
    divider("=");

    // Payments
    if (invoice.payments && invoice.payments.length > 0) {
      line("Payment:", { bold: true, size: 7 });
      invoice.payments.forEach((p) => {
        totRow(`  ${p.method}`, fmt(p.amount));
      });
    }

    divider();

    // QR code
    try {
      const qrText = `${invoice.invoiceNumber}|${invoice.grandTotal}|${sp.gstin || ""}`;
      const qrBuf = await buildQrBuffer(qrText);
      const QR_SZ = widthMm === 58 ? 60 : 80;
      const qrX = margin + (usableW - QR_SZ) / 2;
      doc.image(qrBuf, qrX, y, { width: QR_SZ });
      y += QR_SZ + 4;
    } catch (_) {}

    divider();
    line("Thank you! Visit again.", { align: "center", size: 7, bold: true });
    if (sp.phone) line(`Ph: ${sp.phone}`, { align: "center", size: 6 });
    line("Computer generated receipt.", { align: "center", size: 5.5, color: GRAY });

    doc.end();
  });
}

// ─── Number to words (Indian system) ─────────────────────────────────────────

function numberToWords(n: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const convert = (num: number): string => {
    if (num < 20) return ones[num];
    if (num < 100)
      return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000)
      return (
        ones[Math.floor(num / 100)] +
        " Hundred" +
        (num % 100 ? " " + convert(num % 100) : "")
      );
    if (num < 100000)
      return (
        convert(Math.floor(num / 1000)) +
        " Thousand" +
        (num % 1000 ? " " + convert(num % 1000) : "")
      );
    if (num < 10000000)
      return (
        convert(Math.floor(num / 100000)) +
        " Lakh" +
        (num % 100000 ? " " + convert(num % 100000) : "")
      );
    return (
      convert(Math.floor(num / 10000000)) +
      " Crore" +
      (num % 10000000 ? " " + convert(num % 10000000) : "")
    );
  };

  const whole = Math.floor(n);
  const paise = Math.round((n - whole) * 100);
  let result = convert(whole) || "Zero";
  if (paise > 0) result += ` and ${convert(paise)} Paise`;
  return result;
}
