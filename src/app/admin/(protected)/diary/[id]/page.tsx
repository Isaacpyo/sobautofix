import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignBookingStaff, CancelAppointment } from "@/components/admin/diary/appointment-actions";
import { AppointmentForm, type AppointmentFormValues } from "@/components/admin/diary/appointment-form";
import { StatusBadge, TypeBadge } from "@/components/admin/diary/diary-badges";
import { NotPermitted, SchemaMissingNotice } from "@/components/admin/diary/diary-states";
import { EmailFailure, ViewingRequestActions } from "@/components/admin/diary/viewing-actions";
import { appointmentLinks, canSeeNotes, customerDisplayName, mapBooking, saleVehicleLabel, workshopVehicleLabel } from "@/lib/diary/mapping";
import { latestViewingEmails } from "@/lib/diary/notifications";
import { canUseLink, getAppointment, getBookingForDiary, linkKinds, loadStaffDirectory, resolveLinks, staffNameMap, type AppointmentDetail, type BookingDetail, type LinkKind, type StaffMember } from "@/lib/diary/repository";
import { editableStatuses } from "@/lib/diary/schema";
import { formatDateKeyLong, formatLondonDateTime, formatLondonTimeRange, londonDateKey, londonTimeKey } from "@/lib/diary/time";
import { appointmentStatusLabels, isAppointmentKind, isAppointmentStatus, type AppointmentKind } from "@/lib/diary/types";
import { getExchangePrivateSettings } from "@/lib/exchange/settings";
import { requireStaffPage, type StaffContext } from "@/lib/exchange/staff";
import { assignBookingStaffAction, cancelAppointmentAction, saveAppointmentAction, searchDiaryLinksAction } from "../actions";
import { confirmViewingAction, declineViewingAction, proposeViewingTimeAction, retryViewingEmailAction } from "../../exchange/viewings/actions";

export const metadata: Metadata = { title: "Diary appointment" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const savedMessages: Record<string, string> = {
  created: "Appointment saved.",
  updated: "Changes saved.",
  cancelled: "Appointment cancelled.",
  confirmed: "Viewing confirmed.",
  proposed: "New time suggested. Confirm the viewing once the customer agrees.",
  declined: "Viewing request declined.",
};

const emailMessages: Record<string, { text: string; tone: "ok" | "warn" }> = {
  sent: { text: "The customer has been emailed.", tone: "ok" },
  failed: { text: "The email to the customer failed. Use Retry email below.", tone: "warn" },
  skipped: { text: "No email was sent because the customer did not give an email address.", tone: "warn" },
};

export default async function DiaryEntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { staff, allowed } = await requireStaffPage("diary.manage");
  if (!allowed) return <NotPermitted what="the diary" />;
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const query = await searchParams;
  const saved = typeof query.saved === "string" ? savedMessages[query.saved] : undefined;
  const email = typeof query.email === "string" ? emailMessages[query.email] : undefined;

  const [{ appointment, schemaMissing }, directory] = await Promise.all([getAppointment(staff.client, id), loadStaffDirectory(staff.client)]);
  if (appointment) return <AppointmentPage staff={staff} appointment={appointment} directory={directory} saved={saved} email={email} />;
  const { booking, schemaMissing: bookingSchemaMissing } = await getBookingForDiary(staff.client, id);
  if (booking) return <BookingPage staff={staff} booking={booking} directory={directory} schemaMissing={bookingSchemaMissing} />;
  if (schemaMissing) return <SchemaMissingNotice />;
  notFound();
}

function Banner({ saved, email }: { saved?: string; email?: { text: string; tone: "ok" | "warn" } }) {
  if (!saved && !email) return null;
  return (
    <div role="status" className="rounded-2xl border border-[#ABEFC6] bg-[#ECFDF3] p-4 text-sm font-semibold text-[#067647]">
      {saved}
      {email && <span className={email.tone === "ok" ? "block" : "mt-1 block text-[#93370D]"}>{email.text}</span>}
    </div>
  );
}

