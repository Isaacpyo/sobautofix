import "server-only";

import { z } from "zod";
import { activeSaleStatuses, costCategories, stockStatusLabels, acquisitionSources } from "@/components/admin/exchange/labels";
import { getExchangePrivateSettings } from "@/lib/exchange/settings";
import { daysInStock, summariseMargin, type CostLine, type MarginSummary } from "@/lib/exchange/margin";
import { getPublishReadiness, publicStatuses, type PublishReadiness } from "@/lib/exchange/readiness";
import { isMissingSchemaError } from "@/lib/exchange/schema";
import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { mapVehicle, type SaleVehicleRow } from "@/lib/sales/repository";
import { normalizeRegistration } from "@/lib/vehicle/registration-format";
import type { SaleVehicle, SaleVehicleStatus } from "@/types/domain";
import {
  assertCan,
  checkbox,
  ExchangeUserError,
  fieldError,
  formText,
  guardCopy,
  lines,
  moneyPence,
  must,
  mustRow,
  optionalDate,
  optionalInt,
  optionalText,
  requiredInt,
  type StaffClient,
} from "./core";
import { visibleDocuments } from "./documents";
import { statusChangeColumns, statusChangeProblem } from "./stock-rules";

const STOCK_SELECT = "*, sale_vehicle_images(*)";
export const STOCK_CONFLICT_MESSAGE = "This vehicle was changed by someone else. Reload to see the latest.";

/** Compare-and-set on updated_at: the update only applies if nobody saved since the form was loaded. */
async function updateIfUnchanged(staff: StaffContext, vehicleId: string, expectedUpdatedAt: string | null | undefined, values: Record<string, unknown>, message: string) {
  let query = staff.client.from("sale_vehicles").update(values).eq("id", vehicleId);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const rows = must(await query.select("id"), message);
  if (!rows?.length) throw new ExchangeUserError(STOCK_CONFLICT_MESSAGE);
}
export const saleStatusSchema = z.enum(["draft", "preparation", "available", "reserved", "sold", "archived"]);

export type StockListItem = {
  vehicle: SaleVehicle;
  daysInStock: number;
  readiness: PublishReadiness;
  hasActiveSale: boolean;
};

export type StockFilters = { q?: string; status?: string; sort?: string };

export const stockSorts = [
  { value: "updated", label: "Recently updated" },
  { value: "listed", label: "Newest listed" },
  { value: "days", label: "Longest in stock" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "make", label: "Make and model" },
] as const;

export async function minimumPublishPhotos() {
  return (await getExchangePrivateSettings()).minimumPublishPhotos;
}

export async function listStock(client: StaffClient, filters: StockFilters, now = new Date()): Promise<StockListItem[]> {
  const [vehiclesResult, internalResult, salesResult, minimumPhotos] = await Promise.all([
    client.from("sale_vehicles").select(STOCK_SELECT).is("deleted_at", null).order("updated_at", { ascending: false }).limit(500),
    client.from("vehicle_internal_records").select("sale_vehicle_id,acquired_on"),
    client.from("vehicle_sales").select("sale_vehicle_id,status").in("status", activeSaleStatuses),
    minimumPublishPhotos(),
  ]);
  must(vehiclesResult, "Vehicle stock could not be loaded.");
  const acquired = new Map(((internalResult.data || []) as Array<{ sale_vehicle_id: string; acquired_on: string | null }>).map((row) => [row.sale_vehicle_id, row.acquired_on]));
  const active = new Set(((salesResult.data || []) as Array<{ sale_vehicle_id: string }>).map((row) => row.sale_vehicle_id));
  const query = (filters.q || "").trim().toLowerCase();
  const items = ((vehiclesResult.data || []) as SaleVehicleRow[]).map(mapVehicle).filter((vehicle) => {
    if (filters.status && vehicle.status !== filters.status) return false;
    if (!query) return true;
    const searchable = [vehicle.make, vehicle.model, vehicle.derivative, vehicle.registration, vehicle.stockReference, vehicle.slug, vehicle.year, vehicle.colour].filter(Boolean).join(" ").toLowerCase();
    return searchable.includes(query) || (vehicle.registration && normalizeRegistration(query).length >= 2 && vehicle.registration.includes(normalizeRegistration(query)));
  }).map((vehicle) => ({
    vehicle,
    daysInStock: daysInStock({ acquiredOn: acquired.get(vehicle.id), listedAt: vehicle.listedAt, createdAt: vehicle.createdAt, soldAt: vehicle.soldAt }, now),
    readiness: getPublishReadiness(vehicle, { minimumPhotos }),
    hasActiveSale: active.has(vehicle.id),
  }));
  return sortStock(items, filters.sort);
}

