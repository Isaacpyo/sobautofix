import { UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { CustomerSearch } from "@/components/admin/diary/customer-search";
import { LoadFailedNotice, NotPermitted } from "@/components/admin/diary/diary-states";
import { listRecentCustomers } from "@/lib/customers/repository";
import { requireStaffPage } from "@/lib/exchange/staff";
import { searchCustomersAction } from "./actions";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const { staff, allowed } = await requireStaffPage("customers.view");
  if (!allowed) return <NotPermitted what="customer details" />;
  const { customers, failed } = await listRecentCustomers(staff.client);
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5">
      <header className="flex items-start gap-3">
        <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF2FD] text-[#1974E2] sm:grid"><UsersRound size={23} aria-hidden="true" /></span>
        <div>
          <p className="text-xs font-extrabold tracking-widest text-[#1462C4] uppercase">Operations</p>
          <h1 className="mt-1 text-3xl font-extrabold text-[#0B1220] sm:text-4xl">Customers</h1>
          <p className="mt-1 text-sm text-[#5B6575]">Everyone who has enquired, booked, sold us a car or bought one. The same person can appear more than once if they contacted us separately.</p>
        </div>
      </header>
      {failed && <LoadFailedNotice what="the customer list" />}
      <CustomerSearch recent={customers} search={searchCustomersAction} />
    </div>
  );
}
