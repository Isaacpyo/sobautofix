"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";
import { WebVitals } from "@/components/analytics/web-vitals";
import { Button, ButtonLink } from "@/components/ui/button";

type Consent = { analytics: boolean; functional: boolean };
const storageKey = "sob-autofix-consent-v1";
const changeEvent = "sob-autofix-consent-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changeEvent, callback); };
}

function getSnapshot() { return window.localStorage.getItem(storageKey) || ""; }
function getServerSnapshot() { return ""; }

export function ConsentManager() {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  let consent: Consent | null = null;
  try { consent = stored ? JSON.parse(stored) as Consent : null; } catch { consent = null; }

  function choose(value: Consent) {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
    window.dispatchEvent(new Event(changeEvent));
  }

  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const tawkProperty = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID;
  const tawkWidget = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID;

  return (
    <>
      {!consent && (
        <section aria-label="Cookie preferences" className="fixed right-4 bottom-20 left-4 z-[60] mx-auto max-w-2xl rounded-2xl border border-[#1974E2]/25 bg-white/90 p-5 text-[#071127] shadow-2xl backdrop-blur-xl md:bottom-5">
          <h2 className="text-xl font-bold">Your privacy choices</h2>
          <p className="mt-2 text-sm leading-6 text-[#586575]">We use essential storage to operate the site. With your permission, analytics helps us improve journeys and functional storage enables live chat.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => choose({ analytics: true, functional: true })}>Accept optional cookies</Button>
            <Button onClick={() => choose({ analytics: false, functional: false })} variant="secondary" className="border-[#1974E2]/35 text-[#1446A5] hover:bg-[#EAF3FF]">Essential only</Button>
            <ButtonLink href="/cookies" variant="ghost">Learn about cookie choices</ButtonLink>
          </div>
        </section>
      )}
      {consent?.analytics && measurementId && (
        <>
          <WebVitals />
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${measurementId}',{anonymize_ip:true});`}</Script>
        </>
      )}
      {consent?.functional && tawkProperty && tawkWidget && (
        <Script id="tawk" strategy="lazyOnload">{`var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement('script');s1.async=true;s1.src='https://embed.tawk.to/${tawkProperty}/${tawkWidget}';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');document.head.appendChild(s1);})();`}</Script>
      )}
    </>
  );
}
