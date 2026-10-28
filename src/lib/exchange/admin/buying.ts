import "server-only";

import { z } from "zod";
import { openSubmissionStatuses, submissionStatuses, submissionStatusLabels, type SubmissionStatus } from "@/components/admin/exchange/labels";
import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { normalizeRegistration } from "@/lib/vehicle/registration-format";
import { assertCan, assertStaffMember, ExchangeUserError, fieldError, formText, lines, moneyPence, must, mustRow, optionalDate, optionalText, requiredInt, type StaffClient } from "./core";
import { createStockDraft } from "./stock";
import { visibleDocuments } from "./documents";
import { loadThread, type ThreadMessage } from "./threads";

export type SubmissionListItem = {
  id: string; reference: string; kind: string; status: SubmissionStatus; createdAt: string; updatedAt: string;
  vehicle: string; registration: string | null; mileage: number | null;
  customerName: string | null; assignedTo: string | null; interestedVehicle: { id: string; title: string } | null;
  offerPence: number | null; offerExpiresOn: string | null; enquiryId: string | null; notificationStatus: string | null;
};

type SubmissionRow = {
  id: string; reference: string; kind: string; status: SubmissionStatus; created_at: string; updated_at: string; registration: string | null; make: string | null; model: string | null; derivative: string | null; year: number | null; mileage: number | null;
  assigned_to: string | null; enquiry_id: string | null; provisional_offer_pence: number | null; provisional_offer_expires_on: string | null; final_offer_pence: number | null; final_offer_expires_on: string | null;
  customers: { name: string } | null; interested: { id: string; year: number; make: string; model: string } | null; enquiries: { notification_status: string } | null;
};

const LIST_SELECT = "id,reference,kind,status,created_at,updated_at,registration,make,model,derivative,year,mileage,assigned_to,enquiry_id,provisional_offer_pence,provisional_offer_expires_on,final_offer_pence,final_offer_expires_on,customers(name),interested:sale_vehicles!seller_submissions_interested_vehicle_id_fkey(id,year,make,model),enquiries(notification_status)";

export type SubmissionFilters = { q?: string; status?: string; assigned?: string; kind?: string };

export async function listSubmissions(staff: StaffContext, filters: SubmissionFilters): Promise<SubmissionListItem[]> {
  const result = await staff.client.from("seller_submissions").select(LIST_SELECT).order("created_at", { ascending: false }).limit(500);
  const rows = must(result, "Buying enquiries could not be loaded.") as unknown as SubmissionRow[];
  const showNames = staff.can("customers.view");
  const query = (filters.q || "").trim().toLowerCase();
  return (rows || []).map((row) => toListItem(row, showNames)).filter((item) => {
    if (filters.status === "open" ? !(openSubmissionStatuses as string[]).includes(item.status) : filters.status && item.status !== filters.status) return false;
    if (filters.kind && item.kind !== filters.kind) return false;
    if (filters.assigned === "me" ? item.assignedTo !== staff.userId : filters.assigned === "none" ? item.assignedTo !== null : filters.assigned && item.assignedTo !== filters.assigned) return false;
    if (!query) return true;
    return [item.reference, item.vehicle, item.registration, item.customerName].filter(Boolean).join(" ").toLowerCase().includes(query) || (item.registration && normalizeRegistration(query).length >= 2 && item.registration.includes(normalizeRegistration(query)));
  });
}

function toListItem(row: SubmissionRow, showNames: boolean): SubmissionListItem {
  const finalOffer = row.final_offer_pence != null;
  return {
    id: row.id, reference: row.reference, kind: row.kind, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    vehicle: [row.year, row.make, row.model].filter(Boolean).join(" ") || "Vehicle details not given", registration: row.registration, mileage: row.mileage,
    customerName: showNames ? row.customers?.name || null : null, assignedTo: row.assigned_to,
    interestedVehicle: row.interested ? { id: row.interested.id, title: `${row.interested.year} ${row.interested.make} ${row.interested.model}` } : null,
    offerPence: finalOffer ? row.final_offer_pence : row.provisional_offer_pence, offerExpiresOn: finalOffer ? row.final_offer_expires_on : row.provisional_offer_expires_on,
    enquiryId: row.enquiry_id, notificationStatus: row.enquiries?.notification_status || null,
  };
}

