"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { cloneElement, useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";
import type { EnquiryType } from "@/types/domain";
import { useVehicleSession } from "@/components/vehicle/vehicle-context";
import { VehicleSummary } from "@/components/vehicle/vehicle-summary";
import { TurnstileField } from "./turnstile-field";

const schema = z.object({
  name: z.string().min(2, "Enter your name").max(100),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  phone: z.string().min(7, "Enter a phone number").max(30),
  preferredContact: z.enum(["phone", "whatsapp", "email"]),
  serviceSlug: z.string().max(100).optional(),
  description: z.string().min(10, "Tell us a little more about the problem").max(3000),
  locationPostcode: z.string().max(12).optional(),
  driveable: z.enum(["yes", "no", "unknown"]).optional(),
  privacyAccepted: z.boolean().refine((value) => value, "Please confirm you have read the privacy notice"),
});

type Fields = z.infer<typeof schema>;

const eventForType: Partial<Record<EnquiryType, Parameters<typeof track>[0]>> = {
  mobile: "mobile_mechanic_submitted",
  inspection: "inspection_enquiry_submitted",
  recovery: "recovery_enquiry_submitted",
  vehicle_sales: "vehicle_sales_enquiry",
  fleet: "fleet_enquiry_submitted",
  repair: "quote_submitted",
  diagnostic: "quote_submitted",
};

export function EnquiryForm({ type, title = "Tell us what you need", defaultService, askLocation = false, allowUploads = true }: { type: EnquiryType; title?: string; defaultService?: string; askLocation?: boolean; allowUploads?: boolean }) {
  const { session } = useVehicleSession();
  const [turnstileToken, setTurnstileToken] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { preferredContact: "phone", serviceSlug: defaultService || session.selectedService || "", privacyAccepted: false },
  });
  const handleToken = useCallback((token: string) => setTurnstileToken(token), []);

  async function onSubmit(values: Fields) {
    setResult(null);
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          contact: { name: values.name, email: values.email || undefined, phone: values.phone, preferredContact: values.preferredContact },
          vehicle: session.vehicle || undefined,
          serviceSlug: values.serviceSlug || session.selectedService || undefined,
          description: values.description,
          locationPostcode: values.locationPostcode || undefined,
          driveable: values.driveable === "unknown" ? undefined : values.driveable === "yes",
          turnstileToken,
        }),
      });
      const body = await response.json() as { success?: boolean; id?: string; uploadToken?: string; error?: { message?: string } };
      if (!response.ok || !body.success || !body.id) throw new Error(body.error?.message || "Your request could not be sent.");

      if (files.length && body.uploadToken) await uploadAttachments(body.id, body.uploadToken, files);
      const event = eventForType[type];
      if (event) track(event, { type });
      setResult({ success: true, message: "Thanks—your request has been received. We’ll review it and contact you using your preferred method." });
      reset();
      setFiles([]);
    } catch (error) {
      setResult({ success: false, message: error instanceof Error ? error.message : "Your request could not be sent." });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-3xl border border-[#E4EAF0] bg-white p-6 shadow-xl sm:p-8" noValidate>
      <h2 className="text-3xl font-extrabold text-[#071127]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#586575]">We’ll use these details only to respond to this request.</p>
      <div className="mt-6"><VehicleSummary /></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message}><input {...register("name")} autoComplete="name" /></Field>
        <Field label="Phone" error={errors.phone?.message}><input {...register("phone")} type="tel" autoComplete="tel" /></Field>
        <Field label="Email (optional)" error={errors.email?.message}><input {...register("email")} type="email" autoComplete="email" /></Field>
        <Field label="Preferred contact" error={errors.preferredContact?.message}><select {...register("preferredContact")}><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></Field>
        {askLocation && <Field label="Current postcode" error={errors.locationPostcode?.message}><input {...register("locationPostcode")} autoComplete="postal-code" /></Field>}
        {askLocation && <Field label="Can the vehicle be driven?" error={errors.driveable?.message}><select {...register("driveable")} defaultValue="unknown"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></select></Field>}
      </div>
      <div className="mt-5"><Field label="What is happening?" error={errors.description?.message}><textarea {...register("description")} rows={5} placeholder="Describe the symptoms, warning lights or work you need." /></Field></div>
      {allowUploads && <div className="mt-5"><label className="block text-sm font-bold text-[#071127]">Photos (optional)</label><input className="mt-2 block w-full rounded-xl border border-[#D7E0E9] p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[#EAF3FF] file:px-4 file:py-2 file:font-bold file:text-[#1446A5]" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} /><p className="mt-1 text-xs text-[#667586]">Up to five JPG, PNG or WebP images, 8 MB each.</p></div>}
      <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-[#586575]"><input {...register("privacyAccepted")} type="checkbox" className="mt-1 h-4 w-4 accent-[#1974E2]" /> <span>I have read the <a className="font-bold text-[#1974E2] underline" href="/privacy" target="_blank">privacy notice</a> and agree to be contacted about this request.</span></label>
      {errors.privacyAccepted && <p className="mt-2 text-sm text-red-700">{errors.privacyAccepted.message}</p>}
      <div className="mt-5"><TurnstileField onToken={handleToken} /></div>
      {result && <div role="status" className={result.success ? "mt-5 flex gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-800" : "mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"}>{result.success && <CheckCircle2 className="shrink-0" size={19} />}{result.message}</div>}
      <Button type="submit" disabled={isSubmitting || !turnstileToken} className="mt-6 w-full disabled:cursor-not-allowed disabled:opacity-55">{isSubmitting ? <><LoaderCircle className="animate-spin" size={18} /> Sending…</> : <><Send size={18} /> Send request</>}</Button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactElement<{ className?: string; "aria-invalid"?: boolean }>; }) {
  const element = cloneElement(children, { "aria-invalid": Boolean(error), className: "mt-2 block min-h-12 w-full rounded-xl border border-[#D7E0E9] bg-white px-4 py-3 text-[#071127] outline-none transition focus:border-[#168BFF] focus:ring-4 focus:ring-[#168BFF]/10" });
  return <label className="block text-sm font-bold text-[#071127]">{label}{element}{error && <span className="mt-1 block font-normal text-red-700">{error}</span>}</label>;
}

async function uploadAttachments(enquiryId: string, uploadToken: string, files: File[]) {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  if (!supabase) return;
  for (const file of files) {
    const response = await fetch(`/api/enquiries/${enquiryId}/attachments/sign`, { method: "POST", headers: { "Content-Type": "application/json", "x-upload-token": uploadToken }, body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size }) });
    if (!response.ok) continue;
    const signed = await response.json() as { path: string; token: string; attachmentId: string };
    const { error } = await supabase.storage.from("enquiry-attachments").uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
    if (!error) await fetch(`/api/enquiries/${enquiryId}/attachments/finalize`, { method: "POST", headers: { "Content-Type": "application/json", "x-upload-token": uploadToken }, body: JSON.stringify({ attachmentId: signed.attachmentId }) });
  }
}