export function sortStock(items: StockListItem[], sort = "updated") {
  const sorted = [...items];
  switch (sort) {
    case "listed": return sorted.sort((a, b) => (b.vehicle.listedAt || "").localeCompare(a.vehicle.listedAt || ""));
    case "days": return sorted.sort((a, b) => b.daysInStock - a.daysInStock);
    case "price_desc": return sorted.sort((a, b) => b.vehicle.price - a.vehicle.price);
    case "price_asc": return sorted.sort((a, b) => a.vehicle.price - b.vehicle.price);
    case "make": return sorted.sort((a, b) => `${a.vehicle.make} ${a.vehicle.model}`.localeCompare(`${b.vehicle.make} ${b.vehicle.model}`));
    default: return sorted.sort((a, b) => b.vehicle.updatedAt.localeCompare(a.vehicle.updatedAt));
  }
}

export async function loadStockVehicle(client: StaffClient, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const result = await client.from("sale_vehicles").select(STOCK_SELECT).eq("id", id).is("deleted_at", null).maybeSingle();
  must(result, "The vehicle could not be loaded.");
  return result.data ? { vehicle: mapVehicle(result.data as SaleVehicleRow), raw: result.data as SaleVehicleRow & { deleted_at?: string | null } } : null;
}

export type CostRow = { id: string; category: CostLine["category"]; description: string; amount_pence: number; basis: CostLine["basis"]; incurred_on: string | null; created_at: string };
export type InternalRecord = { acquired_on: string | null; acquisition_source: string | null; seller_submission_id: string | null; internal_notes: string | null; updated_at: string };
export type DocumentRow = { id: string; kind: string; file_name: string; content_type: string; size_bytes: number; created_at: string; uploaded_by: string | null };
export type SaleRow = { id: string; status: string; agreed_price_pence: number; deposit_pence: number; amount_paid_pence: number; payment_status: string; reserved_at: string; reservation_expires_at: string | null; handover_method: string; handover_at: string | null; completed_at: string | null; customer_id: string | null; enquiry_id: string | null };
export type InspectionRow = { id: string; kind: string; inspected_on: string; inspector_name: string; scope: string; findings: string; faults: string[]; outcome: string; created_at: string };
export type PrepItemRow = { id: string; sale_vehicle_id: string; title: string; category: string; status: string; notes: string | null; due_on: string | null; assigned_to: string | null; position: number; completed_at: string | null };
export type HistoryEntry = { id: number; action: string; actorName: string; createdAt: string; detail: Record<string, unknown> };

export type StockDetail = {
  vehicle: SaleVehicle;
  readiness: PublishReadiness;
  minimumPhotos: number;
  daysInStock: number;
  internal: InternalRecord | null;
  costs: CostRow[];
  margin: MarginSummary | null;
  documents: DocumentRow[];
  inspections: InspectionRow[];
  prepItems: PrepItemRow[];
  sales: SaleRow[];
  enquiryCount: number;
  history: HistoryEntry[];
  schemaReady: boolean;
};

