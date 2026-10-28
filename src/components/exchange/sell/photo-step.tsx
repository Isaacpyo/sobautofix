"use client";

import { Camera, CheckCircle2, ImagePlus, LoaderCircle, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { useId, useRef, useState } from "react";
import { SELLER_PHOTO_LIMIT, type SellerPhotoCategory } from "@/lib/exchange/public/schemas";
import { cn } from "@/lib/utils";
import { useToast } from "../feedback";
import { buttonClass, inputClass, Notice } from "../ui";
import { preparePhoto, type SellerPhoto } from "./photo-upload";

export const photoCategoryLabels: Record<SellerPhotoCategory, string> = {
  exterior: "Exterior",
  interior: "Interior",
  dashboard: "Dashboard / mileage",
  damage: "Damage",
  other: "Other",
};

const suggestions = ["The front, back and both sides", "The interior, front and rear seats", "The dashboard with the engine running, showing the mileage and any warning lights", "Close-ups of any damage"];

/** Pick photos from the gallery or camera, preview, categorise and remove them. Uploading happens after the enquiry is saved. */
export function PhotoPicker({ photos, onChange }: { photos: SellerPhoto[]; onChange: (update: (current: SellerPhoto[]) => SellerPhoto[]) => void }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const id = useId();
  const toast = useToast();
  const remaining = SELLER_PHOTO_LIMIT - photos.length;

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    const problems: string[] = [];
    if (files.length > remaining) problems.push(`You can add ${remaining} more ${remaining === 1 ? "photo" : "photos"} (${SELLER_PHOTO_LIMIT} in total). The rest were not added.`);
    setBusy(true);
    const added: SellerPhoto[] = [];
    for (const file of files.slice(0, Math.max(0, remaining))) {
      try {
        const prepared = await preparePhoto(file);
        added.push({ key: crypto.randomUUID(), blob: prepared.blob, contentType: prepared.contentType, previewUrl: URL.createObjectURL(prepared.blob), category: photos.length + added.length === 0 ? "exterior" : "other", status: "ready", progress: 0 });
      } catch (error) {
        problems.push(error instanceof Error && error.message.length < 400 ? error.message : "One photo could not be added. Please choose a JPG, PNG or WebP image up to 8 MB.");
      }
    }
    onChange((current) => [...current, ...added].slice(0, SELLER_PHOTO_LIMIT));
    setMessages([...new Set(problems)]);
    if (added.length) toast(`${added.length} ${added.length === 1 ? "photo" : "photos"} added`);
    setBusy(false);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function remove(key: string) {
    onChange((current) => {
      const photo = current.find((item) => item.key === key);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return current.filter((item) => item.key !== key);
    });
    toast("Photo removed", "info");
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl bg-[#F3F5F8] p-4">
        <p className="font-semibold text-[#0B1220]">Helpful photos</p>
        <ul className="mt-2 grid gap-1 text-[15px] text-[#344054]">{suggestions.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#1974E2]" />{item}</li>)}</ul>
        <p className="mt-2 text-sm text-[#5B6575]">Up to {SELLER_PHOTO_LIMIT} photos. We shrink them on your phone before sending to save data (iPhone HEIC photos are converted where your browser allows), and remove location details on our server.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input ref={cameraRef} id={`${id}-camera`} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => addFiles(event.target.files)} disabled={remaining <= 0 || busy} />
        <label htmlFor={`${id}-camera`} className={cn(buttonClass("primary", "w-full cursor-pointer sm:hidden"), (remaining <= 0 || busy) && "pointer-events-none opacity-60")}><Camera size={20} aria-hidden="true" /> Take a photo</label>
        <input ref={galleryRef} id={`${id}-gallery`} type="file" accept="image/*,.heic,.heif" multiple className="sr-only" onChange={(event) => addFiles(event.target.files)} disabled={remaining <= 0 || busy} />
        <label htmlFor={`${id}-gallery`} className={cn(buttonClass("secondary", "w-full cursor-pointer sm:col-span-2"), (remaining <= 0 || busy) && "pointer-events-none opacity-60")}>
          {busy ? <LoaderCircle size={20} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />} {busy ? "Preparing photos" : "Choose photos"}
        </label>
      </div>
      <p className="text-sm text-[#5B6575]" aria-live="polite">{photos.length} of {SELLER_PHOTO_LIMIT} photos added. Photos are optional, but they help us give you a better idea of value.</p>
      {messages.length > 0 && <Notice tone="warning" role="alert">{messages.map((message) => <p key={message}>{message}</p>)}</Notice>}

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Photos added">
          {photos.map((photo, index) => (
            <li key={photo.key} className="overflow-hidden rounded-2xl border border-[#E3E8EF] bg-white">
              <div className="relative aspect-[4/3] bg-[#F3F5F8]">
                {/* Local object URL preview; next/image cannot optimise blob: URLs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt={`Photo ${index + 1}, ${photoCategoryLabels[photo.category].toLowerCase()}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => remove(photo.key)} className="absolute top-2 right-2 grid size-11 place-items-center rounded-full bg-white/95 text-[#B42318] shadow" aria-label={`Remove photo ${index + 1}`}>
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="p-2">
                <label htmlFor={`${id}-${photo.key}`} className="sr-only">What does photo {index + 1} show?</label>
                <select
                  id={`${id}-${photo.key}`}
                  value={photo.category}
                  onChange={(event) => onChange((current) => current.map((item) => item.key === photo.key ? { ...item, category: event.target.value as SellerPhotoCategory } : item))}
                  className={cn(inputClass, "min-h-11 px-2 py-1.5 text-sm")}
                >
                  {Object.entries(photoCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Upload progress after the enquiry is saved, with per-photo retry. */
export function PhotoUploadList({ photos, onRetry }: { photos: SellerPhoto[]; onRetry: (key: string) => void }) {
  return (
    <ul className="grid gap-3" aria-label="Photo uploads">
      {photos.map((photo, index) => (
        <li key={photo.key} className="flex items-center gap-3 rounded-2xl border border-[#E3E8EF] p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.previewUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-[#0B1220]">Photo {index + 1} <span className="font-normal text-[#5B6575]">· {photoCategoryLabels[photo.category]}</span></p>
            {photo.status === "failed" ? (
              <p className="flex items-center gap-1.5 text-sm text-[#B42318]"><TriangleAlert size={14} aria-hidden="true" /> {photo.error || "Upload failed"}</p>
            ) : photo.status === "done" ? (
              <p className="flex items-center gap-1.5 text-sm text-[#067647]"><CheckCircle2 size={14} aria-hidden="true" /> Uploaded</p>
            ) : (
              <div className="mt-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-[#E3E8EF]" role="progressbar" aria-label={`Photo ${index + 1} upload`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(photo.progress * 100)}>
                  <div className="h-full rounded-full bg-[#1974E2] transition-[width]" style={{ width: `${Math.max(4, Math.round(photo.progress * 100))}%` }} />
                </div>
                <p className="mt-1 text-xs text-[#5B6575]">{photo.status === "uploading" ? `Uploading ${Math.round(photo.progress * 100)}%` : "Waiting"}</p>
              </div>
            )}
          </div>
          {photo.status === "failed" && (
            <button type="button" onClick={() => onRetry(photo.key)} className={buttonClass("secondary", "min-h-11 shrink-0 px-3 text-sm")}><RotateCcw size={16} aria-hidden="true" /> Retry</button>
          )}
        </li>
      ))}
    </ul>
  );
}
