import PDFDocument from "pdfkit";

interface CostEstimatePdfInput {
  order: any;
  estimate: any;
}

const fmt = (n: number | undefined | null) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtLine = (value: string, width: number) => value.padEnd(width).slice(0, width);

export async function generateCostEstimatePdf(input: CostEstimatePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const order = input.order || {};
    const estimate = input.estimate || {};
    const customerName = order.customerName || order.customer || "Walk-in Customer";
    const orderId = order._id || order.id || "N/A";

    doc.fontSize(18).font("Helvetica-Bold").fillColor("#2A2A2A").text("AuraJewel Cost Estimate", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#4B5563").text(`Estimate ID: ${estimate.estimateId}`, { align: "left" });
    doc.text(`Order ID: ${orderId}`, { align: "left" });
    doc.text(`Created By: ${estimate.createdByEmail || estimate.createdBy}`, { align: "left" });
    doc.text(`Status: ${estimate.status}`, { align: "left" });
    doc.text(`Created At: ${new Date(estimate.createdAt).toLocaleString("en-IN")}`, { align: "left" });
    doc.moveDown();

    doc.fontSize(12).font("Helvetica-Bold").text("Customer & Order Details", { underline: true });
    doc.moveDown(0.3);
    const customerLines = [
      `Customer: ${customerName}`,
      `Email: ${order.customerEmail || "N/A"}`,
      `Phone: ${order.customerPhone || order.customerContact || "N/A"}`,
      `Design: ${order.designName || order.designCode || "N/A"}`,
      `Order Status: ${order.status || "N/A"}`,
    ];
    customerLines.forEach((line) => doc.fontSize(10).text(line));
    doc.moveDown();

    doc.fontSize(12).font("Helvetica-Bold").text("Estimate Breakdown", { underline: true });
    doc.moveDown(0.3);

    const tableTop = doc.y;
    const itemCol = 40;
    const descCol = 120;
    const qtyCol = 300;
    const unitCol = 350;
    const amountCol = 430;

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Description", itemCol, tableTop);
    doc.text("Qty", qtyCol, tableTop);
    doc.text("Unit Price", unitCol, tableTop);
    doc.text("Amount", amountCol, tableTop);
    doc.moveDown(0.5);

    doc.font("Helvetica");
    const items = Array.isArray(estimate.lineItems) && estimate.lineItems.length > 0 ? estimate.lineItems : [
      { description: "Metal Cost", quantity: 1, unitPrice: estimate.metalCost || 0, amount: estimate.metalCost || 0 },
      { description: "Stone Cost", quantity: 1, unitPrice: estimate.stoneCost || 0, amount: estimate.stoneCost || 0 },
      { description: "Making Charges", quantity: 1, unitPrice: estimate.makingCharges || 0, amount: estimate.makingCharges || 0 },
    ];

    items.forEach((item) => {
      doc.text(String(item.description || ""), itemCol, doc.y, { width: descCol - itemCol });
      doc.text(String(item.quantity || 1), qtyCol, doc.y);
      doc.text(fmt(Number(item.unitPrice || 0)), unitCol, doc.y);
      doc.text(fmt(Number(item.amount || 0)), amountCol, doc.y);
      doc.moveDown(0.5);
    });

    doc.moveDown();
    const summaryLeft = 320;
    const summaryWidth = 200;
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Subtotal:", summaryLeft, doc.y);
    doc.font("Helvetica").text(fmt((estimate.metalCost || 0) + (estimate.stoneCost || 0) + (estimate.makingCharges || 0)), amountCol, doc.y);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text(`GST @ ${estimate.gstPercent || 0}%:`, summaryLeft, doc.y);
    doc.font("Helvetica").text(fmt(estimate.tax || 0), amountCol, doc.y);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text("Total:", summaryLeft, doc.y);
    doc.font("Helvetica").text(fmt(estimate.total || 0), amountCol, doc.y);

    if (estimate.notes) {
      doc.moveDown();
      doc.fontSize(11).font("Helvetica-Bold").text("Notes");
      doc.moveDown(0.2);
      doc.fontSize(10).font("Helvetica").text(estimate.notes);
    }

    doc.end();
  });
}
