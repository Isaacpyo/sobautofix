import "server-only";

import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatPence } from "./money";
import { invoiceStatusLabel, type Invoice } from "./types";

const s = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 72, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9.5, color: "#202A36", lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 18, borderBottomWidth: 2, borderBottomColor: "#1974E2" },
  brand: { fontSize: 19, fontFamily: "Helvetica-Bold", color: "#071127" }, tagline: { marginTop: 4, color: "#586575", fontSize: 8.5 },
  title: { fontSize: 25, fontFamily: "Helvetica-Bold", color: "#071127", textAlign: "right" }, number: { marginTop: 12, fontFamily: "Helvetica-Bold", color: "#1974E2", textAlign: "right" }, status: { marginTop: 6, fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "right" },
  watermark: { position: "absolute", top: 300, left: 92, transform: "rotate(-35deg)", fontSize: 63, fontFamily: "Helvetica-Bold", color: "#DCE6F2", opacity: 0.34 },
  pageStatus: { position: "absolute", bottom: 42, right: 44, width: 300, textAlign: "right", fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#1974E2" },
  dates: { flexDirection: "row", justifyContent: "flex-end", gap: 24, marginTop: 15 }, label: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#667586", letterSpacing: 0.7, textTransform: "uppercase" }, value: { marginTop: 3, fontFamily: "Helvetica-Bold", color: "#071127" }, line: { marginTop: 3 },
  info: { flexDirection: "row", gap: 12, marginTop: 22 }, card: { flexGrow: 1, flexBasis: 0, minHeight: 94, padding: 11, borderWidth: 1, borderColor: "#E4EAF0", borderRadius: 4 },
  table: { marginTop: 22, borderWidth: 1, borderColor: "#DCE6F2", borderRadius: 4 }, tableHead: { flexDirection: "row", backgroundColor: "#071127", color: "#FFFFFF", paddingVertical: 8, paddingHorizontal: 9, fontFamily: "Helvetica-Bold", fontSize: 8 }, row: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 9, borderTopWidth: 1, borderTopColor: "#E4EAF0", minHeight: 32 },
  description: { width: "55%", paddingRight: 8 }, qty: { width: "12%", textAlign: "right" }, unit: { width: "16%", textAlign: "right" }, amount: { width: "17%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 }, totals: { width: 225 }, totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }, grand: { marginTop: 4, paddingTop: 8, borderTopWidth: 2, borderTopColor: "#1974E2", fontSize: 14, fontFamily: "Helvetica-Bold", color: "#071127" },
  continuation: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#DCE6F2", fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#1974E2" },
  notes: { marginTop: 22, flexDirection: "row", gap: 12 }, note: { flexGrow: 1, flexBasis: 0, padding: 11, backgroundColor: "#F4F7FA", borderRadius: 4 },
});

