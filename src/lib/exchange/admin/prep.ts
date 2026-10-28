import "server-only";

import { z } from "zod";
import { prepCategories, prepStatuses } from "@/components/admin/exchange/labels";
import { getPublishReadiness, type PublishReadiness } from "@/lib/exchange/readiness";
import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { mapVehicle, type SaleVehicleRow } from "@/lib/sales/repository";
import type { SaleVehicle } from "@/types/domain";
import { assertCan, assertStaffMember, ExchangeUserError, formText, must, mustRow, optionalDate, optionalText } from "./core";
import { inspectionSchema } from "./buying";
import { visibleDocuments } from "./documents";
import { minimumPublishPhotos, type PrepItemRow } from "./stock";

export type PrepVehicle = {
  vehicle: SaleVehicle;
  items: PrepItemRow[];
  readiness: PublishReadiness;
  openItems: number;
  overdueItems: number;
  documents: number;
  inspections: Array<{ id: string; inspected_on: string; outcome: string; inspector_name: string }>;
};

/** Vehicles still being prepared, plus live stock with unfinished checklist items. */
export async function listPreparation(staff: StaffContext, now = new Date()): Promise<PrepVehicle[]> {
  const client = staff.client;
  const [vehicles, items, documents, inspections, minimum] = await Promise.all([
    client.from("sale_vehicles").select("*, sale_vehicle_images(*)").is("deleted_at", null).in("status", ["draft", "preparation", "available", "reserved"]).order("updated_at", { ascending: false }).limit(300),
    client.from("vehicle_prep_items").select("id,sale_vehicle_id,title,category,status,notes,due_on,assigned_to,position,completed_at").order("position").order("created_at"),
    client.from("vehicle_documents").select("sale_vehicle_id,kind").not("sale_vehicle_id", "is", null),
    client.from("vehicle_inspections").select("id,sale_vehicle_id,inspected_on,outcome,inspector_name").eq("kind", "pre_sale").order("inspected_on", { ascending: false }),
    minimumPublishPhotos(),
  ]);
  must(vehicles, "Vehicles could not be loaded.");
  const today = now.toISOString().slice(0, 10);
  const itemsByVehicle = group((items.data || []) as PrepItemRow[], (item) => item.sale_vehicle_id);
  const docCounts = group(visibleDocuments(staff, (documents.data || []) as Array<{ sale_vehicle_id: string; kind: string }>), (row) => row.sale_vehicle_id);
  const inspectionsByVehicle = group((inspections.data || []) as Array<{ id: string; sale_vehicle_id: string; inspected_on: string; outcome: string; inspector_name: string }>, (row) => row.sale_vehicle_id);
  return ((vehicles.data || []) as SaleVehicleRow[]).map(mapVehicle).map((vehicle) => {
    const vehicleItems = itemsByVehicle.get(vehicle.id) || [];
    const open = vehicleItems.filter((item) => item.status === "todo" || item.status === "in_progress");
    return {
      vehicle,
      items: vehicleItems,
      readiness: getPublishReadiness(vehicle, { minimumPhotos: minimum }),
      openItems: open.length,
      overdueItems: open.filter((item) => item.due_on && item.due_on < today).length,
      documents: docCounts.get(vehicle.id)?.length || 0,
      inspections: inspectionsByVehicle.get(vehicle.id) || [],
    };
  }).filter((entry) => entry.vehicle.status === "draft" || entry.vehicle.status === "preparation" || entry.openItems > 0);
}

function group<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    map.set(id, [...(map.get(id) || []), row]);
  }
  return map;
}

export const prepItemSchema = z.object({
  title: formText("a checklist item", 160),
  category: z.enum(prepCategories, { error: "Choose a category." }),
  dueOn: optionalDate("the due date"),
  assignedTo: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  notes: optionalText("notes", 2000),
});

