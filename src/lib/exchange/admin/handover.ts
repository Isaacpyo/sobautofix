import "server-only";

import { z } from "zod";
import { activeSaleStatuses, paymentStatuses, type VehicleSaleStatus } from "@/components/admin/exchange/labels";
import { poundsToPence } from "@/lib/exchange/margin";
import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { assertCan, checkbox, ExchangeUserError, fieldError, moneyPence, must, mustRow, optionalDateTime, optionalMoneyPence, optionalText } from "./core";

export type SaleListItem = {
  id: string; status: VehicleSaleStatus; agreedPricePence: number; amountPaidPence: number; paymentStatus: string; reservedAt: string; reservationExpiresAt: string | null;
  handoverMethod: string; handoverAt: string | null; completedAt: string | null; vehicle: { id: string; title: string; slug: string; stockReference: string | null } | null; customerName: string | null; partExchange: boolean;
};

type SaleRow = {
  id: string; status: VehicleSaleStatus; agreed_price_pence: number; deposit_pence: number; amount_paid_pence: number; payment_status: string; payment_method: string | null; reserved_at: string; reservation_expires_at: string | null;
  handover_method: string; handover_at: string | null; handover_notes: string | null; completed_at: string | null; cancelled_at: string | null; cancellation_reason: string | null; customer_id: string | null; enquiry_id: string | null;
  part_exchange_submission_id: string | null; part_exchange_allowance_pence: number | null; created_at: string; updated_at: string; sale_vehicle_id: string;
  sale_vehicles: { id: string; year: number; make: string; model: string; slug: string; stock_reference: string | null; price: number; status: string } | null;
  customers: { name: string; email: string | null; phone: string } | null;
};

const SALE_SELECT = "*, sale_vehicles(id,year,make,model,slug,stock_reference,price,status), customers(name,email,phone)";

