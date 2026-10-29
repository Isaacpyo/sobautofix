import { NoAccess, Notice } from "@/components/admin/exchange/ui";
import { ExchangeSubtabNav, type ExchangeTab } from "@/components/admin/exchange/subtab-nav";
import { ToastRegion } from "@/components/admin/exchange/toast";
import { isMissingSchemaError, SCHEMA_MISSING_MESSAGE } from "@/lib/exchange/schema";
import { requireStaffPage } from "@/lib/exchange/staff";

export default async function ExchangeAdminLayout({ children }: { children: React.ReactNode }) {
  const { staff, allowed } = await requireStaffPage("exchange.view");
  const tabs: ExchangeTab[] = [
    { href: "/admin/exchange", label: "Overview" },
    { href: "/admin/exchange/stock", label: "Vehicle Stock" },
    { href: "/admin/exchange/buying", label: "Buying Enquiries" },
    { href: "/admin/exchange/sales", label: "Sales Enquiries" },
    { href: "/admin/exchange/viewings", label: "Viewings & Appointments" },
    { href: "/admin/exchange/preparation", label: "Preparation & Inspections" },
    { href: "/admin/exchange/handover", label: "Sales & Handover" },
  ];
  // Owner and manager pages sit under the More tab so the row fits a laptop.
  const moreTabs: ExchangeTab[] = [
    ...(staff.can("finance.view") ? [{ href: "/admin/exchange/reports", label: "Costs & Reporting" }] : []),
    ...(staff.can("settings.manage") ? [{ href: "/admin/exchange/settings", label: "Settings" }] : []),
  ];
  const schema = allowed ? await staff.client.from("vehicle_sales").select("id", { head: true, count: "exact" }).limit(1) : null;
  const schemaMissing = Boolean(schema && isMissingSchemaError(schema.error));

  return <div className="pb-24 lg:pb-0">
    <header>
      <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">SOB Auto Exchange</p>
      <h1 className="mt-1 text-3xl font-extrabold text-[#071127] sm:text-4xl">Vehicle Buying &amp; Selling</h1>
    </header>
    {allowed && <ExchangeSubtabNav tabs={tabs} moreTabs={moreTabs} />}
    <div className="mt-6">
      {!allowed ? <NoAccess area="Vehicle Buying & Selling" /> : schemaMissing ? <Notice title="Database update needed">{SCHEMA_MISSING_MESSAGE}</Notice> : children}
    </div>
    <ToastRegion />
  </div>;
}