export type SubmissionDetail = {
  submission: Record<string, unknown> & { id: string; reference: string; kind: string; status: SubmissionStatus; enquiry_id: string | null; purchased_vehicle_id: string | null; assigned_to: string | null; purchase_price_pence: number | null };
  customer: { id: string; name: string; email: string | null; phone: string; preferred_contact: string } | null;
  interestedVehicle: { id: string; title: string; status: string; price: number } | null;
  purchasedVehicle: { id: string; title: string; status: string } | null;
  photos: Array<{ id: string; category: string; file_name: string; finalised: boolean }>;
  documents: Array<{ id: string; kind: string; file_name: string; size_bytes: number; created_at: string }>;
  inspections: Array<{ id: string; inspected_on: string; inspector_name: string; scope: string; findings: string; faults: string[]; outcome: string }>;
  appointments: Array<{ id: string; kind: string; status: string; title: string; starts_at: string }>;
  thread: ThreadMessage[];
  offers: Array<OfferRow & { createdByName: string | null; decidedByName: string | null }>;
  linkable: Array<{ id: string; label: string }>;
};

export async function getSubmissionDetail(staff: StaffContext, id: string): Promise<SubmissionDetail | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const client = staff.client;
  const result = await client.from("seller_submissions").select("*").eq("id", id).maybeSingle();
  const submission = must(result, "The buying enquiry could not be loaded.") as SubmissionDetail["submission"] | null;
  if (!submission) return null;
  if (!staff.can("finance.view")) submission.purchase_price_pence = null;
  const [customer, interested, purchased, photos, documents, inspections, appointments, thread, offers, staffNames, linkable] = await Promise.all([
    staff.can("customers.view") ? client.from("customers").select("id,name,email,phone,preferred_contact").eq("id", submission.customer_id as string).maybeSingle() : Promise.resolve({ data: null }),
    submission.interested_vehicle_id ? client.from("sale_vehicles").select("id,year,make,model,status,price").eq("id", submission.interested_vehicle_id as string).maybeSingle() : Promise.resolve({ data: null }),
    submission.purchased_vehicle_id ? client.from("sale_vehicles").select("id,year,make,model,status").eq("id", submission.purchased_vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    client.from("seller_submission_photos").select("id,category,file_name,finalised").eq("submission_id", id).order("created_at"),
    client.from("vehicle_documents").select("id,kind,file_name,size_bytes,created_at").eq("seller_submission_id", id).order("created_at", { ascending: false }),
    client.from("vehicle_inspections").select("id,inspected_on,inspector_name,scope,findings,faults,outcome").eq("seller_submission_id", id).order("inspected_on", { ascending: false }),
    client.from("diary_appointments").select("id,kind,status,title,starts_at").eq("seller_submission_id", id).is("deleted_at", null).order("starts_at"),
    submission.enquiry_id ? loadThread(client, submission.enquiry_id) : Promise.resolve([]),
    client.from("seller_offers").select("id,stage,amount_pence,conditions,expires_on,status,decision_note,decided_at,decided_by,created_by,created_at").eq("submission_id", id).order("created_at", { ascending: false }),
    client.from("admin_profiles").select("user_id,display_name"),
    submission.status === "purchased" && !submission.purchased_vehicle_id ? linkableStock(client) : Promise.resolve([]),
  ]);
  const names = new Map(((staffNames.data || []) as Array<{ user_id: string; display_name: string }>).map((row) => [row.user_id, row.display_name]));
  const vehicleRow = interested.data as { id: string; year: number; make: string; model: string; status: string; price: number } | null;
  const purchasedRow = purchased.data as { id: string; year: number; make: string; model: string; status: string } | null;
  return {
    submission,
    customer: (customer.data as SubmissionDetail["customer"]) || null,
    interestedVehicle: vehicleRow ? { id: vehicleRow.id, title: `${vehicleRow.year} ${vehicleRow.make} ${vehicleRow.model}`, status: vehicleRow.status, price: vehicleRow.price } : null,
    purchasedVehicle: purchasedRow ? { id: purchasedRow.id, title: `${purchasedRow.year} ${purchasedRow.make} ${purchasedRow.model}`, status: purchasedRow.status } : null,
    photos: (photos.data || []) as SubmissionDetail["photos"],
    documents: visibleDocuments(staff, (documents.data || []) as SubmissionDetail["documents"]),
    inspections: (inspections.data || []) as SubmissionDetail["inspections"],
    appointments: (appointments.data || []) as SubmissionDetail["appointments"],
    thread,
    offers: ((offers.data || []) as OfferRow[]).map((offer) => ({ ...offer, createdByName: offer.created_by ? names.get(offer.created_by) || null : null, decidedByName: offer.decided_by ? names.get(offer.decided_by) || null : null })),
    linkable,
  };
}

