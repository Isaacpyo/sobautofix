"use server";

import { z } from "zod";
import { success, type FormState } from "@/components/admin/exchange/form-state";
import {
  acceptOffer,
  assignSubmission,
  closeSubmission,
  createStockFromPurchase,
  declineSchema,
  inspectionSchema,
  markPurchased,
  moveSubmission,
  offerSchema,
  purchaseSchema,
  recordOffer,
  recordPurchaseInspection,
  stockFromPurchaseSchema,
} from "@/lib/exchange/admin/buying";
import { parseForm, revalidateExchangeAdmin, runStaffAction, uuidField } from "@/lib/exchange/admin/core";

const idForm = z.object({ submissionId: uuidField("enquiry") });

export async function moveSubmissionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("buying.manage", formData, async (staff) => {
    const { submissionId, to } = parseForm(idForm.extend({ to: z.enum(["reviewing", "inspection"]) }), formData);
    await moveSubmission(staff, submissionId, to);
    revalidateExchangeAdmin();
    return success(to === "reviewing" ? "Marked as reviewing." : "Moved to inspection.");
  });
}

export async function assignSubmissionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("buying.manage", formData, async (staff) => {
    const { submissionId, assignedTo } = parseForm(idForm.extend({ assignedTo: z.string().uuid().or(z.literal("")).transform((value) => value || null) }), formData);
    await assignSubmission(staff, submissionId, assignedTo);
    revalidateExchangeAdmin();
    return success(assignedTo ? "Assigned." : "Unassigned.");
  });
}

export async function recordOfferAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("buying.manage", formData, async (staff) => {
    const { submissionId, stage } = parseForm(idForm.extend({ stage: z.enum(["provisional", "final"]) }), formData);
    await recordOffer(staff, submissionId, stage, parseForm(offerSchema, formData));
    revalidateExchangeAdmin();
    return success(stage === "final" ? "Final offer recorded. Tell the seller using the conversation." : "Provisional offer recorded. Tell the seller using the conversation.");
  });
}

export async function acceptOfferAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("buying.manage", formData, async (staff) => {
    const { submissionId } = parseForm(idForm, formData);
    await acceptOffer(staff, submissionId);
    revalidateExchangeAdmin();
    return success("Offer marked as accepted.");
  });
}

export async function recordPurchaseInspectionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("buying.manage", formData, async (staff) => {
    const { submissionId } = parseForm(idForm, formData);
    await recordPurchaseInspection(staff, submissionId, parseForm(inspectionSchema, formData));
    revalidateExchangeAdmin();
    return success("Inspection findings recorded.");
  });
}

export async function markPurchasedAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction(["buying.manage", "finance.edit"], formData, async (staff) => {
    const { submissionId } = parseForm(idForm, formData);
    await markPurchased(staff, submissionId, parseForm(purchaseSchema, formData));
    revalidateExchangeAdmin();
    return success("Marked as purchased. Create the stock draft next.");
  });
}

export async function closeSubmissionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("buying.manage", formData, async (staff) => {
    const { submissionId, outcome } = parseForm(idForm.extend({ outcome: z.enum(["declined", "closed"]) }), formData);
    const reason = outcome === "declined" ? parseForm(declineSchema, formData).reason : null;
    await closeSubmission(staff, submissionId, outcome, reason);
    revalidateExchangeAdmin();
    return success(outcome === "declined" ? "Marked as declined." : "Enquiry closed.");
  });
}

export async function createStockFromPurchaseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction(["stock.edit", "finance.edit"], formData, async (staff) => {
    const { submissionId } = parseForm(idForm, formData);
    const created = await createStockFromPurchase(staff, submissionId, parseForm(stockFromPurchaseSchema, formData));
    revalidateExchangeAdmin();
    return success("Stock draft created.", { redirectTo: `/admin/exchange/stock/${created.id}` });
  });
}
