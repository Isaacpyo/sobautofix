"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, LoaderCircle, Mail, MessageCircle, Pencil, Phone, Search, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { track } from "@/lib/analytics/events";
import { formatPrice } from "@/lib/exchange/public/format";
import { sellerFormSchema, type SellerFormInput, type SellerFormOutput } from "@/lib/exchange/public/schemas";
import { cn } from "@/lib/utils";
import { useExchangeHref } from "../exchange-base";
import { takeSellRegistration } from "../sell-handoff";
import { buttonClass, inputClass, labelClass, linkClass, Notice } from "../ui";
import { ChoiceGroup, FieldError, TextAreaField, TextField } from "./fields";
import { PhotoPicker, PhotoUploadList, photoCategoryLabels } from "./photo-step";
import { uploadSellerPhoto, type SellerPhoto } from "./photo-upload";

export type InterestedVehicle = { id: string; slug: string; name: string; derivative?: string; price: number };
type Contact = { phoneHref: string; phoneLabel: string; whatsappHref: string; email: string };

const DRAFT_KEY = "sob-exchange-sell-draft";

const steps = [
  { key: "vehicle", title: "Your car", fields: ["vehicle.registration", "vehicle.make", "vehicle.model", "vehicle.year", "vehicle.mileage", "vehicle.derivative", "vehicle.fuelType", "vehicle.transmission", "vehicle.colour"] },
  { key: "condition", title: "Condition", fields: ["condition.runningStatus", "condition.knownFaults", "condition.damage", "condition.motStatus", "condition.motExpiry", "condition.serviceHistory", "condition.outstandingFinance"] },
  { key: "photos", title: "Photos", fields: [] },
  { key: "contact", title: "Your details", fields: ["contact.name", "contact.phone", "contact.email", "contact.postcode", "contact.preferredContact", "contact.marketingConsent"] },
  { key: "review", title: "Check and send", fields: ["privacyAccepted"] },
] as const satisfies ReadonlyArray<{ key: string; title: string; fields: readonly FieldPath<SellerFormInput>[] }>;

const runningOptions = [
  { value: "runs_and_drives", label: "Runs and drives" },
  { value: "runs_not_driveable", label: "Runs, but not driveable" },
  { value: "does_not_run", label: "Does not run" },
  { value: "not_sure", label: "Not sure" },
];
const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not_sure", label: "Not sure" }];
const motOptions = [{ value: "valid", label: "Valid" }, { value: "expired", label: "Expired" }, { value: "not_sure", label: "Not sure" }];
const historyOptions = [{ value: "full", label: "Full" }, { value: "partial", label: "Partial" }, { value: "none", label: "None" }, { value: "not_sure", label: "Not sure" }];
const contactOptions = [{ value: "phone", label: "Phone call" }, { value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }];

const labelFor = (options: Array<{ value: string; label: string }>, value?: string) => options.find((option) => option.value === value)?.label || "Not answered";

const emptyValues: SellerFormInput = {
  vehicle: { registration: "", lookupSource: "manual", make: "", model: "", derivative: "", year: "", mileage: "", fuelType: "", transmission: "", colour: "" },
  condition: { runningStatus: undefined as unknown as "not_sure", knownFaults: "", damage: "", motStatus: undefined as unknown as "not_sure", motExpiry: "", serviceHistory: undefined as unknown as "not_sure", outstandingFinance: undefined as unknown as "not_sure" },
  contact: { name: "", phone: "", email: "", postcode: "", preferredContact: "phone", marketingConsent: false },
  privacyAccepted: false as unknown as true,
};

