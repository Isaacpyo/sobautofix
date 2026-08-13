"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CarFront,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  LoaderCircle,
  MapPin,
  Phone,
  Search,
  Smartphone,
  UserRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useVehicleSession } from "@/components/vehicle/vehicle-context";
import { contactLinks, formatPhone, siteConfig } from "@/config/site";
import { track } from "@/lib/analytics/events";
import { cn } from "@/lib/utils";
import { formatRegistration, normalizeRegistration } from "@/lib/vehicle/registration-format";
import type { VehicleDetails } from "@/types/domain";

type LocationMode = "workshop" | "mobile";
type ServiceLocationMode = LocationMode | "both";

type BookingService = {
  key: string;
  name: string;
  description: string;
  locationMode: ServiceLocationMode;
};

type Slot = { start: string; end?: string };
type VehicleView = "input" | "loading" | "found" | "lookup-error" | "manual" | "ready";
type LoadState = "idle" | "loading" | "ready" | "empty" | "error";
type BookingState = "idle" | "submitting" | "error";

type BookingConfirmation = {
  reference: string;
  status: string;
  appointmentStart: string;
  email: string;
  vehicle: VehicleDetails;
  service: BookingService;
  locationLabel: string;
  timeZone: string;
};

type FieldErrors = Partial<Record<
  | "vehicle"
  | "registration"
  | "make"
  | "model"
  | "service"
  | "problemDescription"
  | "mileage"
  | "locationMode"
  | "address"
  | "postcode"
  | "vehicleAccessible"
  | "name"
  | "email"
  | "phone"
  | "appointmentDate"
  | "appointmentStart",
  string
>>;

const steps = ["Vehicle", "Service", "Problem", "Location", "Details", "Appointment", "Review"] as const;
const symptomOptions = [
  { value: "warning_light", label: "Warning light" },
  { value: "unusual_noise", label: "Unusual noise" },
  { value: "starting_problem", label: "Starting problem" },
  { value: "loss_of_power", label: "Loss of power" },
  { value: "braking_concern", label: "Braking concern" },
  { value: "electrical_fault", label: "Electrical fault" },
  { value: "service_due", label: "Service due" },
  { value: "other", label: "Other" },
] as const;
const defaultTimeZone = "Europe/London";
const inputClass = "mt-2 block min-h-12 w-full rounded-xl border border-[#C8D4E0] bg-white px-4 py-3 text-[#071127] outline-none transition placeholder:text-[#7C8998] focus:border-[#168BFF] focus:ring-4 focus:ring-[#168BFF]/10";
const workshopAddress = `${siteConfig.address.building}, ${siteConfig.address.street}, ${siteConfig.address.town}, ${siteConfig.address.city}, ${siteConfig.address.postcode}`;

