"use client";

import {
  CalendarClock,
  CheckCircle2,
  History as HistoryIcon,
  LoaderCircle,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  beginRescheduleAction,
  cancelBookingAction,
  getRescheduleSlotsAction,
  lookupBookingAction,
  rescheduleBookingAction,
} from "@/app/manage-booking/actions";
import { Button } from "@/components/ui/button";
import { initialBookingLookupState, type BookingHistoryEntry, type PublicBooking } from "@/lib/bookings/types";
import { cn } from "@/lib/utils";
import { formatRegistration } from "@/lib/vehicle/registration-format";

type Slot = { start: string; end?: string };
type SlotState = "idle" | "loading" | "ready" | "empty" | "error";
type ActionFeedback = { tone: "success" | "error"; message: string };

export function ManageBooking() {
  const [state, formAction, lookupPending] = useActionState(lookupBookingAction, initialBookingLookupState);
  const [registration, setRegistration] = useState("");
  const [bookingOverride, setBookingOverride] = useState<PublicBooking>();
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotState, setSlotState] = useState<SlotState>("idle");
  const [slotMessage, setSlotMessage] = useState("");
  const [selectedStart, setSelectedStart] = useState("");
  const [slotTimeZone, setSlotTimeZone] = useState("Europe/London");
  const [actionPending, startAction] = useTransition();
  const cancelDialog = useRef<HTMLDialogElement>(null);
  const reschedulePanel = useRef<HTMLDivElement>(null);
  const dateBounds = getDateBounds();
  const activeBooking = bookingOverride?.reference === state.booking?.reference ? bookingOverride : state.booking;

  useEffect(() => {
    if (rescheduleOpen) reschedulePanel.current?.focus();
  }, [rescheduleOpen]);

  function resetReschedule() {
    setRescheduleOpen(false);
    setAppointmentDate("");
    setSlots([]);
    setSlotState("idle");
    setSlotMessage("");
    setSelectedStart("");
  }

  function resetForLookup() {
    setBookingOverride(undefined);
    setActionFeedback(undefined);
    resetReschedule();
    cancelDialog.current?.close();
  }

  function startReschedule() {
    if (!state.accessToken || !activeBooking) return;
    setActionFeedback(undefined);
    setSlotMessage("");
    startAction(async () => {
      const result = await beginRescheduleAction(state.accessToken!);
      if (!result.success) {
        setActionFeedback({ tone: "error", message: result.message });
        return;
      }
      const bookingDate = dateValue(activeBooking.appointmentStart, activeBooking.timezone);
      setAppointmentDate(clampDate(bookingDate, dateBounds.min, dateBounds.max));
      setSlots([]);
      setSelectedStart("");
      setSlotState("idle");
      setRescheduleOpen(true);
    });
  }

  function updateAppointmentDate(value: string) {
    setAppointmentDate(value);
    setSlots([]);
    setSelectedStart("");
    setSlotMessage("");
    setSlotState("idle");
  }

  function loadSlots() {
    if (!state.accessToken) return;
    if (!appointmentDate || appointmentDate < dateBounds.min || appointmentDate > dateBounds.max) {
      setSlotState("error");
      setSlotMessage("Choose a valid appointment date.");
      return;
    }
    const requestedDate = appointmentDate;
    setSlotState("loading");
    setSlotMessage("");
    setSelectedStart("");
    startAction(async () => {
      const result = await getRescheduleSlotsAction(state.accessToken!, requestedDate, shiftDate(requestedDate, 1));
      if (!result.success) {
        setSlots([]);
        setSlotState("error");
        setSlotMessage(result.message);
        return;
      }
      const nextSlots = result.slots.slice().sort((left, right) => left.start.localeCompare(right.start));
      setSlotTimeZone(result.timeZone);
      setSlots(nextSlots);
      setSlotState(nextSlots.length ? "ready" : "empty");
    });
  }

  function confirmReschedule() {
    if (!state.accessToken || !selectedStart) return;
    setSlotMessage("");
    startAction(async () => {
      const result = await rescheduleBookingAction(state.accessToken!, selectedStart);
      if (result.booking) setBookingOverride(result.booking);
      if (result.success) {
        setActionFeedback({ tone: "success", message: result.message });
        resetReschedule();
        return;
      }
      if (result.booking && !result.booking.canModify) {
        setActionFeedback({ tone: "error", message: result.message });
        resetReschedule();
        return;
      }
      setSlots([]);
      setSelectedStart("");
      setSlotState("error");
      setSlotMessage(result.message);
    });
  }

  function openCancellation() {
    setActionFeedback(undefined);
    resetReschedule();
    cancelDialog.current?.showModal();
  }

  function confirmCancellation() {
    if (!state.accessToken) return;
    cancelDialog.current?.close();
    setActionFeedback(undefined);
    startAction(async () => {
      const result = await cancelBookingAction(state.accessToken!);
      if (result.booking) setBookingOverride(result.booking);
      setActionFeedback({ tone: result.success ? "success" : "error", message: result.message });
    });
  }

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl border border-[#DCE5EF] bg-white p-5 shadow-[0_24px_70px_rgba(7,17,39,0.10)] sm:p-7 lg:p-9" aria-labelledby="find-booking-heading">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]"><Search size={23} aria-hidden="true" /></span>
          <div><h2 id="find-booking-heading" className="text-2xl font-extrabold text-[#071127] sm:text-3xl">Find my booking</h2><p className="mt-1 text-sm leading-6 text-[#667586]">Enter your booking details and we&apos;ll find your appointment securely.</p></div>
        </div>
        <form action={formAction} onSubmit={resetForLookup} className="mt-7 grid items-end gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <FormField label="Booking reference" htmlFor="booking-reference">
            <input id="booking-reference" name="bookingReference" placeholder="e.g. SOB-123456" required autoComplete="off" className={inputClasses} />
          </FormField>
          <FormField label="Vehicle registration" htmlFor="booking-registration">
            <div className="flex min-h-12 overflow-hidden rounded-xl border border-[#C9D5E2] bg-white focus-within:border-[#1974E2] focus-within:ring-4 focus-within:ring-[#1974E2]/15">
              <span className="plate-strip grid w-10 place-items-center text-[0.65rem] font-black text-white">GB</span>
              <input id="booking-registration" name="registration" value={registration} onChange={(event) => setRegistration(formatRegistration(event.target.value))} placeholder="AB12 CDE" required autoComplete="off" maxLength={9} className="min-w-0 flex-1 border-0 px-3 font-mono text-base font-black tracking-[.12em] text-black uppercase outline-none" />
            </div>
          </FormField>
          <FormField label="Email address" htmlFor="booking-email">
            <input id="booking-email" name="email" type="email" required autoComplete="email" maxLength={254} className={inputClasses} />
          </FormField>
          <Button type="submit" className="min-h-12 whitespace-nowrap md:col-span-2 xl:col-span-1" disabled={lookupPending}>{lookupPending ? <><LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> Finding booking…</> : <><Search size={18} aria-hidden="true" /> Find my booking</>}</Button>
        </form>
        {state.status === "error" && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900" role="alert">{state.message}</p>}
        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-[#667586]"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#1974E2]" aria-hidden="true" /> All three details must match. Your booking information is never placed in the page address.</p>
      </section>

      {activeBooking && (
        <BookingResult
          booking={activeBooking}
          actionPending={actionPending}
          feedback={actionFeedback}
          rescheduleOpen={rescheduleOpen}
          onReschedule={startReschedule}
          onCancel={openCancellation}
        >
          {rescheduleOpen && (
            <ReschedulePanel
              panelRef={reschedulePanel}
              booking={activeBooking}
              date={appointmentDate}
              minDate={dateBounds.min}
              maxDate={dateBounds.max}
              slots={slots}
              state={slotState}
              message={slotMessage}
              selectedStart={selectedStart}
              timeZone={slotTimeZone}
              pending={actionPending}
              onDateChange={updateAppointmentDate}
              onLoad={loadSlots}
              onSelect={setSelectedStart}
              onConfirm={confirmReschedule}
              onClose={resetReschedule}
            />
          )}
        </BookingResult>
      )}

      <dialog ref={cancelDialog} className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-3xl border-0 p-0 shadow-2xl backdrop:bg-[#030712]/75" aria-labelledby="cancel-booking-title" aria-describedby="cancel-booking-description">
        <div className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700"><XCircle size={24} aria-hidden="true" /></span>
          <h2 id="cancel-booking-title" className="mt-5 text-2xl font-extrabold text-[#071127]">Cancel this booking?</h2>
          <p id="cancel-booking-description" className="mt-3 leading-7 text-[#586575]">{activeBooking ? `${formatAppointment(activeBooking.appointmentStart, activeBooking.timezone)} · ${activeBooking.service}. This appointment will be cancelled.` : "This appointment will be cancelled."}</p>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => cancelDialog.current?.close()}>Keep booking</Button>
            <Button type="button" className="bg-red-700 shadow-none hover:bg-red-800" onClick={confirmCancellation} disabled={actionPending}>Yes, cancel booking</Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function BookingResult({ booking, actionPending, feedback, rescheduleOpen, onReschedule, onCancel, children }: {
  booking: PublicBooking;
  actionPending: boolean;
  feedback?: ActionFeedback;
  rescheduleOpen: boolean;
  onReschedule: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const cancelled = booking.status === "cancelled";
  const originalDiffers = booking.originalAppointmentStart && booking.originalAppointmentStart !== booking.appointmentStart;
  return (
    <section className="overflow-hidden rounded-3xl border border-[#DCE5EF] bg-white shadow-[0_20px_55px_rgba(7,17,39,0.08)]" aria-labelledby="your-booking-heading">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4EAF0] bg-[#F8FAFC] px-5 py-5 sm:px-8">
        <div><p className="text-xs font-extrabold tracking-[.15em] text-[#1974E2] uppercase">Appointment found</p><h2 id="your-booking-heading" className="mt-1 text-3xl font-extrabold text-[#071127]">Your booking</h2></div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-2">
        <Detail icon={CalendarClock} label="Booking reference" value={booking.reference} />
        <Detail icon={UserRound} label="Customer" value={booking.customerName} />
        <Detail icon={Wrench} label="Vehicle" value={booking.registration} support={booking.vehicleName} plate />
        <Detail icon={Wrench} label="Service" value={booking.service} />
        <Detail icon={CalendarClock} label="Current appointment" value={formatAppointment(booking.appointmentStart, booking.timezone)} />
        <Detail icon={MapPin} label="Workshop / location" value={booking.location || "Confirmed with your appointment"} />
        {originalDiffers && <Detail icon={HistoryIcon} label="Original appointment" value={formatAppointment(booking.originalAppointmentStart!, booking.timezone)} />}
        {booking.notes && <div className="lg:col-span-2"><p className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">Booking notes</p><p className="mt-2 whitespace-pre-line rounded-xl bg-[#F4F7FA] p-4 text-sm leading-6 text-[#586575]">{booking.notes}</p></div>}
        <div className="lg:col-span-2"><BookingHistory booking={booking} /></div>
      </div>
      <div className="border-t border-[#E4EAF0] bg-[#F8FAFC] px-5 py-5 sm:px-8">
        {cancelled ? (
          <p className="flex items-center gap-2 font-bold text-green-800" role="status"><CheckCircle2 size={20} aria-hidden="true" /> Your booking has been cancelled.</p>
        ) : booking.canModify ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" onClick={onReschedule} disabled={actionPending || rescheduleOpen}>{actionPending && !rescheduleOpen ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <CalendarClock size={18} aria-hidden="true" />} {rescheduleOpen ? "Rescheduling" : "Reschedule booking"}</Button>
            <Button type="button" variant="outline" className="border-red-200 text-red-800 hover:border-red-400 hover:bg-red-50" onClick={onCancel} disabled={actionPending}>Cancel booking</Button>
          </div>
        ) : <p className="font-semibold text-[#586575]">{booking.modificationMessage}</p>}
        {feedback && <p className={cn("mt-4 rounded-xl border p-4 text-sm font-semibold", feedback.tone === "success" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900")} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.message}</p>}
        {children}
      </div>
    </section>
  );
}

function ReschedulePanel({ panelRef, booking, date, minDate, maxDate, slots, state, message, selectedStart, timeZone, pending, onDateChange, onLoad, onSelect, onConfirm, onClose }: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  booking: PublicBooking;
  date: string;
  minDate: string;
  maxDate: string;
  slots: Slot[];
  state: SlotState;
  message: string;
  selectedStart: string;
  timeZone: string;
  pending: boolean;
  onDateChange: (value: string) => void;
  onLoad: () => void;
  onSelect: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div ref={panelRef} tabIndex={-1} className="mt-6 rounded-2xl border border-[#BFD5EC] bg-white p-4 outline-none focus-visible:ring-4 focus-visible:ring-[#1974E2]/15 sm:p-6" aria-labelledby="reschedule-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-extrabold tracking-[.12em] text-[#1974E2] uppercase">Choose a new time</p><h3 id="reschedule-heading" className="mt-1 text-xl font-extrabold text-[#071127]">Reschedule your appointment</h3><p className="mt-2 text-sm leading-6 text-[#586575]">Your current appointment is {formatAppointment(booking.appointmentStart, booking.timezone)}.</p></div>
        <button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-lg px-3 text-sm font-bold text-[#145CAD] underline disabled:opacity-50">Close</button>
      </div>
      <form className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); onLoad(); }}>
        <FormField label="New appointment date" htmlFor="reschedule-date">
          <input id="reschedule-date" type="date" value={date} min={minDate} max={maxDate} required disabled={pending} onChange={(event) => onDateChange(event.target.value)} className={inputClasses} />
        </FormField>
        <Button type="submit" disabled={pending || !date} className="w-full sm:w-auto">{state === "loading" ? <><LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> Checking…</> : "Check available times"}</Button>
      </form>

      {state === "idle" && <p className="mt-4 rounded-xl bg-[#F4F7FA] p-4 text-sm text-[#586575]">Choose a date to see available appointment times.</p>}
      {state === "loading" && <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#EAF3FF] p-4 text-sm font-semibold text-[#1446A5]" role="status"><LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> Checking availability…</p>}
      {state === "empty" && <p className="mt-4 rounded-xl border border-[#D7E0E9] bg-[#F8FAFC] p-4 text-sm text-[#586575]" role="status">There are no available appointments on this date. Please choose another date.</p>}
      {state === "error" && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900" role="alert">{message || "We couldn't load appointment times. Please try again."}</p>}
      {state === "ready" && (
        <fieldset className="mt-5">
          <legend className="text-sm font-bold text-[#071127]">Available times</legend>
          <p className="mt-1 text-xs text-[#667586]">Times are shown in the booking&apos;s local time.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {slots.map((slot) => (
              <button key={slot.start} type="button" aria-pressed={selectedStart === slot.start} disabled={pending} onClick={() => onSelect(slot.start)} className={cn("min-h-12 rounded-xl border px-3 py-3 text-sm font-extrabold transition focus-visible:ring-4 focus-visible:ring-[#168BFF]/20 disabled:opacity-60", selectedStart === slot.start ? "border-[#1974E2] bg-[#1974E2] text-white shadow-md" : "border-[#B9C9D9] bg-white text-[#071127] hover:border-[#1974E2] hover:bg-[#EAF3FF]")}>{formatTime(slot.start, timeZone)}</button>
            ))}
          </div>
        </fieldset>
      )}

      {selectedStart && (
        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div><p className="flex items-center gap-2 text-xs font-extrabold tracking-wide text-green-800 uppercase"><CheckCircle2 size={17} aria-hidden="true" /> New appointment</p><p className="mt-2 font-bold text-[#071127]">{formatAppointment(selectedStart, timeZone)}</p><p className="mt-1 text-xs leading-5 text-[#586575]">Your appointment will not change until you confirm.</p></div>
          <Button type="button" onClick={onConfirm} disabled={pending} className="mt-4 w-full sm:mt-0 sm:w-auto">{pending ? <><LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> Rescheduling…</> : "Confirm new appointment"}</Button>
        </div>
      )}
    </div>
  );
}

function BookingHistory({ booking }: { booking: PublicBooking }) {
  return (
    <section className="rounded-2xl border border-[#DCE5EF] bg-[#F8FAFC] p-4 sm:p-5" aria-labelledby="booking-history-heading">
      <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><HistoryIcon size={19} aria-hidden="true" /></span><div><h3 id="booking-history-heading" className="font-extrabold text-[#071127]">Booking history</h3><p className="mt-0.5 text-xs text-[#667586]">Your appointment updates in date order.</p></div></div>
      {booking.history.length ? (
        <ol className="mt-5 grid gap-4 border-l-2 border-[#C8D9EB] pl-5">
          {booking.history.map((entry) => <HistoryEntry key={entry.id} entry={entry} booking={booking} />)}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-[#586575]">Original appointment: {formatAppointment(booking.originalAppointmentStart || booking.appointmentStart, booking.timezone)}</p>
      )}
    </section>
  );
}

function HistoryEntry({ entry, booking }: { entry: BookingHistoryEntry; booking: PublicBooking }) {
  const appointment = entry.appointmentStart || (entry.action === "created" ? booking.originalAppointmentStart : undefined);
  return (
    <li className="relative">
      <span className="absolute top-1 -left-[1.7rem] size-3 rounded-full border-2 border-white bg-[#1974E2] shadow" aria-hidden="true" />
      <p className="text-sm font-extrabold text-[#071127]">{historyLabel(entry.action)}</p>
      {entry.previousAppointmentStart && appointment ? <p className="mt-1 text-xs leading-5 text-[#586575]">{formatAppointment(entry.previousAppointmentStart, booking.timezone)} → {formatAppointment(appointment, booking.timezone)}</p> : appointment ? <p className="mt-1 text-xs leading-5 text-[#586575]">{formatAppointment(appointment, booking.timezone)}</p> : null}
      <p className="mt-1 text-xs text-[#788695]">Updated {formatEventDate(entry.createdAt, booking.timezone)}</p>
    </li>
  );
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="w-full"><label htmlFor={htmlFor} className="mb-2 block text-sm font-bold text-[#071127]">{label}</label>{children}</div>;
}

const inputClasses = "min-h-12 w-full rounded-xl border border-[#C9D5E2] bg-white px-4 text-[#071127] outline-none transition placeholder:text-[#8A97A6] focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15 disabled:cursor-not-allowed disabled:bg-[#EEF2F6]";

function Detail({ icon: Icon, label, value, support, plate = false }: { icon: typeof Mail; label: string; value: string; support?: string; plate?: boolean }) {
  return <div className="flex min-w-0 gap-3"><span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><Icon size={19} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">{label}</p><p className={cn("mt-1 break-words font-bold text-[#071127]", plate && "inline-block rounded-md bg-[#F4C542] px-2 py-1 font-mono tracking-[.1em]")}>{value}</p>{support && <p className="mt-1 break-words text-sm text-[#667586]">{support}</p>}</div></div>;
}

function StatusBadge({ status }: { status: PublicBooking["status"] }) {
  const styles = { pending: "bg-amber-100 text-amber-900", confirmed: "bg-green-100 text-green-800", rescheduled: "bg-[#EAF3FF] text-[#1446A5]", cancelled: "bg-red-100 text-red-800", completed: "bg-[#E4EAF0] text-[#586575]" };
  return <span className={cn("rounded-full px-3 py-1.5 text-xs font-extrabold capitalize", styles[status])}>{status}</span>;
}

function historyLabel(action: string) {
  const labels: Record<string, string> = {
    created: "Booking created",
    confirmed: "Booking confirmed",
    reschedule_started: "Reschedule started",
    rescheduled: "Appointment rescheduled",
    cancelled: "Booking cancelled",
    completed: "Appointment completed",
  };
  return labels[action] || "Booking updated";
}

function getDateBounds() {
  const min = dateValue(new Date().toISOString(), "Europe/London");
  return { min, max: shiftDate(min, 90) };
}

function clampDate(value: string, min: string, max: string) {
  if (!value || value < min) return min;
  if (value > max) return max;
  return value;
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function safeTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "Europe/London";
  }
}

function dateValue(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: safeTimeZone(timeZone) }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatTime(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: safeTimeZone(timeZone) }).format(date);
}

function formatAppointment(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: safeTimeZone(timeZone) }).format(date);
}

function formatEventDate(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date unavailable";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: safeTimeZone(timeZone) }).format(date);
}
