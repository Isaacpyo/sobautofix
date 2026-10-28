import "server-only";

import { z } from "zod";
import { activeSaleStatuses, salesStageLabels, type SalesStage } from "@/components/admin/exchange/labels";
import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { assertCan, assertStaffMember, ExchangeUserError, must, mustRow, optionalDateTime } from "./core";
import { loadThread, type ThreadMessage } from "./threads";

type EnquiryRow = {
  id: string; status: string; sales_stage: SalesStage | null; assigned_to: string | null; follow_up_at: string | null; notification_status: string; source: string | null; created_at: string; description: string | null;
  customers: { id: string; name: string; email: string | null; phone: string; preferred_contact: string } | null;
  sale_vehicles: { id: string; year: number; make: string; model: string; status: string; price: number; slug: string; stock_reference: string | null } | null;
};

export type SalesEnquiryItem = {
  id: string; stage: SalesStage; status: string; assignedTo: string | null; followUpAt: string | null; notificationStatus: string; source: string | null; createdAt: string;
  customerName: string | null; vehicle: { id: string; title: string; status: string; price: number } | null; overdue: boolean;
};

const SELECT = "id,status,sales_stage,assigned_to,follow_up_at,notification_status,source,created_at,description,customers(id,name,email,phone,preferred_contact),sale_vehicles(id,year,make,model,status,price,slug,stock_reference)";

export function stageOf(row: { sales_stage: SalesStage | null; status: string }): SalesStage {
  if (row.sales_stage) return row.sales_stage;
  return row.status === "closed" ? "lost" : row.status === "new" ? "new" : "contacted";
}

