"use client";

import { CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Small, dependency-free feedback helpers for the exchange: a polite toast
// region, and hiding fixed bars while the on-screen keyboard is open.

type Toast = { id: number; message: string; tone: "success" | "info" };
const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ExchangeFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const show = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  useTypingDetector();

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#0B1220] py-2.5 pr-2 pl-4 text-[15px] text-white shadow-xl motion-safe:animate-[exchange-toast-in_200ms_ease-out]">
            {toast.tone === "success" ? <CheckCircle2 size={18} aria-hidden="true" className="shrink-0 text-[#75E0A7]" /> : <Info size={18} aria-hidden="true" className="shrink-0 text-[#9CC3F5]" />}
            <span>{toast.message}</span>
            <button type="button" onClick={() => dismiss(toast.id)} className={cn("grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/10")} aria-label="Dismiss"><X size={16} aria-hidden="true" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const typingTypes = new Set(["text", "email", "tel", "number", "search", "url", "password", "date"]);

/**
 * While a text field has focus on a phone, mark the document so fixed bars
 * (bottom navigation, vehicle action bar) hide and never sit on top of the
 * on-screen keyboard or the field being typed in.
 */
function useTypingDetector() {
  useEffect(() => {
    const root = document.documentElement;
    const isTyping = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target instanceof HTMLTextAreaElement) return true;
      if (target instanceof HTMLInputElement) return typingTypes.has(target.type);
      return target.isContentEditable;
    };
    const onFocusIn = (event: FocusEvent) => {
      if (window.innerWidth < 1024 && isTyping(event.target)) root.dataset.exchangeTyping = "true";
    };
    const onFocusOut = () => {
      // Wait for focus to land, so moving between fields does not flash the bars.
      window.setTimeout(() => {
        if (!isTyping(document.activeElement)) delete root.dataset.exchangeTyping;
      }, 50);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      delete root.dataset.exchangeTyping;
    };
  }, []);
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
