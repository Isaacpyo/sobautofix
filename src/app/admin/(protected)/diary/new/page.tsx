import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentForm, type AppointmentFormValues } from "@/components/admin/diary/appointment-form";
import { NotPermitted, SchemaMissingNotice } from "@/components/admin/diary/diary-states";
import { canUseLink, linkKinds, loadStaffDirectory, resolveLinks, type LinkKind } from "@/lib/diary/repository";
import { addMinutesToTime, defaultTitle, parseStartParam } from "@/lib/diary/schema";
import { todayInLondon } from "@/lib/diary/time";
import { isAppointmentKind, type AppointmentKind } from "@/lib/diary/types";
import { canSeeNotes } from "@/lib/diary/mapping";
import { getExchangePrivateSettings } from "@/lib/exchange/settings";
import { isMissingSchemaError } from "@/lib/exchange/schema";
import { requireStaffPage } from "@/lib/exchange/staff";
import { saveAppointmentAction, searchDiaryLinksAction } from "../actions";

export const metadata: Metadata = { title: "New appointment" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const paramFor: Record<LinkKind, string> = { vehicle: "vehicle", customer: "customer", enquiry: "enquiry", submission: "submission", sale: "sale" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { staff, allowed } = await requireStaffPage("diary.manage");
  if (!allowed) return <NotPermitted what="the diary" />;
  const params = await searchParams;
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const probe = await staff.client.from("diary_appointments").select("id", { head: true, count: "exact" }).limit(1);
  const schemaMissing = isMissingSchemaError(probe.error);

  const ids = Object.fromEntries(linkKinds.map((kind) => {
    const value = read(paramFor[kind]);
    return [kind, value && UUID.test(value) ? value : null];
  })) as Record<LinkKind, string | null>;
  const [links, directory, settings] = await Promise.all([
    schemaMissing ? Promise.resolve({} as Awaited<ReturnType<typeof resolveLinks>>) : resolveLinks(staff.client, ids),
    loadStaffDirectory(staff.client),
    getExchangePrivateSettings(),
  ]);

  const requestedKind = read("kind");
  const kind: AppointmentKind = isAppointmentKind(requestedKind) ? requestedKind : isAppointmentKind(links.suggestedKind) ? links.suggestedKind : "viewing";
  const start = parseStartParam(read("start"), todayInLondon());
  const length = kind === "viewing" ? settings.viewingLengthMinutes : 60;
  const initial: AppointmentFormValues = {
    kind,
    status: "confirmed",
    title: defaultTitle(kind, links.vehicle?.label),
    date: start.date,
    startTime: start.time,
    endTime: addMinutesToTime(start.time, length),
    location: "",
    assignedTo: staff.userId,
    notes: "",
    links: { vehicle: links.vehicle ?? null, customer: links.customer ?? null, enquiry: links.enquiry ?? null, submission: links.submission ?? null, sale: links.sale ?? null },
  };

  return (
    <div className="mx-auto grid grid-cols-1 max-w-3xl gap-5">
      <Link href={`/admin/diary?date=${start.date}`} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm font-bold text-[#1462C4] hover:underline"><ArrowLeft size={17} aria-hidden="true" /> Back to the diary</Link>
      <header>
        <p className="text-xs font-extrabold tracking-widest text-[#1462C4] uppercase">Autofix Diary</p>
        <h1 className="mt-1 text-3xl font-extrabold text-[#0B1220]">New appointment</h1>
        <p className="mt-1 text-sm text-[#5B6575]">Workshop bookings come from online booking and are not created here.</p>
      </header>
      {schemaMissing ? (
        <SchemaMissingNotice />
      ) : (
        <AppointmentForm
          initial={initial}
          staff={directory.map((member) => ({ id: member.id, name: member.name }))}
          permissions={{ links: Object.fromEntries(linkKinds.map((link) => [link, canUseLink(staff.role, link)])) as Record<LinkKind, boolean>, notes: canSeeNotes(staff.role, kind) }}
          customerHasEmail={false}
          defaultLengthMinutes={length}
          action={saveAppointmentAction}
          search={searchDiaryLinksAction}
          cancelHref={`/admin/diary?date=${start.date}`}
        />
      )}
    </div>
  );
}
