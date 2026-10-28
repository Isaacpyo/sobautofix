"use server";

import { z } from "zod";
import { prepStatuses } from "@/components/admin/exchange/labels";
import { success, type FormState } from "@/components/admin/exchange/form-state";
import { inspectionSchema } from "@/lib/exchange/admin/buying";
import { parseForm, revalidateExchangeAdmin, runStaffAction, uuidField } from "@/lib/exchange/admin/core";
import { addPrepItem, deletePrepItem, prepItemSchema, prepUpdateSchema, recordPreSaleInspection, setPrepItemStatus, updatePrepItem } from "@/lib/exchange/admin/prep";

export async function addPrepItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("prep.manage", formData, async (staff) => {
    const { vehicleId } = parseForm(z.object({ vehicleId: uuidField("vehicle") }), formData);
    await addPrepItem(staff, vehicleId, parseForm(prepItemSchema, formData));
    revalidateExchangeAdmin();
    return success("Checklist item added.");
  });
}

export async function updatePrepItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("prep.manage", formData, async (staff) => {
    const { itemId } = parseForm(z.object({ itemId: uuidField("item") }), formData);
    await updatePrepItem(staff, itemId, parseForm(prepUpdateSchema, formData));
    revalidateExchangeAdmin();
    return success("Checklist item saved.");
  });
}

export async function setPrepItemStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("prep.manage", formData, async (staff) => {
    const { itemId, status } = parseForm(z.object({ itemId: uuidField("item"), status: z.enum(prepStatuses) }), formData);
    await setPrepItemStatus(staff, itemId, status);
    revalidateExchangeAdmin();
    return success("Updated.");
  });
}

export async function deletePrepItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("prep.manage", formData, async (staff) => {
    const { itemId } = parseForm(z.object({ itemId: uuidField("item") }), formData);
    await deletePrepItem(staff, itemId);
    revalidateExchangeAdmin();
    return success("Checklist item removed.");
  });
}

export async function recordPreSaleInspectionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("prep.manage", formData, async (staff) => {
    const { vehicleId } = parseForm(z.object({ vehicleId: uuidField("vehicle") }), formData);
    await recordPreSaleInspection(staff, vehicleId, parseForm(inspectionSchema, formData));
    revalidateExchangeAdmin();
    return success("Inspection recorded.");
  });
}