type Draft = { values: SellerFormInput; step: number; idempotencyKey: string; photoCount: number };
type Phase = "form" | "uploading" | "complete";
type Saved = { submissionId: string; reference: string; uploadToken: string };
type LookupState = { status: "idle" | "loading" | "found" | "failed" | "manual"; message?: string };

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function SellForm({ interestedVehicle, contact, links, responsePromise }: { interestedVehicle?: InterestedVehicle; contact: Contact; links: { privacyHref: string; sellerPrivacyHref: string }; responsePromise: string }) {
  const href = useExchangeHref();
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("form");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [photos, setPhotos] = useState<SellerPhoto[]>([]);
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [restored, setRestored] = useState<{ photoCount: number } | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const startedRef = useRef(false);
  const photosRef = useRef<SellerPhoto[]>([]);
  const movedRef = useRef(false);

  const form = useForm<SellerFormInput, unknown, SellerFormOutput>({ resolver: zodResolver(sellerFormSchema), defaultValues: emptyValues, mode: "onTouched", shouldFocusError: true });
  const { register, handleSubmit, trigger, watch, setValue, getValues, setError, setFocus, reset, formState: { errors, isSubmitting } } = form;
  const values = watch();

  // Restore a draft (never photos or the registration) and pick up a registration handed over from the home page.
  useEffect(() => {
    const draft = readDraft();
    if (draft?.values) {
      reset({ ...emptyValues, ...draft.values, vehicle: { ...emptyValues.vehicle, ...draft.values.vehicle, registration: "" }, privacyAccepted: false as unknown as true });
      setStep(Math.min(Math.max(0, draft.step || 0), steps.length - 1));
      if (draft.values.vehicle?.make) setLookup({ status: "manual" });
      setRestored({ photoCount: draft.photoCount || 0 });
    }
    setIdempotencyKey(draft?.idempotencyKey || crypto.randomUUID());
    const registration = takeSellRegistration();
    if (registration) setValue("vehicle.registration", registration);
  }, [reset, setValue]);

  // Save a draft as they go, without the registration or photos.
  useEffect(() => {
    if (!idempotencyKey || phase !== "form") return;
    const subscription = watch((current) => {
      if (!startedRef.current) {
        startedRef.current = true;
        track("seller_form_started", { kind: interestedVehicle ? "part_exchange" : "sell" });
      }
      try {
        const draftValues = { ...current, vehicle: { ...current.vehicle, registration: "" }, privacyAccepted: false };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ values: draftValues, step, idempotencyKey, photoCount: photos.length } satisfies Omit<Draft, "values"> & { values: unknown }));
      } catch {
        // Storage unavailable: the form still works, the draft just is not kept.
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, step, idempotencyKey, phase, photos.length, interestedVehicle]);

  // Move focus to the step heading when the step changes, so screen reader and keyboard users start at the top.
  useEffect(() => {
    if (!movedRef.current) return;
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, phase]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const onToken = useCallback((token: string) => setTurnstileToken(token), []);

  async function lookupRegistration() {
    const valid = await trigger("vehicle.registration");
    if (!valid) return;
    setLookup({ status: "loading" });
    try {
      const response = await fetch("/api/vehicle/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registration: getValues("vehicle.registration") }) });
      const body = await response.json().catch(() => null) as null | { success?: boolean; vehicle?: { make?: string; model?: string; derivative?: string; year?: number; fuelType?: string; transmission?: string; colour?: string }; error?: { message?: string } };
      if (!response.ok || !body?.success || !body.vehicle?.make) {
        setLookup({ status: "failed", message: body?.error?.message || "We could not look up that registration. Please enter the details yourself." });
        setValue("vehicle.lookupSource", "manual");
        return;
      }
      const found = body.vehicle;
      setValue("vehicle.make", found.make || "", { shouldValidate: true });
      setValue("vehicle.model", found.model || "", { shouldValidate: true });
      setValue("vehicle.derivative", found.derivative || "");
      setValue("vehicle.year", found.year ? String(found.year) : "", { shouldValidate: true });
      setValue("vehicle.fuelType", found.fuelType || "");
      setValue("vehicle.transmission", found.transmission || "");
      setValue("vehicle.colour", found.colour || "");
      setValue("vehicle.lookupSource", "lookup");
      setLookup({ status: "found" });
    } catch {
      setLookup({ status: "failed", message: "Vehicle lookup is unavailable right now. Please enter the details yourself." });
    }
  }

  function enterManually() {
    setValue("vehicle.lookupSource", "manual");
    setLookup({ status: "manual" });
  }

  async function next() {
    movedRef.current = true;
    if (step === 0 && (lookup.status === "idle" || lookup.status === "loading")) setLookup({ status: "manual" });
    const fields = (steps[step] ?? steps[0]).fields as readonly FieldPath<SellerFormInput>[];
    const valid = fields.length ? await trigger(fields as FieldPath<SellerFormInput>[], { shouldFocus: true }) : true;
    if (!valid) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goTo(index: number) {
    movedRef.current = true;
    setStep(index);
  }

  async function uploadAll(context: Saved, list: SellerPhoto[]) {
    const update = (key: string, patch: Partial<SellerPhoto>) => setPhotos((current) => current.map((photo) => photo.key === key ? { ...photo, ...patch } : photo));
    let failures = 0;
    for (const photo of list) {
      if (photo.status === "done") continue;
      update(photo.key, { status: "uploading", progress: 0, error: undefined });
      try {
        const photoId = await uploadSellerPhoto(context, photo, (fraction) => update(photo.key, { progress: fraction }));
        update(photo.key, { status: "done", progress: 1, photoId });
      } catch (error) {
        failures += 1;
        const withId = error as Error & { photoId?: string };
        update(photo.key, { status: "failed", error: withId.message, photoId: withId.photoId });
      }
    }
    return failures;
  }

  function complete(context: Saved) {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    track("seller_form_completed", { kind: interestedVehicle ? "part_exchange" : "sell", photos: photosRef.current.filter((photo) => photo.status === "done").length });
    setSaved(context);
    movedRef.current = true;
    setPhase("complete");
  }

  async function onSubmit(formValues: SellerFormOutput) {
    setSubmitError("");
    if (!turnstileToken) {
      setSubmitError("Please complete the security check, then send again.");
      return;
    }
    try {
      const response = await fetch("/api/exchange/seller-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formValues, idempotencyKey, interestedVehicleId: interestedVehicle?.id, photoCount: photos.length, turnstileToken }),
      });
      const body = await response.json().catch(() => null) as null | { success?: boolean; submissionId?: string; reference?: string; uploadToken?: string; error?: { message?: string; fields?: Record<string, string[]> } };
      if (!response.ok || !body?.success || !body.submissionId || !body.reference || !body.uploadToken) {
        const fields = Object.entries(body?.error?.fields || {});
        if (fields.length) {
          let firstStep = steps.length - 1;
          for (const [path, messages] of fields) {
            setError(path as FieldPath<SellerFormInput>, { message: messages[0] });
            const index = steps.findIndex((candidate) => (candidate.fields as readonly string[]).includes(path));
            if (index >= 0) firstStep = Math.min(firstStep, index);
          }
          goTo(firstStep);
          const firstField = fields[0]?.[0];
          if (firstField) setTimeout(() => setFocus(firstField as FieldPath<SellerFormInput>), 50);
        }
        setSubmitError(body?.error?.message || "We could not send your enquiry. Please try again, or call us.");
        return;
      }
      const context = { submissionId: body.submissionId, reference: body.reference, uploadToken: body.uploadToken };
      setSaved(context);
      if (!photos.length) return complete(context);
      movedRef.current = true;
      setPhase("uploading");
      const failures = await uploadAll(context, photos);
      if (failures === 0) complete(context);
    } catch {
      setSubmitError("We could not reach our server. Check your connection and try again. Your answers are still here.");
    }
  }

  async function retry(key: string) {
    if (!saved) return;
    const photo = photos.find((item) => item.key === key);
    if (!photo) return;
    const failures = await uploadAll(saved, [photo]);
    if (failures === 0 && photos.every((item) => item.key === key || item.status === "done")) complete(saved);
  }

  const err = (path: string) => {
    const parts = path.split(".");
    let node: unknown = errors;
    for (const part of parts) node = (node as Record<string, unknown> | undefined)?.[part];
    return (node as { message?: string } | undefined)?.message;
  };

  // ---------- Completion ----------
  if (phase === "complete" && saved) {
    const doneCount = photos.filter((photo) => photo.status === "done").length;
    const vehicle = getValues("vehicle");
    return (
      <div ref={topRef} className="scroll-mt-28">
        <div className="rounded-3xl border border-[#ABEFC6] bg-[#ECFDF3] p-6 sm:p-8">
          <CheckCircle2 size={36} aria-hidden="true" className="text-[#067647]" />
          <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-[34px] leading-tight font-bold text-[#0B1220] outline-none">Thank you. We have your enquiry.</h2>
          <p className="mt-2 text-[17px] text-[#0B1220]">Your reference is <strong className="exchange-display text-[26px] tracking-wide">{saved.reference}</strong></p>
          <p className="mt-1 text-[15px] text-[#344054]">Keep this handy if you call us.</p>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby={`${id}-summary`} className="rounded-2xl border border-[#E3E8EF] p-5">
            <h3 id={`${id}-summary`} className="text-[22px] font-bold text-[#0B1220]">What you sent</h3>
            <dl className="mt-3 grid gap-2 text-[15px]">
              <div className="flex justify-between gap-4"><dt className="text-[#5B6575]">Car</dt><dd className="text-right font-semibold text-[#0B1220]">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[#5B6575]">Mileage</dt><dd className="text-right font-semibold text-[#0B1220]">{Number(String(vehicle.mileage).replace(/\D/g, "") || 0).toLocaleString("en-GB")} miles</dd></div>
              {interestedVehicle && <div className="flex justify-between gap-4"><dt className="text-[#5B6575]">Part exchange towards</dt><dd className="text-right font-semibold text-[#0B1220]">{interestedVehicle.name}</dd></div>}
              <div className="flex justify-between gap-4"><dt className="text-[#5B6575]">Photos</dt><dd className="text-right font-semibold text-[#0B1220]">{doneCount} uploaded</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[#5B6575]">We will contact you by</dt><dd className="text-right font-semibold text-[#0B1220]">{labelFor(contactOptions, getValues("contact.preferredContact"))}</dd></div>
            </dl>
          </section>
          <section aria-labelledby={`${id}-next`} className="rounded-2xl border border-[#E3E8EF] p-5">
            <h3 id={`${id}-next`} className="text-[22px] font-bold text-[#0B1220]">What happens next</h3>
            <ol className="mt-3 grid gap-2 text-[15px] leading-6 text-[#344054]">
              <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#EAF2FD] text-xs font-bold text-[#1462C4]">1</span>We review your details and photos.</li>
              <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#EAF2FD] text-xs font-bold text-[#1462C4]">2</span>We contact you by {labelFor(contactOptions, getValues("contact.preferredContact")).toLowerCase()} to talk it through. {responsePromise}</li>
              <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#EAF2FD] text-xs font-bold text-[#1462C4]">3</span>If we can make an offer, we arrange to inspect the car.</li>
            </ol>
            <Notice className="mt-4">Any offer we give before seeing the car is provisional and subject to inspection and verification of the car, its documents and history.</Notice>
          </section>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {contact.phoneHref && <a href={contact.phoneHref} className={buttonClass("secondary")}><Phone size={18} aria-hidden="true" /> Call {contact.phoneLabel}</a>}
          {contact.whatsappHref && <a href={contact.whatsappHref} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}><MessageCircle size={18} aria-hidden="true" /> WhatsApp us</a>}
          {contact.email && <a href={`mailto:${contact.email}`} className={buttonClass("secondary")}><Mail size={18} aria-hidden="true" /> Email us</a>}
          <Link href={href("/cars")} className={buttonClass("primary")}>Browse our cars <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </div>
    );
  }

  // ---------- Uploading ----------
  if (phase === "uploading" && saved) {
    const failed = photos.filter((photo) => photo.status === "failed");
    const working = photos.some((photo) => photo.status === "uploading");
    return (
      <div ref={topRef} className="scroll-mt-28">
        <Notice tone="success" title={`Enquiry saved. Reference ${saved.reference}`}>Now sending your photos. Please keep this page open.</Notice>
        <h2 ref={headingRef} tabIndex={-1} className="mt-6 text-[28px] font-bold text-[#0B1220] outline-none">Uploading photos</h2>
        <div className="mt-4"><PhotoUploadList photos={photos} onRetry={retry} /></div>
        {failed.length > 0 && !working && (
          <div className="mt-5 grid gap-3">
            <Notice tone="warning" role="alert">{failed.length === 1 ? "One photo" : `${failed.length} photos`} did not upload. Retry, or finish without {failed.length === 1 ? "it" : "them"}. Your enquiry is already saved.</Notice>
            <button type="button" onClick={() => complete(saved)} className={buttonClass("secondary", "w-full sm:w-auto")}>Finish without {failed.length === 1 ? "this photo" : "these photos"}</button>
          </div>
        )}
      </div>
    );
  }

  // ---------- Form ----------
  const current = steps[step] ?? steps[0];
  const vehicle = values.vehicle;
  const showVehicleFields = lookup.status === "failed" || lookup.status === "manual";
  return (
    <div ref={topRef} className="scroll-mt-28">
      {interestedVehicle && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-[#B9D4F6] bg-[#EAF2FD] p-4">
          <p className="text-[15px] text-[#0B1220]"><span className="block text-sm text-[#344054]">Part exchange towards</span><strong>{interestedVehicle.name}</strong>{interestedVehicle.derivative ? ` ${interestedVehicle.derivative}` : ""}</p>
          <span className="exchange-display shrink-0 text-[24px] font-bold text-[#0B1220]">{formatPrice(interestedVehicle.price)}</span>
        </div>
      )}

      {/* Progress */}
      <nav aria-label="Progress" className="mb-6">
        <p className="text-sm font-semibold text-[#1462C4]">Step {step + 1} of {steps.length}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E3E8EF]" aria-hidden="true"><div className="h-full rounded-full bg-[#1974E2] transition-[width] duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <ol className="mt-3 hidden grid-cols-5 gap-2 text-sm sm:grid">
          {steps.map((item, index) => (
            <li key={item.key} aria-current={index === step ? "step" : undefined} className={cn("flex items-center gap-2", index === step ? "font-semibold text-[#0B1220]" : index < step ? "text-[#067647]" : "text-[#5B6575]")}>
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", index < step ? "bg-[#ECFDF3]" : index === step ? "bg-[#1974E2] text-white" : "bg-[#F3F5F8]")}>{index < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
              {item.title}{index < step && <span className="sr-only"> (done)</span>}
            </li>
          ))}
        </ol>
      </nav>

      {restored && step < steps.length - 1 && (
        <Notice className="mb-5" role="status">We kept your answers from earlier in this browser tab.{restored.photoCount > 0 ? " Photos are not kept, so please add them again." : ""} For your privacy, please enter the registration again.</Notice>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <h2 ref={headingRef} tabIndex={-1} className="text-[32px] leading-tight font-bold text-[#0B1220] outline-none">{current.title}</h2>

        {current.key === "vehicle" && (
          <div className="mt-5 grid gap-5">
            <div>
              <label htmlFor={`${id}-registration`} className={labelClass}>Registration number</label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id={`${id}-registration`}
                  {...register("vehicle.registration")}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={10}
                  aria-invalid={err("vehicle.registration") ? true : undefined}
                  aria-describedby={err("vehicle.registration") ? `${id}-registration-error` : undefined}
                  className="min-h-14 w-full rounded-xl border-2 border-[#F2C94C] bg-[#FFD84D] px-4 text-center exchange-display text-[26px] font-bold tracking-[.12em] text-[#0B1220] uppercase sm:max-w-xs"
                />
                <button type="button" onClick={lookupRegistration} disabled={lookup.status === "loading"} className={buttonClass("dark", "min-h-14")}>
                  {lookup.status === "loading" ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />} Find my car
                </button>
              </div>
              <FieldError id={`${id}-registration-error`} message={err("vehicle.registration")} />
              {lookup.status === "idle" && <button type="button" onClick={enterManually} className={cn(linkClass, "mt-2 inline-flex min-h-11 items-center text-[15px]")}>Enter the details yourself instead</button>}
            </div>

            <div aria-live="polite">
              {lookup.status === "found" && (
                <div className="rounded-2xl border border-[#ABEFC6] bg-[#ECFDF3] p-4">
                  <p className="text-sm font-semibold text-[#067647]">We found this car</p>
                  <p className="mt-1 text-[20px] font-bold text-[#0B1220]">{[vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ")}</p>
                  <p className="text-[15px] text-[#344054]">{[vehicle?.derivative, vehicle?.fuelType, vehicle?.colour].filter(Boolean).join(" · ")}</p>
                  <button type="button" onClick={enterManually} className={cn(linkClass, "mt-2 inline-flex min-h-11 items-center gap-1.5 text-[15px]")}><Pencil size={16} aria-hidden="true" /> Not right? Change the details</button>
                </div>
              )}
              {lookup.status === "failed" && <Notice tone="warning">{lookup.message}</Notice>}
            </div>

            {showVehicleFields && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id={`${id}-make`} label="Make" placeholder="For example, Ford" registration={register("vehicle.make")} error={err("vehicle.make")} autoComplete="off" />
                <TextField id={`${id}-model`} label="Model" placeholder="For example, Focus" registration={register("vehicle.model")} error={err("vehicle.model")} autoComplete="off" />
                <TextField id={`${id}-year`} label="Year" inputMode="numeric" placeholder="For example, 2017" registration={register("vehicle.year")} error={err("vehicle.year")} maxLength={4} />
                <TextField id={`${id}-derivative`} label="Version or trim" optional placeholder="For example, 1.0 Zetec" registration={register("vehicle.derivative")} error={err("vehicle.derivative")} />
                <TextField id={`${id}-fuel`} label="Fuel" optional placeholder="Petrol, diesel, hybrid..." registration={register("vehicle.fuelType")} error={err("vehicle.fuelType")} />
                <TextField id={`${id}-transmission`} label="Gearbox" optional placeholder="Manual or automatic" registration={register("vehicle.transmission")} error={err("vehicle.transmission")} />
              </div>
            )}

            <TextField id={`${id}-mileage`} label="Current mileage" hint="An approximate reading is fine." inputMode="numeric" registration={register("vehicle.mileage")} error={err("vehicle.mileage")} className="sm:max-w-xs" />
          </div>
        )}

        {current.key === "condition" && (
          <div className="mt-5 grid gap-6">
            <ChoiceGroup id={`${id}-running`} legend="Does the car run and drive?" registration={register("condition.runningStatus")} error={err("condition.runningStatus")} options={runningOptions} />
            <TextAreaField id={`${id}-faults`} label="Known faults or warning lights" optional placeholder="For example: clutch slips, engine light on" registration={register("condition.knownFaults")} error={err("condition.knownFaults")} />
            <TextAreaField id={`${id}-damage`} label="Bodywork or interior damage" optional placeholder="For example: dent on the rear door, torn seat" registration={register("condition.damage")} error={err("condition.damage")} />
            <ChoiceGroup id={`${id}-mot`} legend="MOT" registration={register("condition.motStatus")} error={err("condition.motStatus")} options={motOptions} columns={3}>
              {values.condition?.motStatus === "valid" && (
                <div className="mt-3 sm:max-w-xs">
                  <label htmlFor={`${id}-mot-expiry`} className={labelClass}>MOT expiry date <span className="font-normal text-[#5B6575]">(optional)</span></label>
                  <input id={`${id}-mot-expiry`} type="date" {...register("condition.motExpiry")} className={cn(inputClass, "mt-1.5")} aria-invalid={err("condition.motExpiry") ? true : undefined} />
                  <FieldError id={`${id}-mot-expiry-error`} message={err("condition.motExpiry")} />
                </div>
              )}
            </ChoiceGroup>
            <ChoiceGroup id={`${id}-service`} legend="Service history" registration={register("condition.serviceHistory")} error={err("condition.serviceHistory")} options={historyOptions} columns={4} />
            <ChoiceGroup id={`${id}-finance`} legend="Is there outstanding finance on the car?" hint="This does not stop you selling, but we need to know so it can be settled." registration={register("condition.outstandingFinance")} error={err("condition.outstandingFinance")} options={yesNo} columns={3} />
          </div>
        )}

        {current.key === "photos" && (
          <div className="mt-5"><PhotoPicker photos={photos} onChange={setPhotos} /></div>
        )}

        {current.key === "contact" && (
          <div className="mt-5 grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id={`${id}-name`} label="Your name" autoComplete="name" registration={register("contact.name")} error={err("contact.name")} className="sm:col-span-2" />
              <TextField id={`${id}-phone`} label="Phone number" type="tel" inputMode="tel" autoComplete="tel" registration={register("contact.phone")} error={err("contact.phone")} />
              <TextField id={`${id}-email`} label="Email" optional type="email" inputMode="email" autoComplete="email" hint="We send a copy of your enquiry here." registration={register("contact.email")} error={err("contact.email")} />
              <TextField id={`${id}-postcode`} label="Postcode" autoComplete="postal-code" autoCapitalize="characters" hint="Where the car is kept, so we can plan an inspection." registration={register("contact.postcode")} error={err("contact.postcode")} className="sm:max-w-xs" />
            </div>
            <ChoiceGroup id={`${id}-preferred`} legend="How should we contact you?" registration={register("contact.preferredContact")} error={err("contact.preferredContact")} options={contactOptions} columns={3} />
            <label className="flex items-start gap-3 rounded-xl border border-[#E3E8EF] p-4 text-[15px] leading-6 text-[#344054]">
              <input type="checkbox" {...register("contact.marketingConsent")} className="mt-1 size-5 shrink-0 accent-[#1974E2]" />
              <span><strong className="text-[#0B1220]">Optional:</strong> send me occasional news about cars for sale from SOB Autofix. You can stop these at any time. This is separate from your enquiry and not needed to get a response.</span>
            </label>
          </div>
        )}

        {current.key === "review" && (
          <div className="mt-5 grid gap-5">
            <ReviewSection title="Your car" onEdit={() => goTo(0)} rows={[
              ["Registration", vehicle?.registration || "Not entered"],
              ["Car", [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.derivative].filter(Boolean).join(" ")],
              ["Mileage", vehicle?.mileage ? `${Number(String(vehicle.mileage).replace(/\D/g, "")).toLocaleString("en-GB")} miles` : "Not entered"],
            ]} />
            <ReviewSection title="Condition" onEdit={() => goTo(1)} rows={[
              ["Running", labelFor(runningOptions, values.condition?.runningStatus)],
              ["Known faults", values.condition?.knownFaults || "None given"],
              ["Damage", values.condition?.damage || "None given"],
              ["MOT", `${labelFor(motOptions, values.condition?.motStatus)}${values.condition?.motStatus === "valid" && values.condition?.motExpiry ? `, expires ${values.condition.motExpiry.split("-").reverse().join("/")}` : ""}`],
              ["Service history", labelFor(historyOptions, values.condition?.serviceHistory)],
              ["Outstanding finance", labelFor(yesNo, values.condition?.outstandingFinance)],
            ]} />
            <ReviewSection title="Photos" onEdit={() => goTo(2)} rows={[["Photos", photos.length ? `${photos.length} (${[...new Set(photos.map((photo) => photoCategoryLabels[photo.category].toLowerCase()))].join(", ")})` : "None added"]]} />
            <ReviewSection title="Your details" onEdit={() => goTo(3)} rows={[
              ["Name", values.contact?.name || ""],
              ["Phone", values.contact?.phone || ""],
              ["Email", values.contact?.email || "Not given"],
              ["Postcode", values.contact?.postcode || ""],
              ["Contact by", labelFor(contactOptions, values.contact?.preferredContact)],
              ["News about cars", values.contact?.marketingConsent ? "Yes, send me news" : "No"],
            ]} />
            <div className="rounded-2xl bg-[#F3F5F8] p-4 text-[15px] leading-6 text-[#344054]">
              <p className="font-semibold text-[#0B1220]">How we use your information</p>
              <p className="mt-1">We use these details and photos only to assess your car and contact you about it. Photos are stored privately and location data is removed. If we do not buy the car, we delete the photos and registration after a set period. Read <a href={links.sellerPrivacyHref} target="_blank" rel="noopener" className={linkClass}>selling your car: how we use your information</a> and our <a href={links.privacyHref} target="_blank" rel="noopener" className={linkClass}>privacy notice</a>.</p>
            </div>
            <div>
              <label className="flex items-start gap-3 text-[15px] leading-6 text-[#344054]">
                <input type="checkbox" {...register("privacyAccepted")} aria-invalid={err("privacyAccepted") ? true : undefined} aria-describedby={err("privacyAccepted") ? `${id}-privacy-error` : undefined} className="mt-1 size-5 shrink-0 accent-[#1974E2]" />
                <span>I have read how my information will be used and agree to be contacted about this enquiry.</span>
              </label>
              <FieldError id={`${id}-privacy-error`} message={err("privacyAccepted")} />
            </div>
            <Notice>Any offer we make is provisional and subject to inspection and verification of the car, its documents and history.</Notice>
            <TurnstileField onToken={onToken} />
          </div>
        )}

        {submitError && <Notice tone="error" role="alert" className="mt-5">{submitError}{contact.phoneHref ? <> You can also call us on <a href={contact.phoneHref} className="font-semibold underline">{contact.phoneLabel}</a>.</> : null}</Notice>}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#E3E8EF] pt-5 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={() => goTo(step - 1)} className={buttonClass("secondary")}><ArrowLeft size={18} aria-hidden="true" /> Back</button>
          ) : <span />}
          {step < steps.length - 1 ? (
            <button type="button" onClick={next} className={buttonClass("primary", "sm:min-w-48")}>{step === 2 && !photos.length ? "Continue without photos" : "Continue"} <ArrowRight size={18} aria-hidden="true" /></button>
          ) : (
            <button type="submit" disabled={isSubmitting} className={buttonClass("primary", "sm:min-w-56")}>
              {isSubmitting ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Sending</> : <><Send size={18} aria-hidden="true" /> Send my enquiry</>}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function ReviewSection({ title, rows, onEdit }: { title: string; rows: Array<[string, string]>; onEdit: () => void }) {
  return (
    <section className="rounded-2xl border border-[#E3E8EF] p-4" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[20px] font-bold text-[#0B1220]">{title}</h3>
        <button type="button" onClick={onEdit} className={cn(linkClass, "inline-flex min-h-11 items-center gap-1.5 px-1 text-[15px]")}><Pencil size={15} aria-hidden="true" /> Edit<span className="sr-only"> {title.toLowerCase()}</span></button>
      </div>
      <dl className="mt-2 grid gap-1.5 text-[15px]">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
            <dt className="text-[#5B6575]">{label}</dt>
            <dd className="font-medium break-words text-[#0B1220]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
