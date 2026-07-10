import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:intl/intl.dart';
import '../models/retail_order.dart';
import '../models/ledger_entry.dart';
import '../models/stock_item.dart';

class PdfGenerator {
  static Future<void> generateOrderInvoice(RetailOrder order) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context context) {
          return pw.Padding(
            padding: const pw.EdgeInsets.all(24),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text('SWARNA JEWELERS', style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold, color: PdfColors.amber800)),
                        pw.SizedBox(height: 4),
                        pw.Text('Wholesale B2B Excellence', style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey700)),
                      ],
                    ),
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.end,
                      children: [
                        pw.Text('INVOICE', style: pw.TextStyle(fontSize: 28, fontWeight: pw.FontWeight.bold, color: PdfColors.grey300)),
                        pw.SizedBox(height: 4),
                        pw.Text('Date: ${DateFormat('dd MMM yyyy').format(DateTime.now())}', style: const pw.TextStyle(fontSize: 12)),
                        pw.Text('Order ID: #${order.id ?? 'Pending'}', style: const pw.TextStyle(fontSize: 12)),
                      ],
                    ),
                  ],
                ),
                pw.SizedBox(height: 40),
                pw.Text('Billed To:', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 4),
                pw.Text(order.customerName.toUpperCase(), style: pw.TextStyle(fontSize: 16)),
                pw.SizedBox(height: 30),
                pw.TableHelper.fromTextArray(
                  headers: ['Description', 'Status', 'Date Logged'],
                  data: [
                    [order.details, order.status.toUpperCase(), DateFormat('dd/MM/yyyy').format(order.createdAt)],
                  ],
                  headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, color: PdfColors.white),
                  headerDecoration: const pw.BoxDecoration(color: PdfColors.amber800),
                  cellHeight: 40,
                  cellAlignments: {
                    0: pw.Alignment.centerLeft,
                    1: pw.Alignment.center,
                    2: pw.Alignment.centerRight,
                  },
                ),
                pw.Spacer(),
                pw.Divider(),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('Thank you for your business!', style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey700)),
                    pw.Text('Authorized Signatory', style: pw.TextStyle(fontSize: 12, fontStyle: pw.FontStyle.italic)),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );

    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => pdf.save(),
      name: 'Invoice_${order.customerName}_${order.id}.pdf',
    );
  }

  static Future<void> generateLedgerReceipt(LedgerEntry entry) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context context) {
          final isCredit = entry.transactionType == 'credit';
          final color = isCredit ? PdfColors.green700 : PdfColors.red700;
          
          return pw.Padding(
            padding: const pw.EdgeInsets.all(24),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('SWARNA JEWELERS - PAYMENT RECEIPT', style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold, color: PdfColors.amber800)),
                pw.SizedBox(height: 30),
                pw.Container(
                  padding: const pw.EdgeInsets.all(16),
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(color: PdfColors.grey300),
                    borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
                  ),
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
                        pw.Text('Party:', style: const pw.TextStyle(fontSize: 14)),
                        pw.Text(entry.partyName.toUpperCase(), style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
                      ]),
                      pw.Divider(),
                      pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
                        pw.Text('Date:', style: const pw.TextStyle(fontSize: 14)),
                        pw.Text(DateFormat('dd MMM yyyy, hh:mm a').format(entry.date), style: const pw.TextStyle(fontSize: 14)),
                      ]),
                      pw.Divider(),
                      pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
                        pw.Text('Type:', style: const pw.TextStyle(fontSize: 14)),
                        pw.Text(isCredit ? 'RECEIVED (CREDIT)' : 'PAID (DEBIT)', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold, color: color)),
                      ]),
                      pw.Divider(),
                      pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
                        pw.Text('Amount:', style: const pw.TextStyle(fontSize: 16)),
                        pw.Text('Rs. ${entry.amount.toStringAsFixed(2)}', style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold, color: color)),
                      ]),
                    ],
                  ),
                ),
                pw.SizedBox(height: 20),
                if (entry.description.isNotEmpty) ...[
                  pw.Text('Notes:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                  pw.SizedBox(height: 4),
                  pw.Text(entry.description),
                ],
                pw.Spacer(),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.center,
                  children: [
                    pw.Text('Computer Generated Receipt - No Signature Required', style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );

    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => pdf.save(),
      name: 'Receipt_${entry.partyName}_${entry.id}.pdf',
    );
  }

  static Future<void> generateStockBarcode(StockItem item) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: const PdfPageFormat(50 * PdfPageFormat.mm, 30 * PdfPageFormat.mm, marginAll: 2 * PdfPageFormat.mm),
        build: (pw.Context context) {
          final idToEncode = item.barcodeId ?? 'STK-${item.id?.toString().padLeft(4, '0') ?? '0000'}';
          
          return pw.Center(
            child: pw.Column(
              mainAxisAlignment: pw.MainAxisAlignment.center,
              children: [
                pw.Text('SWARNA JEWELERS', style: pw.TextStyle(fontSize: 6, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 2),
                pw.Text('${item.name} (${item.karat}${item.metalType == 'diamond' ? 'CT' : 'K'} ${item.metalType.substring(0, 1).toUpperCase()})', style: const pw.TextStyle(fontSize: 7)),
                pw.SizedBox(height: 1),
                pw.Text('Wt: ${item.weightGrams}${item.metalType == 'diamond' ? 'ct' : 'g'}', style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 4),
                pw.SizedBox(
                  height: 30,
                  width: 100,
                  child: pw.BarcodeWidget(
                    barcode: pw.Barcode.code128(),
                    data: idToEncode,
                    drawText: true,
                    textStyle: const pw.TextStyle(fontSize: 6),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );

    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => pdf.save(),
      name: 'Tag_${item.name}.pdf',
    );
  }
}
