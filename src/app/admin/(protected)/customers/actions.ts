"use server";

import { searchCustomers, type CustomerSummary } from "@/lib/customers/repository";
import { requireStaffAction, StaffPermissionError } from "@/lib/exchange/staff";

/** Customer search. The query travels in the POST body so names, emails and phone numbers never appear in a URL. */
export async function searchCustomersAction(query: string): Promise<{ ok: boolean; customers: CustomerSummary[]; message?: string }> {
  if (typeof query !== "string") return { ok: false, customers: [], message: "Enter a name, email or phone number." };
  try {
    const staff = await requireStaffAction("customers.view");
    return { ok: true, customers: await searchCustomers(staff.client, query.slice(0, 100)) };
  } catch (error) {
    if (error instanceof StaffPermissionError) return { ok: false, customers: [], message: error.message };
    throw error;
  }
}
