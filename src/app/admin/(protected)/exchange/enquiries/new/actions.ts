"use server";

import { success, type FormState } from "@/components/admin/exchange/form-state";
import { parseForm, revalidateExchangeAdmin, runStaffAction } from "@/lib/exchange/admin/core";
import { createStaffBuyingEnquiry, createStaffSalesEnquiry, staffBuyingEnquirySchema, staffSalesEnquirySchema } from "@/lib/exchange/admin/enquiries-admin";

export async function createStaffSalesEnquiryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction(["sales.manage", "customers.view"], formData, async (staff) => {
    const id = await createStaffSalesEnquiry(staff, parseForm(staffSalesEnquirySchema, formData));
    revalidateExchangeAdmin();
    return success("Sales enquiry created.", { redirectTo: `/admin/exchange/sales/${id}` });
  });
}

export async function createStaffBuyingEnquiryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction(["buying.manage", "customers.view"], formData, async (staff) => {
    const id = await createStaffBuyingEnquiry(staff, parseForm(staffBuyingEnquirySchema, formData));
    revalidateExchangeAdmin();
    return success("Buying enquiry created.", { redirectTo: `/admin/exchange/buying/${id}` });
  });
}
