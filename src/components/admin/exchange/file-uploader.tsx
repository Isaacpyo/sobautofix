"use client";

import { CheckCircle2, LoaderCircle, Upload, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { buttonStyles } from "./ui";

type Target = { target: "stock_photo"; vehicleId: string } | { target: "document"; vehicleId?: string; submissionId?: string; kind: string };
type ItemState = { name: string; status: "waiting" | "uploading" | "checking" | "done" | "error"; message?: string };

const photoTypes = ["image/jpeg", "image/png", "image/webp"];
const documentTypes = ["application/pdf", ...photoTypes];

/**
 * Uploads straight to private storage with a short-lived signed URL (no large
 * request bodies through the app), then asks the server to check the bytes,
 * strip metadata and record the file.
 */
export function FileUploader({ target, label, hint, multiple = false, maxFiles = 20 }: { target: Target; label: string; hint: string; multiple?: boolean; maxFiles?: number }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [items, setItems] = useState<ItemState[]>([]);
  const [busy, setBusy] = useState(false);
  const photo = target.target === "stock_photo";
  const maxBytes = photo ? 12 * 1024 * 1024 : 15 * 1024 * 1024;
  const accepted = photo ? photoTypes : documentTypes;

  function update(index: number, next: Partial<ItemState>) {
    setItems((current) => current.map((item, position) => position === index ? { ...item, ...next } : item));
  }

  async function uploadOne(file: File, index: number) {
    if (!accepted.includes(file.type)) return update(index, { status: "error", message: photo ? "Choose a JPG, PNG or WebP photo." : "Choose a PDF, JPG, PNG or WebP file." });
    if (file.size > maxBytes) return update(index, { status: "error", message: `Larger than ${photo ? 12 : 15} MB.` });
    update(index, { status: "uploading" });
    try {
      const signResponse = await fetch("/api/admin/exchange/uploads/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, fileName: file.name, contentType: file.type, size: file.size }) });
      const signed = await signResponse.json() as { bucket?: string; path?: string; token?: string; error?: string };
      if (!signResponse.ok || !signed.bucket || !signed.path || !signed.token) throw new Error(signed.error || "The upload could not be prepared.");
      const supabase = createClient();
      if (!supabase) throw new Error("Uploads are not configured.");
      const { error } = await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: false });
      if (error) throw new Error("The file could not be uploaded. Check your connection and try again.");
      update(index, { status: "checking" });
      const finalizeResponse = await fetch("/api/admin/exchange/uploads/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, path: signed.path, fileName: file.name }) });
      const finalized = await finalizeResponse.json() as { error?: string };
      if (!finalizeResponse.ok) throw new Error(finalized.error || "The file could not be saved.");
      update(index, { status: "done" });
    } catch (error) {
      update(index, { status: "error", message: error instanceof Error ? error.message : "The upload failed." });
    }
  }

  async function handleFiles(files: File[]) {
    if (!files.length || busy) return;
    const chosen = files.slice(0, maxFiles);
    setItems(chosen.map((file) => ({ name: file.name, status: "waiting" })));
    setBusy(true);
    // One at a time keeps the order the photos were chosen in.
    for (const [index, file] of chosen.entries()) await uploadOne(file, index);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return <div className="rounded-xl border border-dashed border-[#9DBFE9] bg-[#F7FAFE] p-4">
    <label htmlFor={inputId} className="block text-sm font-extrabold text-[#071127]">{label}</label>
    <p id={`${inputId}-hint`} className="mt-0.5 text-xs leading-5 text-[#586575]">{hint}</p>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <input ref={inputRef} id={inputId} type="file" className="sr-only" aria-describedby={`${inputId}-hint`} multiple={multiple} accept={accepted.join(",")} disabled={busy} onChange={(event) => void handleFiles(Array.from(event.target.files || []))} />
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={cn(buttonStyles.primary)}>{busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}{busy ? "Uploading…" : multiple ? "Choose files" : "Choose file"}</button>
      {items.length > 0 && !busy && <span className="text-xs font-semibold text-[#586575]" role="status">{items.filter((item) => item.status === "done").length} of {items.length} uploaded</span>}
    </div>
    {items.length > 0 && <ul aria-live="polite" className="mt-3 grid gap-1.5">{items.map((item, index) => <li key={`${item.name}-${index}`} className="flex items-start gap-2 text-xs">
      {item.status === "done" ? <CheckCircle2 size={15} className="mt-px shrink-0 text-[#067647]" aria-hidden="true" /> : item.status === "error" ? <XCircle size={15} className="mt-px shrink-0 text-[#B42318]" aria-hidden="true" /> : <LoaderCircle size={15} className={cn("mt-px shrink-0 text-[#1974E2]", item.status !== "waiting" && "animate-spin")} aria-hidden="true" />}
      <span className="min-w-0"><span className="font-bold break-all text-[#071127]">{item.name}</span> <span className={item.status === "error" ? "font-bold text-[#B42318]" : "text-[#586575]"}>{item.status === "waiting" ? "Waiting" : item.status === "uploading" ? "Uploading" : item.status === "checking" ? "Checking and removing location data" : item.status === "done" ? "Saved" : item.message}</span></span>
    </li>)}</ul>}
  </div>;
}
