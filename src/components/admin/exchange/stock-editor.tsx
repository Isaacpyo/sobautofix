"use client";

import { ArrowDown, ArrowUp, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  changeStockStatusAction,
  deleteCostAction,
  deleteDocumentAction,
  deletePhotoAction,
  movePhotoAction,
  saveConditionAction,
  saveCostAction,
  saveInternalAction,
  saveListingAction,
  updatePhotoAltAction,
} from "@/app/admin/(protected)/exchange/stock/actions";
import { AdminField } from "@/components/admin/content-editor";
import { VehicleFeatureSelector } from "@/components/admin/vehicle-feature-selector";
import { VehicleMakeModelFields } from "@/components/admin/vehicle-make-model-fields";
import { VehicleSalesSelect } from "@/components/admin/vehicle-sales-select";
import { VehicleYearSelect } from "@/components/admin/vehicle-year-select";
import { costCategoryLabels } from "@/lib/exchange/margin";
import type { SaleVehicle, SaleVehicleStatus } from "@/types/domain";
import { FileUploader } from "./file-uploader";
import { ActionForm, CheckboxField, ConfirmButton, MoneyField, SelectField, SubmitButton, TextArea, TextField } from "./forms";
import {
  acquisitionSourceLabels,
  acquisitionSources,
  costCategories,
  documentKindLabels,
  documentKinds,
  formatDate,
  listingConditionLabels,
  penceToInput,
  serviceHistoryLabels,
  stockStatusLabels,
  writeOffLabels,
} from "./labels";
import { buttonStyles } from "./ui";

const options = <T extends string>(labels: Record<T, string>) => (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({ value, label }));