export async function renderInvoicePdf(invoice: Invoice) { return renderToBuffer(<InvoiceDocument invoice={invoice} />); }

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const watermark = invoice.status === "draft" ? "DRAFT" : invoice.status === "void" ? "VOID" : null;
  const status = invoiceStatusLabel(invoice.status).toUpperCase();
  const reference = invoice.invoice_number || "DRAFT";
  return <Document title={`${invoice.issuer_trading_name} invoice ${reference}`} author={invoice.issuer_legal_name} creationDate={new Date(invoice.created_at)} modificationDate={new Date(invoice.updated_at)}>
    <Page size="A4" style={s.page} wrap>
      {watermark && <Text fixed style={s.watermark}>{watermark}</Text>}
      <Text fixed style={s.pageStatus}>{reference} | {status}</Text>
      <View style={s.header}><View><Text style={s.brand}>{invoice.issuer_trading_name.toUpperCase()}</Text><Text style={s.tagline}>{invoice.issuer_tagline}</Text></View><View><Text style={s.title}>INVOICE</Text><Text style={s.number}>{reference}</Text><Text style={s.status}>{status}</Text></View></View>
      <View style={s.dates}><Pair label="Issue date" value={formatDate(invoice.issue_date)} /><Pair label="Due date" value={formatDate(invoice.due_date)} />{invoice.paid_at && <Pair label="Paid" value={formatDate(invoice.paid_at.slice(0, 10))} />}</View>
      <View style={s.info}><View style={s.card}><Text style={s.label}>Bill to</Text><Text style={s.value}>{invoice.customer_name}</Text>{splitAddress(invoice.customer_address).map((line) => <Text key={line} style={s.line}>{line}</Text>)}{invoice.customer_email && <Text style={s.line}>{invoice.customer_email}</Text>}{invoice.customer_phone && <Text style={s.line}>{invoice.customer_phone}</Text>}</View><View style={s.card}><Text style={s.label}>Vehicle / Service</Text>{[invoice.vehicle_registration, invoice.vehicle_make, invoice.vehicle_model].filter(Boolean).map((line) => <Text key={line} style={s.value}>{line}</Text>)}{invoice.service_name && <Text style={s.line}>{invoice.service_name}</Text>}{invoice.appointment_start && <Text style={s.line}>{formatDateTime(invoice.appointment_start)}</Text>}</View><View style={s.card}><Text style={s.label}>From</Text><Text style={s.value}>{invoice.issuer_legal_name}</Text>{splitAddress(invoice.issuer_address).map((line) => <Text key={line} style={s.line}>{line}</Text>)}<Text style={s.line}>{invoice.issuer_phone}</Text><Text style={s.line}>{invoice.issuer_email}</Text><Text style={s.line}>Company no. {invoice.issuer_company_number}</Text></View></View>
      <View style={s.table}><View style={s.tableHead} fixed><Text style={s.description}>Description</Text><Text style={s.qty}>Qty</Text><Text style={s.unit}>Unit price</Text><Text style={s.amount}>Amount</Text></View>{invoice.invoice_items.map((item) => <View key={item.id} style={s.row} wrap={false}><Text style={s.description}>{item.description}</Text><Text style={s.qty}>{trimQuantity(String(item.quantity))}</Text><Text style={s.unit}>{formatPence(item.unit_price_pence)}</Text><Text style={s.amount}>{formatPence(item.line_total_pence)}</Text></View>)}</View>
      <View break={invoice.invoice_items.length > 20} wrap={false}>{invoice.invoice_items.length > 20 && <View style={s.continuation}><Text>INVOICE SUMMARY</Text><Text>{reference} | {status}</Text></View>}<View style={s.totalsWrap}><View style={s.totals}><Total label="Subtotal" value={invoice.subtotal_pence} />{BigInt(invoice.discount_pence) > 0n && <Total label="Discount" value={-BigInt(invoice.discount_pence)} />}{BigInt(invoice.tax_pence) > 0n && <Total label="Tax" value={invoice.tax_pence} />}<View style={[s.totalRow, s.grand]}><Text>TOTAL GBP</Text><Text>{formatPence(invoice.total_pence)}</Text></View></View></View></View>
      {(invoice.payment_terms || invoice.notes) && <View wrap={false} style={s.notes}>{invoice.payment_terms && <Note label="Payment terms" text={invoice.payment_terms} />}{invoice.notes && <Note label="Notes" text={invoice.notes} />}</View>}
    </Page>
  </Document>;
}

function Pair({ label, value }: { label: string; value: string }) { return <View><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>; }
function Total({ label, value }: { label: string; value: bigint | string | number }) { return <View style={s.totalRow}><Text>{label}</Text><Text>{formatPence(value)}</Text></View>; }
function Note({ label, text }: { label: string; text: string }) { return <View style={s.note}><Text style={s.label}>{label}</Text><Text style={s.line}>{text}</Text></View>; }
function splitAddress(value: string | null) { return value ? value.split(/\r?\n|,/).map((line) => line.trim()).filter(Boolean) : []; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(`${value}T12:00:00Z`)) : "Not set"; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)); }
function trimQuantity(value: string) { return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1"); }
