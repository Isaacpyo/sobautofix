"use client";

import { MessageCircle } from "lucide-react";
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
        className="group fixed right-4 bottom-20 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_rgba(0,0,0,.3)] ring-1 ring-black/5 transition hover:-translate-y-1 hover:bg-[#20BD5A] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/35 md:right-6 md:bottom-6 md:h-16 md:w-16"
      >
        <MessageCircle aria-hidden="true" size={30} strokeWidth={2.25} />
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-[#071127] px-3 py-2 text-xs font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100 md:block">
          Chat on WhatsApp
        </span>
      </a>
    </aside>
  );
}
