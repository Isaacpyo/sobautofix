import { randomUUID } from "node:crypto";
import { ArrowLeftRight, CalendarPlus, ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnquiryReplyComposer } from "@/components/admin/enquiry-reply-composer";
import { EnquiryThread } from "@/components/admin/exchange/enquiry-thread";
import { ActionForm, ConfirmButton, MoneyField, SelectField, SubmitButton, TextArea, TextField } from "@/components/admin/exchange/forms";
import { financeLabels, formatDate, formatDateTime, inspectionOutcomeLabels, inspectionOutcomes, label, penceToInput, preferredContactLabels, runningStatusLabels, sellerMotLabels, sellerServiceHistoryLabels, submissionStatusLabels, submissionStatusTones, type SubmissionStatus } from "@/components/admin/exchange/labels";
import { DocumentList, DocumentUploader } from "@/components/admin/exchange/stock-editor";
import { Badge, Card, KeyValues, LinkButton, NoAccess, Notice } from "@/components/admin/exchange/ui";
import { BackLink } from "@/components/ui/back-link";
import { effectiveOfferStatus, getSubmissionDetail, type OfferStatus } from "@/lib/exchange/admin/buying";
import { listStaff } from "@/lib/exchange/admin/core";
import { formatPence } from "@/lib/exchange/margin";
import { requireStaffPage } from "@/lib/exchange/staff";
import { vehicleSalesOptions } from "@/lib/vehicle/sales-options";
import { formatRegistration } from "@/lib/vehicle/registration-format";
import { saveExchangeNoteAction, sendExchangeReplyAction } from "../../thread-actions";
import { assignSubmissionAction, closeSubmissionAction, createStockFromPurchaseAction, decideOfferAction, linkExistingStockAction, markPurchasedAction, moveSubmissionAction, recordOfferAction, recordPurchaseInspectionAction } from "../actions";

const open: SubmissionStatus[] = ["new", "reviewing", "provisional_offer", "inspection", "final_offer"];

