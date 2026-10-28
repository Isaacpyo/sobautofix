"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, CheckCircle2, LoaderCircle, MessageCircle, MessageSquareText, Phone, Repeat, Send, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import type { z } from "zod";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { track } from "@/lib/analytics/events";
import { formatDateTime, formatPrice } from "@/lib/exchange/public/format";
import { vehicleEnquiryFormSchema, type VehicleEnquiryIntent } from "@/lib/exchange/public/schemas";
import { formatViewingDateOption, viewingDates, viewingSlots } from "@/lib/exchange/public/viewing-time";
import { cn } from "@/lib/utils";
import { useExchangeHref } from "./exchange-base";
import { buttonClass, errorClass, hintClass, inputClass, labelClass, linkClass, Notice } from "./ui";

export type EnquiryVehicle = { id: string; slug: string; name: string; derivative?: string; price: number; status: "available" | "reserved" | "sold"; imageUrl?: string; imageAlt?: string };
type Contact = { phoneHref: string; phoneLabel: string; whatsappHref: string };
type Links = { privacyHref: string; policiesHref: string };

type FormInput = z.input<typeof vehicleEnquiryFormSchema>;
type FormOutput = z.output<typeof vehicleEnquiryFormSchema>;

type Similar = { slug: string; name: string; price: number };
type Outcome = { kind: "success"; intent: VehicleEnquiryIntent; requestedStart?: string; alternativeStart?: string; preferredContact: string } | null;
type Unavailable = { message: string; similar: Similar[]; currentStatus: string };

const contactLabels: Record<string, string> = { phone: "phone", whatsapp: "WhatsApp", email: "email" };

/**
 * Buying actions for a vehicle page: the action buttons (in the page and as
 * a compact bar above the mobile bottom navigation) and the viewing /
 * question dialog. Viewings are requests until staff confirm them.
 */