function BackLink({ date }: { date: string }) {
  return <Link href={`/admin/diary?date=${date}`} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm font-bold text-[#1462C4] hover:underline"><ArrowLeft size={17} aria-hidden="true" /> Back to the diary</Link>;
}

function Contact({ customer, canView }: { customer: { name: string | null; email?: string | null; phone?: string | null; anonymised_at?: string | null } | null; canView: boolean }) {
  const name = customerDisplayName(customer);
  if (!customer || !name) return <p className="text-[#5B6575]">No customer linked</p>;
  if (customer.anonymised_at) return <p className="font-semibold text-[#0B1220]">Anonymised</p>;
  return (
    <div className="grid grid-cols-1 gap-1">
      <p className="font-semibold text-[#0B1220]">{name}</p>
      {canView ? (
        <>
          {customer.phone && <a href={`tel:${customer.phone.replace(/\s+/g, "")}`} className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold text-[#1462C4] hover:underline"><Phone size={16} aria-hidden="true" /> {customer.phone}</a>}
          {customer.email && <a href={`mailto:${customer.email}`} className="inline-flex min-h-11 w-fit items-center gap-2 break-all font-semibold text-[#1462C4] hover:underline"><Mail size={16} aria-hidden="true" /> {customer.email}</a>}
        </>
      ) : (
        <p className="text-sm text-[#5B6575]">Contact details are visible to sales and management roles.</p>
      )}
    </div>
  );
}

async function AppointmentPage({ staff, appointment, directory, saved, email }: { staff: StaffContext; appointment: AppointmentDetail; directory: StaffMember[]; saved?: string; email?: { text: string; tone: "ok" | "warn" } }) {
  const kind: AppointmentKind = isAppointmentKind(appointment.kind) ? appointment.kind : "other";
  const status = isAppointmentStatus(appointment.status) ? appointment.status : "confirmed";
  const date = londonDateKey(appointment.starts_at);
  const names = staffNameMap(directory);
  const canSales = staff.can("sales.manage");
  const isViewing = kind === "viewing";
  const customer = appointment.customers;
  const customerHasEmail = Boolean(customer?.email && !customer.anonymised_at);

  const [links, emails, settings, history] = await Promise.all([
    resolveLinks(staff.client, { vehicle: appointment.sale_vehicle_id, customer: appointment.customer_id, enquiry: appointment.enquiry_id, submission: appointment.seller_submission_id, sale: appointment.vehicle_sale_id }),
    latestViewingEmails(staff.client, [appointment.id]),
    getExchangePrivateSettings(),
    staff.client.from("admin_audit_log").select("id,action,detail,created_at").eq("entity_type", "diary_appointment").eq("entity_id", appointment.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const latestEmail = emails.get(appointment.id);
  const related = appointmentLinks(appointment, staff.role);
  const initial: AppointmentFormValues = {
    id: appointment.id,
    kind,
    status: (editableStatuses as readonly string[]).includes(status) ? (status as AppointmentFormValues["status"]) : "confirmed",
    title: appointment.title,
    date,
    startTime: londonTimeKey(appointment.starts_at),
    endTime: londonTimeKey(appointment.ends_at),
    location: appointment.location ?? "",
    assignedTo: appointment.assigned_to ?? "",
    notes: canSeeNotes(staff.role, kind) ? appointment.notes ?? "" : "",
    links: { vehicle: links.vehicle ?? null, customer: links.customer ?? null, enquiry: links.enquiry ?? null, submission: links.submission ?? null, sale: links.sale ?? null },
    updatedAt: appointment.updated_at,
  };

  return (
    <div className="mx-auto grid grid-cols-1 max-w-3xl gap-5">
      <BackLink date={date} />
      <header className="grid grid-cols-1 gap-2">
        <div className="flex flex-wrap items-center gap-2"><TypeBadge type={kind} /><StatusBadge status={status} label={appointmentStatusLabels[status]} /></div>
        <h1 className="text-2xl font-extrabold text-[#0B1220] sm:text-3xl">{appointment.title}</h1>
        <p className="text-[#344054]"><time dateTime={appointment.starts_at}>{formatDateKeyLong(date)}, {formatLondonTimeRange(appointment.starts_at, appointment.ends_at)}</time> (UK time)</p>
        <p className="text-sm text-[#5B6575]">{appointment.assigned_to ? `With ${names.get(appointment.assigned_to) ?? "a former staff member"}` : "No staff member assigned"}{appointment.location ? ` · ${appointment.location}` : ""}</p>
      </header>

      <Banner saved={saved} email={email} />

      {status === "cancelled" && (
        <div className="rounded-2xl border border-[#FECDCA] bg-[#FEF3F2] p-4 text-sm text-[#B42318]">
          <p className="font-extrabold">Cancelled{appointment.cancelled_at ? ` on ${formatLondonDateTime(appointment.cancelled_at)}` : ""}</p>
          {appointment.cancellation_reason && <p className="mt-1 text-[#344054]">Reason: {appointment.cancellation_reason}</p>}
        </div>
      )}

      {appointment.conflict_override_reason && (
        <div className="rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] p-4 text-sm text-[#7A2E0E]">
          <p className="font-extrabold">Saved despite a warning</p>
          <p className="mt-1 text-[#344054]">Reason: {appointment.conflict_override_reason}</p>
          <p className="mt-0.5 text-[#5B6575]">{[appointment.conflict_override_by ? names.get(appointment.conflict_override_by) ?? "A former staff member" : null, appointment.conflict_override_at ? formatLondonDateTime(appointment.conflict_override_at) : null].filter(Boolean).join(", ")}</p>
        </div>
      )}

      {isViewing && canSales && latestEmail?.status === "failed" && (
        <EmailFailure id={appointment.id} label={`The ${latestEmail.template === "proposed" ? "suggested time" : latestEmail.template} email to the customer was not sent${latestEmail.errorCode === "email_not_configured" ? " because email is not set up here" : ""}.`} retry={retryViewingEmailAction} />
      )}

      {isViewing && status === "requested" && (
        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] p-4 sm:p-5" aria-labelledby="request-heading">
          <h2 id="request-heading" className="text-lg font-extrabold text-[#0B1220]">Viewing request</h2>
          <p className="text-sm text-[#344054]">The customer asked for this time. They have been told it is a request until you confirm it.</p>
          {canSales && appointment.alternative_start && <p className="text-sm text-[#344054]"><strong>Alternative they offered:</strong> {formatLondonDateTime(appointment.alternative_start)}</p>}
          {canSales && appointment.customer_message && <p className="text-sm text-[#344054]"><strong>Their message:</strong> {appointment.customer_message}</p>}
          {canSales ? (
            <ViewingRequestActions id={appointment.id} returnTo="diary" updatedAt={appointment.updated_at} defaultDate={date} defaultTime={londonTimeKey(appointment.starts_at)} confirm={confirmViewingAction} propose={proposeViewingTimeAction} decline={declineViewingAction} />
          ) : (
            <p className="text-sm font-semibold text-[#93370D]">A member of the sales team confirms viewing requests.</p>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-[#E3E8EF] bg-white p-4 sm:grid-cols-2 sm:p-5" aria-label="Customer and vehicle">
        <div>
          <h2 className="mb-1 text-xs font-extrabold tracking-wide text-[#5B6575] uppercase">Customer</h2>
          <Contact customer={customer} canView={staff.can("customers.view")} />
        </div>
        <div>
          <h2 className="mb-1 text-xs font-extrabold tracking-wide text-[#5B6575] uppercase">Vehicle</h2>
          <p className={appointment.sale_vehicles ? "font-semibold text-[#0B1220]" : "text-[#5B6575]"}>{saleVehicleLabel(appointment.sale_vehicles) ?? "No vehicle linked"}</p>
        </div>
        {related.length > 0 && (
          <div className="sm:col-span-2">
            <h2 className="mb-1 text-xs font-extrabold tracking-wide text-[#5B6575] uppercase">Open related records</h2>
            <ul className="flex flex-wrap gap-2">
              {related.map((link) => <li key={link.href}><Link href={link.href} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#BCD6F6] px-3 text-sm font-bold text-[#1462C4] hover:bg-[#F5F9FF]">{link.label} <ExternalLink size={14} aria-hidden="true" /></Link></li>)}
            </ul>
          </div>
        )}
      </section>

      {status !== "cancelled" && (
        <>
          <h2 className="mt-2 text-xl font-extrabold text-[#0B1220]">Edit or reschedule</h2>
          <AppointmentForm
            initial={initial}
            staff={directory.map((member) => ({ id: member.id, name: member.name }))}
            permissions={{ links: Object.fromEntries(linkKinds.map((link) => [link, canUseLink(staff.role, link)])) as Record<LinkKind, boolean>, notes: canSeeNotes(staff.role, kind) }}
            customerHasEmail={customerHasEmail && canSales}
            defaultLengthMinutes={kind === "viewing" ? settings.viewingLengthMinutes : 60}
            action={saveAppointmentAction}
            search={searchDiaryLinksAction}
            cancelHref={`/admin/diary?date=${date}`}
          />
          <CancelAppointment id={appointment.id} updatedAt={appointment.updated_at} isViewing={isViewing} customerHasEmail={customerHasEmail && canSales} action={cancelAppointmentAction} />
        </>
      )}

      <section className="rounded-2xl border border-[#E3E8EF] bg-white p-4 sm:p-5" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-extrabold text-[#0B1220]">History</h2>
        <ol className="mt-3 grid grid-cols-1 gap-2 text-sm">
          <li className="text-[#344054]">Created {formatLondonDateTime(appointment.created_at)}</li>
          {((history.data || []) as Array<{ id: number; action: string; detail: Record<string, unknown> | null; created_at: string }>).map((entry) => (
            <li key={entry.id} className="text-[#344054]"><span className="font-semibold text-[#0B1220]">{historyLabel(entry.action, entry.detail)}</span> · {formatLondonDateTime(entry.created_at)}{typeof entry.detail?.actorName === "string" ? ` · ${entry.detail.actorName}` : ""}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function historyLabel(action: string, detail: Record<string, unknown> | null) {
  const labels: Record<string, string> = {
    "diary.appointment_created": "Created in the diary",
    "diary.appointment_updated": "Details changed",
    "diary.appointment_rescheduled": "Rescheduled",
    "diary.appointment_assigned": "Staff member changed",
    "diary.appointment_cancelled": "Cancelled",
    "diary.viewing_confirmed": "Viewing confirmed",
    "diary.viewing_proposed": "New time suggested to the customer",
    "diary.viewing_declined": "Viewing request declined",
    "diary.appointment_status_changed": `Status changed to ${String(detail?.status ?? "").replace("_", " ")}`,
  };
  const override = typeof detail?.conflictOverride === "string" ? ` (warning overridden: ${detail.conflictOverride})` : "";
  if (labels[action]) return `${labels[action]}${override}`;
  if (action === "diary.customer_email") return `Customer email (${String(detail?.template ?? "update")}): ${detail?.status === "sent" ? "sent" : "not sent"}`;
  return labels[action] ?? action;
}

function BookingPage({ staff, booking, directory, schemaMissing }: { staff: StaffContext; booking: BookingDetail; directory: StaffMember[]; schemaMissing: boolean }) {
  const entry = mapBooking(booking, { role: staff.role, staffNames: staffNameMap(directory) });
  const date = londonDateKey(booking.appointment_start);
  const canNotes = canSeeNotes(staff.role, "workshop_booking");
  return (
    <div className="mx-auto grid grid-cols-1 max-w-3xl gap-5">
      <BackLink date={date} />
      <header className="grid grid-cols-1 gap-2">
        <div className="flex flex-wrap items-center gap-2"><TypeBadge type="workshop_booking" /><StatusBadge status={entry.status} label={entry.statusLabel} /><span className="font-mono text-sm font-bold text-[#1462C4]">{booking.booking_reference}</span></div>
        <h1 className="text-2xl font-extrabold text-[#0B1220] sm:text-3xl">{booking.service_name}</h1>
        <p className="text-[#344054]"><time dateTime={booking.appointment_start}>{formatDateKeyLong(date)}, {formatLondonTimeRange(entry.start, entry.end)}</time> (UK time){booking.appointment_end ? "" : " · end time not recorded, shown as one hour"}</p>
      </header>

      {schemaMissing && <SchemaMissingNotice />}

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-[#E3E8EF] bg-white p-4 sm:grid-cols-2 sm:p-5" aria-label="Booking details">
        <div>
          <h2 className="mb-1 text-xs font-extrabold tracking-wide text-[#5B6575] uppercase">Customer</h2>
          <Contact customer={booking.customers} canView={staff.can("customers.view")} />
        </div>
        <div>
          <h2 className="mb-1 text-xs font-extrabold tracking-wide text-[#5B6575] uppercase">Vehicle</h2>
          <p className="font-semibold text-[#0B1220]">{workshopVehicleLabel(booking.vehicles && !Array.isArray(booking.vehicles) ? booking.vehicles : null) ?? "Not recorded"}</p>
        </div>
        <div>
          <h2 className="mb-1 text-xs font-extrabold tracking-wide text-[#5B6575] uppercase">Location</h2>
          <p className="text-[#0B1220]">{entry.location ?? "Workshop"}</p>
        </div>
        {booking.problem_description && (
          <div className="sm:col-span-2">
            <h2 className="mb-1 text-xs font-extrabold tracking-wide text-[#5B6575] uppercase">What the customer told us</h2>
            <p className="whitespace-pre-line text-[#0B1220]">{booking.problem_description}</p>
          </div>
        )}
        {canNotes && booking.notes && (
          <div className="sm:col-span-2">
            <h2 className="mb-1 text-xs font-extrabold tracking-wide text-[#5B6575] uppercase">Booking notes</h2>
            <p className="whitespace-pre-line text-[#0B1220]">{booking.notes}</p>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-[#E3E8EF] bg-white p-4 sm:p-5" aria-labelledby="assign-heading">
        <h2 id="assign-heading" className="text-lg font-extrabold text-[#0B1220]">Who is doing this job?</h2>
        {schemaMissing ? <p className="text-sm text-[#5B6575]">Assigning staff becomes available after the database update.</p> : <AssignBookingStaff bookingId={booking.id} current={booking.assigned_to ?? ""} staff={directory.map((member) => ({ id: member.id, name: member.name }))} action={assignBookingStaffAction} />}
      </section>

      <section className="rounded-2xl border border-[#BCD6F6] bg-[#F5F9FF] p-4 text-sm text-[#0B3B7A] sm:p-5">
        <p className="font-bold">Rescheduling and cancelling happen on the booking itself</p>
        <p className="mt-1">Online booking (Cal.com) keeps the customer&apos;s calendar in step, so make those changes there.</p>
        <Link href={`/admin/bookings/${booking.id}`} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1974E2] px-4 font-bold text-white hover:bg-[#1462C4]">Open booking {booking.booking_reference} <ExternalLink size={15} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
