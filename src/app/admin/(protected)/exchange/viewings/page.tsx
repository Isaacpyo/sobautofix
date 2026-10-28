import { CalendarPlus, Clock3, MessageSquareText, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DiaryEntryCard, StatusBadge, TypeBadge } from "@/components/admin/diary/diary-badges";
import { LoadFailedNotice, NotPermitted, SchemaMissingNotice } from "@/components/admin/diary/diary-states";
import { EmailFailure, ViewingRequestActions } from "@/components/admin/diary/viewing-actions";
import { groupByStartDate } from "@/lib/diary/layout";
import { customerDisplayName, relation, saleVehicleLabel } from "@/lib/diary/mapping";
import { latestViewingEmails, type ViewingEmailAudit } from "@/lib/diary/notifications";
import { appointmentSelect, loadDiaryEntries, loadStaffDirectory, staffNameMap, type AppointmentDetail } from "@/lib/diary/repository";
import { formatDateKeyLong, formatLondonDateTime, formatLondonTimeRange, londonDateKey, londonTimeKey } from "@/lib/diary/time";
import type { DiaryEntryType } from "@/lib/diary/types";
import { isMissingSchemaError } from "@/lib/exchange/schema";
import { requireStaffPage } from "@/lib/exchange/staff";
import { confirmViewingAction, declineViewingAction, proposeViewingTimeAction, retryViewingEmailAction } from "./actions";

export const metadata: Metadata = { title: "Viewings & Appointments" };

const upcomingTypes: DiaryEntryType[] = ["viewing", "purchase_inspection", "collection", "handover"];
const UPCOMING_DAYS = 30;

function emailFailureLabel(email: ViewingEmailAudit) {
  const what = email.template === "proposed" ? "suggested time" : email.template === "confirmed" ? "confirmation" : email.template === "rescheduled" ? "new time" : "cancellation";
  return `The ${what} email was not sent${email.errorCode === "email_not_configured" ? " because email is not set up here" : ""}.`;
}