export async function addPrepItem(staff: StaffContext, vehicleId: string, input: z.infer<typeof prepItemSchema>) {
  assertCan(staff, "prep.manage");
  await assertStaffMember(staff.client, input.assignedTo);
  mustRow(await staff.client.from("sale_vehicles").select("id").eq("id", vehicleId).is("deleted_at", null).maybeSingle(), "This vehicle no longer exists.");
  const { data: last } = await staff.client.from("vehicle_prep_items").select("position").eq("sale_vehicle_id", vehicleId).order("position", { ascending: false }).limit(1).maybeSingle();
  const inserted = mustRow(await staff.client.from("vehicle_prep_items").insert({ sale_vehicle_id: vehicleId, title: input.title, category: input.category, due_on: input.dueOn, assigned_to: input.assignedTo, notes: input.notes, position: (last?.position ?? -1) + 1 }).select("id").single(), "The checklist item could not be added.");
  await auditStaffAction(staff, "prep_item_added", "sale_vehicle", vehicleId, { itemId: inserted.id, title: input.title });
}

export const prepUpdateSchema = prepItemSchema.extend({ status: z.enum(prepStatuses, { error: "Choose a status." }) });

export async function updatePrepItem(staff: StaffContext, itemId: string, input: z.infer<typeof prepUpdateSchema>, now = new Date()) {
  assertCan(staff, "prep.manage");
  await assertStaffMember(staff.client, input.assignedTo);
  const current = mustRow(await staff.client.from("vehicle_prep_items").select("id,sale_vehicle_id,status").eq("id", itemId).maybeSingle(), "That checklist item no longer exists.");
  const finished = input.status === "done" || input.status === "not_required";
  const wasFinished = current.status === "done" || current.status === "not_required";
  must(await staff.client.from("vehicle_prep_items").update({
    title: input.title, category: input.category, due_on: input.dueOn, assigned_to: input.assignedTo, notes: input.notes, status: input.status,
    ...(finished && !wasFinished ? { completed_at: now.toISOString(), completed_by: staff.userId } : !finished ? { completed_at: null, completed_by: null } : {}),
  }).eq("id", itemId), "The checklist item could not be saved.");
  await auditStaffAction(staff, "prep_item_updated", "sale_vehicle", current.sale_vehicle_id, { itemId, from: undefined, status: input.status, title: input.title });
}

export async function setPrepItemStatus(staff: StaffContext, itemId: string, status: (typeof prepStatuses)[number], now = new Date()) {
  assertCan(staff, "prep.manage");
  const current = mustRow(await staff.client.from("vehicle_prep_items").select("id,sale_vehicle_id,status,title").eq("id", itemId).maybeSingle(), "That checklist item no longer exists.");
  const finished = status === "done" || status === "not_required";
  must(await staff.client.from("vehicle_prep_items").update({ status, completed_at: finished ? now.toISOString() : null, completed_by: finished ? staff.userId : null }).eq("id", itemId), "The checklist item could not be saved.");
  await auditStaffAction(staff, "prep_item_updated", "sale_vehicle", current.sale_vehicle_id, { itemId, status, title: current.title });
}

export async function deletePrepItem(staff: StaffContext, itemId: string) {
  assertCan(staff, "prep.manage");
  const rows = must(await staff.client.from("vehicle_prep_items").delete().eq("id", itemId).select("id,sale_vehicle_id,title"), "The checklist item could not be removed.");
  if (!rows?.length) throw new ExchangeUserError("That checklist item no longer exists.");
  await auditStaffAction(staff, "prep_item_removed", "sale_vehicle", rows[0]!.sale_vehicle_id, { itemId, title: rows[0]!.title });
}

export async function recordPreSaleInspection(staff: StaffContext, vehicleId: string, input: z.infer<typeof inspectionSchema>) {
  assertCan(staff, "prep.manage");
  mustRow(await staff.client.from("sale_vehicles").select("id").eq("id", vehicleId).is("deleted_at", null).maybeSingle(), "This vehicle no longer exists.");
  const inserted = mustRow(await staff.client.from("vehicle_inspections").insert({ sale_vehicle_id: vehicleId, kind: "pre_sale", inspected_on: input.inspectedOn, inspector_name: input.inspectorName, scope: input.scope, findings: input.findings, faults: input.faults, outcome: input.outcome, created_by: staff.userId }).select("id").single(), "The inspection could not be saved.");
  await auditStaffAction(staff, "inspection_recorded", "sale_vehicle", vehicleId, { inspectionId: inserted.id, outcome: input.outcome });
}