export async function listSalesEnquiries(staff: StaffContext, filters: { q?: string; stage?: string; assigned?: string; followUp?: string }, now = new Date()): Promise<SalesEnquiryItem[]> {
  const rows = must(await staff.client.from("enquiries").select(SELECT).eq("type", "vehicle_sales").is("deleted_at", null).order("created_at", { ascending: false }).limit(500), "Sales enquiries could not be loaded.") as unknown as EnquiryRow[];
  const showNames = staff.can("customers.view");
  const query = (filters.q || "").trim().toLowerCase();
  return (rows || []).map((row): SalesEnquiryItem => {
    const stage = stageOf(row);
    return {
      id: row.id, stage, status: row.status, assignedTo: row.assigned_to, followUpAt: row.follow_up_at, notificationStatus: row.notification_status, source: row.source, createdAt: row.created_at,
      customerName: showNames ? row.customers?.name || null : null,
      vehicle: row.sale_vehicles ? { id: row.sale_vehicles.id, title: `${row.sale_vehicles.year} ${row.sale_vehicles.make} ${row.sale_vehicles.model}`, status: row.sale_vehicles.status, price: row.sale_vehicles.price } : null,
      overdue: Boolean(row.follow_up_at && new Date(row.follow_up_at) < now && stage !== "sold" && stage !== "lost"),
    };
  }).filter((item) => {
    if (filters.stage === "open" ? item.stage === "sold" || item.stage === "lost" : filters.stage && item.stage !== filters.stage) return false;
    if (filters.followUp === "overdue" && !item.overdue) return false;
    if (filters.assigned === "me" ? item.assignedTo !== staff.userId : filters.assigned === "none" ? item.assignedTo !== null : filters.assigned && item.assignedTo !== filters.assigned) return false;
    return !query || [item.customerName, item.vehicle?.title].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
}

export type SalesEnquiryDetail = {
  enquiry: EnquiryRow & { stage: SalesStage };
  appointments: Array<{ id: string; kind: string; status: string; title: string; starts_at: string; customer_message: string | null; alternative_start: string | null }>;
  sales: Array<{ id: string; status: string; agreed_price_pence: number; reserved_at: string }>;
  vehicleActiveSale: { id: string; enquiry_id: string | null } | null;
  thread: ThreadMessage[];
  partExchangeOptions: Array<{ id: string; reference: string; title: string }>;
};

export async function getSalesEnquiry(staff: StaffContext, id: string): Promise<SalesEnquiryDetail | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const row = must(await staff.client.from("enquiries").select(SELECT).eq("id", id).eq("type", "vehicle_sales").is("deleted_at", null).maybeSingle(), "The enquiry could not be loaded.") as unknown as EnquiryRow | null;
  if (!row) return null;
  const customerId = row.customers?.id;
  if (!staff.can("customers.view")) row.customers = null;
  const vehicleId = row.sale_vehicles?.id;
  const [appointments, sales, activeSale, thread, partExchange] = await Promise.all([
    staff.client.from("diary_appointments").select("id,kind,status,title,starts_at,customer_message,alternative_start").eq("enquiry_id", id).is("deleted_at", null).order("starts_at"),
    staff.client.from("vehicle_sales").select("id,status,agreed_price_pence,reserved_at").eq("enquiry_id", id).order("created_at", { ascending: false }),
    vehicleId ? staff.client.from("vehicle_sales").select("id,enquiry_id").eq("sale_vehicle_id", vehicleId).in("status", activeSaleStatuses).maybeSingle() : Promise.resolve({ data: null }),
    loadThread(staff.client, id),
    customerId ? staff.client.from("seller_submissions").select("id,reference,year,make,model").eq("customer_id", customerId).in("status", ["new", "reviewing", "provisional_offer", "inspection", "final_offer", "purchased"]) : Promise.resolve({ data: [] }),
  ]);
  return {
    enquiry: { ...row, stage: stageOf(row) },
    appointments: (appointments.data || []) as SalesEnquiryDetail["appointments"],
    sales: (sales.data || []) as SalesEnquiryDetail["sales"],
    vehicleActiveSale: (activeSale.data as SalesEnquiryDetail["vehicleActiveSale"]) || null,
    thread,
    partExchangeOptions: ((partExchange.data || []) as Array<{ id: string; reference: string; year: number | null; make: string | null; model: string | null }>).map((item) => ({ id: item.id, reference: item.reference, title: [item.year, item.make, item.model].filter(Boolean).join(" ") || "Vehicle" })),
  };
}

/** Stages staff set by hand. Reserved and Sold follow the reservation record. */
export const manualStages: SalesStage[] = ["new", "contacted", "viewing_booked", "negotiating", "lost"];

export const salesUpdateSchema = z.object({
  stage: z.enum(["new", "contacted", "viewing_booked", "negotiating", "reserved", "sold", "lost"], { error: "Choose a stage." }),
  assignedTo: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  followUpAt: optionalDateTime("the follow-up date"),
});

const enquiryStatusForStage: Record<SalesStage, string> = { new: "new", contacted: "contacted", viewing_booked: "booked", negotiating: "contacted", reserved: "booked", sold: "closed", lost: "closed" };

export function salesStageProblem(from: SalesStage, to: SalesStage) {
  if (from === to) return null;
  if (to === "reserved") return "Reserve the vehicle below so the agreed price and deposit are recorded.";
  if (to === "sold") return "Complete the sale in Sales & Handover; the enquiry is then marked Sold.";
  if (from === "reserved") return "This enquiry has a reservation. Cancel it in Sales & Handover to change the stage.";
  if (from === "sold") return "This sale is complete.";
  return null;
}

export async function updateSalesEnquiry(staff: StaffContext, id: string, input: z.infer<typeof salesUpdateSchema>, now = new Date()) {
  assertCan(staff, "sales.manage");
  const current = mustRow(await staff.client.from("enquiries").select("id,status,sales_stage,assigned_to,follow_up_at").eq("id", id).eq("type", "vehicle_sales").maybeSingle(), "This enquiry no longer exists.") as { id: string; status: string; sales_stage: SalesStage | null; assigned_to: string | null; follow_up_at: string | null };
  const from = stageOf(current);
  const problem = salesStageProblem(from, input.stage);
  if (problem) throw new ExchangeUserError(problem, { stage: problem });
  await assertStaffMember(staff.client, input.assignedTo);
  const values: Record<string, unknown> = { sales_stage: input.stage, assigned_to: input.assignedTo, follow_up_at: input.followUpAt };
  if (input.stage !== from) {
    values.status = enquiryStatusForStage[input.stage];
    values.closed_at = input.stage === "lost" ? now.toISOString() : null;
  }
  must(await staff.client.from("enquiries").update(values).eq("id", id), "The enquiry could not be saved.");
  await auditStaffAction(staff, input.stage !== from ? "stage_change" : "enquiry_updated", "enquiry", id, { from, to: input.stage, assignedTo: input.assignedTo, followUpAt: input.followUpAt, stageLabel: salesStageLabels[input.stage] });
}
