"use client";

import { contactLinks } from "@/config/site";
import { track } from "@/lib/analytics/events";

export function FloatingWhatsApp() {
  return (
    <aside aria-label="WhatsApp contact">
      <a
        href={contactLinks.whatsapp}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat with SOB Autofix on WhatsApp"
        onClick={() => track("whatsapp_clicked")}
        className="group fixed right-4 bottom-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_rgba(0,0,0,.3)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:bg-[#20BD5A] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/35 md:right-6 md:bottom-6 md:h-16 md:w-16"
      >
        <WhatsAppLogo />
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-[#071127] px-3 py-2 text-xs font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100 md:block">
          Chat on WhatsApp
        </span>
      </a>
    </aside>
  );
}

function WhatsAppLogo() {
  return <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 fill-current"><path d="M16 3.1a12.8 12.8 0 0 0-10.9 19.5L3.4 28.9l6.5-1.7A12.8 12.8 0 1 0 16 3.1Zm0 23.3c-2 0-3.9-.5-5.6-1.5l-.4-.2-3.8 1 1-3.7-.2-.4A10.5 10.5 0 1 1 16 26.4Zm5.8-7.8c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2l-.9 1.1c-.2.2-.3.2-.6.1-1.6-.8-2.7-1.6-3.8-3.5-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.4-.3.3-1 1-1 2.5s1 3 1.1 3.2c.2.2 2 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3Z" /></svg>;
}
