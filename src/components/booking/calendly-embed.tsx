"use client";

import Script from "next/script";
import { CalendarX2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";
import { formatRegistration } from "@/lib/vehicle/registration-format";
import { useVehicleSession } from "@/components/vehicle/vehicle-context";

declare global {
  interface Window {
    Calendly?: { initInlineWidget: (options: { url: string; parentElement: HTMLElement; resize?: boolean; prefill?: { customAnswers?: Record<string, string> } }) => void };
  }
}

export function CalendlyEmbed() {
  const { session } = useVehicleSession();
  const container = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  const url = process.env.NEXT_PUBLIC_CALENDLY_URL;

  const initialise = useCallback(() => {
    if (!url || !container.current || !window.Calendly || initialized) return;
    const customAnswers: Record<string, string> = {};
    if (session.vehicle) customAnswers.a1 = `${formatRegistration(session.vehicle.registration)} ${[session.vehicle.make, session.vehicle.model].filter(Boolean).join(" ")}`.trim();
    if (session.selectedService) customAnswers.a2 = session.selectedService;
    if (session.selectedProblem) customAnswers.a3 = session.selectedProblem;
    window.Calendly.initInlineWidget({ url, parentElement: container.current, resize: true, prefill: { customAnswers } });
    setInitialized(true);
    track("booking_opened", { source: session.source || "book-page" });
  }, [initialized, session, url]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://calendly.com") return;
      const name = (event.data as { event?: string } | null)?.event;
      if (name === "calendly.event_scheduled") track("booking_completed", { source: session.source || "book-page" });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [session.source]);

  if (!url) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><CalendarX2 className="mx-auto text-amber-600" /><h2 className="mt-4 text-2xl font-bold text-[#071127]">Online booking is being configured</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#586575]">Use the quote form or call SOB Autofix while the production scheduling link is connected.</p><ButtonLink className="mt-5" href="/get-a-quote">Send a request</ButtonLink></div>;

  return <><Script src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" onLoad={initialise} /><div ref={container} className="min-h-[720px]" aria-label="Appointment calendar"><button onClick={initialise} className="sr-only">Load appointment calendar</button></div></>;
}
