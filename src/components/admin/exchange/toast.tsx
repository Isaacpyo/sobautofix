"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";

type Toast = { id: number; message: string };
const listeners = new Set<(toast: Toast) => void>();
let counter = 0;

/** Shows a short confirmation in the shared toast region (it survives the form unmounting). */
export function announce(message: string) {
  counter += 1;
  const toast = { id: counter, message };
  for (const listener of listeners) listener(toast);
}

/** Mounted once by the Vehicle Buying & Selling layout. */
export function ToastRegion() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((current) => [...current.slice(-2), toast]);
      window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 5000);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] z-[90] grid justify-items-center gap-2 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:justify-items-end">
    {toasts.map((toast) => <p key={toast.id} className="pointer-events-auto flex max-w-md items-start gap-2 rounded-xl bg-[#071127] py-3 pr-2 pl-4 text-sm font-bold text-white shadow-2xl">
      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#6CE9A6]" aria-hidden="true" />
      <span className="flex-1">{toast.message}</span>
      <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss" className="grid size-7 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"><X size={15} aria-hidden="true" /></button>
    </p>)}
  </div>;
}