/** Everything the stock editor shows. Private sections are loaded only for roles that may see them. */
export async function getStockDetail(staff: StaffContext, id: string, now = new Date()): Promise<StockDetail | null> {
  const loaded = await loadStockVehicle(staff.client, id);
  if (!loaded) return null;
  const { vehicle } = loaded;
  const client = staff.client;
  const finance = staff.can("finance.view");
  const [minimumPhotos, internalResult, costsResult, documentsResult, inspectionsResult, prepResult, salesResult, enquiriesResult, history] = await Promise.all([
    minimumPublishPhotos(),
    finance ? client.from("vehicle_internal_records").select("acquired_on,acquisition_source,seller_submission_id,internal_notes,updated_at").eq("sale_vehicle_id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    finance ? client.from("vehicle_costs").select("id,category,description,amount_pence,basis,incurred_on,created_at").eq("sale_vehicle_id", id).order("created_at") : Promise.resolve({ data: [], error: null }),
    client.from("vehicle_documents").select("id,kind,file_name,content_type,size_bytes,created_at,uploaded_by").eq("sale_vehicle_id", id).order("created_at", { ascending: false }),
    client.from("vehicle_inspections").select("id,kind,inspected_on,inspector_name,scope,findings,faults,outcome,created_at").eq("sale_vehicle_id", id).order("inspected_on", { ascending: false }),
    client.from("vehicle_prep_items").select("id,sale_vehicle_id,title,category,status,notes,due_on,assigned_to,position,completed_at").eq("sale_vehicle_id", id).order("position"),
    client.from("vehicle_sales").select("id,status,agreed_price_pence,deposit_pence,amount_paid_pence,payment_status,reserved_at,reservation_expires_at,handover_method,handover_at,completed_at,customer_id,enquiry_id").eq("sale_vehicle_id", id).order("created_at", { ascending: false }),
    client.from("enquiries").select("id", { count: "exact", head: true }).eq("sale_vehicle_id", id).is("deleted_at", null),
    loadVehicleHistory(client, id),
  ]);
  const schemaReady = ![documentsResult, salesResult, prepResult].some((result) => isMissingSchemaError(result.error));
  const internal = (internalResult.data as InternalRecord | null) || null;
  const costs = (costsResult.data || []) as CostRow[];
  const sales = (salesResult.data || []) as SaleRow[];
  const liveSale = sales.find((sale) => sale.status !== "cancelled");
  return {
    vehicle,
    readiness: getPublishReadiness(vehicle, { minimumPhotos }),
    minimumPhotos,
    daysInStock: daysInStock({ acquiredOn: internal?.acquired_on, listedAt: vehicle.listedAt, createdAt: vehicle.createdAt, soldAt: vehicle.soldAt }, now),
    internal,
    costs,
    margin: finance ? summariseMargin({ costs: costs.map((cost) => ({ category: cost.category, amountPence: cost.amount_pence, basis: cost.basis })), advertisedPricePounds: vehicle.price, sale: liveSale ? { agreedPricePence: liveSale.agreed_price_pence, completed: liveSale.status === "completed" } : null }) : null,
    documents: visibleDocuments(staff, (documentsResult.data || []) as DocumentRow[]),
    inspections: (inspectionsResult.data || []) as InspectionRow[],
    prepItems: (prepResult.data || []) as PrepItemRow[],
    sales,
    enquiryCount: enquiriesResult.count || 0,
    history,
    schemaReady,
  };
}

export async function loadVehicleHistory(client: StaffClient, vehicleId: string): Promise<HistoryEntry[]> {
  const [logResult, staffResult] = await Promise.all([
    client.from("admin_audit_log").select("id,actor_id,action,entity_type,entity_id,detail,created_at").or(`and(entity_type.eq.sale_vehicle,entity_id.eq.${vehicleId}),detail->>vehicleId.eq.${vehicleId}`).order("created_at", { ascending: false }).limit(100),
    client.from("admin_profiles").select("user_id,display_name"),
  ]);
  const names = new Map(((staffResult.data || []) as Array<{ user_id: string; display_name: string }>).map((row) => [row.user_id, row.display_name]));
  return ((logResult.data || []) as Array<{ id: number; actor_id: string | null; action: string; detail: Record<string, unknown> | null; created_at: string }>).map((row) => ({
    id: row.id,
    action: row.action,
    actorName: (typeof row.detail?.actorName === "string" && row.detail.actorName) || (row.actor_id && names.get(row.actor_id)) || "System",
    createdAt: row.created_at,
    detail: row.detail || {},
  }));
}

async function activeSaleState(client: StaffClient, vehicleId: string) {
  const { data, error } = await client.from("vehicle_sales").select("status").eq("sale_vehicle_id", vehicleId).neq("status", "cancelled");
  if (error) return { hasActiveSale: false, hasCompletedSale: false };
  const statuses = (data || []).map((row) => row.status as string);
  return { hasActiveSale: statuses.some((status) => (activeSaleStatuses as string[]).includes(status)), hasCompletedSale: statuses.includes("completed") };
}

// ---------------------------------------------------------------------------
// Status: the single service function for every stock status change.
// ---------------------------------------------------------------------------

export async function changeStockStatus(staff: StaffContext, vehicleId: string, to: SaleVehicleStatus, options: { reason?: string | null; source?: string; expectedUpdatedAt?: string | null } = {}) {
  const loaded = await loadStockVehicle(staff.client, vehicleId);
  if (!loaded) throw new ExchangeUserError("This vehicle no longer exists.");
  const { vehicle } = loaded;
  const [saleState, minimumPhotos] = await Promise.all([activeSaleState(staff.client, vehicleId), minimumPublishPhotos()]);
  const readiness = getPublishReadiness(vehicle, { minimumPhotos });
  const problem = statusChangeProblem({ from: vehicle.status, to, can: staff.can, readiness, ...saleState });
  if (problem) throw new ExchangeUserError(problem);
  const columns = statusChangeColumns(vehicle.status, to, { listedAt: vehicle.listedAt, soldAt: vehicle.soldAt });
  if (options.expectedUpdatedAt && options.expectedUpdatedAt !== vehicle.updatedAt) throw new ExchangeUserError(STOCK_CONFLICT_MESSAGE);
  let query = staff.client.from("sale_vehicles").update(columns).eq("id", vehicleId).eq("status", vehicle.status);
  if (options.expectedUpdatedAt) query = query.eq("updated_at", options.expectedUpdatedAt);
  const rows = must(await query.select("id"), "The status could not be changed.");
  if (!rows?.length) throw new ExchangeUserError(STOCK_CONFLICT_MESSAGE);
  await auditStaffAction(staff, to === "available" && !vehicle.listedAt ? "publish" : to === "sold" ? "mark_sold" : "status_change", "sale_vehicle", vehicleId, { from: vehicle.status, to, slug: vehicle.slug, reason: options.reason || undefined, source: options.source });
  return { slug: vehicle.slug, from: vehicle.status, to, label: stockStatusLabels[to] };
}

// ---------------------------------------------------------------------------
// Listing (specs, price, description, features, finance and warranty text)
// ---------------------------------------------------------------------------

export const listingSchema = z.object({
  registration: optionalText("registration", 9),
  make: formText("the make", 60),
  model: formText("the model", 80),
  derivative: optionalText("derivative", 120),
  year: requiredInt("the year", 1885, 2100),
  mileage: requiredInt("the mileage", 0, 2_000_000),
  price: requiredInt("the advertised price", 0, 10_000_000),
  fuelType: formText("the fuel type", 40),
  transmission: formText("the transmission", 40),
  engineSize: optionalText("engine size", 40),
  colour: optionalText("colour", 40),
  bodyType: optionalText("body type", 40),
  doors: optionalInt("doors", 0, 9),
  seats: optionalInt("seats", 0, 99),
  description: z.string().trim().max(6000, "The description must be 6,000 characters or fewer.").default(""),
  features: lines("feature", 80, 80),
  financeAvailable: checkbox(),
  warrantyAvailable: checkbox(),
  warrantyDescription: optionalText("warranty wording", 1000),
});

export async function saveListing(staff: StaffContext, vehicleId: string, input: z.infer<typeof listingSchema>, expectedUpdatedAt?: string | null) {
  assertCan(staff, "stock.edit");
  const loaded = await loadStockVehicle(staff.client, vehicleId);
  if (!loaded) throw new ExchangeUserError("This vehicle no longer exists.");
  const current = loaded.vehicle;
  if (input.price !== current.price && !staff.can("stock.price")) fieldError("price", "Only an owner or manager can change the advertised price.");
  guardCopy({ description: input.description, features: input.features, warrantyDescription: input.warrantyDescription, derivative: input.derivative });
  const registration = input.registration ? normalizeRegistration(input.registration) : null;
  if (registration !== null && (registration.length < 2 || registration.length > 8)) fieldError("registration", "Check the registration number.");
  if (registration && registration !== current.registration) {
    const { data: duplicate } = await staff.client.from("sale_vehicles").select("id").eq("registration", registration).neq("id", vehicleId).maybeSingle();
    if (duplicate) fieldError("registration", "Another stock record already uses this registration.");
  }
  const next = { ...current, make: input.make, model: input.model, year: input.year, mileage: input.mileage, price: input.price, fuelType: input.fuelType, transmission: input.transmission, description: input.description };
  await assertStillPublishable(current, next);
  const row = {
    registration, make: input.make, model: input.model, derivative: input.derivative, year: input.year, mileage: input.mileage, price: input.price,
    fuel_type: input.fuelType, transmission: input.transmission, engine_size: input.engineSize, colour: input.colour, body_type: input.bodyType,
    doors: input.doors, seats: input.seats, description: input.description, features: input.features, finance_available: input.financeAvailable,
    warranty: input.warrantyAvailable ? { available: true, description: input.warrantyDescription || undefined } : { available: false },
  };
  await updateIfUnchanged(staff, vehicleId, expectedUpdatedAt, row, "The listing could not be saved.");
  const changed = Object.keys(row).filter((key) => key !== "registration" && JSON.stringify((loaded.raw as Record<string, unknown>)[key] ?? null) !== JSON.stringify((row as Record<string, unknown>)[key] ?? null));
  await auditStaffAction(staff, input.price !== current.price ? "price_change" : "update_listing", "sale_vehicle", vehicleId, { slug: current.slug, changed, ...(input.price !== current.price ? { previousPrice: current.price, price: input.price } : {}) });
  return { slug: current.slug };
}

/** A live listing must keep passing the publishing checklist; otherwise withdraw it first. */
async function assertStillPublishable(current: SaleVehicle, next: SaleVehicle) {
  if (!publicStatuses.includes(current.status)) return;
  const readiness = getPublishReadiness(next, { minimumPhotos: await minimumPublishPhotos() });
  if (!readiness.ready) throw new ExchangeUserError(`This vehicle is live, so it must keep meeting the publishing checklist. Missing: ${readiness.missing.join("; ")}. Move it back to Preparation first if it needs more work.`);
}

// ---------------------------------------------------------------------------
// Condition & disclosure (all public: shown on the listing)
// ---------------------------------------------------------------------------

export const conditionSchema = z.object({
  listingCondition: z.enum(["ready_to_drive", "repair_project"], { error: "Choose the listing condition." }),
  writeOffStatus: z.enum(["not_confirmed", "none_recorded", "cat_s", "cat_n", "cat_c", "cat_d", "other_recorded"], { error: "Choose the write-off status." }),
  conditionSummary: optionalText("condition summary", 2000),
  knownFaults: lines("known fault", 30, 300),
  workCompleted: lines("work completed", 30, 300),
  inspectionDate: optionalDate("the inspection date"),
  inspectionScope: optionalText("inspection scope", 2000),
  inspectionFindings: optionalText("inspection findings", 4000),
  motExpiry: optionalDate("the MOT expiry"),
  motNotes: optionalText("MOT notes", 2000),
  serviceHistory: z.enum(["not_confirmed", "full", "partial", "none"], { error: "Choose the service history." }),
  serviceHistoryNotes: optionalText("service history notes", 2000),
  previousOwners: optionalInt("previous owners", 0, 50),
  keysCount: optionalInt("keys", 0, 10),
  historyCheckSummary: optionalText("history check summary", 2000),
  historyCheckedOn: optionalDate("the history check date"),
  videoUrl: optionalText("video link", 500).refine((value) => !value || /^https:\/\/[^\s]+$/.test(value), "Use a full https:// link."),
  collectionDelivery: optionalText("collection and delivery", 2000),
  afterSales: optionalText("after-sales", 2000),
});

export async function saveCondition(staff: StaffContext, vehicleId: string, input: z.infer<typeof conditionSchema>, expectedUpdatedAt?: string | null) {
  assertCan(staff, "stock.edit");
  const loaded = await loadStockVehicle(staff.client, vehicleId);
  if (!loaded) throw new ExchangeUserError("This vehicle no longer exists.");
  if (input.listingCondition === "repair_project" && !input.knownFaults.length) fieldError("knownFaults", "List the known faults for a repair project.");
  guardCopy({ conditionSummary: input.conditionSummary, knownFaults: input.knownFaults, workCompleted: input.workCompleted, inspectionScope: input.inspectionScope, inspectionFindings: input.inspectionFindings, motNotes: input.motNotes, serviceHistoryNotes: input.serviceHistoryNotes, historyCheckSummary: input.historyCheckSummary, collectionDelivery: input.collectionDelivery, afterSales: input.afterSales });
  const next: SaleVehicle = { ...loaded.vehicle, listingCondition: input.listingCondition, writeOffStatus: input.writeOffStatus, conditionSummary: input.conditionSummary || undefined, knownFaults: input.knownFaults };
  await assertStillPublishable(loaded.vehicle, next);
  const row = {
    listing_condition: input.listingCondition, write_off_status: input.writeOffStatus, condition_summary: input.conditionSummary, known_faults: input.knownFaults, work_completed: input.workCompleted,
    inspection_date: input.inspectionDate, inspection_scope: input.inspectionScope, inspection_findings: input.inspectionFindings, mot_expiry: input.motExpiry, mot_notes: input.motNotes,
    service_history: input.serviceHistory, service_history_notes: input.serviceHistoryNotes, previous_owners: input.previousOwners, keys_count: input.keysCount,
    history_check_summary: input.historyCheckSummary, history_checked_on: input.historyCheckedOn, video_url: input.videoUrl, collection_delivery: input.collectionDelivery, after_sales: input.afterSales,
  };
  await updateIfUnchanged(staff, vehicleId, expectedUpdatedAt, row, "The condition details could not be saved.");
  await auditStaffAction(staff, "update_disclosures", "sale_vehicle", vehicleId, { slug: loaded.vehicle.slug, listingCondition: input.listingCondition, writeOffStatus: input.writeOffStatus, knownFaults: input.knownFaults.length });
  return { slug: loaded.vehicle.slug };
}

// ---------------------------------------------------------------------------
// New stock draft (registration lookup flow, or from a purchased submission)
// ---------------------------------------------------------------------------

export const draftSchema = z.object({
  registration: optionalText("registration", 9),
  slug: z.string().trim().max(120).optional(),
  make: formText("the make", 60),
  model: formText("the model", 80),
  derivative: optionalText("derivative", 120),
  year: requiredInt("the year", 1885, 2100),
  mileage: requiredInt("the mileage", 0, 2_000_000),
  price: z.preprocess((value) => (value === "" || value == null ? 0 : value), z.coerce.number().int().min(0).max(10_000_000)),
  fuelType: formText("the fuel type", 40),
  transmission: formText("the transmission", 40),
  engineSize: optionalText("engine size", 40),
  colour: optionalText("colour", 40),
  bodyType: optionalText("body type", 40),
  description: z.string().trim().max(6000).default(""),
  features: lines("feature", 80, 80),
});

export function stockSlug(input: { year?: number | null; make?: string | null; model?: string | null; registration?: string | null }) {
  const base = [input.year, input.make, input.model].filter(Boolean).join("-").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "vehicle";
  // A random suffix keeps slugs unique without exposing the registration in public URLs.
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

export async function createStockDraft(staff: StaffContext, input: z.infer<typeof draftSchema>, extra: { status?: "draft" | "preparation"; source?: string; purchasedFromSubmissionId?: string } = {}) {
  assertCan(staff, "stock.edit");
  const price = staff.can("stock.price") ? input.price : 0;
  guardCopy({ description: input.description, features: input.features });
  const registration = input.registration ? normalizeRegistration(input.registration) : null;
  if (registration !== null && (registration.length < 2 || registration.length > 8)) fieldError("registration", "Check the registration number.");
  if (registration) {
    const { data: duplicate } = await staff.client.from("sale_vehicles").select("id").eq("registration", registration).is("deleted_at", null).maybeSingle();
    if (duplicate) throw new ExchangeUserError("This registration already exists in Vehicle Stock.");
  }
  const row = {
    registration, slug: stockSlug({ ...input, registration }), make: input.make, model: input.model, derivative: input.derivative, year: input.year, mileage: input.mileage, price,
    fuel_type: input.fuelType, transmission: input.transmission, engine_size: input.engineSize, colour: input.colour, body_type: input.bodyType,
    description: input.description, features: input.features, finance_available: false, warranty: { available: false }, status: extra.status || "draft",
    ...(extra.purchasedFromSubmissionId ? { purchased_from_submission_id: extra.purchasedFromSubmissionId } : {}),
  };
  const result = await staff.client.from("sale_vehicles").insert(row).select("id,slug").single();
  if (result.error?.code === "23505") throw new ExchangeUserError(extra.purchasedFromSubmissionId ? "A stock record already exists for this purchase." : "This registration already exists in Vehicle Stock.");
  const inserted = mustRow(result, "The vehicle could not be created.");
  await auditStaffAction(staff, "create", "sale_vehicle", inserted.id, { status: row.status, slug: inserted.slug, source: extra.source || "stock" });
  return inserted as { id: string; slug: string };
}

// ---------------------------------------------------------------------------
// Internal (finance roles): acquisition and notes
// ---------------------------------------------------------------------------

export const internalSchema = z.object({
  acquiredOn: optionalDate("the acquisition date"),
  acquisitionSource: z.preprocess((value) => (value === "" ? undefined : value), z.enum(acquisitionSources).optional()).transform((value) => value ?? null),
  internalNotes: optionalText("internal notes", 6000),
});

export async function saveInternalRecord(staff: StaffContext, vehicleId: string, input: z.infer<typeof internalSchema>) {
  assertCan(staff, "finance.edit");
  must(await staff.client.from("vehicle_internal_records").upsert({ sale_vehicle_id: vehicleId, acquired_on: input.acquiredOn, acquisition_source: input.acquisitionSource, internal_notes: input.internalNotes, updated_by: staff.userId }), "The internal record could not be saved.");
  await auditStaffAction(staff, "update_internal", "sale_vehicle", vehicleId, { acquiredOn: input.acquiredOn, acquisitionSource: input.acquisitionSource });
}

// ---------------------------------------------------------------------------
// Costs (finance roles)
// ---------------------------------------------------------------------------

export const costSchema = z.object({
  category: z.enum(costCategories, { error: "Choose a cost category." }),
  description: formText("a description", 200),
  amount: moneyPence("the amount"),
  basis: z.enum(["estimated", "actual"], { error: "Choose estimated or actual." }),
  incurredOn: optionalDate("the date"),
});

export async function addCost(staff: StaffContext, vehicleId: string, input: z.infer<typeof costSchema>) {
  assertCan(staff, "finance.edit");
  const inserted = mustRow(await staff.client.from("vehicle_costs").insert({ sale_vehicle_id: vehicleId, category: input.category, description: input.description, amount_pence: input.amount, basis: input.basis, incurred_on: input.incurredOn, created_by: staff.userId }).select("id").single(), "The cost could not be added.");
  await auditStaffAction(staff, "cost_added", "sale_vehicle", vehicleId, { costId: inserted.id, category: input.category, amountPence: input.amount, basis: input.basis });
}

export async function updateCost(staff: StaffContext, vehicleId: string, costId: string, input: z.infer<typeof costSchema>) {
  assertCan(staff, "finance.edit");
  const rows = must(await staff.client.from("vehicle_costs").update({ category: input.category, description: input.description, amount_pence: input.amount, basis: input.basis, incurred_on: input.incurredOn }).eq("id", costId).eq("sale_vehicle_id", vehicleId).select("id"), "The cost could not be updated.");
  if (!rows?.length) throw new ExchangeUserError("That cost line no longer exists.");
  await auditStaffAction(staff, "cost_updated", "sale_vehicle", vehicleId, { costId, category: input.category, amountPence: input.amount, basis: input.basis });
}

export async function deleteCost(staff: StaffContext, vehicleId: string, costId: string) {
  assertCan(staff, "finance.edit");
  const rows = must(await staff.client.from("vehicle_costs").delete().eq("id", costId).eq("sale_vehicle_id", vehicleId).select("id,amount_pence,category"), "The cost could not be removed.");
  if (!rows?.length) throw new ExchangeUserError("That cost line no longer exists.");
  await auditStaffAction(staff, "cost_removed", "sale_vehicle", vehicleId, { costId, category: rows[0]!.category, amountPence: rows[0]!.amount_pence });
}

// ---------------------------------------------------------------------------
// Photos (public bucket vehicle-sales). Uploads go through the signed upload
// route handlers; these manage order, alt text, cover and removal.
// ---------------------------------------------------------------------------

async function vehiclePhotos(client: StaffClient, vehicleId: string) {
  const result = await client.from("sale_vehicle_images").select("id,object_path,alt_text,position").eq("sale_vehicle_id", vehicleId).order("position").order("created_at");
  return must(result, "Photos could not be loaded.") as Array<{ id: string; object_path: string; alt_text: string; position: number }>;
}

async function writePhotoOrder(client: StaffClient, vehicleId: string, ids: string[]) {
  for (const [position, id] of ids.entries()) {
    must(await client.from("sale_vehicle_images").update({ position }).eq("id", id).eq("sale_vehicle_id", vehicleId), "The photo order could not be saved.");
  }
}

export async function updatePhotoAlt(staff: StaffContext, vehicleId: string, photoId: string, alt: string) {
  assertCan(staff, "stock.edit");
  guardCopy({ alt });
  const rows = must(await staff.client.from("sale_vehicle_images").update({ alt_text: alt }).eq("id", photoId).eq("sale_vehicle_id", vehicleId).select("id"), "The alt text could not be saved.");
  if (!rows?.length) throw new ExchangeUserError("That photo no longer exists.");
  await auditStaffAction(staff, "photo_updated", "sale_vehicle", vehicleId, { photoId });
}

export async function movePhoto(staff: StaffContext, vehicleId: string, photoId: string, move: "up" | "down" | "cover") {
  assertCan(staff, "stock.edit");
  const ids = (await vehiclePhotos(staff.client, vehicleId)).map((photo) => photo.id);
  const index = ids.indexOf(photoId);
  if (index < 0) throw new ExchangeUserError("That photo no longer exists.");
  const target = move === "cover" ? 0 : move === "up" ? Math.max(0, index - 1) : Math.min(ids.length - 1, index + 1);
  ids.splice(index, 1);
  ids.splice(target, 0, photoId);
  await writePhotoOrder(staff.client, vehicleId, ids);
  await auditStaffAction(staff, move === "cover" ? "photo_cover" : "photo_reordered", "sale_vehicle", vehicleId, { photoId, position: target });
}

export async function deletePhoto(staff: StaffContext, vehicleId: string, photoId: string) {
  assertCan(staff, "stock.edit");
  const photos = await vehiclePhotos(staff.client, vehicleId);
  const photo = photos.find((item) => item.id === photoId);
  if (!photo) throw new ExchangeUserError("That photo no longer exists.");
  const loaded = await loadStockVehicle(staff.client, vehicleId);
  if (loaded && publicStatuses.includes(loaded.vehicle.status)) {
    const minimum = await minimumPublishPhotos();
    if (photos.length - 1 < minimum) throw new ExchangeUserError(`This vehicle is live and needs at least ${minimum} photos. Add another photo first, or move it back to Preparation.`);
  }
  const { error: storageError } = await staff.client.storage.from("vehicle-sales").remove([photo.object_path]);
  if (storageError) throw new ExchangeUserError("The photo could not be removed. Try again.");
  must(await staff.client.from("sale_vehicle_images").delete().eq("id", photoId).eq("sale_vehicle_id", vehicleId), "The photo could not be removed.");
  await writePhotoOrder(staff.client, vehicleId, photos.filter((item) => item.id !== photoId).map((item) => item.id));
  await auditStaffAction(staff, "photo_deleted", "sale_vehicle", vehicleId, { photoId });
  return { slug: loaded?.vehicle.slug };
}

export function activeSaleFor(sales: SaleRow[]) {
  return sales.find((sale) => (activeSaleStatuses as string[]).includes(sale.status)) || null;
}
