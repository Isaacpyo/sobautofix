import "server-only";

import { activeSaleStatuses, openSubmissionStatuses, vehicleTitle } from "@/components/admin/exchange/labels";
import { getPublishReadiness, publicStatuses } from "@/lib/exchange/readiness";
import type { StaffContext } from "@/lib/exchange/staff";
import { mapVehicle, type SaleVehicleRow } from "@/lib/sales/repository";
import { minimumPublishPhotos } from "./stock";

export type AttentionItem = { id: string; href: string; title: string; detail: string; when?: string | null; tone?: "warning" | "danger" | "info" };
export type AttentionGroup = { key: string; title: string; description: string; href: string; count: number; items: AttentionItem[]; tone: "warning" | "danger" | "info" };
export type NotificationFailure = { enquiryId: string; type: string; title: string; createdAt: string; href: string };

type CustomerJoin = { name: string | null } | null;

const DAY = 86_400_000;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getExchangeOverview(staff: StaffContext, now = new Date()) {
  const client = staff.client;
  const showNames = staff.can("customers.view");
  const today = isoDate(now);
  const inThreeDays = isoDate(new Date(now.getTime() + 3 * DAY));
  const [submissions, salesEnquiries, viewings, sales, stock, prepItems, failures, minimumPhotos] = await Promise.all([
    client.from("seller_submissions").select("id,reference,kind,status,make,model,year,created_at,provisional_offer_expires_on,final_offer_expires_on,customers(name)").in("status", openSubmissionStatuses).order("created_at", { ascending: false }).limit(200),
    client.from("enquiries").select("id,status,sales_stage,follow_up_at,created_at,customers(name),sale_vehicles(year,make,model)").eq("type", "vehicle_sales").is("deleted_at", null).or("sales_stage.is.null,sales_stage.not.in.(sold,lost)").order("created_at", { ascending: false }).limit(300),
    client.from("diary_appointments").select("id,title,starts_at,status,customers(name)").eq("kind", "viewing").eq("status", "requested").is("deleted_at", null).order("starts_at").limit(50),
    client.from("vehicle_sales").select("id,status,reservation_expires_at,sale_vehicles(year,make,model)").in("status", activeSaleStatuses).order("reservation_expires_at", { ascending: true, nullsFirst: false }).limit(100),
    client.from("sale_vehicles").select("*, sale_vehicle_images(*)").is("deleted_at", null).in("status", ["draft", "preparation", "available", "reserved"]).limit(500),
    client.from("vehicle_prep_items").select("id,title,status,due_on,sale_vehicle_id,sale_vehicles(year,make,model,status)").in("status", ["todo", "in_progress"]).limit(500),
    client.from("enquiries").select("id,type,created_at,customers(name)").eq("notification_status", "failed").in("type", ["vehicle_sales", "vehicle_purchase"]).is("deleted_at", null).order("created_at", { ascending: false }).limit(20),
    minimumPublishPhotos(),
  ]);

  const name = (customer: CustomerJoin, fallback = "Customer") => (showNames && customer?.name) || fallback;
  const submissionRows = (submissions.data || []) as unknown as Array<{ id: string; reference: string; kind: string; status: string; make: string | null; model: string | null; year: number | null; created_at: string; provisional_offer_expires_on: string | null; final_offer_expires_on: string | null; customers: CustomerJoin }>;
  const enquiryRows = (salesEnquiries.data || []) as unknown as Array<{ id: string; status: string; sales_stage: string | null; follow_up_at: string | null; created_at: string; customers: CustomerJoin; sale_vehicles: { year: number; make: string; model: string } | null }>;
  const viewingRows = (viewings.data || []) as unknown as Array<{ id: string; title: string; starts_at: string; customers: CustomerJoin }>;
  const saleRows = (sales.data || []) as unknown as Array<{ id: string; status: string; reservation_expires_at: string | null; sale_vehicles: { year: number; make: string; model: string } | null }>;
  const stockVehicles = ((stock.data || []) as SaleVehicleRow[]).map(mapVehicle);
  const prepRows = (prepItems.data || []) as unknown as Array<{ id: string; title: string; status: string; due_on: string | null; sale_vehicle_id: string; sale_vehicles: { year: number; make: string; model: string; status: string } | null }>;

  const newBuying = submissionRows.filter((row) => row.status === "new");
  const awaitingContact = enquiryRows.filter((row) => (row.sales_stage || "new") === "new" && row.status === "new");
  const overdueFollowUps = enquiryRows.filter((row) => row.follow_up_at && new Date(row.follow_up_at) < now);
  const expiringOffers = submissionRows.flatMap((row) => {
    const expiry = row.status === "final_offer" ? row.final_offer_expires_on : row.status === "provisional_offer" || row.status === "inspection" ? row.provisional_offer_expires_on : null;
    return expiry && expiry <= inThreeDays ? [{ row, expiry }] : [];
  }).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const expiringReservations = saleRows.filter((row) => row.reservation_expires_at && new Date(row.reservation_expires_at).getTime() <= now.getTime() + 3 * DAY);
  const inPreparation = stockVehicles.filter((vehicle) => vehicle.status === "preparation");
  const overduePrep = prepRows.filter((row) => row.due_on && row.due_on < today && row.sale_vehicles && row.sale_vehicles.status !== "sold");
  const failingListings = stockVehicles.filter((vehicle) => publicStatuses.includes(vehicle.status) && !getPublishReadiness(vehicle, { minimumPhotos }).ready);

  const groups: AttentionGroup[] = [
    { key: "new-buying", title: "New buying enquiries", description: "Sell-your-car and part-exchange submissions nobody has reviewed yet.", href: "/admin/exchange/buying?status=new", count: newBuying.length, tone: "info", items: newBuying.slice(0, 5).map((row) => ({ id: row.id, href: `/admin/exchange/buying/${row.id}`, title: `${row.reference} · ${vehicleTitle(row)}`, detail: `${row.kind === "part_exchange" ? "Part exchange" : "Sell"} · ${name(row.customers)}`, when: row.created_at })) },
    { key: "awaiting-contact", title: "Sales enquiries awaiting first contact", description: "Buyers who have not heard from us yet.", href: "/admin/exchange/sales?stage=new", count: awaitingContact.length, tone: "warning", items: awaitingContact.slice(0, 5).map((row) => ({ id: row.id, href: `/admin/exchange/sales/${row.id}`, title: name(row.customers), detail: row.sale_vehicles ? vehicleTitle(row.sale_vehicles) : "No vehicle linked", when: row.created_at })) },
    { key: "follow-ups", title: "Overdue follow-ups", description: "Sales enquiries whose follow-up date has passed.", href: "/admin/exchange/sales?followUp=overdue", count: overdueFollowUps.length, tone: "danger", items: overdueFollowUps.slice(0, 5).map((row) => ({ id: row.id, href: `/admin/exchange/sales/${row.id}`, title: name(row.customers), detail: `Follow-up was due · ${row.sale_vehicles ? vehicleTitle(row.sale_vehicles) : "No vehicle"}`, when: row.follow_up_at, tone: "danger" })) },
    { key: "viewings", title: "Viewing requests to confirm", description: "Customers are told a viewing is a request until we confirm it.", href: "/admin/exchange/viewings?status=requested", count: viewingRows.length, tone: "warning", items: viewingRows.slice(0, 5).map((row) => ({ id: row.id, href: `/admin/diary/${row.id}`, title: row.title, detail: `Requested by ${name(row.customers)}`, when: row.starts_at })) },
    { key: "offers", title: "Offers expiring within 3 days", description: "Provisional and final offers about to lapse.", href: "/admin/exchange/buying?status=final_offer", count: expiringOffers.length, tone: "warning", items: expiringOffers.slice(0, 5).map(({ row, expiry }) => ({ id: row.id, href: `/admin/exchange/buying/${row.id}`, title: `${row.reference} · ${vehicleTitle(row)}`, detail: `${row.status === "final_offer" ? "Final" : "Provisional"} offer ${expiry < today ? "expired" : "expires"}`, when: expiry, tone: expiry < today ? "danger" : "warning" })) },
    { key: "reservations", title: "Reservations expiring", description: "Reservations ending within 3 days, or already past their expiry.", href: "/admin/exchange/handover", count: expiringReservations.length, tone: "warning", items: expiringReservations.slice(0, 5).map((row) => ({ id: row.id, href: `/admin/exchange/handover/${row.id}`, title: row.sale_vehicles ? vehicleTitle(row.sale_vehicles) : "Vehicle", detail: new Date(row.reservation_expires_at!) < now ? "Reservation expired" : "Reservation expires", when: row.reservation_expires_at, tone: new Date(row.reservation_expires_at!) < now ? "danger" : "warning" })) },
    { key: "preparation", title: "Overdue preparation items", description: `${inPreparation.length} ${inPreparation.length === 1 ? "vehicle is" : "vehicles are"} in preparation. These checklist items are past their due date.`, href: "/admin/exchange/preparation", count: overduePrep.length, tone: "warning", items: overduePrep.slice(0, 5).map((row) => ({ id: row.id, href: `/admin/exchange/stock/${row.sale_vehicle_id}?tab=status`, title: row.title, detail: row.sale_vehicles ? vehicleTitle(row.sale_vehicles) : "Vehicle", when: row.due_on, tone: "danger" })) },
    { key: "readiness", title: "Live listings failing the checklist", description: "Visible to customers but missing required information.", href: "/admin/exchange/stock?status=available", count: failingListings.length, tone: "danger", items: failingListings.slice(0, 5).map((vehicle) => ({ id: vehicle.id, href: `/admin/exchange/stock/${vehicle.id}?tab=status`, title: vehicleTitle(vehicle), detail: getPublishReadiness(vehicle, { minimumPhotos }).missing.join("; ") })) },
  ];

  const notificationFailures: NotificationFailure[] = ((failures.data || []) as unknown as Array<{ id: string; type: string; created_at: string; customers: CustomerJoin }>).map((row) => ({
    enquiryId: row.id,
    type: row.type,
    title: `${row.type === "vehicle_purchase" ? "Seller submission" : "Sales enquiry"} from ${name(row.customers)}`,
    createdAt: row.created_at,
    href: row.type === "vehicle_purchase" ? `/admin/exchange/buying?enquiry=${row.id}` : `/admin/exchange/sales/${row.id}`,
  }));

  return {
    counts: {
      available: stockVehicles.filter((vehicle) => vehicle.status === "available").length,
      reserved: stockVehicles.filter((vehicle) => vehicle.status === "reserved").length,
      preparation: inPreparation.length,
      drafts: stockVehicles.filter((vehicle) => vehicle.status === "draft").length,
      openBuying: submissionRows.length,
      openSales: enquiryRows.length,
      activeSales: saleRows.length,
    },
    groups,
    notificationFailures,
  };
}
