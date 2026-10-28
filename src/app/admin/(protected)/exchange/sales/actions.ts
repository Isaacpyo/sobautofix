"use server";

import { z } from "zod";
import { success, type FormState } from "@/components/admin/exchange/form-state";
import { parseForm, revalidateExchangeAdmin, revalidatePublicStock, runStaffAction, uuidField } from "@/lib/exchange/admin/core";
import { cancelSale, cancelSchema, completeSale, reserveSchema, reserveVehicle, saleUpdateSchema, updateSale } from "@/lib/exchange/admin/handover";
import { salesUpdateSchema, updateSalesEnquiry } from "@/lib/exchange/admin/sales";

export async function updateSalesEnquiryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("sales.manage", formData, async (staff) => {
    const { enquiryId } = parseForm(z.object({ enquiryId: uuidField("enquiry") }), formData);
    await updateSalesEnquiry(staff, enquiryId, parseForm(salesUpdateSchema, formData));
    revalidateExchangeAdmin();
    return success("Enquiry updated.");
  });
}

const reserveTarget = z.object({ vehicleId: uuidField("vehicle"), enquiryId: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()) });

export async function reserveVehicleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("sales.manage", formData, async (staff) => {
    const target = parseForm(reserveTarget, formData);
    const result = await reserveVehicle(staff, { ...parseForm(reserveSchema, formData), vehicleId: target.vehicleId, enquiryId: target.enquiryId ?? null });
    revalidateExchangeAdmin();
    revalidatePublicStock(result.slug);
    return success("Vehicle reserved. It now shows as Reserved on the website.", { redirectTo: `/admin/exchange/handover/${result.saleId}` });
  });
}

const saleId = z.object({ saleId: uuidField("sale") });

export async function updateSaleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("sales.manage", formData, async (staff) => {
    const { saleId: id } = parseForm(saleId, formData);
    await updateSale(staff, id, parseForm(saleUpdateSchema, formData));
    revalidateExchangeAdmin();
    return success("Sale details saved.");
  });
}

export async function completeSaleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("sales.manage", formData, async (staff) => {
    const { saleId: id } = parseForm(saleId, formData);
    const { slug } = await completeSale(staff, id);
    revalidateExchangeAdmin();
    revalidatePublicStock(slug);
    return success("Sale completed. The vehicle is now marked as sold.");
  });
}

export async function cancelSaleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("sales.manage", formData, async (staff) => {
    const { saleId: id } = parseForm(saleId, formData);
    const { slug } = await cancelSale(staff, id, parseForm(cancelSchema, formData));
    revalidateExchangeAdmin();
    revalidatePublicStock(slug);
    return success("Reservation cancelled. The vehicle is available again.");
  });
}
