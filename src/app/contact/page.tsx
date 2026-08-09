import { Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { EnquiryForm } from "@/components/forms/enquiry-form";
import { PageHero } from "@/components/marketing/page-hero";
import { Container } from "@/components/ui/container";
import { contactLinks, formatPhone, siteConfig } from "@/config/site";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Contact SOB Autofix", "Call, WhatsApp, email or send an enquiry to SOB Autofix Limited in Norton, Doncaster.", "/contact");

export default function ContactPage() {
  return <><PageHero eyebrow="Contact" title="Tell us about the vehicle and what you need." body="Call, WhatsApp or send the details online. For the most useful response, include the vehicle and symptoms." cta={false} /><section className="bg-[#F4F7FA] py-20"><Container className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><div className="grid content-start gap-4"><ContactCard icon={<Phone />} title="Phone" value={formatPhone(siteConfig.phone)} href={contactLinks.phone} /><ContactCard icon={<MessageCircle />} title="WhatsApp" value={formatPhone(siteConfig.whatsapp)} href={contactLinks.whatsapp} /><ContactCard icon={<Mail />} title="Email" value={siteConfig.email} href={contactLinks.email} /><ContactCard icon={<MapPin />} title="Workshop" value={`${siteConfig.address.building}, ${siteConfig.address.street}, ${siteConfig.address.town}, ${siteConfig.address.city}, ${siteConfig.address.postcode}`} /><ContactCard icon={<Clock3 />} title="Opening" value="Open 24 hours; appointment and response availability varies." /></div><EnquiryForm type="general" title="Send a general enquiry" allowUploads={false} /></Container></section></>;
}

function ContactCard({ icon, title, value, href }: { icon: React.ReactNode; title: string; value: string; href?: string }) { const body = <><span className="text-[#1974E2]">{icon}</span><div><strong className="block text-[#071127]">{title}</strong><span className="mt-1 block text-sm leading-6 text-[#586575]">{value}</span></div></>; return href ? <a href={href} className="flex gap-4 rounded-2xl border border-[#E4EAF0] bg-white p-5 transition hover:border-[#1974E2]/50">{body}</a> : <div className="flex gap-4 rounded-2xl border border-[#E4EAF0] bg-white p-5">{body}</div>; }