function SaveBar({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#EEF2F6] pt-4">{children}</div>;
}

export function ListingForm({ vehicle, canEditPrice }: { vehicle: SaleVehicle; canEditPrice: boolean }) {
  return <ActionForm action={saveListingAction} hidden={{ vehicleId: vehicle.id, updatedAt: vehicle.updatedAt }} aria-label="Listing details">
    <div className="grid gap-4 md:grid-cols-2">
      <VehicleMakeModelFields initialMake={vehicle.make} initialModel={vehicle.model} />
      <TextField name="derivative" label="Derivative" defaultValue={vehicle.derivative} maxLength={120} />
      <AdminField label="Year"><VehicleYearSelect value={vehicle.year} /></AdminField>
      <TextField name="mileage" label="Mileage" required inputMode="numeric" defaultValue={vehicle.mileage} />
      <TextField name="price" label="Advertised price (£, whole pounds)" required inputMode="numeric" defaultValue={vehicle.price} readOnly={!canEditPrice} hint={canEditPrice ? "Shown to customers. Changes are recorded in History." : "Only an owner or manager can change the price."} />
      <AdminField label="Fuel"><VehicleSalesSelect name="fuelType" required value={vehicle.fuelType} /></AdminField>
      <AdminField label="Transmission"><VehicleSalesSelect name="transmission" required value={vehicle.transmission} /></AdminField>
      <AdminField label="Engine size"><VehicleSalesSelect name="engineSize" value={vehicle.engineSize} /></AdminField>
      <AdminField label="Colour"><VehicleSalesSelect name="colour" value={vehicle.colour} /></AdminField>
      <AdminField label="Body type"><VehicleSalesSelect name="bodyType" value={vehicle.bodyType} /></AdminField>
      <TextField name="registration" label="Registration" defaultValue={vehicle.registration} maxLength={9} autoComplete="off" hint="Private to staff on this screen; never used in web addresses." />
      <TextField name="doors" label="Doors" inputMode="numeric" defaultValue={vehicle.doors} />
      <TextField name="seats" label="Seats" inputMode="numeric" defaultValue={vehicle.seats} />
      <TextArea className="md:col-span-2" name="description" label="Description" rows={6} defaultValue={vehicle.description} hint="At least 20 characters to publish. Describe what you have verified; unknowns are shown as Not confirmed." />
      <div className="md:col-span-2"><VehicleFeatureSelector defaultValue={vehicle.features} /></div>
    </div>
    <div className="mt-5 grid gap-4 rounded-xl bg-[#F4F7FA] p-4 sm:grid-cols-2">
      <CheckboxField name="financeAvailable" label="Finance may be available" defaultChecked={vehicle.financeAvailable} />
      <CheckboxField name="warrantyAvailable" label="A warranty is included" defaultChecked={vehicle.warranty?.available} hint="Only tick if the cover is agreed. Customers see the wording below." />
      <TextArea className="sm:col-span-2" name="warrantyDescription" label="Warranty wording for this vehicle" rows={3} defaultValue={vehicle.warranty?.description} />
    </div>
    <SaveBar><SubmitButton>Save listing</SubmitButton></SaveBar>
  </ActionForm>;
}

export function ConditionForm({ vehicle }: { vehicle: SaleVehicle }) {
  return <ActionForm action={saveConditionAction} hidden={{ vehicleId: vehicle.id, updatedAt: vehicle.updatedAt }} aria-label="Condition and disclosure">
    <fieldset className="grid gap-4 md:grid-cols-2">
      <legend className="sr-only">Condition</legend>
      <SelectField name="listingCondition" label="Listing condition" defaultValue={vehicle.listingCondition} options={options(listingConditionLabels)} hint="A repair project must list its known faults." />
      <SelectField name="writeOffStatus" label="Insurance write-off" defaultValue={vehicle.writeOffStatus} options={options(writeOffLabels)} />
      <TextArea className="md:col-span-2" name="conditionSummary" label="Condition summary" rows={3} defaultValue={vehicle.conditionSummary} hint="At least 20 characters to publish. Mention marks and wear you can see in the photos." />
      <TextArea name="knownFaults" label="Known faults (one per line)" rows={4} defaultValue={vehicle.knownFaults.join("\n")} />
      <TextArea name="workCompleted" label="Work completed (one per line)" rows={4} defaultValue={vehicle.workCompleted.join("\n")} />
    </fieldset>
    <h4 className="mt-6 text-sm font-extrabold tracking-wide text-[#586575] uppercase">Inspection</h4>
    <div className="mt-2 grid gap-4 md:grid-cols-3">
      <TextField name="inspectionDate" label="Inspected on" type="date" defaultValue={vehicle.inspectionDate} />
      <TextArea className="md:col-span-2" name="inspectionScope" label="What was checked" rows={2} defaultValue={vehicle.inspectionScope} />
      <TextArea className="md:col-span-3" name="inspectionFindings" label="Inspection summary for customers" rows={3} defaultValue={vehicle.inspectionFindings} hint="State findings only. Never describe an inspection that did not happen." />
    </div>
    <h4 className="mt-6 text-sm font-extrabold tracking-wide text-[#586575] uppercase">MOT, history and ownership</h4>
    <div className="mt-2 grid gap-4 md:grid-cols-3">
      <TextField name="motExpiry" label="MOT expiry" type="date" defaultValue={vehicle.motExpiry} hint="A vehicle fact only." />
      <TextArea className="md:col-span-2" name="motNotes" label="MOT history notes" rows={2} defaultValue={vehicle.motNotes} />
      <SelectField name="serviceHistory" label="Service history" defaultValue={vehicle.serviceHistory} options={options(serviceHistoryLabels)} />
      <TextArea className="md:col-span-2" name="serviceHistoryNotes" label="Service history notes" rows={2} defaultValue={vehicle.serviceHistoryNotes} />
      <TextField name="previousOwners" label="Previous owners" inputMode="numeric" defaultValue={vehicle.previousOwners} />
      <TextField name="keysCount" label="Keys" inputMode="numeric" defaultValue={vehicle.keysCount} />
      <TextField name="historyCheckedOn" label="History checked on" type="date" defaultValue={vehicle.historyCheckedOn} />
      <TextArea className="md:col-span-3" name="historyCheckSummary" label="History check summary" rows={2} defaultValue={vehicle.historyCheckSummary} hint="For example finance, stolen and write-off markers, as reported by the check you ran." />
    </div>
    <h4 className="mt-6 text-sm font-extrabold tracking-wide text-[#586575] uppercase">Buying information</h4>
    <div className="mt-2 grid gap-4 md:grid-cols-2">
      <TextField className="md:col-span-2" name="videoUrl" label="Video link" type="url" defaultValue={vehicle.videoUrl} placeholder="https://" />
      <TextArea name="collectionDelivery" label="Collection and delivery" rows={3} defaultValue={vehicle.collectionDelivery} />
      <TextArea name="afterSales" label="After-sales" rows={3} defaultValue={vehicle.afterSales} />
    </div>
    <SaveBar><SubmitButton>Save condition and disclosures</SubmitButton></SaveBar>
  </ActionForm>;
}

const statusHelp: Record<SaleVehicleStatus, string> = {
  draft: "Hidden from customers. Still being set up.",
  preparation: "Hidden from customers while work, photos and checks are completed.",
  available: "Listed for sale. Needs the publishing checklist complete.",
  reserved: "Set automatically when a reservation is recorded in Sales & Handover.",
  sold: "Shows a sold banner for 90 days. Prefer completing the sale in Sales & Handover.",
  archived: "Withdrawn: removed from the website but kept for records.",
};

export function StatusPanel({ vehicle, allowed }: { vehicle: SaleVehicle; allowed: Array<{ status: SaleVehicleStatus; blockedReason: string | null }> }) {
  const [choice, setChoice] = useState<SaleVehicleStatus | "">("");
  const selected = allowed.find((item) => item.status === choice);
  return <ActionForm action={changeStockStatusAction} hidden={{ vehicleId: vehicle.id, updatedAt: vehicle.updatedAt }} aria-label="Change status">
    <fieldset>
      <legend className="text-sm font-bold text-[#071127]">Move this vehicle to</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{allowed.map((item) => <label key={item.status} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 ${choice === item.status ? "border-[#1974E2] bg-[#EAF2FD]" : "border-[#D7E0E9] bg-white"} ${item.blockedReason ? "cursor-not-allowed bg-[#F8FAFC]" : ""}`}>
        <input type="radio" name="status" value={item.status} checked={choice === item.status} disabled={Boolean(item.blockedReason)} onChange={() => setChoice(item.status)} className="mt-1 size-4 accent-[#1974E2]" />
        <span><span className="block text-sm font-extrabold text-[#071127]">{stockStatusLabels[item.status]}</span><span className={`block text-xs leading-5 ${item.blockedReason ? "font-semibold text-[#93370D]" : "text-[#586575]"}`}>{item.blockedReason || statusHelp[item.status]}</span></span>
      </label>)}</div>
      {!allowed.length && <p className="mt-2 text-sm text-[#586575]">No status changes are available from {stockStatusLabels[vehicle.status]}.</p>}
    </fieldset>
    {choice && <TextField className="mt-4" name="reason" label="Note for the history (optional)" maxLength={300} />}
    {selected?.blockedReason && <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">{selected.blockedReason}</p>}
    <SaveBar>
      {choice && (choice === "available" || choice === "archived" || choice === "sold")
        ? <ConfirmButton variant={choice === "available" ? "primary" : "danger"} tone={choice === "available" ? "warning" : "danger"} title={choice === "available" ? "Publish this vehicle?" : choice === "sold" ? "Mark as sold?" : "Withdraw this vehicle?"} message={choice === "available" ? "The listing, photos and disclosures will be visible to customers on the website straight away." : choice === "sold" ? "The listing will show a sold banner for 90 days." : "The listing will be removed from the website. You can relist it later."} confirmLabel={choice === "available" ? "Publish" : choice === "sold" ? "Mark as sold" : "Withdraw"}>{choice === "available" ? (vehicle.listedAt ? "Relist" : "Publish") : `Move to ${stockStatusLabels[choice]}`}</ConfirmButton>
        : <SubmitButton disabled={!choice}>Change status</SubmitButton>}
    </SaveBar>
  </ActionForm>;
}

export function InternalForm({ vehicleId, internal, canEdit }: { vehicleId: string; internal: { acquired_on: string | null; acquisition_source: string | null; internal_notes: string | null } | null; canEdit: boolean }) {
  return <ActionForm action={saveInternalAction} hidden={{ vehicleId }} aria-label="Internal record">
    <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
      <legend className="sr-only">Acquisition</legend>
      <TextField name="acquiredOn" label="Acquired on" type="date" defaultValue={internal?.acquired_on} hint="Used for days in stock." />
      <SelectField name="acquisitionSource" label="Acquired from" defaultValue={internal?.acquisition_source} placeholder="Not recorded" options={acquisitionSources.map((value) => ({ value, label: acquisitionSourceLabels[value] }))} />
      <TextArea className="md:col-span-2" name="internalNotes" label="Internal notes" rows={5} defaultValue={internal?.internal_notes} hint="Staff only. Never shown to customers." />
    </fieldset>
    {canEdit && <SaveBar><SubmitButton>Save internal record</SubmitButton></SaveBar>}
  </ActionForm>;
}

type Cost = { id: string; category: (typeof costCategories)[number]; description: string; amount_pence: number; basis: "estimated" | "actual"; incurred_on: string | null };

export function CostLineForm({ vehicleId, cost, onDone }: { vehicleId: string; cost?: Cost; onDone?: () => void }) {
  return <ActionForm action={saveCostAction} hidden={{ vehicleId, costId: cost?.id }} resetOnSuccess={!cost} aria-label={cost ? "Edit cost" : "Add cost"}>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_minmax(0,1fr)_8rem_9rem_10rem]">
      <SelectField name="category" label="Category" defaultValue={cost?.category || "preparation"} options={costCategories.map((value) => ({ value, label: costCategoryLabels[value] }))} />
      <TextField name="description" label="Description" defaultValue={cost?.description} maxLength={200} required />
      <MoneyField name="amount" label="Amount" defaultValue={cost ? penceToInput(cost.amount_pence) : ""} required />
      <SelectField name="basis" label="Basis" defaultValue={cost?.basis || "actual"} options={[{ value: "actual", label: "Actual" }, { value: "estimated", label: "Estimated" }]} />
      <TextField name="incurredOn" label="Date" type="date" defaultValue={cost?.incurred_on} />
    </div>
    <div className="mt-3 flex flex-wrap justify-end gap-2">{onDone && <button type="button" onClick={onDone} className={buttonStyles.secondary}>Done</button>}<SubmitButton>{cost ? "Save cost" : "Add cost"}</SubmitButton></div>
  </ActionForm>;
}

export function CostRowActions({ vehicleId, cost }: { vehicleId: string; cost: Cost }) {
  const [editing, setEditing] = useState(false);
  return <>
    <div className="flex justify-end gap-2">
      <button type="button" onClick={() => setEditing((value) => !value)} aria-expanded={editing} className={`${buttonStyles.secondary} min-h-10 px-3 text-xs`}>{editing ? "Close" : "Edit"}<span className="sr-only"> {cost.description}</span></button>
      <ActionForm action={deleteCostAction} hidden={{ vehicleId, costId: cost.id }} successMessage={false}><ConfirmButton className="min-h-10 px-3 text-xs" title="Remove this cost?" message={`Remove "${cost.description}" from this vehicle's costs? Margins are recalculated.`} confirmLabel="Remove cost"><Trash2 size={14} aria-hidden="true" /><span className="sr-only">Remove {cost.description}</span></ConfirmButton></ActionForm>
    </div>
    {editing && <div className="mt-3 rounded-xl border border-[#D7E0E9] bg-[#F8FAFC] p-3 text-left"><CostLineForm vehicleId={vehicleId} cost={cost} onDone={() => setEditing(false)} /></div>}
  </>;
}

export function PhotoManager({ vehicleId, photos, minimumPhotos }: { vehicleId: string; photos: SaleVehicle["images"]; minimumPhotos: number }) {
  return <div className="grid gap-4">
    <FileUploader target={{ target: "stock_photo", vehicleId }} multiple label="Add photos" hint={`JPG, PNG or WebP up to 12 MB each. Photos are re-encoded to remove location and camera data. At least ${minimumPhotos} are needed to publish; the first photo is the cover.`} />
    {photos.length ? <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{photos.map((photo, index) => <li key={photo.id} className="overflow-hidden rounded-xl border border-[#E4EAF0] bg-white">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- public stock photo already re-encoded */}
        <img src={photo.url} alt={photo.alt} className="aspect-[4/3] w-full bg-[#E4EAF0] object-cover" loading="lazy" />
        <span className="absolute left-2 top-2 rounded-full bg-[#071127]/80 px-2 py-0.5 text-xs font-bold text-white">{index === 0 ? "Cover" : `Photo ${index + 1}`}</span>
      </div>
      <div className="p-3">
        <ActionForm action={updatePhotoAltAction} hidden={{ vehicleId, photoId: photo.id }}>
          <TextField name="alt" label="Description (alt text)" defaultValue={photo.alt} maxLength={180} />
          <div className="mt-2 flex justify-end"><SubmitButton variant="secondary" className="min-h-10 px-3 text-xs">Save description</SubmitButton></div>
        </ActionForm>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#EEF2F6] pt-2">
          <ActionForm action={movePhotoAction} hidden={{ vehicleId, photoId: photo.id }} successMessage={false} className="flex flex-wrap gap-2">
            <SubmitButton name="move" value="up" variant="secondary" className="min-h-10 px-3 text-xs" disabled={index === 0} pendingLabel="Moving…"><ArrowUp size={14} aria-hidden="true" /><span className="sr-only">Move photo {index + 1} </span>Up</SubmitButton>
            <SubmitButton name="move" value="down" variant="secondary" className="min-h-10 px-3 text-xs" disabled={index === photos.length - 1} pendingLabel="Moving…"><ArrowDown size={14} aria-hidden="true" /><span className="sr-only">Move photo {index + 1} </span>Down</SubmitButton>
            {index > 0 && <SubmitButton name="move" value="cover" variant="secondary" className="min-h-10 px-3 text-xs" pendingLabel="Setting…"><Star size={14} aria-hidden="true" />Make cover</SubmitButton>}
          </ActionForm>
          <ActionForm action={deletePhotoAction} hidden={{ vehicleId, photoId: photo.id }} className="ml-auto"><ConfirmButton className="min-h-10 px-3 text-xs" title="Delete this photo?" message="The photo is removed from the listing and deleted from storage. This cannot be undone." confirmLabel="Delete photo"><Trash2 size={14} aria-hidden="true" />Delete</ConfirmButton></ActionForm>
        </div>
      </div>
    </li>)}</ol> : <p className="rounded-xl bg-[#F4F7FA] p-5 text-sm text-[#586575]">No photos yet. Upload genuine photos of this vehicle only.</p>}
  </div>;
}

export function DocumentUploader({ vehicleId, submissionId }: { vehicleId?: string; submissionId?: string }) {
  const [kind, setKind] = useState<string>("other");
  return <div className="grid gap-3">
    <label className="block max-w-sm text-sm font-bold text-[#071127]">Document type
      <select value={kind} onChange={(event) => setKind(event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-xl border border-[#D7E0E9] bg-white px-3 text-sm font-semibold">
        {documentKinds.map((value) => <option key={value} value={value}>{documentKindLabels[value]}</option>)}
      </select>
    </label>
    <FileUploader target={{ target: "document", vehicleId, submissionId, kind }} label="Upload a private document" hint="PDF, JPG, PNG or WebP up to 15 MB. Stored privately; staff open it through a link that expires after a minute." />
  </div>;
}

export function DocumentList({ documents, canDelete }: { documents: Array<{ id: string; kind: string; file_name: string; size_bytes: number; created_at: string }>; canDelete: boolean }) {
  if (!documents.length) return <p className="rounded-xl bg-[#F4F7FA] p-5 text-sm text-[#586575]">No documents uploaded.</p>;
  return <ul className="divide-y divide-[#EEF2F6] rounded-xl border border-[#E4EAF0]">{documents.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
    <div className="min-w-0"><a href={`/api/admin/exchange/documents/${document.id}`} target="_blank" rel="noreferrer" className="font-bold break-all text-[#1462C4] hover:underline">{document.file_name}</a><p className="text-xs text-[#586575]">{documentKindLabels[document.kind as keyof typeof documentKindLabels] || "Other"} · {(document.size_bytes / 1024 / 1024).toFixed(1)} MB · {formatDate(document.created_at)}</p></div>
    {canDelete && <ActionForm action={deleteDocumentAction} hidden={{ documentId: document.id }} successMessage={false}><ConfirmButton className="min-h-10 px-3 text-xs" title="Delete this document?" message={`Delete "${document.file_name}"? The file is removed from private storage and cannot be recovered.`} confirmLabel="Delete document"><Trash2 size={14} aria-hidden="true" />Delete</ConfirmButton></ActionForm>}
  </li>)}</ul>;
}
