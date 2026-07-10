import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../models/stock_item.dart';
import 'package:intl/intl.dart';

class ShopifyExporter {
  static Future<void> exportStockToShopifyCSV(List<StockItem> items) async {
    final StringBuffer csv = StringBuffer();
    
    // Shopify Standard Import Headers
    csv.writeln('Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Variant Inventory Qty,Variant Price,Variant Barcode,Variant SKU');

    for (var item in items) {
      final handle = item.name.toLowerCase().replaceAll(' ', '-').replaceAll(RegExp(r'[^a-z0-9\-]'), '');
      final title = '"${item.name}"';
      final body = '"Weight: ${item.weightGrams}g, Karat: ${item.karat}K"';
      final vendor = '"Swarna ERP"';
      final type = '"${item.category}"';
      final tags = '"${item.metalType}, ${item.karat}k, ${item.category}"';
      final published = 'TRUE';
      final optionName = '"Design Code"';
      final optionValue = '"${item.designCode ?? "N/A"}"';
      final qty = item.pieces.toString();
      final price = (item.costPerGram ?? 0.0) * item.weightGrams;
      final barcode = '"${item.barcodeId ?? ""}"';
      final sku = '"${item.id}"';

      csv.writeln('$handle,$title,$body,$vendor,$type,$tags,$published,$optionName,$optionValue,$qty,$price,$barcode,$sku');
    }

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/Shopify_Inventory_${DateFormat('yyyyMMdd_HHmm').format(DateTime.now())}.csv');
    await file.writeAsString(csv.toString());

    await Share.shareXFiles([XFile(file.path)], subject: 'Shopify CSV Export');
  }
}