export async function submissionIdForEnquiry(client: StaffClient, enquiryId: string) {
  if (!z.string().uuid().safeParse(enquiryId).success) return null;
  const { data } = await client.from("seller_submissions").select("id").eq("enquiry_id", enquiryId).maybeSingle();
  return (data?.id as string | undefined) || null;
}

// ---------------------------------------------------------------------------
// Pipeline rules
// ---------------------------------------------------------------------------

const terminal: SubmissionStatus[] = ["purchased", "declined", "closed"];
const stageOrder: SubmissionStatus[] = ["new", "reviewing", "provisional_offer", "inspection", "final_offer", "purchased"];

/** Returns a message when a buying enquiry may not move to `to`, or null. */
export function submissionTransitionProblem(from: SubmissionStatus, to: SubmissionStatus, context: { hasFinalOffer?: boolean; offerAccepted?: boolean } = {}) {
  if (from === to && to !== "provisional_offer" && to !== "final_offer") return `This enquiry is already ${submissionStatusLabels[to]}.`;
  if (terminal.includes(from)) return `This enquiry is ${submissionStatusLabels[from]}. It cannot be changed.`;
  if (to === "new") return "An enquiry cannot go back to New.";
  if (to === "purchased" && !context.hasFinalOffer) return "Record a final offer before marking the vehicle as purchased.";
  if (to === "purchased" && !context.offerAccepted) return "Record that the seller accepted the final offer first.";
  if (to === "provisional_offer" && stageOrder.indexOf(from) > stageOrder.indexOf("inspection")) return "A final offer has already been made.";
  return null;
}

async function loadForChange(staff: StaffContext, id: string) {
  const row = mustRow(await staff.client.from("seller_submissions").select("id,status,reference,enquiry_id,final_offer_pence,offer_accepted_at,purchased_vehicle_id,kind,registration,make,model,derivative,year,mileage,fuel_type,transmission,colour,purchase_price_pence,interested_vehicle_id").eq("id", id).maybeSingle(), "This buying enquiry no longer exists.");
  return row as { id: string; status: SubmissionStatus; reference: string; enquiry_id: string | null; final_offer_pence: number | null; offer_accepted_at: string | null; purchased_vehicle_id: string | null; kind: string; registration: string | null; make: string | null; model: string | null; derivative: string | null; year: number | null; mileage: number | null; fuel_type: string | null; transmission: string | null; colour: string | null; purchase_price_pence: number | null; interested_vehicle_id: string | null };
}

async function update(staff: StaffContext, id: string, from: SubmissionStatus, values: Record<string, unknown>) {
  const rows = must(await staff.client.from("seller_submissions").update(values).eq("id", id).eq("status", from).select("id"), "The buying enquiry could not be updated.");
  if (!rows?.length) throw new ExchangeUserError("This enquiry changed while you were working. Refresh the page and try again.");
}

