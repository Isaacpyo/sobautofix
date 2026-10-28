"use server";

import { z } from "zod";
import { success, type FormState } from "@/components/admin/exchange/form-state";
import { ExchangeUserError, optionalText, parseForm, revalidateExchangeAdmin, revalidatePublicStock, runStaffAction, toFormFailure, uuidField } from "@/lib/exchange/admin/core";
import { deleteDocument } from "@/lib/exchange/admin/documents";
import {
  addCost,
  changeStockStatus,
  conditionSchema,
  costSchema,
  createStockDraft,
  deleteCost,
  deletePhoto,
  draftSchema,
  internalSchema,
  listingSchema,
  movePhoto,
  saleStatusSchema,
  saveCondition,
  saveInternalRecord,
  saveListing,
  updateCost,
  updatePhotoAlt,
} from "@/lib/exchange/admin/stock";
import { requireStaffAction } from "@/lib/exchange/staff";
import { unstable_rethrow } from "next/navigation";

export type NewStockDraftState = { status: "idle" | "error" | "saved"; message: string; vehicleId?: string };

/** Used by the registration lookup flow. Always creates a Draft. */
export async function createStockDraftAction(_previous: NewStockDraftState, formData: FormData): Promise<NewStockDraftState> {
  try {
    const staff = await requireStaffAction("stock.edit");
    const input = parseForm(draftSchema, formData);
    const created = await createStockDraft(staff, input, { source: "registration_lookup" });
    revalidateExchangeAdmin();
    return { status: "saved", message: "Draft created. Add photos and disclosures next.", vehicleId: created.id };
  } catch (error) {
    unstable_rethrow(error);
    const failure = toFormFailure(error, formData);
    const firstField = failure.fieldErrors ? Object.values(failure.fieldErrors)[0] : undefined;
    return { status: "error", message: firstField ? `${failure.message} ${firstField}` : failure.message };
  }
}

const idOnly = z.object({ vehicleId: uuidField("vehicle") });

export async function saveListingAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("stock.edit", formData, async (staff) => {
    const { vehicleId } = parseForm(idOnly, formData);
    const { slug } = await saveListing(staff, vehicleId, parseForm(listingSchema, formData));
    revalidateExchangeAdmin();
    revalidatePublicStock(slug);
    return success("Listing saved.");
  });
}

export async function saveConditionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("stock.edit", formData, async (staff) => {
    const { vehicleId } = parseForm(idOnly, formData);
    const { slug } = await saveCondition(staff, vehicleId, parseForm(conditionSchema, formData));
    revalidateExchangeAdmin();
    revalidatePublicStock(slug);
    return success("Condition and disclosures saved.");
  });
}

const statusForm = z.object({ vehicleId: uuidField("vehicle"), status: saleStatusSchema, reason: optionalText("reason", 300) });

export async function changeStockStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  // The service checks the exact permission for the transition (edit vs publish).
  return runStaffAction("exchange.view", formData, async (staff) => {
    const input = parseForm(statusForm, formData);
    const result = await changeStockStatus(staff, input.vehicleId, input.status, { reason: input.reason, source: "stock_editor" });
    revalidateExchangeAdmin();
    revalidatePublicStock(result.slug);
    return success(`Status changed to ${result.label}.`);
  });
}

export async function saveInternalAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction(["finance.view", "finance.edit"], formData, async (staff) => {
    const { vehicleId } = parseForm(idOnly, formData);
    await saveInternalRecord(staff, vehicleId, parseForm(internalSchema, formData));
    revalidateExchangeAdmin();
    return success("Internal record saved.");
  });
}

const costForm = z.object({ vehicleId: uuidField("vehicle"), costId: z.string().uuid().optional() });

export async function saveCostAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction(["finance.view", "finance.edit"], formData, async (staff) => {
    const { vehicleId, costId } = parseForm(costForm, formData);
    const input = parseForm(costSchema, formData);
    if (costId) await updateCost(staff, vehicleId, costId, input);
    else await addCost(staff, vehicleId, input);
    revalidateExchangeAdmin();
    return success(costId ? "Cost updated." : "Cost added.");
  });
}

export async function deleteCostAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction(["finance.view", "finance.edit"], formData, async (staff) => {
    const { vehicleId, costId } = parseForm(costForm, formData);
    if (!costId) throw new ExchangeUserError("Choose a cost line to remove.");
    await deleteCost(staff, vehicleId, costId);
    revalidateExchangeAdmin();
    return success("Cost removed.");
  });
}

const photoForm = z.object({ vehicleId: uuidField("vehicle"), photoId: uuidField("photo") });

export async function updatePhotoAltAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("stock.edit", formData, async (staff) => {
    const { vehicleId, photoId } = parseForm(photoForm, formData);
    const { alt } = parseForm(z.object({ alt: z.string().trim().min(5, "Describe the photo in at least 5 characters.").max(180, "Keep the description under 180 characters.") }), formData);
    await updatePhotoAlt(staff, vehicleId, photoId, alt);
    revalidateExchangeAdmin();
    revalidatePublicStock();
    return success("Description saved.");
  });
}

export async function movePhotoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("stock.edit", formData, async (staff) => {
    const { vehicleId, photoId } = parseForm(photoForm, formData);
    const { move } = parseForm(z.object({ move: z.enum(["up", "down", "cover"]) }), formData);
    await movePhoto(staff, vehicleId, photoId, move);
    revalidateExchangeAdmin();
    revalidatePublicStock();
    return success(move === "cover" ? "Cover photo set." : "Photo moved.");
  });
}

export async function deletePhotoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("stock.edit", formData, async (staff) => {
    const { vehicleId, photoId } = parseForm(photoForm, formData);
    const { slug } = await deletePhoto(staff, vehicleId, photoId);
    revalidateExchangeAdmin();
    revalidatePublicStock(slug);
    return success("Photo deleted.");
  });
}

export async function deleteDocumentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("prep.manage", formData, async (staff) => {
    const { documentId } = parseForm(z.object({ documentId: uuidField("document") }), formData);
    await deleteDocument(staff, documentId);
    revalidateExchangeAdmin();
    return success("Document deleted.");
  });
}