export async function listSales(staff: StaffContext, filters: { status?: string; q?: string }) {
  const rows = must(await staff.client.from("vehicle_sales").select(SALE_SELECT).order("updated_at", { ascending: false }).limit(500), "Sales could not be loaded.") as unknown as SaleRow[];
  const showNames = staff.can("customers.view");
  const query = (filters.q || "").trim().toLowerCase();
  return (rows || []).map((row): SaleListItem => ({
    id: row.id, status: row.status, agreedPricePence: row.agreed_price_pence, amountPaidPence: row.amount_paid_pence, paymentStatus: row.payment_status, reservedAt: row.reserved_at, reservationExpiresAt: row.reservation_expires_at,
    handoverMethod: row.handover_method, handoverAt: row.handover_at, completedAt: row.completed_at,
    vehicle: row.sale_vehicles ? { id: row.sale_vehicles.id, title: `${row.sale_vehicles.year} ${row.sale_vehicles.make} ${row.sale_vehicles.model}`, slug: row.sale_vehicles.slug, stockReference: row.sale_vehicles.stock_reference } : null,
    customerName: showNames ? row.customers?.name || null : null, partExchange: Boolean(row.part_exchange_submission_id),
  })).filter((item) => {
    if (filters.status === "active" ? !(activeSaleStatuses as string[]).includes(item.status) : filters.status && item.status !== filters.status) return false;
    return !query || [item.vehicle?.title, item.vehicle?.stockReference, item.customerName].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
}

export async function getSale(staff: StaffContext, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const row = must(await staff.client.from("vehicle_sales").select(SALE_SELECT).eq("id", id).maybeSingle(), "The sale could not be loaded.") as unknown as SaleRow | null;
  if (!row) return null;
  const [partExchange, appointments] = await Promise.all([
    row.part_exchange_submission_id ? staff.client.from("seller_submissions").select("id,reference,year,make,model,status").eq("id", row.part_exchange_submission_id).maybeSingle() : Promise.resolve({ data: null }),
    staff.client.from("diary_appointments").select("id,kind,status,title,starts_at").eq("vehicle_sale_id", id).is("deleted_at", null).order("starts_at"),
  ]);
  if (!staff.can("customers.view")) row.customers = null;
  return {
    sale: row,
    partExchange: partExchange.data as { id: string; reference: string; year: number | null; make: string | null; model: string | null; status: string } | null,
    appointments: (appointments.data || []) as Array<{ id: string; kind: string; status: string; title: string; starts_at: string }>,
  };
}

// ---------------------------------------------------------------------------
// Reserve
// ---------------------------------------------------------------------------

export const reserveSchema = z.object({
  agreedPrice: moneyPence("the agreed price"),
  deposit: optionalMoneyPence("the deposit"),
  paymentMethod: optionalText("payment method", 80),
  reservationExpiresAt: optionalDateTime("the reservation expiry"),
  partExchangeSubmissionId: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()).transform((value) => value ?? null),
  partExchangeAllowance: optionalMoneyPence("the part-exchange allowance"),
});

export async function reserveVehicle(staff: StaffContext, input: z.infer<typeof reserveSchema> & { vehicleId: string; enquiryId?: string | null; customerId?: string | null }, now = new Date()) {
  assertCan(staff, "sales.manage");
  const vehicle = mustRow(await staff.client.from("sale_vehicles").select("id,slug,status,price").eq("id", input.vehicleId).is("deleted_at", null).maybeSingle(), "This vehicle no longer exists.");
  if (vehicle.status !== "available") throw new ExchangeUserError("Only an Available vehicle can be reserved. It may already be reserved or sold.");
  // Agreeing a price other than the advertised one is a price decision.
  if (input.agreedPrice !== poundsToPence(vehicle.price) && !staff.can("stock.price")) fieldError("agreedPrice", `Only an owner or manager can agree a price other than the advertised £${vehicle.price.toLocaleString("en-GB")}.`);
  const deposit = input.deposit ?? 0;
  if (deposit > input.agreedPrice) fieldError("deposit", "The deposit cannot be more than the agreed price.");
  if (input.reservationExpiresAt && new Date(input.reservationExpiresAt) <= now) fieldError("reservationExpiresAt", "The reservation must end in the future.");
  if (input.partExchangeAllowance != null && !input.partExchangeSubmissionId) fieldError("partExchangeSubmissionId", "Choose the part-exchange vehicle for this allowance.");
  let customerId = input.customerId ?? null;
  if (input.enquiryId) {
    const enquiry = mustRow(await staff.client.from("enquiries").select("id,customer_id").eq("id", input.enquiryId).maybeSingle(), "The enquiry could not be loaded.");
    customerId = enquiry.customer_id;
  }
  const inserted = await staff.client.from("vehicle_sales").insert({
    sale_vehicle_id: vehicle.id, customer_id: customerId, enquiry_id: input.enquiryId || null, status: "reserved",
    agreed_price_pence: input.agreedPrice, deposit_pence: deposit, amount_paid_pence: deposit, payment_status: deposit > 0 ? "deposit_received" : "not_started",
    payment_method: input.paymentMethod, reservation_expires_at: input.reservationExpiresAt, part_exchange_submission_id: input.partExchangeSubmissionId, part_exchange_allowance_pence: input.partExchangeAllowance, created_by: staff.userId,
  }).select("id").single();
  if (inserted.error?.code === "23505") throw new ExchangeUserError("This vehicle already has an active reservation.");
  const sale = mustRow(inserted, "The reservation could not be saved.");
  if (input.enquiryId) must(await staff.client.from("enquiries").update({ sales_stage: "reserved", status: "booked" }).eq("id", input.enquiryId), "The enquiry stage could not be updated.");
  await auditStaffAction(staff, "reserved", "vehicle_sale", sale.id, { vehicleId: vehicle.id, agreedPricePence: input.agreedPrice, depositPence: deposit, enquiryId: input.enquiryId || undefined });
  await auditStaffAction(staff, "reserved", "sale_vehicle", vehicle.id, { saleId: sale.id, from: "available", to: "reserved" });
  return { saleId: sale.id as string, slug: vehicle.slug as string };
}

// ---------------------------------------------------------------------------
// Update, complete, cancel
// ---------------------------------------------------------------------------

export const saleUpdateSchema = z.object({
  status: z.enum(["reserved", "awaiting_payment", "ready_for_handover"], { error: "Choose a stage." }),
  agreedPrice: moneyPence("the agreed price"),
  deposit: optionalMoneyPence("the deposit"),
  amountPaid: optionalMoneyPence("the amount paid"),
  paymentStatus: z.enum(paymentStatuses, { error: "Choose the payment status." }),
  paymentMethod: optionalText("payment method", 80),
  reservationExpiresAt: optionalDateTime("the reservation expiry"),
  handoverMethod: z.enum(["collection", "delivery", "not_decided"], { error: "Choose collection or delivery." }),
  handoverAt: optionalDateTime("the handover date"),
  handoverNotes: optionalText("handover notes", 2000),
  partExchangeAllowance: optionalMoneyPence("the part-exchange allowance"),
});

async function loadSale(staff: StaffContext, id: string) {
  return mustRow(await staff.client.from("vehicle_sales").select("id,status,agreed_price_pence,amount_paid_pence,payment_status,sale_vehicle_id,enquiry_id,part_exchange_submission_id,sale_vehicles(slug,price)").eq("id", id).maybeSingle(), "This sale no longer exists.") as unknown as { id: string; status: VehicleSaleStatus; agreed_price_pence: number; amount_paid_pence: number; payment_status: string; sale_vehicle_id: string; enquiry_id: string | null; part_exchange_submission_id: string | null; sale_vehicles: { slug: string; price: number } | null };
}

function assertActive(sale: { status: VehicleSaleStatus }) {
  if (!(activeSaleStatuses as string[]).includes(sale.status)) throw new ExchangeUserError(`This sale is ${sale.status === "completed" ? "completed" : "cancelled"} and can no longer be changed.`);
}

export async function updateSale(staff: StaffContext, id: string, input: z.infer<typeof saleUpdateSchema>) {
  assertCan(staff, "sales.manage");
  const sale = await loadSale(staff, id);
  assertActive(sale);
  if (input.agreedPrice !== sale.agreed_price_pence && !staff.can("stock.price")) fieldError("agreedPrice", "Only an owner or manager can change the agreed price.");
  const paid = input.amountPaid ?? 0;
  if (paid > input.agreedPrice) fieldError("amountPaid", "The amount paid cannot be more than the agreed price.");
  if (input.paymentStatus === "paid_in_full" && paid < input.agreedPrice - (input.partExchangeAllowance ?? 0)) fieldError("amountPaid", "Paid in full needs the amount paid (plus any part-exchange allowance) to cover the agreed price.");
  if (input.partExchangeAllowance != null && !sale.part_exchange_submission_id) fieldError("partExchangeAllowance", "Link a part-exchange vehicle before recording an allowance.");
  const rows = must(await staff.client.from("vehicle_sales").update({
    status: input.status, agreed_price_pence: input.agreedPrice, deposit_pence: input.deposit ?? 0, amount_paid_pence: paid, payment_status: input.paymentStatus, payment_method: input.paymentMethod,
    reservation_expires_at: input.reservationExpiresAt, handover_method: input.handoverMethod, handover_at: input.handoverAt, handover_notes: input.handoverNotes, part_exchange_allowance_pence: input.partExchangeAllowance,
  }).eq("id", id).eq("status", sale.status).select("id"), "The sale could not be saved.");
  if (!rows?.length) throw new ExchangeUserError("This sale changed while you were working. Refresh the page and try again.");
  await auditStaffAction(staff, "sale_updated", "vehicle_sale", id, { from: sale.status, to: input.status, paymentStatus: input.paymentStatus, amountPaidPence: paid, ...(input.agreedPrice !== sale.agreed_price_pence ? { previousAgreedPricePence: sale.agreed_price_pence, agreedPricePence: input.agreedPrice } : {}) });
  return { slug: sale.sale_vehicles?.slug };
}

/** Completing records the sale; the database trigger then marks the vehicle Sold. */
export async function completeSale(staff: StaffContext, id: string, now = new Date()) {
  assertCan(staff, "sales.manage");
  const sale = await loadSale(staff, id);
  assertActive(sale);
  if (sale.payment_status !== "paid_in_full") throw new ExchangeUserError("Record the payment as Paid in full before completing the sale.");
  const rows = must(await staff.client.from("vehicle_sales").update({ status: "completed", completed_at: now.toISOString() }).eq("id", id).eq("status", sale.status).select("id"), "The sale could not be completed.");
  if (!rows?.length) throw new ExchangeUserError("This sale changed while you were working. Refresh the page and try again.");
  if (sale.enquiry_id) await staff.client.from("enquiries").update({ sales_stage: "sold", status: "closed", closed_at: now.toISOString() }).eq("id", sale.enquiry_id);
  await auditStaffAction(staff, "sale_completed", "vehicle_sale", id, { vehicleId: sale.sale_vehicle_id });
  await auditStaffAction(staff, "sale_completed", "sale_vehicle", sale.sale_vehicle_id, { saleId: id, from: "reserved", to: "sold" });
  return { slug: sale.sale_vehicles?.slug };
}

export const cancelSchema = z.object({ reason: z.string({ error: "Give a reason." }).trim().min(3, "Give a reason.").max(500), markLost: checkbox() });

/** Cancelling puts the vehicle back on sale through the trigger. */
export async function cancelSale(staff: StaffContext, id: string, input: z.infer<typeof cancelSchema>, now = new Date()) {
  assertCan(staff, "sales.manage");
  const sale = await loadSale(staff, id);
  assertActive(sale);
  const rows = must(await staff.client.from("vehicle_sales").update({ status: "cancelled", cancelled_at: now.toISOString(), cancellation_reason: input.reason }).eq("id", id).eq("status", sale.status).select("id"), "The reservation could not be cancelled.");
  if (!rows?.length) throw new ExchangeUserError("This sale changed while you were working. Refresh the page and try again.");
  if (sale.enquiry_id) await staff.client.from("enquiries").update(input.markLost ? { sales_stage: "lost", status: "closed", closed_at: now.toISOString() } : { sales_stage: "negotiating", status: "contacted" }).eq("id", sale.enquiry_id);
  await auditStaffAction(staff, "sale_cancelled", "vehicle_sale", id, { reason: input.reason });
  await auditStaffAction(staff, "sale_cancelled", "sale_vehicle", sale.sale_vehicle_id, { saleId: id, from: "reserved", to: "available", reason: input.reason });
  return { slug: sale.sale_vehicles?.slug };
}