function check(problem: string | null) {
  if (problem) throw new ExchangeUserError(problem);
}

export async function moveSubmission(staff: StaffContext, id: string, to: "reviewing" | "inspection") {
  assertCan(staff, "buying.manage");
  const current = await loadForChange(staff, id);
  check(submissionTransitionProblem(current.status, to));
  await update(staff, id, current.status, { status: to });
  await auditStaffAction(staff, "status_change", "seller_submission", id, { from: current.status, to });
}

export async function assignSubmission(staff: StaffContext, id: string, assignedTo: string | null) {
  assertCan(staff, "buying.manage");
  await assertStaffMember(staff.client, assignedTo);
  const current = await loadForChange(staff, id);
  must(await staff.client.from("seller_submissions").update({ assigned_to: assignedTo }).eq("id", id), "The assignment could not be saved.");
  if (current.enquiry_id) await staff.client.from("enquiries").update({ assigned_to: assignedTo }).eq("id", current.enquiry_id);
  await auditStaffAction(staff, "assigned", "seller_submission", id, { assignedTo });
}

export const offerStages = ["provisional", "revised", "final"] as const;
export type OfferStage = (typeof offerStages)[number];
export type OfferStatus = "open" | "accepted" | "declined" | "withdrawn" | "expired" | "superseded";
export type OfferRow = { id: string; stage: OfferStage; amount_pence: number; conditions: string | null; expires_on: string | null; status: OfferStatus; decision_note: string | null; decided_at: string | null; decided_by: string | null; created_by: string | null; created_at: string };

export const offerSchema = z.object({ amount: moneyPence("the offer"), expiresOn: optionalDate("the expiry date"), conditions: optionalText("conditions", 2000) });

/** An open offer whose expiry date has passed is shown (and treated) as expired. */
export function effectiveOfferStatus(offer: Pick<OfferRow, "status" | "expires_on">, today = new Date().toISOString().slice(0, 10)): OfferStatus {
  return offer.status === "open" && offer.expires_on && offer.expires_on < today ? "expired" : offer.status;
}

/**
 * Records a provisional, revised or final offer as a new history row. Any
 * open offer is superseded first (one open offer per submission is enforced
 * by a unique index). The summary columns on seller_submissions are kept in
 * step for list views; seller_offers is the record.
 */
export async function recordOffer(staff: StaffContext, id: string, stage: OfferStage, input: z.infer<typeof offerSchema>, now = new Date()) {
  assertCan(staff, "buying.manage");
  if (input.amount <= 0) fieldError("amount", "Enter an offer above £0.");
  if (input.expiresOn && input.expiresOn < now.toISOString().slice(0, 10)) fieldError("expiresOn", "The expiry date cannot be in the past.");
  const current = await loadForChange(staff, id);
  const finalLike = stage !== "provisional";
  check(submissionTransitionProblem(current.status, finalLike ? "final_offer" : "provisional_offer"));
  const nowIso = now.toISOString();
  must(await staff.client.from("seller_offers").update({ status: "superseded", decided_at: nowIso, decided_by: staff.userId }).eq("submission_id", id).eq("status", "open"), "The previous offer could not be superseded.");
  const inserted = await staff.client.from("seller_offers").insert({ submission_id: id, stage, amount_pence: input.amount, conditions: input.conditions, expires_on: input.expiresOn, status: "open", created_by: staff.userId }).select("id").single();
  if (inserted.error?.code === "23505") throw new ExchangeUserError("Another offer was recorded at the same time. Refresh the page and try again.");
  const offer = mustRow(inserted, "The offer could not be saved.");
  const to: SubmissionStatus = finalLike ? "final_offer" : current.status === "inspection" ? "inspection" : "provisional_offer";
  const summary = finalLike
    ? { status: to, final_offer_pence: input.amount, final_offer_expires_on: input.expiresOn, offer_accepted_at: null }
    : { status: to, provisional_offer_pence: input.amount, provisional_offer_expires_on: input.expiresOn, offer_accepted_at: null };
  await update(staff, id, current.status, summary);
  await auditStaffAction(staff, `${stage}_offer`, "seller_submission", id, { offerId: offer.id, from: current.status, amountPence: input.amount, expiresOn: input.expiresOn });
  return offer.id as string;
}

