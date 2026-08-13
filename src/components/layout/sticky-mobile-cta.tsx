"use client";

import { CalendarDays, CarFront, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { contactLinks } from "@/config/site";
import { track } from "@/lib/analytics/events";

export function StickyMobileCta() {
  const pathname = usePathname();
  const conversionRoutes = ["/book", "/get-a-quote", "/vehicle-check", "/contact", "/mobile-mechanic", "/vehicle-inspections", "/vehicle-recovery", "/fleet"];
  if (pathname === "/" || conversionRoutes.includes(pathname)) return null;
  return (
    <nav aria-label="Quick actions" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#1974E2]/25 bg-[#030712]/98 text-white shadow-[0_-12px_40px_rgba(0,0,0,.3)] md:hidden">
      <Action href={contactLinks.phone} label="Call" icon={<Phone size={18} />} onClick={() => track("phone_clicked")} />
      <Action href={contactLinks.whatsapp} label="WhatsApp" icon={<MessageCircle size={18} />} onClick={() => track("whatsapp_clicked")} />
      <Action href="/vehicle-check" label="Vehicle" icon={<CarFront size={18} />} />
      <Action href="/book" label="Book" icon={<CalendarDays size={18} />} primary />
    </nav>
  );
}

function Action({ href, label, icon, primary, onClick }: { href: string; label: string; icon: React.ReactNode; primary?: boolean; onClick?: () => void }) {
  return <Link href={href} onClick={onClick} className={primary ? "flex min-h-16 flex-col items-center justify-center gap-1 bg-[#1974E2] text-[10px] font-extrabold uppercase" : "flex min-h-16 flex-col items-center justify-center gap-1 border-r border-white/10 text-[10px] font-bold uppercase text-[#DCE6F2]"}>{icon}{label}</Link>;
}
