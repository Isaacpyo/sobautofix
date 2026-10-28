import "server-only";

import { activeSaleStatuses, openSubmissionStatuses, vehicleTitle } from "@/components/admin/exchange/labels";
import { getPublishReadiness, publicStatuses } from "@/lib/exchange/readiness";
import type { StaffContext } from "@/lib/exchange/staff";
import { mapVehicle, type SaleVehicleRow } from "@/lib/sales/repository";
import { minimumPublishPhotos } from "./stock";

export type AttentionItem = { id: string; href: string; title: string; detail: string; when?: string | null; tone?: "warning" | "danger" | "info" };
export type AttentionGroup = { key: string; title: string; description: string; action: string; href: string; count: number; items: AttentionItem[]; tone: "warning" | "danger" | "info" };
export type NotificationFailure = { enquiryId: string; type: string; title: string; createdAt: string; href: string };

type CustomerJoin = { name: string | null } | null;
type VehicleJoin = { year: number; make: string; model: string } | null;

const DAY = 86_400_000;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Every "needs attention" list on the Overview, each with a link and a next action. */
export async function getExchangeOverview(staff: StaffContext, now = new Date()) {
  const client = staff.client;
  const showNames = staff.can("customers.view");
  const today = isoDate(now);
  const inThreeDays = isoDate(new Date(now.getTime() + 3 * DAY));
  const weekAhead = new Date(now.getTime() + 7 * DAY).toISOString();
  const [submissions, salesEnquiries, viewings, sales, stock, prepItems, failures, offers, handovers, minimumPhotos] = await Promise.all([
    client.from("seller_submissions").select("id,reference,kind,status,make,model,year,created_at,assigned_to,customers(name)").in("status", openSubmissionStatuses).order("created_at", { ascending: false }).limit(300),
    client.from("enquiries").select("id,status,sales_stage,assigned_to,follow_up_at,created_at,customers(name),sale_vehicles(year,make,model)").eq("type", "vehicle_sales").is("deleted_at", null).or("sales_stage.is.null,sales_stage.not.in.(sold,lost)").neq("status", "closed").order("created_at", { ascending: false }).limit(300),
    client.from("diary_appointments").select("id,title,starts_at,status,customers(name)").eq("kind", "viewing").eq("status", "requested").is("deleted_at", null).order("starts_at").limit(50),
    client.from("vehicle_sales").select("id,status,reservation_expires_at,handover_at,handover_method,sale_vehicles(year,make,model)").in("status", activeSaleStatuses).limit(200),
    client.from("sale_vehicles").select("*, sale_vehicle_images(*)").is("deleted_at", null).in("status", ["draft", "preparation", "available", "reserved"]).limit(500),
    client.from("vehicle_prep_items").select("id,title,status,due_on,sale_vehicle_id").in("status", ["todo", "in_progress"]).limit(1000),
    client.from("enquiries").select("id,type,created_at,customers(name)").eq("notification_status", "failed").in("type", ["vehicle_sales", "vehicle_purchase"]).is("deleted_at", null).order("created_at", { ascending: false }).limit(20),
    client.from("seller_offers").select("id,stage,amount_pence,expires_on,submission_id,seller_submissions(reference,year,make,model,status)").eq("status", "open").not("expires_on", "is", null).lte("expires_on", inThreeDays).order("expires_on").limit(50),
    client.from("diary_appointments").select("id,kind,title,starts_at,status,vehicle_sale_id").in("kind", ["collection", "handover"]).in("status", ["requested", "confirmed"]).is("deleted_at", null).gte("starts_at", now.toISOString()).lte("starts_at", weekAhead).order("starts_at").limit(50),
    minimumPublishPhotos(),
  ]);

  const name = (customer: CustomerJoin, fallback = "Customer") => (showNames && customer?.name) || fallback;
  const submissionRows = (submissions.data || []) as unknown as Array<{ id: string; reference: string; kind: string; status: string; make: string | null; model: string | null; year: number | null; created_at: string; assigned_to: string | null; customers: CustomerJoin }>;
  const enquiryRows = (salesEnquiries.data || []) as unknown as Array<{ id: string; status: string; sales_stage: string | null; assigned_to: string | null; follow_up_at: string | null; created_at: string; customers: CustomerJoin; sale_vehicles: VehicleJoin }>;
  const viewingRows = (viewings.data || []) as unknown as Array<{ id: string; title: string; starts_at: string; customers: CustomerJoin }>;
  const saleRows = (sales.data || []) as unknown as Array<{ id: string; status: string; reservation_expires_at: string | null; handover_at: string | null; handover_method: string; sale_vehicles: VehicleJoin }>;
  const stockVehicles = ((stock.data || []) as SaleVehicleRow[]).map(mapVehicle);
  const prepRows = (prepItems.data || []) as Array<{ id: string; title: string; status: string; due_on: string | null; sale_vehicle_id: string }>;
  const offerRows = (offers.data || []) as unknown as Array<{ id: string; stage: string; amount_pence: number; expires_on: string; submission_id: string; seller_submissions: { reference: string; year: number | null; make: string | null; model: string | null; status: string } | null }>;
  const handoverRows = (handovers.data || []) as Array<{ id: string; kind: string; title: string; starts_at: string; status: string; vehicle_sale_id: string | null }>;

  // 1. Unassigned or unanswered (no reply yet) enquiries, buying and sales.
  const waiting = [
    ...submissionRows.filter((row) => row.status === "new" || !row.assigned_to).map((row) => ({ id: row.id, href: `/admin/exchange/buying/${row.id}`, title: `${row.kind === "part_exchange" ? "Part exchange" : "Selling"}: ${vehicleTitle(row)}`, detail: `${name(row.customers)} · ${[row.status === "new" ? "not answered" : null, !row.assigned_to ? "unassigned" : null].filter(Boolean).join(", ")}`, when: row.created_at })),
    ...enquiryRows.filter((row) => ((row.sales_stage || "new") === "new" && row.status === "new") || !row.assigned_to).map((row) => ({ id: row.id, href: `/admin/exchange/sales/${row.id}`, title: `Buying: ${row.sale_vehicles ? vehicleTitle(row.sale_vehicles) : "no vehicle linked"}`, detail: `${name(row.customers)} · ${[(row.sales_stage || "new") === "new" && row.status === "new" ? "not answered" : null, !row.assigned_to ? "unassigned" : null].filter(Boolean).join(", ")}`, when: row.created_at })),
  ].sort((a, b) => a.when.localeCompare(b.when));

  const overdueFollowUps = enquiryRows.filter((row) => row.follow_up_at && new Date(row.follow_up_at) < now);
  const expiringReservations = saleRows.filter((row) => row.reservation_expires_at && new Date(row.reservation_expires_at).getTime() <= now.getTime() + 3 * DAY);

  // Preparation blocking publication: unpublished stock with open checklist items or a failing publishing checklist.
  const openItemsByVehicle = new Map<string, typeof prepRows>();
  for (const item of prepRows) openItemsByVehicle.set(item.sale_vehicle_id, [...(openItemsByVehicle.get(item.sale_vehicle_id) || []), item]);
  const blocked = stockVehicles.filter((vehicle) => vehicle.status === "draft" || vehicle.status === "preparation").map((vehicle) => ({ vehicle, items: openItemsByVehicle.get(vehicle.id) || [], readiness: getPublishReadiness(vehicle, { minimumPhotos }) })).filter((entry) => entry.items.length || !entry.readiness.ready);

  // Upcoming collections and handovers in the next 7 days (diary and sale records, without duplicates).
  const diarySales = new Set(handoverRows.map((row) => row.vehicle_sale_id).filter(Boolean));
  const upcoming = [
    ...handoverRows.map((row) => ({ id: row.id, href: row.vehicle_sale_id ? `/admin/exchange/handover/${row.vehicle_sale_id}` : `/admin/diary/${row.id}`, title: row.title, detail: `${row.kind === "handover" ? "Handover" : "Collection"} · ${row.status === "requested" ? "not yet confirmed" : "confirmed"}`, when: row.starts_at })),
    ...saleRows.filter((row) => row.handover_at && !diarySales.has(row.id) && row.handover_at >= now.toISOString() && row.handover_at <= weekAhead).map((row) => ({ id: row.id, href: `/admin/exchange/handover/${row.id}`, title: row.sale_vehicles ? vehicleTitle(row.sale_vehicles) : "Vehicle", detail: `${row.handover_method === "delivery" ? "Delivery" : "Handover"} planned · not in the diary yet`, when: row.handover_at })),
  ].sort((a, b) => a.when!.localeCompare(b.when!));

  const failingListings = stockVehicles.filter((vehicle) => publicStatuses.includes(vehicle.status) && !getPublishReadiness(vehicle, { minimumPhotos }).ready);

  const groups: AttentionGroup[] = [
    { key: "waiting", title: "Enquiries waiting for us", description: "Buying and sales enquiries nobody has answered or picked up.", action: "Assign an owner and reply", href: "/admin/exchange/buying?assigned=none", count: waiting.length, tone: "warning", items: waiting.slice(0, 6) },
    { key: "viewings", title: "Viewing requests to confirm", description: "Customers are told a viewing is only a request until we confirm it.", action: "Confirm the time or offer another", href: "/admin/exchange/viewings?status=requested", count: viewingRows.length, tone: "warning", items: viewingRows.slice(0, 5).map((row) => ({ id: row.id, href: `/admin/diary/${row.id}`, title: row.title, detail: `Requested by ${name(row.customers)}`, when: row.starts_at })) },
    { key: "offers", title: "Offers expiring within 3 days", description: "Open offers to sellers that are about to lapse.", action: "Chase the seller, or record a revised offer", href: "/admin/exchange/buying?status=open", count: offerRows.length, tone: "warning", items: offerRows.slice(0, 5).map((row) => ({ id: row.id, href: `/admin/exchange/buying/${row.submission_id}`, title: `${row.seller_submissions?.reference || "Offer"} · ${vehicleTitle(row.seller_submissions)}`, detail: `${row.stage === "provisional" ? "Provisional" : row.stage === "revised" ? "Revised" : "Final"} offer ${row.expires_on < today ? "expired" : "expires"}`, when: row.expires_on, tone: row.expires_on < today ? "danger" : "warning" })) },
    { key: "upcoming", title: "Collections and handovers this week", description: "Handovers, deliveries and collections in the next 7 days.", action: "Check the checklist, payment record and paperwork", href: "/admin/exchange/handover", count: upcoming.length, tone: "info", items: upcoming.slice(0, 6) },
    { key: "preparation", title: "Preparation blocking publication", description: "Stock that cannot be published yet: open checklist items or missing listing information.", action: "Finish the work, then publish", href: "/admin/exchange/preparation?show=blocked", count: blocked.length, tone: "warning", items: blocked.slice(0, 5).map(({ vehicle, items, readiness }) => ({ id: vehicle.id, href: `/admin/exchange/stock/${vehicle.id}?tab=status`, title: vehicleTitle(vehicle), detail: [items.length ? `${items.length} open ${items.length === 1 ? "task" : "tasks"}${items.some((item) => item.due_on && item.due_on < today) ? " (some overdue)" : ""}` : null, readiness.missing.length ? `${readiness.missing.length} listing ${readiness.missing.length === 1 ? "item" : "items"} missing` : null].filter(Boolean).join(" · ") })) },
    { key: "reservations", title: "Reservations ending", description: "Reservations ending within 3 days, or already past their end date.", action: "Extend, complete or cancel", href: "/admin/exchange/handover", count: expiringReservations.length, tone: "warning", items: expiringReservations.slice(0, 5).map((row) => ({ id: row.id, href: `/admin/exchange/handover/${row.id}`, title: row.sale_vehicles ? vehicleTitle(row.sale_vehicles) : "Vehicle", detail: new Date(row.reservation_expires_at!) < now ? "Reservation has ended" : "Reservation ends", when: row.reservation_expires_at, tone: new Date(row.reservation_expires_at!) < now ? "danger" : "warning" })) },
    { key: "follow-ups", title: "Overdue follow-ups", description: "Sales enquiries whose follow-up date has passed.", action: "Contact the customer and set the next date", href: "/admin/exchange/sales?followUp=overdue", count: overdueFollowUps.length, tone: "danger", items: overdueFollowUps.slice(0, 5).map((row) => ({ id: row.id, href: `/admin/exchange/sales/${row.id}`, title: name(row.customers), detail: row.sale_vehicles ? vehicleTitle(row.sale_vehicles) : "No vehicle", when: row.follow_up_at, tone: "danger" })) },
    { key: "readiness", title: "Live listings failing the checklist", description: "Visible to customers but missing required information.", action: "Complete the listing or move it back to Preparation", href: "/admin/exchange/stock?status=available", count: failingListings.length, tone: "danger", items: failingListings.slice(0, 5).map((vehicle) => ({ id: vehicle.id, href: `/admin/exchange/stock/${vehicle.id}?tab=status`, title: vehicleTitle(vehicle), detail: getPublishReadiness(vehicle, { minimumPhotos }).missing.join("; ") })) },
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
      preparation: stockVehicles.filter((vehicle) => vehicle.status === "preparation").length,
      drafts: stockVehicles.filter((vehicle) => vehicle.status === "draft").length,
      openBuying: submissionRows.length,
      openSales: enquiryRows.length,
      activeSales: saleRows.length,
    },
    groups,
    notificationFailures,
  };
}