export function BookingWizard() {
  const { session, updateSession, clearVehicle } = useVehicleSession();
  const [step, setStep] = useState(0);
  const [vehicleView, setVehicleView] = useState<VehicleView>("input");
  const [useStoredVehicle, setUseStoredVehicle] = useState(true);
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [registration, setRegistration] = useState("");
  const [manualVehicle, setManualVehicle] = useState({ registration: "", make: "", model: "" });
  const [vehicleLookupMessage, setVehicleLookupMessage] = useState("");
  const [services, setServices] = useState<BookingService[]>([]);
  const [servicesState, setServicesState] = useState<LoadState>("loading");
  const [serviceKey, setServiceKey] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mileage, setMileage] = useState("");
  const [warningLight, setWarningLight] = useState("");
  const [issueTiming, setIssueTiming] = useState("");
  const [locationMode, setLocationMode] = useState<LocationMode>("workshop");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [vehicleAccessible, setVehicleAccessible] = useState<boolean | undefined>(undefined);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [appointmentDate, setAppointmentDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsState, setSlotsState] = useState<LoadState>("idle");
  const [slotTimeZone, setSlotTimeZone] = useState(defaultTimeZone);
  const [appointmentStart, setAppointmentStart] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [bookingState, setBookingState] = useState<BookingState>("idle");
  const [bookingError, setBookingError] = useState("");
  const [slotConflict, setSlotConflict] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openedTrackedRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const slotRequestRef = useRef(0);

  const storedVehicle = useStoredVehicle ? session.vehicle : null;
  const activeVehicle = vehicle ?? storedVehicle;
  const effectiveVehicleView = vehicleView === "input" && activeVehicle
    ? session.vehicleConfirmed === false ? "found" : "ready"
    : vehicleView;
  const selectedService = services.find((service) => service.key === (serviceKey || session.selectedService));
  const effectiveLocationMode: LocationMode = selectedService?.locationMode === "mobile"
    ? "mobile"
    : selectedService?.locationMode === "workshop"
      ? "workshop"
      : locationMode;
  const serviceSearchText = `${selectedService?.key ?? ""} ${selectedService?.name ?? ""}`.toLowerCase();
  const asksMileage = serviceSearchText.includes("servic");
  const asksDiagnosticQuestions = /diagnostic|electrical|warning|fault/.test(serviceSearchText) || symptoms.includes("warning_light");
  const dateBounds = getDateBounds();

  const loadServices = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/bookings/services", { cache: "no-store", signal });
      const result = await response.json().catch(() => ({})) as { services?: unknown };
      if (!response.ok || !Array.isArray(result.services)) throw new Error("services_unavailable");
      const nextServices = result.services.filter(isBookingService);
      setServices(nextServices);
      setServicesState(nextServices.length ? "ready" : "empty");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setServicesState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => void loadServices(controller.signal), 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadServices]);

  useEffect(() => {
    if (!openedTrackedRef.current) {
      openedTrackedRef.current = true;
      track("booking_started", { source: "booking_wizard" });
    }
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step, confirmation]);

  function moveTo(nextStep: number) {
    setErrors({});
    setBookingError("");
    setSlotConflict(false);
    setStep(nextStep);
  }

  function goBack() {
    if (step === 0 || bookingState === "submitting") return;
    if (step === steps.length - 1) idempotencyKeyRef.current = null;
    moveTo(step - 1);
  }

  async function lookUpVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeRegistration(registration);
    if (normalized.length < 2 || normalized.length > 8) {
      setErrors({ registration: "Enter a valid UK registration." });
      focusInvalidField();
      return;
    }
    setErrors({});
    setVehicleLookupMessage("");
    setVehicleView("loading");
    track("vehicle_lookup_started", { source: "booking_wizard" });
    try {
      const response = await fetch("/api/vehicle/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: normalized }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; vehicle?: VehicleDetails; error?: { message?: string } };
      if (!response.ok || !result.success || !result.vehicle) throw new Error(result.error?.message || "lookup_failed");
      setVehicle(result.vehicle);
      setUseStoredVehicle(false);
      setManualVehicle({
        registration: result.vehicle.registration,
        make: result.vehicle.make ?? "",
        model: result.vehicle.model ?? "",
      });
      setVehicleView("found");
      updateSession({ vehicle: result.vehicle, vehicleConfirmed: false, source: "booking_wizard" });
      track("vehicle_lookup_success", { source: "booking_wizard" });
    } catch {
      setManualVehicle((current) => ({ ...current, registration: normalized }));
      setVehicleLookupMessage("Vehicle lookup is temporarily unavailable. Your booking can still continue.");
      setVehicleView("lookup-error");
      track("vehicle_lookup_failed", { source: "booking_wizard" });
    }
  }

  function confirmVehicle() {
    if (!activeVehicle) return;
    updateSession({ vehicle: activeVehicle, vehicleConfirmed: true, source: "booking_wizard" });
    setVehicleView("ready");
    track("booking_vehicle_confirmed", { source: "booking_wizard" });
    moveTo(1);
  }

  function saveManualVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeRegistration(manualVehicle.registration);
    const nextErrors: FieldErrors = {};
    if (normalized.length < 2 || normalized.length > 8) nextErrors.registration = "Enter a valid UK registration.";
    if (manualVehicle.make.trim().length < 2) nextErrors.make = "Enter the vehicle make.";
    if (manualVehicle.model.trim().length < 1) nextErrors.model = "Enter the vehicle model.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      focusInvalidField();
      return;
    }
    const nextVehicle: VehicleDetails = {
      registration: normalized,
      make: manualVehicle.make.trim(),
      model: manualVehicle.model.trim(),
    };
    setVehicle(nextVehicle);
    setUseStoredVehicle(false);
    setVehicleView("ready");
    updateSession({ vehicle: nextVehicle, vehicleConfirmed: true, source: "booking_wizard" });
    track("booking_vehicle_confirmed", { source: "booking_wizard" });
    moveTo(1);
  }

  function searchAgain() {
    clearVehicle();
    setUseStoredVehicle(false);
    setVehicle(null);
    setVehicleView("input");
    setRegistration("");
    setErrors({});
  }

  function chooseService(service: BookingService) {
    setServiceKey(service.key);
    if (service.locationMode !== "both") setLocationMode(service.locationMode);
    setErrors((current) => ({ ...current, service: undefined }));
    updateSession({ selectedService: service.key, source: "booking_wizard" });
    track("booking_service_selected", { source: "booking_wizard", selection: service.key });
  }

  function retryServices() {
    setServicesState("loading");
    void loadServices();
  }

  function toggleSymptom(value: string) {
    setSymptoms((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function continueToNextStep() {
    const nextErrors = validateStep(step);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      focusInvalidField();
      return;
    }
    if (step === 0) track("booking_vehicle_confirmed", { source: "booking_wizard" });
    moveTo(step + 1);
  }

  function validateStep(currentStep: number): FieldErrors {
    const nextErrors: FieldErrors = {};
    if (currentStep === 0 && (!activeVehicle || effectiveVehicleView !== "ready")) {
      nextErrors.vehicle = "Find or enter your vehicle, then confirm it to continue.";
    }
    if (currentStep === 1 && !selectedService) nextErrors.service = "Choose a service to continue.";
    if (currentStep === 2) {
      if (asksMileage && mileage && (!/^\d+$/.test(mileage) || Number(mileage) > 2_000_000)) nextErrors.mileage = "Enter the mileage using numbers only.";
    }
    if (currentStep === 3) {
      if (!selectedService) nextErrors.locationMode = "Choose a service before selecting a location.";
      if (effectiveLocationMode === "mobile") {
        if (address.trim().length < 5) nextErrors.address = "Enter the address where the vehicle is parked.";
        if (postcode.trim().length < 3 || postcode.trim().length > 12) nextErrors.postcode = "Enter a valid postcode.";
        if (vehicleAccessible === undefined) nextErrors.vehicleAccessible = "Tell us whether the vehicle is safely accessible.";
      }
    }
    if (currentStep === 4) {
      if (customer.name.trim().length < 2) nextErrors.name = "Enter your full name.";
      if (!isValidEmail(customer.email)) nextErrors.email = "Enter a valid email address.";
      if (!isValidPhone(customer.phone)) nextErrors.phone = "Enter a valid phone number.";
    }
    if (currentStep === 5) {
      if (!appointmentDate) nextErrors.appointmentDate = "Choose a date and check its availability.";
      if (!appointmentStart) nextErrors.appointmentStart = "Choose an available appointment time.";
    }
    return nextErrors;
  }

  async function loadSlots(targetDate = appointmentDate) {
    if (!selectedService) {
      setErrors({ service: "Choose a service before checking appointment times." });
      moveTo(1);
      return;
    }
    if (!targetDate) {
      setErrors({ appointmentDate: "Choose a date to check." });
      focusInvalidField();
      return;
    }
    const requestId = ++slotRequestRef.current;
    setErrors({});
    setSlotsState("loading");
    setSlots([]);
    setAppointmentStart("");
    const window = appointmentWindow(targetDate);
    try {
      const response = await fetch("/api/bookings/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceKey: selectedService.key,
          locationMode: effectiveLocationMode,
          start: window.start,
          end: window.end,
        }),
      });
      const result = await response.json().catch(() => ({})) as { slots?: unknown; timeZone?: unknown };
      if (!response.ok || !Array.isArray(result.slots)) throw new Error("availability_unavailable");
      if (requestId !== slotRequestRef.current) return;
      const nextSlots = result.slots.filter(isSlot).sort((left, right) => left.start.localeCompare(right.start));
      setSlotTimeZone(safeTimeZone(result.timeZone));
      setSlots(nextSlots);
      setSlotsState(nextSlots.length ? "ready" : "empty");
      track("booking_slot_viewed", { source: "booking_wizard", availability: nextSlots.length ? "available" : "empty" });
    } catch {
      if (requestId !== slotRequestRef.current) return;
      setSlotsState("error");
    }
  }

  function chooseAnotherDate(days: number) {
    const nextDate = shiftDate(appointmentDate || dateBounds.min, days);
    setAppointmentDate(nextDate);
    void loadSlots(nextDate);
  }

  async function confirmBooking() {
    if (submittingRef.current) return;
    if (!activeVehicle || !selectedService || !appointmentStart) {
      setBookingError("Some booking details are missing. Go back and check each step.");
      return;
    }
    submittingRef.current = true;
    setBookingState("submitting");
    setBookingError("");
    setSlotConflict(false);
    idempotencyKeyRef.current ??= createIdempotencyKey();
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle: bookingVehicle(activeVehicle),
          serviceKey: selectedService.key,
          problemDescription: problemDescription.trim(),
          symptoms,
          conditionalAnswers: {
            ...(asksMileage && mileage ? { mileage } : {}),
            ...(asksDiagnosticQuestions && warningLight.trim() ? { warningLight: warningLight.trim() } : {}),
            ...(asksDiagnosticQuestions && issueTiming ? { issueTiming } : {}),
            ...(effectiveLocationMode === "mobile" && vehicleAccessible !== undefined ? { vehicleAccessible: vehicleAccessible ? "yes" : "no_or_unsure" } : {}),
          },
          location: {
            mode: effectiveLocationMode,
            ...(effectiveLocationMode === "mobile" ? { address: address.trim(), postcode: postcode.trim().toUpperCase() } : {}),
          },
          customer: {
            name: customer.name.trim(),
            email: customer.email.trim(),
            phone: customer.phone.trim(),
          },
          appointmentStart,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const result = await response.json().catch(() => ({})) as {
        booking?: Partial<BookingConfirmation>;
        error?: { code?: string; message?: string };
      };
      if (!response.ok || !result.booking?.reference) {
        const conflict = result.error?.code === "slot_unavailable" || result.error?.code === "appointment_unavailable";
        setSlotConflict(conflict);
        setBookingError(conflict
          ? "That appointment time is no longer available. Please choose another time."
          : bookingErrorMessage(result.error?.code));
        setBookingState("error");
        return;
      }
      setConfirmation({
        reference: result.booking.reference,
        status: result.booking.status ?? "confirmed",
        appointmentStart: result.booking.appointmentStart ?? appointmentStart,
        email: result.booking.email ?? customer.email.trim(),
        vehicle: activeVehicle,
        service: selectedService,
        locationLabel: effectiveLocationMode === "workshop" ? "SOB Autofix workshop" : postcode.trim().toUpperCase(),
        timeZone: slotTimeZone,
      });
      track("booking_completed", { source: "booking_wizard", selection: selectedService.key });
      setStep(0);
      setVehicleView("input");
      setUseStoredVehicle(true);
      setVehicle(null);
      setRegistration("");
      setManualVehicle({ registration: "", make: "", model: "" });
      setVehicleLookupMessage("");
      setServiceKey("");
      setProblemDescription("");
      setSymptoms([]);
      setMileage("");
      setWarningLight("");
      setIssueTiming("");
      setLocationMode("workshop");
      setAddress("");
      setPostcode("");
      setVehicleAccessible(undefined);
      setCustomer({ name: "", email: "", phone: "" });
      setAppointmentDate("");
      setSlots([]);
      setSlotsState("idle");
      setSlotTimeZone(defaultTimeZone);
      setAppointmentStart("");
      setErrors({});
      setBookingError("");
      setSlotConflict(false);
      idempotencyKeyRef.current = null;
      clearVehicle();
      setBookingState("idle");
    } catch {
      setBookingError("We couldn't confirm the booking just now. Please try again.");
      setBookingState("error");
    } finally {
      submittingRef.current = false;
    }
  }

  if (confirmation) {
    const isConfirmed = confirmation.status === "confirmed" || confirmation.status === "rescheduled";
    return (
      <section className="p-5 sm:p-8 lg:p-10" aria-labelledby="booking-confirmed-heading">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 size={34} aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-extrabold tracking-[.16em] text-[#1974E2] uppercase">{isConfirmed ? "Appointment secured" : "Request received"}</p>
          <h2 ref={headingRef} tabIndex={-1} id="booking-confirmed-heading" className="mt-2 text-4xl font-extrabold text-[#071127] outline-none focus-visible:outline-none sm:text-5xl">
            {isConfirmed ? "Booking confirmed" : "Booking request received"}
          </h2>
          <p role="status" className="mt-4 text-[#586575]">
            {isConfirmed
              ? <>We&apos;ve sent the details to {confirmation.email}.</>
              : <>We&apos;ll email {confirmation.email} as soon as the appointment is confirmed.</>}
          </p>
          <div className="mt-7 rounded-2xl border border-[#DCE5EF] bg-[#F7F9FC] p-6 text-left shadow-[0_12px_35px_rgba(7,17,39,0.06)] sm:p-7">
            <p className="text-xs font-extrabold tracking-[.15em] text-[#1974E2] uppercase">Booking reference</p>
            <strong className="mt-1 block font-mono text-3xl tracking-[.08em] text-[#071127]">{confirmation.reference}</strong>
            <dl className="mt-6 grid gap-4 border-t border-[#DCE5EF] pt-6 sm:grid-cols-2">
              <ReviewItem label="Vehicle" value={vehicleLabel(confirmation.vehicle)} support={formatRegistration(confirmation.vehicle.registration)} />
              <ReviewItem label="Service" value={confirmation.service.name} />
              <ReviewItem label="Appointment" value={formatAppointment(confirmation.appointmentStart, confirmation.timeZone)} />
              <ReviewItem label="Location" value={confirmation.locationLabel} />
            </dl>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link href="/manage-booking" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#1974E2] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#168BFF]">
              Manage this booking <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#1974E2]/30 px-5 py-3 text-sm font-bold text-[#071127] transition hover:bg-[#F4F7FA]">
              Return to website
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="min-w-0">
      <nav className="border-b border-[#E4EAF0] bg-[#F7F9FC] px-5 py-4 sm:px-8" aria-label="Booking progress">
        <p className="text-xs font-extrabold tracking-[.14em] text-[#145CAD] uppercase" aria-live="polite">
          Step {step + 1} of {steps.length}: {steps[step]}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#DCE6F2]" aria-hidden="true">
          <span className="block h-full rounded-full bg-[#1974E2] transition-[width]" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <ol className="mt-4 hidden grid-cols-7 gap-2 lg:grid">
          {steps.map((label, index) => (
            <li key={label} className={cn("text-[11px] font-bold", index === step ? "text-[#1446A5]" : index < step ? "text-[#327162]" : "text-[#586575]")} aria-current={index === step ? "step" : undefined}>
              <span className={cn("mr-1 inline-grid h-5 w-5 place-items-center rounded-full text-[10px]", index === step ? "bg-[#1974E2] text-white" : index < step ? "bg-green-100 text-green-800" : "bg-[#E4EAF0] text-[#586575]")}>
                {index < step ? <Check size={12} aria-hidden="true" /> : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      </nav>

      <div className="p-5 pb-7 sm:p-8 lg:p-10">
        {step === 0 && (
          <StepShell headingRef={headingRef} icon={CarFront} eyebrow="Your vehicle" title="Which vehicle are we booking in?" description="Start with the registration. If lookup is unavailable, you can enter the essentials yourself.">
            <VehicleStep
              activeVehicle={activeVehicle}
              view={effectiveVehicleView}
              registration={registration}
              setRegistration={setRegistration}
              manualVehicle={manualVehicle}
              setManualVehicle={setManualVehicle}
              lookupMessage={vehicleLookupMessage}
              errors={errors}
              onLookup={lookUpVehicle}
              onConfirm={confirmVehicle}
              onManual={saveManualVehicle}
              onShowManual={() => {
                setManualVehicle((current) => ({ ...current, registration: current.registration || normalizeRegistration(registration) }));
                setErrors({});
                setVehicleView("manual");
              }}
              onRetry={() => {
                setErrors({});
                setVehicleView("input");
              }}
              onSearchAgain={searchAgain}
            />
          </StepShell>
        )}

        {step === 1 && (
          <StepShell headingRef={headingRef} icon={Wrench} eyebrow="Service" title="What does your vehicle need?" description="Choose the closest option. The technician will still assess the vehicle before any repair work is agreed.">
            <ServiceStep services={services} state={servicesState} selectedKey={selectedService?.key ?? ""} error={errors.service} onChoose={chooseService} onRetry={retryServices} />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell headingRef={headingRef} icon={ClipboardCheck} eyebrow="Problem details" title="What should we know?" description="Describe the symptoms in your own words. This helps us prepare; it is not treated as a diagnosis.">
            <ProblemStep
              problemDescription={problemDescription}
              setProblemDescription={setProblemDescription}
              symptoms={symptoms}
              onToggleSymptom={toggleSymptom}
              asksMileage={asksMileage}
              mileage={mileage}
              setMileage={setMileage}
              asksDiagnosticQuestions={asksDiagnosticQuestions}
              warningLight={warningLight}
              setWarningLight={setWarningLight}
              issueTiming={issueTiming}
              setIssueTiming={setIssueTiming}
              errors={errors}
            />
          </StepShell>
        )}

        {step === 3 && selectedService && (
          <StepShell headingRef={headingRef} icon={MapPin} eyebrow="Service location" title="Where should we assess the vehicle?" description="The available choices are based on the service you selected.">
            <LocationStep
              service={selectedService}
              mode={effectiveLocationMode}
              setMode={setLocationMode}
              address={address}
              setAddress={setAddress}
              postcode={postcode}
              setPostcode={setPostcode}
              vehicleAccessible={vehicleAccessible}
              setVehicleAccessible={setVehicleAccessible}
              errors={errors}
            />
          </StepShell>
        )}

        {step === 4 && (
          <StepShell headingRef={headingRef} icon={UserRound} eyebrow="Your details" title="How can we confirm the booking?" description="No account is needed. We only use these details to arrange and manage this appointment.">
            <CustomerStep customer={customer} setCustomer={setCustomer} errors={errors} />
          </StepShell>
        )}

        {step === 5 && selectedService && (
          <StepShell headingRef={headingRef} icon={CalendarDays} eyebrow="Appointment" title="Choose an appointment" description="Pick a date, check the current availability, then choose a time.">
            <AppointmentStep
              date={appointmentDate}
              setDate={(value) => {
                setAppointmentDate(value);
                setAppointmentStart("");
                setSlots([]);
                setSlotsState("idle");
                setErrors({});
              }}
              minDate={dateBounds.min}
              maxDate={dateBounds.max}
              state={slotsState}
              slots={slots}
              selectedStart={appointmentStart}
              timeZone={slotTimeZone}
              errors={errors}
              onLoad={() => void loadSlots()}
              onSelect={(start) => {
                setAppointmentStart(start);
                setErrors((current) => ({ ...current, appointmentStart: undefined }));
              }}
              onNextDay={() => chooseAnotherDate(1)}
            />
          </StepShell>
        )}

        {step === 6 && activeVehicle && selectedService && (
          <StepShell headingRef={headingRef} icon={CheckCircle2} eyebrow="Review" title="Review your booking" description="Nothing is booked until you select Confirm booking below.">
            <ReviewStep
              vehicle={activeVehicle}
              service={selectedService}
              problemDescription={problemDescription}
              symptoms={symptoms}
              mileage={asksMileage ? mileage : ""}
              warningLight={asksDiagnosticQuestions ? warningLight : ""}
              issueTiming={asksDiagnosticQuestions ? issueTiming : ""}
              locationMode={effectiveLocationMode}
              address={address}
              postcode={postcode}
              vehicleAccessible={effectiveLocationMode === "mobile" ? vehicleAccessible : undefined}
              customer={customer}
              appointmentStart={appointmentStart}
              timeZone={slotTimeZone}
            />
            {bookingError && (
              <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p>{bookingError}</p>
                {slotConflict && <button type="button" className="mt-2 font-bold text-[#1446A5] underline" onClick={() => { idempotencyKeyRef.current = null; moveTo(5); }}>Choose another time</button>}
              </div>
            )}
          </StepShell>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-[#E4EAF0] bg-white/95 px-5 py-4 shadow-[0_-12px_30px_rgba(7,17,39,.07)] backdrop-blur sm:px-8">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={goBack} disabled={bookingState === "submitting"} className="px-4">
            <ChevronLeft size={18} aria-hidden="true" /> Back
          </Button>
        ) : <span />}
        {step < steps.length - 1 ? (
          <Button type="button" onClick={continueToNextStep} disabled={effectiveVehicleView === "loading" || bookingState === "submitting"}>
            Continue <ArrowRight size={18} aria-hidden="true" />
          </Button>
        ) : (
          <Button type="button" onClick={() => void confirmBooking()} disabled={bookingState === "submitting"} className="min-w-40">
            {bookingState === "submitting" ? <><LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> Confirming…</> : <><Check size={18} aria-hidden="true" /> Confirm booking</>}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepShell({ headingRef, icon: Icon, eyebrow, title, description, children }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  icon: typeof CarFront;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby="booking-step-heading">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1974E2]"><Icon size={24} aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-[.14em] text-[#1974E2] uppercase">{eyebrow}</p>
          <h2 ref={headingRef} tabIndex={-1} id="booking-step-heading" className="mt-1 text-3xl leading-tight font-extrabold text-[#071127] outline-none focus-visible:outline-none sm:text-4xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#586575] sm:text-base">{description}</p>
        </div>
      </div>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function VehicleStep({ activeVehicle, view, registration, setRegistration, manualVehicle, setManualVehicle, lookupMessage, errors, onLookup, onConfirm, onManual, onShowManual, onRetry, onSearchAgain }: {
  activeVehicle: VehicleDetails | null;
  view: VehicleView;
  registration: string;
  setRegistration: (value: string) => void;
  manualVehicle: { registration: string; make: string; model: string };
  setManualVehicle: React.Dispatch<React.SetStateAction<{ registration: string; make: string; model: string }>>;
  lookupMessage: string;
  errors: FieldErrors;
  onLookup: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
  onManual: (event: FormEvent<HTMLFormElement>) => void;
  onShowManual: () => void;
  onRetry: () => void;
  onSearchAgain: () => void;
}) {
  if (view === "loading") {
    return <div role="status" aria-live="polite" className="flex min-h-36 items-center justify-center gap-3 rounded-2xl bg-[#F4F7FA] text-sm font-bold text-[#344256]"><LoaderCircle className="animate-spin text-[#1974E2]" aria-hidden="true" /> Finding your vehicle…</div>;
  }

  if ((view === "found" || view === "ready") && activeVehicle) {
    const facts = [activeVehicle.year, activeVehicle.fuelType, activeVehicle.transmission, activeVehicle.colour].filter(Boolean);
    return (
      <>
      <div className="rounded-2xl border border-[#B9D7FA] bg-[#F5F9FF] p-5 sm:p-6">
        <p className="flex items-center gap-2 text-xs font-extrabold tracking-[.14em] text-[#145CAD] uppercase"><Check size={16} aria-hidden="true" /> {view === "found" ? "Vehicle found" : "Vehicle ready"}</p>
        <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <span className="inline-block rounded-lg bg-white px-3 py-2 font-mono text-lg font-black tracking-[.12em] text-black shadow-sm">{formatRegistration(activeVehicle.registration)}</span>
            <h3 className="mt-3 text-2xl font-extrabold text-[#071127]">{vehicleLabel(activeVehicle)}</h3>
            {facts.length > 0 && <p className="mt-1 text-sm text-[#586575]">{facts.join(" · ")}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {view === "found" && <Button type="button" onClick={onConfirm}>Yes, this is my vehicle <ArrowRight size={18} aria-hidden="true" /></Button>}
            <button type="button" className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-bold text-[#145CAD] underline" onClick={onSearchAgain}><ChevronLeft size={17} aria-hidden="true" /> Search again</button>
          </div>
        </div>
      </div>
      {errors.vehicle && <p role="alert" className="mt-3 text-sm text-red-700">{errors.vehicle}</p>}
      </>
    );
  }

  if (view === "lookup-error") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[#4E3A10] sm:p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <div><h3 className="text-xl font-extrabold">We couldn&apos;t load the vehicle details.</h3><p className="mt-2 text-sm leading-6">{lookupMessage}</p></div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={onRetry}>Try again</Button>
          <Button type="button" onClick={onShowManual}>Enter vehicle manually</Button>
        </div>
      </div>
    );
  }

  if (view === "manual") {
    return (
      <form onSubmit={onManual} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Vehicle registration" htmlFor="manual-registration" error={errors.registration}>
            <input id="manual-registration" value={manualVehicle.registration} onChange={(event) => setManualVehicle((current) => ({ ...current, registration: event.target.value.toUpperCase() }))} className={inputClass} autoComplete="off" maxLength={9} aria-invalid={Boolean(errors.registration)} aria-describedby={errors.registration ? "manual-registration-error" : undefined} />
          </Field>
          <div className="hidden sm:block" />
          <Field label="Make" htmlFor="manual-make" error={errors.make}>
            <input id="manual-make" value={manualVehicle.make} onChange={(event) => setManualVehicle((current) => ({ ...current, make: event.target.value }))} className={inputClass} autoComplete="off" maxLength={60} aria-invalid={Boolean(errors.make)} aria-describedby={errors.make ? "manual-make-error" : undefined} />
          </Field>
          <Field label="Model" htmlFor="manual-model" error={errors.model}>
            <input id="manual-model" value={manualVehicle.model} onChange={(event) => setManualVehicle((current) => ({ ...current, model: event.target.value }))} className={inputClass} autoComplete="off" maxLength={60} aria-invalid={Boolean(errors.model)} aria-describedby={errors.model ? "manual-model-error" : undefined} />
          </Field>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button type="submit">Continue with these details <ArrowRight size={18} aria-hidden="true" /></Button>
          <Button type="button" variant="outline" onClick={onRetry}><ChevronLeft size={18} aria-hidden="true" /> Back to lookup</Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onLookup} noValidate>
      <label htmlFor="booking-registration" className="block text-sm font-bold text-[#071127]">Vehicle registration</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <div className="flex min-h-16 flex-1 overflow-hidden rounded-xl border border-[#C8D4E0] bg-white shadow-inner focus-within:border-[#168BFF] focus-within:ring-4 focus-within:ring-[#168BFF]/10">
          <span className="plate-strip grid w-12 shrink-0 place-items-center text-xs font-bold text-white" aria-hidden="true">GB</span>
          <input id="booking-registration" value={registration} onChange={(event) => setRegistration(event.target.value.toUpperCase())} className="min-w-0 flex-1 border-0 bg-white px-4 font-mono text-xl font-black tracking-[.13em] text-black outline-none" placeholder="AB12 CDE" autoComplete="off" maxLength={9} aria-invalid={Boolean(errors.registration)} aria-describedby={errors.registration ? "booking-registration-error" : "registration-privacy"} />
        </div>
        <Button type="submit" className="min-h-16 px-7"><Search size={19} aria-hidden="true" /> Find vehicle</Button>
      </div>
      {errors.registration && <p id="booking-registration-error" className="mt-2 text-sm text-red-700">{errors.registration}</p>}
      {errors.vehicle && <p role="alert" className="mt-2 text-sm text-red-700">{errors.vehicle}</p>}
      <div className="mt-3 flex flex-col items-start justify-between gap-2 text-xs text-[#667586] sm:flex-row sm:items-center">
        <p id="registration-privacy">Your registration stays out of page addresses and analytics.</p>
        <button type="button" onClick={onShowManual} className="min-h-10 font-bold text-[#145CAD] underline">Enter details manually</button>
      </div>
    </form>
  );
}

function ServiceStep({ services, state, selectedKey, error, onChoose, onRetry }: { services: BookingService[]; state: LoadState; selectedKey: string; error?: string; onChoose: (service: BookingService) => void; onRetry: () => void }) {
  if (state === "loading") return <LoadingPanel message="Loading the services available to book…" />;
  if (state === "error" || state === "empty") {
    return <AvailabilityFallback title={state === "empty" ? "There are no online services available right now." : "Online service options are temporarily unavailable."} onRetry={onRetry} />;
  }
  return (
    <fieldset aria-invalid={Boolean(error)} aria-describedby={error ? "booking-service-error" : undefined} tabIndex={error ? -1 : undefined}>
      <legend className="sr-only">Choose a service</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const selected = selectedKey === service.key;
          return (
            <label key={service.key} className={cn("relative flex min-h-28 cursor-pointer items-start gap-4 rounded-2xl border p-4 transition focus-within:ring-4 focus-within:ring-[#168BFF]/20", selected ? "border-[#1974E2] bg-[#EAF3FF] shadow-sm" : "border-[#D7E0E9] bg-white hover:border-[#79AFE9] hover:bg-[#F8FBFF]")}>
              <input type="radio" name="booking-service" value={service.key} checked={selected} onChange={() => onChoose(service)} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" aria-describedby={error ? "booking-service-error" : undefined} />
              <span className={cn("mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl", selected ? "bg-[#1974E2] text-white" : "bg-[#EAF3FF] text-[#1974E2]")}><Wrench size={20} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <strong className="block text-base text-[#071127]">{service.name}</strong>
                <span className="mt-1 block text-sm leading-5 text-[#586575]">{service.description}</span>
                <span className="mt-3 inline-block rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold tracking-[.08em] text-[#145CAD] uppercase">{locationModeLabel(service.locationMode)}</span>
              </span>
              {selected && <CheckCircle2 className="shrink-0 text-[#1974E2]" size={20} aria-hidden="true" />}
            </label>
          );
        })}
      </div>
      {error && <p id="booking-service-error" role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}

function ProblemStep({ problemDescription, setProblemDescription, symptoms, onToggleSymptom, asksMileage, mileage, setMileage, asksDiagnosticQuestions, warningLight, setWarningLight, issueTiming, setIssueTiming, errors }: {
  problemDescription: string;
  setProblemDescription: (value: string) => void;
  symptoms: string[];
  onToggleSymptom: (value: string) => void;
  asksMileage: boolean;
  mileage: string;
  setMileage: (value: string) => void;
  asksDiagnosticQuestions: boolean;
  warningLight: string;
  setWarningLight: (value: string) => void;
  issueTiming: string;
  setIssueTiming: (value: string) => void;
  errors: FieldErrors;
}) {
  return (
    <div className="grid gap-6">
      <Field label="Tell us what is happening (optional)" htmlFor="problem-description">
        <textarea id="problem-description" value={problemDescription} onChange={(event) => setProblemDescription(event.target.value)} rows={5} maxLength={2000} placeholder="Describe when it happens, what you notice and any recent changes." className={inputClass} aria-describedby="problem-description-help" />
      </Field>
      <p id="problem-description-help" className="-mt-4 text-xs text-[#667586]">Please avoid including contact details here.</p>
      <fieldset>
        <legend className="text-sm font-bold text-[#071127]">Symptoms noticed <span className="font-normal text-[#667586]">(optional)</span></legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {symptomOptions.map((option) => (
            <label key={option.value} className={cn("flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition focus-within:ring-4 focus-within:ring-[#168BFF]/20", symptoms.includes(option.value) ? "border-[#1974E2] bg-[#EAF3FF] text-[#1446A5]" : "border-[#D7E0E9] text-[#344256]")}>
              <input type="checkbox" checked={symptoms.includes(option.value)} onChange={() => onToggleSymptom(option.value)} className="h-4 w-4 accent-[#1974E2]" /> {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {(asksMileage || asksDiagnosticQuestions) && (
        <div className="grid gap-5 sm:grid-cols-2">
          {asksMileage && <Field label="Current mileage (optional)" htmlFor="current-mileage" error={errors.mileage}><input id="current-mileage" value={mileage} onChange={(event) => setMileage(event.target.value)} inputMode="numeric" maxLength={7} className={inputClass} aria-invalid={Boolean(errors.mileage)} aria-describedby={errors.mileage ? "current-mileage-error" : undefined} /></Field>}
          {asksDiagnosticQuestions && <Field label="Which warning light have you noticed? (optional)" htmlFor="warning-light"><input id="warning-light" value={warningLight} onChange={(event) => setWarningLight(event.target.value)} maxLength={120} className={inputClass} placeholder="For example, engine management" /></Field>}
          {asksDiagnosticQuestions && <Field label="When does the issue happen? (optional)" htmlFor="issue-timing"><select id="issue-timing" value={issueTiming} onChange={(event) => setIssueTiming(event.target.value)} className={inputClass}><option value="">Select if known</option><option value="all_the_time">All the time</option><option value="intermittently">Intermittently</option><option value="when_starting">When starting</option><option value="while_driving">While driving</option><option value="under_load">Under load or acceleration</option></select></Field>}
        </div>
      )}
    </div>
  );
}

function LocationStep({ service, mode, setMode, address, setAddress, postcode, setPostcode, vehicleAccessible, setVehicleAccessible, errors }: {
  service: BookingService;
  mode: LocationMode;
  setMode: (mode: LocationMode) => void;
  address: string;
  setAddress: (value: string) => void;
  postcode: string;
  setPostcode: (value: string) => void;
  vehicleAccessible: boolean | undefined;
  setVehicleAccessible: (value: boolean) => void;
  errors: FieldErrors;
}) {
  const availableModes: LocationMode[] = service.locationMode === "both" ? ["workshop", "mobile"] : [service.locationMode];
  return (
    <div>
      <fieldset>
        <legend className="sr-only">Choose service location</legend>
        <div className={cn("grid gap-3", availableModes.length > 1 && "sm:grid-cols-2")}>
          {availableModes.map((option) => {
            const mobile = option === "mobile";
            const Icon = mobile ? Smartphone : Building2;
            return (
              <label key={option} className={cn("relative flex min-h-28 cursor-pointer items-start gap-4 rounded-2xl border p-4 transition focus-within:ring-4 focus-within:ring-[#168BFF]/20", mode === option ? "border-[#1974E2] bg-[#EAF3FF]" : "border-[#D7E0E9]")}>
                <input type="radio" name="location-mode" value={option} checked={mode === option} onChange={() => setMode(option)} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", mode === option ? "bg-[#1974E2] text-white" : "bg-[#F4F7FA] text-[#1974E2]")}><Icon size={20} aria-hidden="true" /></span>
                <span><strong className="block text-[#071127]">{mobile ? "Mobile service" : "Bring vehicle to SOB Autofix"}</strong><span className="mt-1 block text-sm leading-5 text-[#586575]">{mobile ? "We assess the vehicle where it is parked." : workshopAddress}</span></span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {errors.locationMode && <p role="alert" className="mt-3 text-sm text-red-700">{errors.locationMode}</p>}
      {mode !== "workshop" && (
        <div className="mt-6 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Vehicle address" htmlFor="mobile-address" error={errors.address}><input id="mobile-address" value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" maxLength={180} className={inputClass} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "mobile-address-error" : undefined} /></Field>
            <Field label="Postcode" htmlFor="mobile-postcode" error={errors.postcode}><input id="mobile-postcode" value={postcode} onChange={(event) => setPostcode(event.target.value.toUpperCase())} autoComplete="postal-code" maxLength={12} className={inputClass} aria-invalid={Boolean(errors.postcode)} aria-describedby={errors.postcode ? "mobile-postcode-error" : undefined} /></Field>
          </div>
          <fieldset aria-invalid={Boolean(errors.vehicleAccessible)} aria-describedby={errors.vehicleAccessible ? "vehicle-accessible-error" : undefined} tabIndex={errors.vehicleAccessible ? -1 : undefined}>
            <legend className="text-sm font-bold text-[#071127]">Is the vehicle safely accessible where it is parked?</legend>
            <div className="mt-2 flex gap-3">
              {[{ label: "Yes", value: true }, { label: "No / not sure", value: false }].map((option) => <label key={option.label} className={cn("relative flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border px-4 text-sm font-bold focus-within:ring-4 focus-within:ring-[#168BFF]/20", vehicleAccessible === option.value ? "border-[#1974E2] bg-[#EAF3FF] text-[#1446A5]" : "border-[#D7E0E9]")}><input type="radio" name="vehicle-accessible" className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" checked={vehicleAccessible === option.value} onChange={() => setVehicleAccessible(option.value)} aria-describedby={errors.vehicleAccessible ? "vehicle-accessible-error" : undefined} />{option.label}</label>)}
            </div>
            {errors.vehicleAccessible && <p id="vehicle-accessible-error" role="alert" className="mt-2 text-sm text-red-700">{errors.vehicleAccessible}</p>}
          </fieldset>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Some work may require workshop equipment after the initial assessment.</p>
        </div>
      )}
    </div>
  );
}

function CustomerStep({ customer, setCustomer, errors }: { customer: { name: string; email: string; phone: string }; setCustomer: React.Dispatch<React.SetStateAction<{ name: string; email: string; phone: string }>>; errors: FieldErrors }) {
  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="customer-name" error={errors.name}><input id="customer-name" value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} autoComplete="name" maxLength={100} className={inputClass} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "customer-name-error" : undefined} /></Field>
        <Field label="Phone number" htmlFor="customer-phone" error={errors.phone}><input id="customer-phone" type="tel" value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" maxLength={30} placeholder="07469 273483" className={inputClass} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "customer-phone-error" : undefined} /></Field>
        <Field label="Email address" htmlFor="customer-email" error={errors.email}><input id="customer-email" type="email" value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} autoComplete="email" maxLength={254} className={inputClass} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "customer-email-error" : undefined} /></Field>
      </div>
      <p className="mt-5 text-xs leading-5 text-[#667586]">We&apos;ll send the booking confirmation to your email. Read our <Link href="/privacy" target="_blank" className="font-bold text-[#145CAD] underline">privacy notice</Link>.</p>
    </div>
  );
}

function AppointmentStep({ date, setDate, minDate, maxDate, state, slots, selectedStart, timeZone, errors, onLoad, onSelect, onNextDay }: {
  date: string;
  setDate: (value: string) => void;
  minDate: string;
  maxDate: string;
  state: LoadState;
  slots: Slot[];
  selectedStart: string;
  timeZone: string;
  errors: FieldErrors;
  onLoad: () => void;
  onSelect: (start: string) => void;
  onNextDay: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col items-end gap-3 sm:flex-row">
        <Field label="Appointment date" htmlFor="appointment-date" error={errors.appointmentDate} className="w-full sm:max-w-xs">
          <input id="appointment-date" type="date" value={date} min={minDate} max={maxDate} onChange={(event) => setDate(event.target.value)} className={inputClass} aria-invalid={Boolean(errors.appointmentDate)} aria-describedby={errors.appointmentDate ? "appointment-date-error" : undefined} />
        </Field>
        <Button type="button" onClick={onLoad} disabled={state === "loading"} className="w-full sm:w-auto">{state === "loading" ? <><LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> Checking…</> : "Check available times"}</Button>
      </div>
      {state === "idle" && <p className="mt-5 rounded-xl bg-[#F4F7FA] p-4 text-sm text-[#586575]">Choose a date to see the current appointment times.</p>}
      {state === "loading" && <div className="mt-5"><LoadingPanel message="Checking appointment availability…" compact /></div>}
      {state === "empty" && (
        <div className="mt-5 rounded-2xl border border-[#D7E0E9] bg-[#F8FAFC] p-5">
          <h3 className="text-xl font-extrabold text-[#071127]">No appointments on this date</h3>
          <p className="mt-2 text-sm leading-6 text-[#586575]">Try the next day, choose another date, or send us an enquiry.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row"><Button type="button" onClick={onNextDay}>Check next day</Button><Link href="/get-a-quote" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#1974E2]/25 px-5 py-3 text-sm font-bold text-[#071127]">Send a booking enquiry</Link></div>
        </div>
      )}
      {state === "error" && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" /><div><h3 className="text-xl font-extrabold text-[#4E3A10]">Online appointment availability is temporarily unavailable.</h3><p className="mt-2 text-sm leading-6 text-amber-900">Your details are still here. You can try again or contact SOB Autofix.</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Button type="button" onClick={onLoad}>Try again</Button>
            <Link href="/get-a-quote" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-amber-500/50 bg-white px-4 py-3 text-sm font-bold text-[#071127]">Send an enquiry</Link>
            <a href={contactLinks.phone} onClick={() => track("phone_clicked", { source: "booking_availability" })} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-amber-500/50 bg-white px-4 py-3 text-sm font-bold text-[#071127]"><Phone size={17} aria-hidden="true" /> Call {formatPhone(siteConfig.phone)}</a>
          </div>
        </div>
      )}
      {state === "ready" && (
        <fieldset className="mt-6">
          <legend className="text-sm font-bold text-[#071127]">Available times</legend>
          <p className="mt-1 text-xs text-[#667586]">Times are shown in UK local time.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {slots.map((slot) => <button key={slot.start} type="button" aria-pressed={selectedStart === slot.start} onClick={() => onSelect(slot.start)} className={cn("min-h-12 rounded-xl border px-4 py-3 text-sm font-extrabold transition focus-visible:ring-4 focus-visible:ring-[#168BFF]/20", selectedStart === slot.start ? "border-[#1974E2] bg-[#1974E2] text-white shadow-md" : "border-[#B9C9D9] bg-white text-[#071127] hover:border-[#1974E2] hover:bg-[#EAF3FF]")}>{formatTime(slot.start, timeZone)}</button>)}
          </div>
        </fieldset>
      )}
      {errors.appointmentStart && <p role="alert" className="mt-3 text-sm text-red-700">{errors.appointmentStart}</p>}
      {(state === "ready" || state === "empty") && <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm"><button type="button" onClick={onNextDay} className="font-bold text-[#145CAD] underline">Check the next day</button><Link href="/get-a-quote" className="font-bold text-[#145CAD] underline">No suitable time? Send an enquiry</Link></div>}
    </div>
  );
}

function ReviewStep({ vehicle, service, problemDescription, symptoms, mileage, warningLight, issueTiming, locationMode, address, postcode, vehicleAccessible, customer, appointmentStart, timeZone }: {
  vehicle: VehicleDetails;
  service: BookingService;
  problemDescription: string;
  symptoms: string[];
  mileage: string;
  warningLight: string;
  issueTiming: string;
  locationMode: LocationMode;
  address: string;
  postcode: string;
  vehicleAccessible: boolean | undefined;
  customer: { name: string; email: string; phone: string };
  appointmentStart: string;
  timeZone: string;
}) {
  const symptomLabels = symptoms.map((value) => symptomOptions.find((option) => option.value === value)?.label).filter(Boolean).join(", ");
  const conditional = [mileage ? `${Number(mileage).toLocaleString("en-GB")} miles` : "", warningLight, issueTiming ? issueTimingLabel(issueTiming) : ""].filter(Boolean).join(" · ");
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <ReviewCard icon={CarFront} label="Vehicle" value={vehicleLabel(vehicle)} support={formatRegistration(vehicle.registration)} />
      <ReviewCard icon={Wrench} label="Service" value={service.name} />
      <ReviewCard icon={ClipboardCheck} label="Problem" value={problemDescription || "Not provided"} support={[symptomLabels, conditional].filter(Boolean).join(" · ")} wide />
      <ReviewCard icon={MapPin} label="Location" value={locationMode === "workshop" ? "SOB Autofix workshop" : address} support={locationMode === "workshop" ? workshopAddress : `${postcode.toUpperCase()} · ${vehicleAccessible ? "Vehicle safely accessible" : "Access needs checking"}`} />
      <ReviewCard icon={CalendarDays} label="Appointment" value={formatAppointment(appointmentStart, timeZone)} />
      <ReviewCard icon={UserRound} label="Customer" value={customer.name} support={`${customer.email} · ${customer.phone}`} />
    </dl>
  );
}

function ReviewCard({ icon: Icon, label, value, support, wide = false }: { icon: typeof CarFront; label: string; value: string; support?: string; wide?: boolean }) {
  return <div className={cn("rounded-2xl border border-[#D7E0E9] bg-[#F8FAFC] p-4", wide && "sm:col-span-2")}><dt className="flex items-center gap-2 text-xs font-extrabold tracking-[.12em] text-[#145CAD] uppercase"><Icon size={16} aria-hidden="true" />{label}</dt><dd className="mt-2 break-words font-bold text-[#071127]">{value}</dd>{support && <dd className="mt-1 break-words text-sm leading-5 text-[#586575]">{support}</dd>}</div>;
}

function ReviewItem({ label, value, support, dark = false }: { label: string; value: string; support?: string; dark?: boolean }) {
  return <div><dt className={cn("text-xs font-extrabold tracking-[.12em] uppercase", dark ? "text-[#67B9FF]" : "text-[#145CAD]")}>{label}</dt><dd className="mt-1 font-bold">{value}</dd>{support && <dd className={cn("mt-1 text-sm", dark ? "text-[#C6D2DF]" : "text-[#586575]")}>{support}</dd>}</div>;
}

function Field({ label, htmlFor, error, className, children }: { label: string; htmlFor: string; error?: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><label htmlFor={htmlFor} className="block text-sm font-bold text-[#071127]">{label}</label>{children}{error && <p id={`${htmlFor}-error`} className="mt-1 text-sm text-red-700">{error}</p>}</div>;
}

function LoadingPanel({ message, compact = false }: { message: string; compact?: boolean }) {
  return <div role="status" aria-live="polite" className={cn("flex items-center justify-center gap-3 rounded-2xl bg-[#F4F7FA] text-sm font-bold text-[#344256]", compact ? "min-h-24" : "min-h-40")}><LoaderCircle className="animate-spin text-[#1974E2]" aria-hidden="true" />{message}</div>;
}

function AvailabilityFallback({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="text-xl font-extrabold text-[#4E3A10]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-amber-900">Try again, send a booking enquiry, or call us and we&apos;ll help.</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row"><Button type="button" onClick={onRetry}>Try again</Button><Link href="/get-a-quote" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-amber-500/50 bg-white px-4 py-3 text-sm font-bold text-[#071127]">Send a booking enquiry</Link><a href={contactLinks.phone} onClick={() => track("phone_clicked", { source: "booking_services" })} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-amber-500/50 bg-white px-4 py-3 text-sm font-bold text-[#071127]"><Phone size={17} aria-hidden="true" /> Call us</a></div>
    </div>
  );
}

function isBookingService(value: unknown): value is BookingService {
  if (!value || typeof value !== "object") return false;
  const service = value as Partial<BookingService>;
  return typeof service.key === "string"
    && typeof service.name === "string"
    && typeof service.description === "string"
    && (service.locationMode === "workshop" || service.locationMode === "mobile" || service.locationMode === "both");
}

function isSlot(value: unknown): value is Slot {
  if (!value || typeof value !== "object") return false;
  const slot = value as Partial<Slot>;
  return typeof slot.start === "string" && Number.isFinite(Date.parse(slot.start));
}

function bookingVehicle(vehicle: VehicleDetails) {
  return {
    registration: normalizeRegistration(vehicle.registration),
    ...(vehicle.make ? { make: vehicle.make } : {}),
    ...(vehicle.model ? { model: vehicle.model } : {}),
    ...(vehicle.year ? { year: vehicle.year } : {}),
    ...(vehicle.fuelType ? { fuelType: vehicle.fuelType } : {}),
    ...(vehicle.transmission ? { transmission: vehicle.transmission } : {}),
    ...(vehicle.colour ? { colour: vehicle.colour } : {}),
  };
}

function vehicleLabel(vehicle: VehicleDetails) {
  return [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle details entered";
}

function locationModeLabel(mode: ServiceLocationMode) {
  if (mode === "mobile") return "Mobile service";
  if (mode === "workshop") return "Workshop";
  return "Workshop or mobile";
}

function issueTimingLabel(value: string) {
  return ({ all_the_time: "All the time", intermittently: "Intermittently", when_starting: "When starting", while_driving: "While driving", under_load: "Under load or acceleration" } as Record<string, string>)[value] ?? value;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string) {
  const trimmed = value.trim();
  if (!/^[+\d][\d\s()-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function getDateBounds() {
  const today = new Date();
  const max = new Date(today);
  max.setDate(max.getDate() + 90);
  return { min: localDateValue(today), max: localDateValue(max) };
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function appointmentWindow(date: string) {
  return { start: date, end: shiftDate(date, 1) };
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function safeTimeZone(value: unknown) {
  if (typeof value !== "string") return defaultTimeZone;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return defaultTimeZone;
  }
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: safeTimeZone(timeZone) }).format(new Date(value));
}

function formatAppointment(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: safeTimeZone(timeZone) }).format(new Date(value));
}

function createIdempotencyKey() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function bookingErrorMessage(code?: string) {
  if (code === "validation_error" || code === "invalid_request") return "Some booking details could not be accepted. Go back and check them, then try again.";
  if (code === "rate_limited") return "There have been too many booking attempts. Please wait a moment and try again.";
  return "The booking service is temporarily unavailable. Your details are still here, so you can try again.";
}

function focusInvalidField() {
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>("[aria-invalid='true']");
    field?.focus();
  });
}