export default async function BuyingEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff, allowed } = await requireStaffPage("buying.manage");
  if (!allowed) return <NoAccess area="buying enquiries" />;
  const { id } = await params;
  const [detail, staffList] = await Promise.all([getSubmissionDetail(staff, id), listStaff(staff.client)]);
  if (!detail) notFound();
  const s = detail.submission as Record<string, string | number | null> & typeof detail.submission;
  const status = s.status;
  const isOpen = open.includes(status);
  const vehicle = [s.year, s.make, s.model].filter(Boolean).join(" ") || "Vehicle details not given";
  const today = new Date().toISOString().slice(0, 10);
  const whatsapp = detail.customer?.phone.replace(/[^+\d]/g, "").replace(/^\+/, "") || "";
  const canFinance = staff.can("finance.edit");
  const openOffer = detail.offers.find((offer) => offer.status === "open");
  const acceptedOffer = detail.offers.find((offer) => offer.status === "accepted");

  return <>
    <BackLink href="/admin/exchange/buying">Back to Buying Enquiries</BackLink>
    <header className="mt-3 rounded-xl border border-[#E4EAF0] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={submissionStatusTones[status]}>{submissionStatusLabels[status]}</Badge>{s.kind === "part_exchange" && <Badge tone="info"><ArrowLeftRight size={12} aria-hidden="true" />Part exchange</Badge>}<span className="text-xs font-bold text-[#586575]">{s.reference}</span></div>
          <h2 className="mt-2 text-2xl font-extrabold text-[#071127] sm:text-3xl">{vehicle}</h2>
          <p className="mt-0.5 text-sm text-[#586575]">{[s.derivative, s.registration ? formatRegistration(String(s.registration)) : null, s.mileage != null ? `${Number(s.mileage).toLocaleString("en-GB")} miles` : null].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-xs text-[#667586]">Received {formatDateTime(String(s.created_at))}</p>
        </div>
        <ActionForm action={assignSubmissionAction} hidden={{ submissionId: s.id }} className="w-full sm:w-64" successMessage={false}>
          <div className="flex items-end gap-2"><SelectField className="flex-1" name="assignedTo" label="Assigned to" defaultValue={s.assigned_to || ""} placeholder="Unassigned" options={staffList.map((member) => ({ value: member.id, label: member.name }))} /><SubmitButton variant="secondary" pendingLabel="…">Save</SubmitButton></div>
        </ActionForm>
      </div>
      {detail.interestedVehicle && <p className="mt-3 rounded-lg bg-[#EAF2FD] px-3 py-2 text-sm text-[#1446A5]"><strong>Wants to buy:</strong> <Link className="font-bold underline" href={`/admin/exchange/stock/${detail.interestedVehicle.id}`}>{detail.interestedVehicle.title}</Link> ({detail.interestedVehicle.status}, advertised £{detail.interestedVehicle.price.toLocaleString("en-GB")})</p>}
    </header>

    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid min-w-0 gap-4">
        <Card title="Vehicle and condition" description="As described by the seller. Nothing here has been checked until an inspection is recorded.">
          <KeyValues columns={3} items={[
            { label: "Fuel", value: s.fuel_type || "Not given" }, { label: "Transmission", value: s.transmission || "Not given" }, { label: "Colour", value: s.colour || "Not given" },
            { label: "Running", value: label(runningStatusLabels, s.running_status as string, "Not sure") }, { label: "MOT", value: `${label(sellerMotLabels, s.mot_status as string, "Not sure")}${s.mot_expiry ? ` (expires ${formatDate(String(s.mot_expiry))})` : ""}` },
            { label: "Service history", value: label(sellerServiceHistoryLabels, s.service_history as string, "Not sure") }, { label: "Outstanding finance", value: label(financeLabels, s.outstanding_finance as string, "Not sure") },
            { label: "Details from", value: s.lookup_source === "lookup" ? "Registration lookup" : "Entered by seller" }, { label: "Postcode", value: s.postcode || "Not given" },
          ]} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-[#F4F7FA] p-3"><p className="text-xs font-extrabold tracking-wide text-[#586575] uppercase">Known faults</p><p className="mt-1 text-sm whitespace-pre-wrap text-[#071127]">{s.known_faults || "None given"}</p></div>
            <div className="rounded-lg bg-[#F4F7FA] p-3"><p className="text-xs font-extrabold tracking-wide text-[#586575] uppercase">Damage</p><p className="mt-1 text-sm whitespace-pre-wrap text-[#071127]">{s.damage || "None given"}</p></div>
          </div>
          {s.anonymised_at && <div className="mt-3"><Notice tone="info">Photos, registration and notes were removed under the retention policy on {formatDate(String(s.anonymised_at))}.</Notice></div>}
        </Card>

        <Card title="Offer history" description="Every offer is kept, with who made it and what the seller decided.">
          {detail.offers.length ? <ol className="grid gap-2">{detail.offers.map((offer) => { const effective = effectiveOfferStatus(offer, today); return <li key={offer.id} className="rounded-lg border border-[#E4EAF0] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-extrabold text-[#071127]">{formatPence(offer.amount_pence)} <span className="text-sm font-bold text-[#586575]">{offerStageLabels[offer.stage]}</span></p><Badge tone={offerStatusTones[effective]}>{offerStatusLabels[effective]}</Badge></div>
            <p className="mt-0.5 text-xs text-[#586575]">Made {formatDateTime(offer.created_at)}{offer.createdByName ? ` by ${offer.createdByName}` : ""}{offer.expires_on ? ` · valid until ${formatDate(offer.expires_on)}` : ""}</p>
            {offer.conditions && <p className="mt-1 text-sm whitespace-pre-wrap text-[#344054]">Conditions: {offer.conditions}</p>}
            {offer.decided_at && offer.status !== "open" && <p className="mt-1 text-xs text-[#586575]">{offerStatusLabels[offer.status]} {formatDateTime(offer.decided_at)}{offer.decidedByName ? ` (recorded by ${offer.decidedByName})` : ""}{offer.decision_note ? `: ${offer.decision_note}` : ""}</p>}
          </li>; })}</ol> : <p className="text-sm text-[#586575]">No offers yet.</p>}
        </Card>

        <Card title={`Seller photos (${detail.photos.filter((photo) => photo.finalised).length})`} description="Private. Each image is served through a link that expires after a minute.">
          {detail.photos.length ? <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{detail.photos.map((photo) => <li key={photo.id}>{!photo.finalised ? <div className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-[#C9D5E2] bg-[#F8FAFC] p-2 text-center text-xs font-bold text-[#586575]"><span>Upload not completed<span className="block font-normal capitalize">{photo.category}</span></span></div> : <a href={`/api/admin/exchange/submission-photos/${photo.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-[#E4EAF0]">
            {/* eslint-disable-next-line @next/next/no-img-element -- private photo through a short-lived signed redirect */}
            <img src={`/api/admin/exchange/submission-photos/${photo.id}`} alt={`Seller photo: ${photo.category}`} className="aspect-[4/3] w-full bg-[#E4EAF0] object-cover" loading="lazy" />
            <span className="block px-2 py-1 text-xs font-bold capitalize text-[#586575]">{photo.category}</span>
          </a>}</li>)}</ul> : <p className="text-sm text-[#586575]">No photos were uploaded.</p>}
        </Card>

        <Card title="Inspections" actions={isOpen && staff.can("diary.manage") ? <LinkButton href={`/admin/diary/new?kind=purchase_inspection&submission=${s.id}`} className="min-h-10"><CalendarPlus size={15} aria-hidden="true" />Schedule inspection</LinkButton> : undefined}>
          {detail.appointments.length > 0 && <ul className="mb-3 grid gap-1.5">{detail.appointments.map((appointment) => <li key={appointment.id}><Link href={`/admin/diary/${appointment.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E4EAF0] px-3 py-2 text-sm hover:border-[#1974E2]"><span className="font-bold text-[#071127]">{appointment.title}</span><span className="text-xs text-[#586575]">{formatDateTime(appointment.starts_at)} · {appointment.status}</span></Link></li>)}</ul>}
          {detail.inspections.length ? <ul className="grid gap-2">{detail.inspections.map((inspection) => <li key={inspection.id} className="rounded-lg border border-[#E4EAF0] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-[#071127]">{formatDate(inspection.inspected_on)} · {inspection.inspector_name}</p><Badge tone={inspection.outcome === "not_satisfactory" ? "danger" : inspection.outcome === "advisories" ? "warning" : "success"}>{inspectionOutcomeLabels[inspection.outcome as keyof typeof inspectionOutcomeLabels]}</Badge></div><p className="mt-1 text-xs text-[#586575]">Checked: {inspection.scope}</p><p className="mt-1 text-sm whitespace-pre-wrap">{inspection.findings}</p>{inspection.faults.length > 0 && <ul className="mt-1 list-disc pl-5 text-sm">{inspection.faults.map((fault) => <li key={fault}>{fault}</li>)}</ul>}</li>)}</ul> : <p className="text-sm text-[#586575]">No inspection recorded yet.</p>}
          {(status === "reviewing" || status === "provisional_offer") && <ActionForm action={moveSubmissionAction} hidden={{ submissionId: s.id, to: "inspection" }} className="mt-3"><SubmitButton variant="secondary">Mark as awaiting inspection</SubmitButton></ActionForm>}
          {isOpen && <details className="mt-3 rounded-lg border border-[#E4EAF0] p-3"><summary className="min-h-10 cursor-pointer text-sm font-extrabold text-[#1462C4]">Record inspection findings</summary>
            <ActionForm action={recordPurchaseInspectionAction} hidden={{ submissionId: s.id }} resetOnSuccess className="mt-3">
              <div className="grid gap-3 sm:grid-cols-2"><TextField name="inspectedOn" label="Inspected on" type="date" defaultValue={today} required /><TextField name="inspectorName" label="Inspected by" defaultValue={staff.displayName} required /><TextArea className="sm:col-span-2" name="scope" label="What was checked" rows={2} required /><TextArea className="sm:col-span-2" name="findings" label="Findings" rows={4} required /><TextArea name="faults" label="Faults found (one per line)" rows={3} /><SelectField name="outcome" label="Outcome" defaultValue="recorded" options={inspectionOutcomes.map((value) => ({ value, label: inspectionOutcomeLabels[value] }))} /></div>
              <div className="mt-3 flex justify-end"><SubmitButton>Save inspection</SubmitButton></div>
            </ActionForm>
          </details>}
        </Card>

        <Card title="Documents" description="Private files for this purchase, such as the V5C or service book.">
          <DocumentList documents={detail.documents} canDelete={staff.can("prep.manage")} />
          <div className="mt-3"><DocumentUploader submissionId={s.id} canFinance={staff.can("finance.view")} /></div>
        </Card>

        {s.enquiry_id ? <><EnquiryThread messages={detail.thread} /><EnquiryReplyComposer enquiryId={s.enquiry_id} customerEmail={detail.customer?.email || null} initialClientRequestId={randomUUID()} replyAction={sendExchangeReplyAction} noteAction={saveExchangeNoteAction} /></> : <Notice tone="info">This submission has no email thread.</Notice>}
      </div>

      <aside className="grid min-w-0 gap-4 xl:sticky xl:top-20" aria-label="Pipeline actions">
        <Card title="Offer and purchase">
          <KeyValues columns={1} items={[
            { label: "Provisional offer", value: s.provisional_offer_pence != null ? `${formatPence(Number(s.provisional_offer_pence))}${s.provisional_offer_expires_on ? `, until ${formatDate(String(s.provisional_offer_expires_on))}` : ""}` : "None" },
            { label: "Final offer", value: s.final_offer_pence != null ? `${formatPence(Number(s.final_offer_pence))}${s.final_offer_expires_on ? `, until ${formatDate(String(s.final_offer_expires_on))}` : ""}${s.offer_accepted_at ? " (accepted)" : ""}` : "None" },
            ...(staff.can("finance.view") ? [{ label: "Purchase price", value: s.purchase_price_pence != null ? formatPence(Number(s.purchase_price_pence)) : "Not recorded" }] : []),
          ]} />
          {status === "new" && <ActionForm action={moveSubmissionAction} hidden={{ submissionId: s.id, to: "reviewing" }} className="mt-4"><SubmitButton className="w-full">Start reviewing</SubmitButton></ActionForm>}
          {openOffer && <div className="mt-4 rounded-lg border border-[#B9D8FF] bg-[#F7FAFE] p-3">
            <p className="text-xs font-extrabold tracking-wide text-[#586575] uppercase">Open offer</p>
            <p className="mt-0.5 text-lg font-extrabold text-[#071127]">{formatPence(openOffer.amount_pence)} <span className="text-sm font-bold text-[#586575]">{offerStageLabels[openOffer.stage]}</span></p>
            <p className="text-xs text-[#586575]">{openOffer.expires_on ? `${effectiveOfferStatus(openOffer, today) === "expired" ? "Expired" : "Valid until"} ${formatDate(openOffer.expires_on)}` : "No expiry date"}</p>
            <ActionForm action={decideOfferAction} hidden={{ submissionId: s.id, offerId: openOffer.id }} className="mt-3">
              <SelectField name="decision" label="Record the outcome" defaultValue={openOffer.stage === "provisional" ? "declined" : "accepted"} options={[...(openOffer.stage !== "provisional" ? [{ value: "accepted", label: "Seller accepted" }] : []), { value: "declined", label: "Seller declined" }, { value: "withdrawn", label: "We withdrew it" }, { value: "expired", label: "It expired" }]} />
              <TextField className="mt-2" name="note" label="Note (optional)" maxLength={1000} />
              <div className="mt-2 flex justify-end"><ConfirmButton variant="secondary" tone="warning" title="Record this outcome?" message="The decision is added to the offer history with your name and the time." confirmLabel="Record outcome">Record outcome</ConfirmButton></div>
            </ActionForm>
          </div>}
          {offerStagesFor(status).length > 0 && <OfferForm submissionId={s.id} stages={offerStagesFor(status)} current={openOffer?.amount_pence ?? (s.final_offer_pence ?? s.provisional_offer_pence) as number | null} title={openOffer ? "Make a new offer (replaces the open one)" : detail.offers.length ? "Make another offer" : "Make an offer"} startOpen={!detail.offers.length && status !== "new"} />}
          {status === "final_offer" && Boolean(s.offer_accepted_at) && (canFinance
            ? <ActionForm action={markPurchasedAction} hidden={{ submissionId: s.id }} className="mt-4 rounded-lg border border-[#E4EAF0] p-3"><MoneyField name="purchasePrice" label="Price paid" defaultValue={penceToInput(acceptedOffer?.amount_pence ?? Number(s.final_offer_pence))} required /><div className="mt-3"><ConfirmButton variant="primary" tone="warning" className="w-full" title="Mark as purchased?" message="This records the price paid. You can then create the stock record." confirmLabel="Mark as purchased">Mark as purchased</ConfirmButton></div></ActionForm>
            : <p className="mt-4 rounded-lg bg-[#F4F7FA] p-3 text-sm text-[#586575]">An owner or manager records the purchase price and marks the vehicle as purchased.</p>)}
          {status === "purchased" && (detail.purchasedVehicle
            ? <LinkButton href={`/admin/exchange/stock/${detail.purchasedVehicle.id}`} variant="primary" className="mt-4 w-full"><ExternalLink size={15} aria-hidden="true" />Open stock: {detail.purchasedVehicle.title}</LinkButton>
            : staff.can("stock.edit") && canFinance ? <ActionForm action={createStockFromPurchaseAction} hidden={{ submissionId: s.id }} className="mt-4 rounded-lg border border-[#E4EAF0] p-3">
              <p className="text-sm font-extrabold text-[#071127]">Create stock draft from this vehicle</p>
              <p className="text-xs text-[#586575]">Creates a Draft listing, the acquisition record and the purchase cost. Check the details first.</p>
              <div className="mt-3 grid gap-3">
                <TextField name="make" label="Make" defaultValue={s.make as string} required /><TextField name="model" label="Model" defaultValue={s.model as string} required /><TextField name="derivative" label="Derivative" defaultValue={s.derivative as string} />
                <div className="grid grid-cols-2 gap-3"><TextField name="year" label="Year" inputMode="numeric" defaultValue={s.year as number} required /><TextField name="mileage" label="Mileage" inputMode="numeric" defaultValue={s.mileage as number} required /></div>
                <SelectField name="fuelType" label="Fuel" defaultValue={s.fuel_type as string} placeholder="Choose" options={vehicleSalesOptions.fuelType.map((value) => ({ value, label: value }))} required />
                <SelectField name="transmission" label="Transmission" defaultValue={s.transmission as string} placeholder="Choose" options={vehicleSalesOptions.transmission.map((value) => ({ value, label: value }))} required />
                <TextField name="colour" label="Colour" defaultValue={s.colour as string} />
              </div>
              <p className="mt-2 text-xs text-[#586575]">Only vehicle facts are copied. The seller&apos;s details, offers, photos and documents stay private.</p>
              <div className="mt-3"><SubmitButton className="w-full" pendingLabel="Creating…">Create stock draft</SubmitButton></div>
            </ActionForm> : <p className="mt-4 text-sm text-[#586575]">An owner or manager creates the stock record.</p>)}
          {status === "purchased" && !detail.purchasedVehicle && staff.can("stock.edit") && canFinance && detail.linkable.length > 0 && <ActionForm action={linkExistingStockAction} hidden={{ submissionId: s.id }} className="mt-3 rounded-lg border border-[#E4EAF0] p-3">
            <SelectField name="vehicleId" label="Or link an existing stock record" placeholder="Choose a draft or preparation vehicle" options={detail.linkable.map((item) => ({ value: item.id, label: item.label }))} />
            <div className="mt-2 flex justify-end"><SubmitButton variant="secondary" pendingLabel="Linking…">Link stock record</SubmitButton></div>
          </ActionForm>}
          {(status === "declined" || status === "closed") && <p className="mt-4 rounded-lg bg-[#F4F7FA] p-3 text-sm text-[#344054]">{status === "declined" ? `Declined${s.decline_reason ? `: ${s.decline_reason}` : "."}` : "Closed."} {s.closed_at ? `(${formatDate(String(s.closed_at))})` : ""}</p>}
        </Card>

        {isOpen && <Card title="Decline or close">
          <ActionForm action={closeSubmissionAction} hidden={{ submissionId: s.id, outcome: "declined" }}>
            <TextArea name="reason" label="Reason for declining" rows={2} required hint="Staff only. Not sent to the seller." />
            <div className="mt-2 flex justify-end"><ConfirmButton title="Decline this vehicle?" message="The enquiry and its email thread are closed. The seller is not emailed automatically; reply in the conversation if you want to tell them." confirmLabel="Decline">Decline</ConfirmButton></div>
          </ActionForm>
          <ActionForm action={closeSubmissionAction} hidden={{ submissionId: s.id, outcome: "closed" }} className="mt-3 border-t border-[#EEF2F6] pt-3">
            <div className="flex items-center justify-between gap-3"><p className="text-xs text-[#586575]">Seller withdrew or went quiet? Close without declining.</p><ConfirmButton variant="secondary" tone="warning" title="Close this enquiry?" message="The enquiry and its email thread are closed, and the retention period starts." confirmLabel="Close enquiry">Close</ConfirmButton></div>
          </ActionForm>
        </Card>}

        {staff.can("customers.view") && detail.customer ? <Card title="Seller">
          <p className="font-extrabold text-[#071127]">{detail.customer.name}</p>
          <p className="text-sm text-[#586575]">Prefers {label(preferredContactLabels, detail.customer.preferred_contact, "phone")}{s.marketing_consent ? " · Agreed to marketing" : ""}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.customer.phone && <a href={`tel:${detail.customer.phone}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7E0E9] px-3 text-sm font-bold"><Phone size={15} aria-hidden="true" />{detail.customer.phone}</a>}
            {detail.customer.email && <a href={`mailto:${detail.customer.email}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7E0E9] px-3 text-sm font-bold break-all"><Mail size={15} aria-hidden="true" />{detail.customer.email}</a>}
            {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7E0E9] px-3 text-sm font-bold"><MessageCircle size={15} aria-hidden="true" />WhatsApp</a>}
          </div>
        </Card> : null}
      </aside>
    </div>
  </>;
}

const offerStageLabels = { provisional: "Provisional", revised: "Revised", final: "Final" } as const;
const offerStatusLabels: Record<OfferStatus, string> = { open: "Open", accepted: "Accepted", declined: "Declined", withdrawn: "Withdrawn", expired: "Expired", superseded: "Superseded" };
const offerStatusTones = { open: "info", accepted: "success", declined: "danger", withdrawn: "muted", expired: "warning", superseded: "muted" } as const;

function offerStagesFor(status: SubmissionStatus): Array<keyof typeof offerStageLabels> {
  if (status === "new" || status === "reviewing" || status === "provisional_offer" || status === "inspection") return status === "new" ? ["provisional"] : ["provisional", "final"];
  if (status === "final_offer") return ["revised", "final"];
  return [];
}

function OfferForm({ submissionId, stages, current, title, startOpen }: { submissionId: string; stages: Array<keyof typeof offerStageLabels>; current: number | null; title: string; startOpen: boolean }) {
  return <details className="mt-4 rounded-lg border border-[#E4EAF0] p-3" open={startOpen}>
    <summary className="min-h-10 cursor-pointer text-sm font-extrabold text-[#1462C4]">{title}</summary>
    <ActionForm action={recordOfferAction} hidden={{ submissionId }} resetOnSuccess className="mt-2">
      <div className="grid gap-3">
        <SelectField name="stage" label="Type of offer" defaultValue={stages[stages.length - 1]} options={stages.map((value) => ({ value, label: offerStageLabels[value] }))} hint="Provisional offers are subject to inspection. The seller accepts a final or revised offer." />
        <div className="grid grid-cols-2 gap-3"><MoneyField name="amount" label="Offer" defaultValue={penceToInput(current)} required /><TextField name="expiresOn" label="Valid until" type="date" /></div>
        <TextArea name="conditions" label="Conditions (optional)" rows={2} hint="For example: subject to the V5C and service book matching." />
      </div>
      <div className="mt-3 flex justify-end"><SubmitButton>Record offer</SubmitButton></div>
    </ActionForm>
  </details>;
}