export const offerDecisionSchema = z.object({ decision: z.enum(["accepted", "declined", "withdrawn", "expired"], { error: "Choose a decision." }), note: optionalText("note", 1000) });

/** Records the seller's answer (or our withdrawal) on the open offer. */
export async function decideOffer(staff: StaffContext, id: string, offerId: string, input: z.infer<typeof offerDecisionSchema>, now = new Date()) {
  assertCan(staff, "buying.manage");
  const current = await loadForChange(staff, id);
  if (terminal.includes(current.status)) throw new ExchangeUserError(`This enquiry is ${submissionStatusLabels[current.status]}. It cannot be changed.`);
  const offer = mustRow(await staff.client.from("seller_offers").select("id,stage,status,amount_pence,expires_on").eq("id", offerId).eq("submission_id", id).maybeSingle(), "That offer no longer exists.") as Pick<OfferRow, "id" | "stage" | "status" | "amount_pence" | "expires_on">;
  if (offer.status !== "open") throw new ExchangeUserError("Only the open offer can be decided.");
  if (input.decision === "accepted" && offer.stage === "provisional") throw new ExchangeUserError("A provisional offer is subject to inspection. Record a final offer for the seller to accept.");
  if (input.decision === "accepted" && effectiveOfferStatus(offer, now.toISOString().slice(0, 10)) === "expired") throw new ExchangeUserError("This offer has expired. Record a revised offer instead.");
  const rows = must(await staff.client.from("seller_offers").update({ status: input.decision, decision_note: input.note, decided_at: now.toISOString(), decided_by: staff.userId }).eq("id", offerId).eq("status", "open").select("id"), "The decision could not be saved.");
  if (!rows?.length) throw new ExchangeUserError("This offer changed while you were working. Refresh the page and try again.");
  if (input.decision === "accepted") await update(staff, id, current.status, { offer_accepted_at: now.toISOString(), final_offer_pence: offer.amount_pence, final_offer_expires_on: offer.expires_on });
  await auditStaffAction(staff, `offer_${input.decision}`, "seller_submission", id, { offerId, amountPence: offer.amount_pence, note: input.note || undefined });
}

