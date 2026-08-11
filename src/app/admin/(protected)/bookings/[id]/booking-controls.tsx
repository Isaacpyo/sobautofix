"use client";

import { CalendarClock, LoaderCircle, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@/lib/bookings/types";
import { cn } from "@/lib/utils";
import {
  cancelAdminBookingAction,
  getAdminBookingSlotsAction,
  rescheduleAdminBookingAction,
} from "../actions";

type Slot = { start: string; end?: string };

export function AdminBookingControls({
  bookingId,
  status,
  currentAppointmentStart,
}: {
  bookingId: string;
  status: BookingStatus;
  currentAppointmentStart: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(todayInLondon());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const rescheduleDialog = useRef<HTMLDialogElement>(null);
  const cancelDialog = useRef<HTMLDialogElement>(null);
  const canModify = status === "pending" || status === "confirmed" || status === "rescheduled";
  const slotGroups = useMemo(() => groupSlots(slots), [slots]);

  function loadSlots() {
    setMessage(null);
    setSelectedSlot(null);
    startTransition(async () => {
      try {
        const result = await getAdminBookingSlotsAction(bookingId, startDate, addUtcDays(startDate, 7));
        if (!result.success) {
          setSlots([]);
          setMessage({ tone: "error", text: result.message });
          return;
        }
        setSlots(result.slots || []);
        setMessage({ tone: "info", text: result.message });
      } catch {
        setSlots([]);
        setMessage({ tone: "error", text: "Appointment availability could not be loaded. Please try again." });
      }
    });
  }

  function confirmReschedule() {
    if (!selectedSlot) return;
    rescheduleDialog.current?.close();
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await rescheduleAdminBookingAction(bookingId, selectedSlot);
        if (!result.success) {
          setMessage({ tone: "error", text: result.message });
          return;
        }
        setSlots([]);
        setSelectedSlot(null);
        setMessage({ tone: "success", text: result.message });
        router.refresh();
      } catch {
        setMessage({ tone: "error", text: "The booking could not be rescheduled. Please try again." });
      }
    });
  }

  function confirmCancellation() {
    cancelDialog.current?.close();
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await cancelAdminBookingAction(bookingId);
        setMessage({ tone: result.success ? "success" : "error", text: result.message });
        if (result.success) router.refresh();
      } catch {
        setMessage({ tone: "error", text: "The booking could not be cancelled. Please try again." });
      }
    });
  }

  if (!canModify) {
    return (
      <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6" aria-labelledby="booking-actions-heading">
        <h2 id="booking-actions-heading" className="text-xl font-extrabold text-[#071127]">Booking actions</h2>
        <p className="mt-2 text-sm leading-6 text-[#667586]">{status === "cancelled" ? "This booking has been cancelled and cannot be changed." : "This appointment is complete and cannot be changed."}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5 sm:p-6" aria-labelledby="booking-actions-heading">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><CalendarClock size={19} aria-hidden="true" /></span>
        <div>
          <h2 id="booking-actions-heading" className="text-xl font-extrabold text-[#071127]">Booking actions</h2>
          <p className="mt-1 text-sm leading-6 text-[#667586]">Reschedule or cancel here so the calendar, local record and customer update stay together.</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[#E4EAF0] bg-[#F8FAFC] p-4 sm:p-5">
        <h3 className="font-extrabold text-[#071127]">Reschedule appointment</h3>
        <p className="mt-1 text-sm text-[#667586]">Current: {formatAppointment(currentAppointmentStart)}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-bold text-[#071127]">
            Search from
            <input
              type="date"
              value={startDate}
              min={todayInLondon()}
              onChange={(event) => { setStartDate(event.target.value); setSlots([]); setSelectedSlot(null); }}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#C9D5E2] bg-white px-4 outline-none focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15"
            />
          </label>
          <Button type="button" variant="outline" onClick={loadSlots} disabled={pending || !startDate} className="shrink-0">
            {pending ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
            Find available times
          </Button>
        </div>

        {slotGroups.length > 0 && (
          <fieldset className="mt-6">
            <legend className="text-sm font-extrabold text-[#071127]">Available appointment times</legend>
            <div className="mt-3 grid gap-4">
              {slotGroups.map((group) => (
                <div key={group.date}>
                  <p className="text-xs font-extrabold tracking-wide text-[#667586] uppercase">{formatGroupDate(group.date)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.slots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        aria-pressed={selectedSlot === slot.start}
                        onClick={() => setSelectedSlot(slot.start)}
                        className={cn(
                          "min-h-11 rounded-xl border px-4 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1974E2]/20",
                          selectedSlot === slot.start
                            ? "border-[#1974E2] bg-[#1974E2] text-white"
                            : "border-[#C9D5E2] bg-white text-[#1446A5] hover:border-[#1974E2]",
                        )}
                      >
                        {formatSlotTime(slot.start)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {selectedSlot && (
          <Button type="button" className="mt-5 w-full sm:w-auto" onClick={() => rescheduleDialog.current?.showModal()} disabled={pending}>
            Reschedule to {formatSlotDateTime(selectedSlot)}
          </Button>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-[#E4EAF0] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#667586]">Cancelling is final and will notify the customer.</p>
        <Button type="button" variant="outline" className="border-red-200 text-red-800 hover:border-red-400 hover:bg-red-50" onClick={() => cancelDialog.current?.showModal()} disabled={pending}>
          <XCircle size={18} aria-hidden="true" /> Cancel booking
        </Button>
      </div>

      {pending && <p className="mt-4 flex items-center gap-2 text-sm font-bold text-[#586575]" role="status"><LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> Updating booking…</p>}
      {message && <p className={cn("mt-4 rounded-xl border p-4 text-sm font-semibold", message.tone === "error" && "border-red-200 bg-red-50 text-red-900", message.tone === "success" && "border-green-200 bg-green-50 text-green-900", message.tone === "info" && "border-[#BBD9FA] bg-[#F1F7FF] text-[#1446A5]")} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>}

      <dialog ref={rescheduleDialog} className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-3xl border-0 p-0 shadow-2xl backdrop:bg-[#030712]/75" aria-labelledby="confirm-reschedule-title">
        <div className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]"><CalendarClock size={23} aria-hidden="true" /></span>
          <h2 id="confirm-reschedule-title" className="mt-5 text-2xl font-extrabold text-[#071127]">Confirm reschedule</h2>
          <p className="mt-3 leading-7 text-[#586575]">Move this appointment from {formatAppointment(currentAppointmentStart)} to <strong className="text-[#071127]">{selectedSlot ? formatAppointment(selectedSlot) : "the selected time"}</strong>?</p>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => rescheduleDialog.current?.close()}>Keep current time</Button>
            <Button type="button" onClick={confirmReschedule}>Confirm reschedule</Button>
          </div>
        </div>
      </dialog>

      <dialog ref={cancelDialog} className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-3xl border-0 p-0 shadow-2xl backdrop:bg-[#030712]/75" aria-labelledby="confirm-admin-cancel-title">
        <div className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700"><TriangleAlert size={23} aria-hidden="true" /></span>
          <h2 id="confirm-admin-cancel-title" className="mt-5 text-2xl font-extrabold text-[#071127]">Cancel this booking?</h2>
          <p className="mt-3 leading-7 text-[#586575]">The appointment for {formatAppointment(currentAppointmentStart)} will be cancelled and the customer update will be requested.</p>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => cancelDialog.current?.close()}>Keep booking</Button>
            <Button type="button" className="bg-red-700 shadow-none hover:bg-red-800" onClick={confirmCancellation}>Yes, cancel booking</Button>
          </div>
        </div>
      </dialog>
    </section>
  );
}

function groupSlots(slots: Slot[]) {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = dateKeyInLondon(new Date(slot.start));
    groups.set(key, [...(groups.get(key) || []), slot]);
  }
  return [...groups.entries()].map(([date, groupedSlots]) => ({ date, slots: groupedSlots }));
}

function todayInLondon() {
  return dateKeyInLondon(new Date());
}

function dateKeyInLondon(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/London" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatAppointment(value: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}

function formatSlotDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date(value));
}

function formatGroupDate(value: string) {
  return formatSlotDate(`${value}T12:00:00Z`);
}

function formatSlotTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(new Date(value));
}

function formatSlotDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}
