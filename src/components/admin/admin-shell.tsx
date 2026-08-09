import { BadgePoundSterling, CarFront, FileText, Gauge, Gift, ImageIcon, Inbox, Link2, LogOut, Settings, Star } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/admin/login/actions";
import { Logo } from "@/components/layout/logo";

const links = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/navigation", label: "Navigation", icon: Link2 },
  { href: "/admin/offers", label: "Offers", icon: Gift },
  { href: "/admin/pricing", label: "Pricing", icon: BadgePoundSterling },
  { href: "/admin/inventory", label: "Vehicle stock", icon: CarFront },
  { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminShell({ children, displayName }: { children: React.ReactNode; displayName: string }) {
  return <div className="min-h-screen bg-[#F4F7FA] lg:grid lg:grid-cols-[260px_1fr]"><aside className="bg-[#030712] p-5 text-white lg:sticky lg:top-0 lg:h-screen"><Logo inverse /><nav className="mt-10 grid gap-1">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-[#C6D2DF] hover:bg-[#1974E2]/15 hover:text-white"><Icon size={18} className="text-[#67B9FF]" />{label}</Link>)}</nav><div className="mt-10 border-t border-white/10 pt-5"><p className="px-3 text-xs text-[#8F9EAF]">Signed in as</p><p className="px-3 text-sm font-bold">{displayName}</p><form action={signOut}><button className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-[#C6D2DF] hover:bg-white/5"><LogOut size={18} />Sign out</button></form></div></aside><div><header className="border-b border-[#E4EAF0] bg-white px-5 py-4 lg:px-10"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#071127]">SOB Autofix CMS</p><Link href="/" className="text-sm font-bold text-[#1974E2]">View website ↗</Link></div></header><div className="p-5 lg:p-10">{children}</div></div></div>;
}