export function VehicleActions({ vehicle, contact, links }: { vehicle: EnquiryVehicle; contact: Contact; links: Links }) {
  const href = useExchangeHref();
  const [intent, setIntent] = useState<VehicleEnquiryIntent | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canView = vehicle.status === "available";
  const canAsk = vehicle.status !== "sold";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (intent && !dialog.open) dialog.showModal();
    if (!intent && dialog.open) dialog.close();
  }, [intent]);

  const contactClick = (channel: string) => () => track("vehicle_contact_clicked", { channel, status: vehicle.status });

  const dialog = (
    <dialog
      ref={dialogRef}
      onClose={() => setIntent(null)}
      aria-labelledby="vehicle-enquiry-title"
      className="m-0 mt-auto max-h-[100dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-white p-0 text-[#344054] shadow-2xl sm:m-auto sm:max-h-[92dvh] sm:max-w-xl sm:rounded-3xl"
    >
      {intent && <EnquiryDialogBody vehicle={vehicle} initialIntent={intent} canView={canView} links={links} contact={contact} onClose={() => setIntent(null)} />}
    </dialog>
  );

  if (!canAsk) {
    return (
      <>
        <div className="grid gap-3">
          <Link href={href("/cars")} className={buttonClass("primary", "w-full")}>Browse available cars</Link>
          {contact.phoneHref && <a href={contact.phoneHref} onClick={contactClick("phone")} className={buttonClass("secondary", "w-full")}><Phone size={18} aria-hidden="true" /> Call {contact.phoneLabel}</a>}
        </div>
        {dialog}
      </>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        {canView && <button type="button" onClick={() => setIntent("viewing")} className={buttonClass("primary", "w-full")}><CalendarClock size={18} aria-hidden="true" /> Book a Viewing</button>}
        <button type="button" onClick={() => setIntent("question")} className={buttonClass(canView ? "secondary" : "primary", "w-full")}><MessageSquareText size={18} aria-hidden="true" /> Ask About This Car</button>
        <Link href={`${href("/sell")}?vehicle=${encodeURIComponent(vehicle.slug)}`} className={buttonClass("ghost", "w-full")}><Repeat size={18} aria-hidden="true" /> Part Exchange Your Car</Link>
        <div className="grid grid-cols-2 gap-3">
          {contact.phoneHref && <a href={contact.phoneHref} onClick={contactClick("phone")} className={buttonClass("secondary", "w-full px-3")} aria-label={`Call us about the ${vehicle.name}`}><Phone size={18} aria-hidden="true" /> Call</a>}
          {contact.whatsappHref && <a href={contact.whatsappHref} target="_blank" rel="noopener noreferrer" onClick={contactClick("whatsapp")} className={buttonClass("secondary", "w-full px-3")} aria-label={`WhatsApp us about the ${vehicle.name}`}><MessageCircle size={18} aria-hidden="true" /> WhatsApp</a>}
        </div>
      </div>

      {/* Compact action bar directly above the mobile bottom navigation. */}
      <div data-exchange-action-bar data-exchange-fixed className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-[#E3E8EF] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <p className="mr-auto min-w-0">
            <span className="block truncate text-[13px] text-[#5B6575]">{vehicle.name}</span>
            <span className="exchange-display text-[22px] leading-none font-bold text-[#0B1220]">{formatPrice(vehicle.price)}</span>
          </p>
          <button type="button" onClick={() => setIntent("question")} className={buttonClass("secondary", "min-h-11 px-3.5 text-sm")}>Ask</button>
          {canView && <button type="button" onClick={() => setIntent("viewing")} className={buttonClass("primary", "min-h-11 px-3.5 text-sm")}>Book a viewing</button>}
        </div>
      </div>

      {dialog}
    </>
  );
}

function EnquiryDialogBody({ vehicle, initialIntent, canView, links, contact, onClose }: { vehicle: EnquiryVehicle; initialIntent: VehicleEnquiryIntent; canView: boolean; links: Links; contact: Contact; onClose: () => void }) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  return (
    <div className="flex max-h-[100dvh] flex-col sm:max-h-[92dvh]">
      <div className="flex items-start gap-3 border-b border-[#E3E8EF] px-5 py-4">
        {vehicle.imageUrl && (
          <span className="relative hidden h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-[#F3F5F8] min-[380px]:block">
            <Image src={vehicle.imageUrl} alt="" fill sizes="80px" className="object-cover" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id="vehicle-enquiry-title" className="text-[24px] leading-tight font-bold text-[#0B1220]">{outcome?.kind === "success" ? (outcome.intent === "viewing" ? "Viewing requested" : "Question sent") : "Enquire about this car"}</h2>
          <p className="truncate text-sm text-[#5B6575]">{vehicle.name}{vehicle.derivative ? ` ${vehicle.derivative}` : ""} · {formatPrice(vehicle.price)}</p>
        </div>
        <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-[#F3F5F8]" aria-label="Close"><X size={22} aria-hidden="true" /></button>
      </div>
      <div className="overflow-y-auto px-5 pt-5 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {outcome?.kind === "success" ? (
          <div role="status" className="grid gap-4">
            <div className="flex gap-3 rounded-2xl bg-[#ECFDF3] p-4 text-[#067647]">
              <CheckCircle2 size={22} aria-hidden="true" className="mt-0.5 shrink-0" />
              <div>
                {outcome.intent === "viewing" ? (
                  <>
                    <p className="font-semibold">Your viewing request has been sent. It is not confirmed yet.</p>
                    <p className="mt-1 text-[15px] leading-6 text-[#0B1220]">A member of our team will contact you by {contactLabels[outcome.preferredContact] || "phone"} to confirm the time or suggest another.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Your question has been sent.</p>
                    <p className="mt-1 text-[15px] leading-6 text-[#0B1220]">We will reply by {contactLabels[outcome.preferredContact] || "phone"}.</p>
                  </>
                )}
              </div>
            </div>
            <dl className="grid gap-3 rounded-2xl border border-[#E3E8EF] p-4 text-[15px]">
              <div><dt className="text-sm text-[#5B6575]">Car</dt><dd className="font-semibold text-[#0B1220]">{vehicle.name}{vehicle.derivative ? ` ${vehicle.derivative}` : ""}</dd></div>
              {outcome.requestedStart && <div><dt className="text-sm text-[#5B6575]">Requested time (awaiting confirmation)</dt><dd className="font-semibold text-[#0B1220]">{formatDateTime(outcome.requestedStart)}</dd></div>}
              {outcome.alternativeStart && <div><dt className="text-sm text-[#5B6575]">Alternative time</dt><dd className="font-semibold text-[#0B1220]">{formatDateTime(outcome.alternativeStart)}</dd></div>}
            </dl>
            <p className="text-sm leading-6 text-[#5B6575]">We do not take payments or reservations online. Please wait for us to confirm before travelling.</p>
            <button type="button" onClick={onClose} className={buttonClass("primary", "w-full")}>Done</button>
          </div>
        ) : (
          <VehicleEnquiryForm vehicle={vehicle} initialIntent={initialIntent} canView={canView} links={links} contact={contact} onOutcome={setOutcome} />
        )}
      </div>
    </div>
  );
}

function VehicleEnquiryForm({ vehicle, initialIntent, canView: initialCanView, links, contact, onOutcome }: { vehicle: EnquiryVehicle; initialIntent: VehicleEnquiryIntent; canView: boolean; links: Links; contact: Contact; onOutcome: (outcome: Outcome) => void }) {
  const id = useId();
  const href = useExchangeHref();
  const router = useRouter();
  const inFlight = useRef(false);
  const unavailableRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState<Unavailable | null>(null);
  // Availability can change while the dialog is open; a 409 turns viewings off without losing what was typed.
  const canView = initialCanView && !unavailable;
  // One key per form: a retry after a network error reuses it, so the server never creates a duplicate.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showAlternative, setShowAlternative] = useState(false);
  const dates = useMemo(() => viewingDates(), []);
  const { register, handleSubmit, watch, setValue, setError, setFocus, formState: { errors, isSubmitting } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(vehicleEnquiryFormSchema),
    defaultValues: { intent: canView ? initialIntent : "question", name: "", phone: "", email: "", preferredContact: "phone", preferredDate: "", preferredTime: "", alternativeDate: "", alternativeTime: "", message: "", privacyAccepted: false as unknown as true },
    shouldFocusError: true,
  });
  const intent = watch("intent");
  const onToken = useCallback((token: string) => setTurnstileToken(token), []);

  async function onSubmit(values: FormOutput) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await send(values);
    } finally {
      inFlight.current = false;
    }
  }

  async function send(values: FormOutput) {
    setSubmitError("");
    if (!turnstileToken) {
      setSubmitError("Please complete the security check, then send again.");
      return;
    }
    try {
      const response = await fetch("/api/exchange/vehicle-enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, vehicleId: vehicle.id, idempotencyKey, turnstileToken }),
      });
      const body = await response.json().catch(() => null) as null | { success?: boolean; requestedStart?: string; alternativeStart?: string; currentStatus?: string; error?: { code?: string; message?: string; fields?: Record<string, string[] | undefined> }; similar?: Similar[] };
      if (response.status === 409 && body?.error?.code === "VEHICLE_UNAVAILABLE") {
        const currentStatus = body.currentStatus || "unavailable";
        setUnavailable({ message: body.error.message || "This car has just been reserved or sold.", similar: body.similar || [], currentStatus });
        // Questions are still welcome on a reserved car; keep everything they typed.
        if (currentStatus === "reserved") setValue("intent", "question");
        // Refresh the page behind the dialog so the availability shown is current.
        router.refresh();
        setTimeout(() => unavailableRef.current?.focus(), 30);
        return;
      }
      if (!response.ok || !body?.success) {
        const fields = body?.error?.fields || {};
        let first: FieldPath<FormInput> | null = null;
        for (const [field, messages] of Object.entries(fields)) {
          if (!messages?.length) continue;
          setError(field as FieldPath<FormInput>, { message: messages[0] });
          first ??= field as FieldPath<FormInput>;
        }
        if (first) setFocus(first);
        setSubmitError(body?.error?.message || "We could not send your request. Please try again, or call us.");
        return;
      }
      track(values.intent === "viewing" ? "viewing_requested" : "vehicle_question_sent", { intent: values.intent, alternative: Boolean(values.alternativeDate) });
      onOutcome({ kind: "success", intent: values.intent, requestedStart: body.requestedStart, alternativeStart: body.alternativeStart, preferredContact: values.preferredContact });
    } catch {
      setSubmitError("We could not reach our server. Check your connection and try again. Your details are still here.");
    }
  }

  const field = (name: FieldPath<FormInput>) => ({ id: `${id}-${name}`, "aria-invalid": Boolean(errors[name as keyof typeof errors]) || undefined, "aria-describedby": errors[name as keyof typeof errors] ? `${id}-${name}-error` : undefined });
  const error = (name: keyof typeof errors) => errors[name]?.message ? <span id={`${id}-${name}-error`} className={errorClass}>{String(errors[name]?.message)}</span> : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5" aria-describedby={`${id}-reference`}>
      <p id={`${id}-reference`} className="sr-only">This enquiry is about the {vehicle.name}.</p>
      {unavailable && (
        <div ref={unavailableRef} tabIndex={-1} className="grid gap-3 outline-none">
          <Notice tone="warning" role="alert" title={unavailable.currentStatus === "reserved" ? "This car has just been reserved" : "This car is no longer available"}>{unavailable.message}</Notice>
          {unavailable.similar.length > 0 && (
            <div>
              <p className="text-[15px] font-semibold text-[#0B1220]">Similar cars</p>
              <ul className="mt-2 grid gap-2">
                {unavailable.similar.map((car) => (
                  <li key={car.slug}><Link href={href(`/cars/${car.slug}`)} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#E3E8EF] px-4 py-2 font-semibold text-[#0B1220] hover:border-[#1974E2]">{car.name}<span className="exchange-display text-xl">{formatPrice(car.price)}</span></Link></li>
                ))}
              </ul>
            </div>
          )}
          {unavailable.currentStatus !== "reserved" && <Link href={href("/cars")} className={buttonClass("secondary", "w-full")}>Browse all cars</Link>}
        </div>
      )}
      {canView && (
        <fieldset>
          <legend className={labelClass}>What would you like to do?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-[#F3F5F8] p-1">
            {([["viewing", "Book a viewing"], ["question", "Ask a question"]] as const).map(([value, label]) => (
              <label key={value} className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-3 text-[15px] font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[rgba(22,139,255,.55)]", intent === value ? "bg-white text-[#0B1220] shadow-sm" : "text-[#5B6575]")}>
                <input type="radio" value={value} {...register("intent")} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {intent === "viewing" && (
        <fieldset className="grid gap-3">
          <legend className={labelClass}>Preferred viewing time</legend>
          <p className={hintClass + " -mt-1"}>Monday to Saturday. We will confirm the time with you before your visit.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-preferredDate`} className="text-sm text-[#344054]">Date</label>
              <select {...register("preferredDate")} {...field("preferredDate")} className={cn(inputClass, "mt-1")}>
                <option value="">Choose a date</option>
                {dates.map((date) => <option key={date} value={date}>{formatViewingDateOption(date)}</option>)}
              </select>
              {error("preferredDate")}
            </div>
            <div>
              <label htmlFor={`${id}-preferredTime`} className="text-sm text-[#344054]">Time</label>
              <select {...register("preferredTime")} {...field("preferredTime")} className={cn(inputClass, "mt-1")}>
                <option value="">Choose a time</option>
                {viewingSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
              {error("preferredTime")}
            </div>
          </div>
          {showAlternative ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${id}-alternativeDate`} className="text-sm text-[#344054]">Alternative date (optional)</label>
                <select {...register("alternativeDate")} {...field("alternativeDate")} className={cn(inputClass, "mt-1")}>
                  <option value="">No alternative</option>
                  {dates.map((date) => <option key={date} value={date}>{formatViewingDateOption(date)}</option>)}
                </select>
                {error("alternativeDate")}
              </div>
              <div>
                <label htmlFor={`${id}-alternativeTime`} className="text-sm text-[#344054]">Alternative time</label>
                <select {...register("alternativeTime")} {...field("alternativeTime")} className={cn(inputClass, "mt-1")}>
                  <option value="">No alternative</option>
                  {viewingSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
                {error("alternativeTime")}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAlternative(true)} className={cn(linkClass, "inline-flex min-h-11 w-fit items-center")}>Add an alternative time</button>
          )}
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-name`} className={labelClass}>Your name</label>
          <input {...register("name")} {...field("name")} autoComplete="name" className={cn(inputClass, "mt-1.5")} />
          {error("name")}
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className={labelClass}>Phone number</label>
          <input {...register("phone")} {...field("phone")} type="tel" autoComplete="tel" inputMode="tel" className={cn(inputClass, "mt-1.5")} />
          {error("phone")}
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={labelClass}>Email <span className="font-normal text-[#5B6575]">(optional)</span></label>
          <input {...register("email")} {...field("email")} type="email" autoComplete="email" inputMode="email" className={cn(inputClass, "mt-1.5")} />
          {error("email")}
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>How should we contact you?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["phone", "whatsapp", "email"] as const).map((value) => (
            <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#C9D3E0] px-4 text-[15px] font-medium has-[:checked]:border-[#1974E2] has-[:checked]:bg-[#EAF2FD] has-[:checked]:text-[#0B1220] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[rgba(22,139,255,.55)]">
              <input type="radio" value={value} {...register("preferredContact")} className="size-4 accent-[#1974E2]" />
              {value === "phone" ? "Phone call" : value === "whatsapp" ? "WhatsApp" : "Email"}
            </label>
          ))}
        </div>
        {error("preferredContact")}
      </fieldset>

      <div>
        <label htmlFor={`${id}-message`} className={labelClass}>{intent === "question" ? "Your question" : "Message"} {intent !== "question" && <span className="font-normal text-[#5B6575]">(optional)</span>}</label>
        <textarea {...register("message")} {...field("message")} rows={intent === "question" ? 4 : 3} placeholder={intent === "question" ? "For example: does it come with two keys?" : "Anything we should know before your visit"} className={cn(inputClass, "mt-1.5 min-h-24")} />
        {error("message")}
      </div>

      <div>
        <label className="flex items-start gap-3 text-[15px] leading-6 text-[#344054]">
          <input type="checkbox" {...register("privacyAccepted")} {...field("privacyAccepted")} className="mt-1 size-5 shrink-0 accent-[#1974E2]" />
          <span>I have read the <a href={links.privacyHref} target="_blank" rel="noopener" className={linkClass}>privacy notice</a> and the <a href={links.policiesHref} target="_blank" rel="noopener" className={linkClass}>vehicle sales policies</a>, and agree to be contacted about this car.</span>
        </label>
        {error("privacyAccepted")}
      </div>

      <TurnstileField onToken={onToken} />

      {submitError && <Notice tone="error" role="alert">{submitError}{contact.phoneHref ? <> You can also call us on <a href={contact.phoneHref} className="font-semibold underline">{contact.phoneLabel}</a>.</> : null}</Notice>}

      <button type="submit" disabled={isSubmitting} className={buttonClass("primary", "w-full")} onClick={() => { if (!canView) setValue("intent", "question"); }}>
        {isSubmitting ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Sending</> : intent === "viewing" ? <><CalendarClock size={18} aria-hidden="true" /> Request this viewing</> : <><Send size={18} aria-hidden="true" /> Send question</>}
      </button>
      {intent === "viewing" && <p className="-mt-2 text-center text-sm text-[#5B6575]">This sends a request. We confirm every viewing personally.</p>}
    </form>
  );
}