export const inspectionSchema = z.object({
  inspectedOn: z.string({ error: "Enter the inspection date." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the inspection date."),
  inspectorName: formText("the inspector's name", 100),
  scope: formText("what was checked", 2000),
  findings: formText("the findings", 6000),
  faults: lines("fault", 30, 300),
  outcome: z.enum(["recorded", "satisfactory", "advisories", "not_satisfactory"], { error: "Choose an outcome." }),
});

export async function recordPurchaseInspection(staff: StaffContext, id: string, input: z.infer<typeof inspectionSchema>) {
  assertCan(staff, "buying.manage");
  const current = await loadForChange(staff, id);
  if (terminal.includes(current.status)) throw new ExchangeUserError(`This enquiry is ${submissionStatusLabels[current.status]}. It cannot be changed.`);
  const inserted = mustRow(await staff.client.from("vehicle_inspections").insert({ seller_submission_id: id, kind: "purchase", inspected_on: input.inspectedOn, inspector_name: input.inspectorName, scope: input.scope, findings: input.findings, faults: input.faults, outcome: input.outcome, created_by: staff.userId }).select("id").single(), "The inspection could not be saved.");
  if (["new", "reviewing", "provisional_offer"].includes(current.status)) await update(staff, id, current.status, { status: "inspection" });
  await auditStaffAction(staff, "inspection_recorded", "seller_submission", id, { inspectionId: inserted.id, outcome: input.outcome });
}

export const purchaseSchema = z.object({ purchasePrice: moneyPence("the purchase price") });

/** Recording what we paid is a finance action (owner or manager). */
export async function markPurchased(staff: StaffContext, id: string, input: z.infer<typeof purchaseSchema>) {
  assertCan(staff, "buying.manage", "finance.edit");
  const current = await loadForChange(staff, id);
  const { data: accepted } = await staff.client.from("seller_offers").select("id").eq("submission_id", id).eq("status", "accepted").limit(1);
  check(submissionTransitionProblem(current.status, "purchased", { hasFinalOffer: current.final_offer_pence != null, offerAccepted: Boolean(current.offer_accepted_at && accepted?.length) }));
  await update(staff, id, current.status, { status: "purchased", purchase_price_pence: input.purchasePrice });
  await auditStaffAction(staff, "purchased", "seller_submission", id, { purchasePricePence: input.purchasePrice });
}

export const declineSchema = z.object({ reason: formText("a reason", 1000) });

export async function closeSubmission(staff: StaffContext, id: string, outcome: "declined" | "closed", reason: string | null) {
  assertCan(staff, "buying.manage");
  const current = await loadForChange(staff, id);
  if (terminal.includes(current.status)) throw new ExchangeUserError(`This enquiry is already ${submissionStatusLabels[current.status]}.`);
  const closedAt = new Date().toISOString();
  await update(staff, id, current.status, { status: outcome, decline_reason: outcome === "declined" ? reason : null, closed_at: closedAt });
  // Close the email thread too, so the documented retention period starts.
  if (current.enquiry_id) must(await staff.client.from("enquiries").update({ status: "closed", closed_at: closedAt }).eq("id", current.enquiry_id).neq("status", "closed"), "The enquiry thread could not be closed.");
  await auditStaffAction(staff, outcome, "seller_submission", id, { from: current.status });
}

export const stockFromPurchaseSchema = z.object({
  make: formText("the make", 60),
  model: formText("the model", 80),
  derivative: optionalText("derivative", 120),
  year: requiredInt("the year", 1885, 2100),
  mileage: requiredInt("the mileage", 0, 2_000_000),
  fuelType: formText("the fuel type", 40),
  transmission: formText("the transmission", 40),
  colour: optionalText("colour", 40),
});

/**
 * Turns a purchased vehicle into stock: a Draft listing, its private
 * acquisition record and the purchase cost line, then links them.
 */
/** Private acquisition record and purchase cost for a vehicle bought from a seller. */
async function recordAcquisition(staff: StaffContext, vehicleId: string, submission: { id: string; kind: string; reference: string; purchase_price_pence: number | null }, now: Date) {
  const day = now.toISOString().slice(0, 10);
  must(await staff.client.from("vehicle_internal_records").upsert({ sale_vehicle_id: vehicleId, acquired_on: day, acquisition_source: submission.kind === "part_exchange" ? "part_exchange" : "customer_purchase", seller_submission_id: submission.id, updated_by: staff.userId }), "The acquisition record could not be saved.");
  must(await staff.client.from("vehicle_costs").insert({ sale_vehicle_id: vehicleId, category: "purchase", description: `Purchase from seller (${submission.reference})`, amount_pence: submission.purchase_price_pence, basis: "actual", incurred_on: day, created_by: staff.userId }), "The purchase cost could not be saved.");
}

function assertReadyForStock(current: Awaited<ReturnType<typeof loadForChange>>) {
  if (current.status !== "purchased") throw new ExchangeUserError("Mark the vehicle as purchased first.");
  if (current.purchased_vehicle_id) throw new ExchangeUserError("A stock record is already linked to this purchase.");
  if (current.purchase_price_pence == null) throw new ExchangeUserError("Record the purchase price first.");
}

/**
 * Turns a purchased vehicle into stock: a Draft listing with vehicle facts
 * only (never the seller's contact details, offers, photos or documents),
 * plus the private acquisition record and purchase cost. The unique
 * sale_vehicles.purchased_from_submission_id stops duplicates.
 */
export async function createStockFromPurchase(staff: StaffContext, id: string, input: z.infer<typeof stockFromPurchaseSchema>, now = new Date()) {
  assertCan(staff, "stock.edit", "finance.edit");
  const current = await loadForChange(staff, id);
  assertReadyForStock(current);
  const created = await createStockDraft(staff, { ...input, registration: current.registration, price: 0, engineSize: null, bodyType: null, description: "", features: [] }, { source: "seller_submission", purchasedFromSubmissionId: id });
  try {
    await recordAcquisition(staff, created.id, current, now);
    const linked = must(await staff.client.from("seller_submissions").update({ purchased_vehicle_id: created.id }).eq("id", id).is("purchased_vehicle_id", null).select("id"), "The stock record could not be linked.");
    if (!linked?.length) throw new ExchangeUserError("A stock record was linked by someone else at the same time.");
  } catch (error) {
    // Undo the half-made draft so a retry starts clean.
    await staff.client.from("sale_vehicles").delete().eq("id", created.id).eq("status", "draft");
    throw error;
  }
  await auditStaffAction(staff, "created_from_purchase", "sale_vehicle", created.id, { submissionId: id, reference: current.reference });
  await auditStaffAction(staff, "stock_created", "seller_submission", id, { vehicleId: created.id });
  return created;
}

/** Links a purchase to a stock record that already exists (for example one added by registration). */
export async function linkExistingStock(staff: StaffContext, id: string, vehicleId: string, now = new Date()) {
  assertCan(staff, "stock.edit", "finance.edit");
  const current = await loadForChange(staff, id);
  assertReadyForStock(current);
  const vehicle = mustRow(await staff.client.from("sale_vehicles").select("id,status,purchased_from_submission_id").eq("id", vehicleId).is("deleted_at", null).maybeSingle(), "That stock record no longer exists.");
  if (vehicle.purchased_from_submission_id) throw new ExchangeUserError("That stock record is already linked to another purchase.");
  const result = await staff.client.from("sale_vehicles").update({ purchased_from_submission_id: id }).eq("id", vehicleId).is("purchased_from_submission_id", null).select("id");
  if (result.error?.code === "23505") throw new ExchangeUserError("A stock record is already linked to this purchase.");
  if (!must(result, "The stock record could not be linked.")?.length) throw new ExchangeUserError("That stock record changed while you were working. Refresh and try again.");
  try {
    await recordAcquisition(staff, vehicleId, current, now);
    const linked = must(await staff.client.from("seller_submissions").update({ purchased_vehicle_id: vehicleId }).eq("id", id).is("purchased_vehicle_id", null).select("id"), "The stock record could not be linked.");
    if (!linked?.length) throw new ExchangeUserError("A stock record was linked by someone else at the same time.");
  } catch (error) {
    await staff.client.from("sale_vehicles").update({ purchased_from_submission_id: null }).eq("id", vehicleId).eq("purchased_from_submission_id", id);
    throw error;
  }
  await auditStaffAction(staff, "linked_to_purchase", "sale_vehicle", vehicleId, { submissionId: id, reference: current.reference });
  await auditStaffAction(staff, "stock_linked", "seller_submission", id, { vehicleId });
}

/** Unlinked stock that a purchase could be attached to. */
export async function linkableStock(client: StaffClient) {
  const { data, error } = await client.from("sale_vehicles").select("id,year,make,model,stock_reference,status").is("deleted_at", null).is("purchased_from_submission_id", null).in("status", ["draft", "preparation"]).order("created_at", { ascending: false }).limit(50);
  if (error) return [];
  return (data || []).map((row) => ({ id: row.id as string, label: `${row.stock_reference} · ${row.year} ${row.make} ${row.model} (${row.status})` }));
}

export const submissionStatusOptions = submissionStatuses.map((value) => ({ value, label: submissionStatusLabels[value] }));