export default async function ViewingsPage() {
  const { staff, allowed } = await requireStaffPage("exchange.view");
  if (!allowed) return <NotPermitted what="Viewings & Appointments" />;
  const canSales = staff.can("sales.manage");
  const canContact = staff.can("customers.view");

  const now = new Date();
  const until = new Date(now.getTime() + UPCOMING_DAYS * 86_400_000);
  const directory = await loadStaffDirectory(staff.client);
  const names = staffNameMap(directory);
  const [requestsResult, upcoming] = await Promise.all([
    staff.client.from("diary_appointments").select(appointmentSelect).is("deleted_at", null).eq("kind", "viewing").eq("status", "requested").order("starts_at").limit(100),
    loadDiaryEntries(staff.client, now.toISOString(), until.toISOString(), staff.role, names),
  ]);
  if (isMissingSchemaError(requestsResult.error)) return <SchemaMissingNotice />;
  const requests = ((requestsResult.data || []) as unknown as AppointmentDetail[]).map((row) => ({
    ...row,
    customers: relation(row.customers as AppointmentDetail["customers"] | Array<NonNullable<AppointmentDetail["customers"]>>),
    sale_vehicles: relation(row.sale_vehicles as AppointmentDetail["sale_vehicles"] | Array<NonNullable<AppointmentDetail["sale_vehicles"]>>),
  }));
  const scheduled = upcoming.entries.filter((entry) => upcomingTypes.includes(entry.type) && entry.status === "confirmed");
  const emails = canSales ? await latestViewingEmails(staff.client, [...requests.map((row) => row.id), ...scheduled.filter((entry) => entry.type === "viewing").map((entry) => entry.id)]) : new Map<string, ViewingEmailAudit>();
  const groups = groupByStartDate(scheduled);

  return (
    <div className="grid grid-cols-1 gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0B1220]">Viewings &amp; Appointments</h2>
          <p className="mt-1 text-sm text-[#5B6575]">Viewing requests from the website first, then everything booked for the next {UPCOMING_DAYS} days. Times are UK time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/diary/new?kind=viewing" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1974E2] px-4 text-sm font-bold text-white hover:bg-[#1462C4] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]"><CalendarPlus size={17} aria-hidden="true" /> Book a viewing</Link>
          <Link href="/admin/diary" className="inline-flex min-h-11 items-center rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm font-bold text-[#0B1220] hover:border-[#1974E2] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(22,139,255,.55)]">Open the diary</Link>
        </div>
      </div>

      {(upcoming.failed || requestsResult.error) && <LoadFailedNotice what="the appointments" />}

      <section aria-labelledby="requests-heading" className="grid grid-cols-1 gap-3">
        <h3 id="requests-heading" className="flex items-center gap-2 text-lg font-extrabold text-[#0B1220]">
          Viewing requests <span className="rounded-full bg-[#FFFAEB] px-2.5 py-0.5 text-sm font-bold text-[#93370D] ring-1 ring-[#FEDF89]">{requests.length}</span>
        </h3>
        {!requests.length && <p className="rounded-2xl border border-dashed border-[#D0D5DD] bg-white px-4 py-5 text-sm text-[#5B6575]">No viewing requests are waiting. New requests from the website appear here.</p>}
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {requests.map((request) => {
            const customer = request.customers;
            const past = Date.parse(request.starts_at) < now.getTime();
            const email = emails.get(request.id);
            return (
              <li key={request.id}>
                <article className="grid grid-cols-1 h-full gap-3 rounded-2xl border border-[#FEDF89] bg-white p-4 sm:p-5" aria-labelledby={`request-${request.id}`}>
                  <div className="flex flex-wrap items-center gap-2"><TypeBadge type="viewing" /><StatusBadge status="requested" label="Requested" /></div>
                  <div>
                    <h4 id={`request-${request.id}`} className="text-lg font-extrabold text-[#0B1220]"><Link href={`/admin/diary/${request.id}`} className="hover:underline">{saleVehicleLabel(request.sale_vehicles) ?? request.title}</Link></h4>
                    <p className="mt-1 flex items-center gap-2 font-semibold text-[#0B1220]"><Clock3 size={16} className="text-[#5B6575]" aria-hidden="true" /> {formatDateKeyLong(londonDateKey(request.starts_at))}, {formatLondonTimeRange(request.starts_at, request.ends_at)}</p>
                    {past && <p className="mt-1 text-sm font-bold text-[#B42318]">This time has passed. Propose another time or decline.</p>}
                    {canSales && request.alternative_start && <p className="mt-1 text-sm text-[#344054]">Alternative offered: {formatLondonDateTime(request.alternative_start)}</p>}
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-sm text-[#344054]">
                    <p><span className="font-semibold text-[#0B1220]">{customerDisplayName(customer) ?? "Customer"}</span>{request.assigned_to ? ` · with ${names.get(request.assigned_to) ?? "former staff"}` : ""}</p>
                    {canContact && customer?.phone && !customer.anonymised_at && <a href={`tel:${customer.phone.replace(/\s+/g, "")}`} className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold text-[#1462C4] hover:underline"><Phone size={15} aria-hidden="true" /> {customer.phone}</a>}
                    {canContact && !customer?.email && <p className="text-[#93370D]">No email address: call to confirm.</p>}
                    {canSales && request.customer_message && <p className="flex gap-2 rounded-xl bg-[#F8FAFC] p-2.5"><MessageSquareText size={16} className="mt-0.5 shrink-0 text-[#5B6575]" aria-hidden="true" /><span>{request.customer_message}</span></p>}
                  </div>
                  {email?.status === "failed" && <EmailFailure id={request.id} label={emailFailureLabel(email)} retry={retryViewingEmailAction} />}
                  {email?.status === "sent" && email.template === "proposed" && <p className="text-sm text-[#344054]">Suggested this time to the customer on {formatLondonDateTime(email.createdAt)}. Confirm once they agree.</p>}
                  {canSales ? (
                    <ViewingRequestActions id={request.id} defaultDate={londonDateKey(request.starts_at)} defaultTime={londonTimeKey(request.starts_at)} confirm={confirmViewingAction} propose={proposeViewingTimeAction} decline={declineViewingAction} compact />
                  ) : (
                    <p className="text-sm font-semibold text-[#93370D]">A member of the sales team confirms viewing requests.</p>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="upcoming-heading" className="grid grid-cols-1 gap-3">
        <h3 id="upcoming-heading" className="text-lg font-extrabold text-[#0B1220]">Booked: viewings, inspections, collections and handovers</h3>
        {!scheduled.length && <p className="rounded-2xl border border-dashed border-[#D0D5DD] bg-white px-4 py-5 text-sm text-[#5B6575]">Nothing confirmed in the next {UPCOMING_DAYS} days.</p>}
        <ol className="grid grid-cols-1 gap-5">
          {[...groups.entries()].map(([date, entries]) => (
            <li key={date} aria-labelledby={`day-${date}`}>
              <h4 id={`day-${date}`} className="text-sm font-extrabold text-[#344054]">{formatDateKeyLong(date)}</h4>
              <ul className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {entries.map((entry) => {
                  const email = emails.get(entry.id);
                  return (
                    <li key={entry.key} className="grid grid-cols-1 gap-2">
                      <DiaryEntryCard entry={entry} />
                      {email?.status === "failed" && <EmailFailure id={entry.id} label={emailFailureLabel(email)} retry={retryViewingEmailAction} />}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
