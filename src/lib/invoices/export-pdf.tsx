import "server-only";

import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatPence } from "./money";
import { exportDate, invoiceExportFilterDescription, type InvoiceExportFilters, type InvoiceExportRow } from "./export";
import { invoiceStatusLabel, sourceLabel } from "./types";

const colours = { navy: "#071127", blue: "#1974E2", pale: "#F4F7FA", border: "#DCE6F2", muted: "#667586", white: "#FFFFFF", green: "#237A57" };
const styles = StyleSheet.create({
  page: { padding: 34, paddingBottom: 52, fontFamily: "Helvetica", fontSize: 8, color: colours.navy },
  header: { marginHorizontal: -34, marginTop: -34, paddingHorizontal: 34, paddingVertical: 24, backgroundColor: colours.navy, color: colours.white },
  eyebrow: { color: "#67B9FF", fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.2 },
  title: { marginTop: 6, fontSize: 24, fontFamily: "Helvetica-Bold" },
  subtitle: { marginTop: 7, color: "#DCE6F2", fontSize: 9 },
  metrics: { marginTop: 18, flexDirection: "row", gap: 10 },
  metric: { flexGrow: 1, flexBasis: 0, padding: 12, backgroundColor: colours.pale, borderTopWidth: 3, borderTopColor: colours.blue },
  metricLabel: { color: colours.muted, fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  metricValue: { marginTop: 5, fontSize: 15, fontFamily: "Helvetica-Bold" },
  table: { marginTop: 18 },
  head: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 7, backgroundColor: colours.navy, color: colours.white, fontFamily: "Helvetica-Bold", fontSize: 7 },
  row: { flexDirection: "row", minHeight: 28, paddingVertical: 7, paddingHorizontal: 7, borderBottomWidth: 1, borderBottomColor: colours.border },
  alt: { backgroundColor: "#FAFCFE" },
  number: { width: "17%" }, date: { width: "11%" }, customer: { width: "24%", paddingRight: 5 }, category: { width: "14%" }, status: { width: "14%" }, amount: { width: "20%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  empty: { marginTop: 24, padding: 20, textAlign: "center", backgroundColor: colours.pale, color: colours.muted },
  footer: { position: "absolute", bottom: 20, left: 34, right: 34, paddingTop: 7, borderTopWidth: 1, borderTopColor: colours.border, flexDirection: "row", justifyContent: "space-between", color: colours.muted, fontSize: 7 },
});

export async function renderInvoiceExportPdf(rows: InvoiceExportRow[], filters: InvoiceExportFilters) {
  return renderToBuffer(<InvoiceExportDocument rows={rows} filters={filters} />);
}

function InvoiceExportDocument({ rows, filters }: { rows: InvoiceExportRow[]; filters: InvoiceExportFilters }) {
  const total = rows.reduce((sum, row) => sum + BigInt(row.total_pence), 0n);
  const paid = rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + BigInt(row.total_pence), 0n);
  const outstanding = rows.filter((row) => row.status === "issued").reduce((sum, row) => sum + BigInt(row.total_pence), 0n);
  return <Document title={`SOB Autofix invoice export - ${filters.label}`} author="SOB Autofix Limited">
    <Page size="A4" orientation="landscape" style={styles.page} wrap>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SOB AUTOFIX - ACCOUNTS</Text>
        <Text style={styles.title}>Invoice export</Text>
        <Text style={styles.subtitle}>{invoiceExportFilterDescription(filters)}</Text>
      </View>
      <View style={styles.metrics} wrap={false}>
        <Metric label="Invoices" value={String(rows.length)} />
        <Metric label="Invoice value" value={formatPence(total)} />
        <Metric label="Paid / settled" value={formatPence(paid)} />
        <Metric label="Outstanding" value={formatPence(outstanding)} />
      </View>
      {rows.length ? <View style={styles.table}>
        <View style={styles.head} fixed><Text style={styles.number}>INVOICE</Text><Text style={styles.date}>DATE</Text><Text style={styles.customer}>CUSTOMER</Text><Text style={styles.category}>SOURCE</Text><Text style={styles.status}>STATUS</Text><Text style={styles.amount}>TOTAL</Text></View>
        {rows.map((row, index) => <View key={row.id} style={[styles.row, index % 2 ? styles.alt : {}]} wrap={false}><Text style={styles.number}>{row.invoice_number || "DRAFT"}</Text><Text style={styles.date}>{displayDate(exportDate(row))}</Text><Text style={styles.customer}>{row.customer_name}</Text><Text style={styles.category}>{sourceLabel(row.source_type)}</Text><Text style={styles.status}>{invoiceStatusLabel(row.status)}</Text><Text style={styles.amount}>{formatPence(row.total_pence)}</Text></View>)}
      </View> : <Text style={styles.empty}>No invoices matched the selected filters.</Text>}
      <View fixed style={styles.footer}><Text>SOB Autofix Limited - Private accounts export</Text><Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} /></View>
    </Page>
  </Document>;
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function displayDate(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }
