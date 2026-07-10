import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../models/ledger_entry.dart';
import 'package:intl/intl.dart';

class TallyExporter {
  static Future<void> exportLedgersToTally(List<LedgerEntry> entries) async {
    final StringBuffer xml = StringBuffer();
    
    xml.writeln('<ENVELOPE>');
    xml.writeln(' <HEADER>');
    xml.writeln('  <TALLYREQUEST>Import Data</TALLYREQUEST>');
    xml.writeln(' </HEADER>');
    xml.writeln(' <BODY>');
    xml.writeln('  <IMPORTDATA>');
    xml.writeln('   <REQUESTDESC>');
    xml.writeln('    <REPORTNAME>Vouchers</REPORTNAME>');
    xml.writeln('   </REQUESTDESC>');
    xml.writeln('   <REQUESTDATA>');

    for (var entry in entries) {
      final date = DateFormat('yyyyMMdd').format(entry.date);
      final isDebit = entry.transactionType == 'debit';
      final voucherType = isDebit ? 'Payment' : 'Receipt';
      
      xml.writeln('    <TALLYMESSAGE xmlns:UDF="TallyUDF">');
      xml.writeln('     <VOUCHER VCHTYPE="$voucherType" ACTION="Create">');
      xml.writeln('      <DATE>$date</DATE>');
      xml.writeln('      <VOUCHERTYPENAME>$voucherType</VOUCHERTYPENAME>');
      xml.writeln('      <NARRATION>${entry.description}</NARRATION>');
      
      // Debit Node
      xml.writeln('      <ALLLEDGERENTRIES.LIST>');
      xml.writeln('       <LEDGERNAME>${isDebit ? entry.partyName : "Cash"}</LEDGERNAME>');
      xml.writeln('       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>');
      xml.writeln('       <AMOUNT>-${entry.amount.toStringAsFixed(2)}</AMOUNT>');
      xml.writeln('      </ALLLEDGERENTRIES.LIST>');
      
      // Credit Node
      xml.writeln('      <ALLLEDGERENTRIES.LIST>');
      xml.writeln('       <LEDGERNAME>${isDebit ? "Cash" : entry.partyName}</LEDGERNAME>');
      xml.writeln('       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
      xml.writeln('       <AMOUNT>${entry.amount.toStringAsFixed(2)}</AMOUNT>');
      xml.writeln('      </ALLLEDGERENTRIES.LIST>');
      
      xml.writeln('     </VOUCHER>');
      xml.writeln('    </TALLYMESSAGE>');
    }

    xml.writeln('   </REQUESTDATA>');
    xml.writeln('  </IMPORTDATA>');
    xml.writeln(' </BODY>');
    xml.writeln('</ENVELOPE>');

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/Tally_Export_${DateFormat('yyyyMMdd_HHmm').format(DateTime.now())}.xml');
    await file.writeAsString(xml.toString());

    await Share.shareXFiles([XFile(file.path)], subject: 'Tally XML Export');
  }
}
