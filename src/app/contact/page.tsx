import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { EnquiryForm } from "@/components/forms/enquiry-form";
import { PageHero } from "@/components/marketing/page-hero";
import { SocialLinks } from "@/components/marketing/social-links";
import { Container, Eyebrow } from "@/components/ui/container";
import { contactLinks, formatPhone, siteConfig } from "@/config/site";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata("Contact SOB Autofix", "Call, WhatsApp, email or send an enquiry to SOB Autofix Limited in Doncaster, South Yorkshire.", "/contact");

export default function ContactPage() {
  return <><PageHero title="Tell us about the vehicle and what you need." cta={false} compact showTrustFacts={false} /><section className="relative bg-[#F4F7FA] py-12 sm:py-16"><Container className="grid gap-6 lg:grid-cols-[.78fr_1.22fr] lg:gap-8"><aside className="order-2 overflow-hidden bg-[#071127] text-white lg:order-1"><div className="hero-grid p-6 sm:p-8"><Eyebrow className="text-[#67B9FF]">Direct contact</Eyebrow><h2 className="text-4xl font-extrabold">Workshop, phone or message.</h2><p className="mt-4 text-sm leading-7 text-[#C6D2DF]">Share the registration, symptoms, location and whether the vehicle can be driven where relevant.</p></div><div className="grid gap-px bg-white/10"> <ContactCard icon={<Phone />} title="Phone" value={formatPhone(siteConfig.phone)} href={contactLinks.phone} /><ContactCard icon={<MessageCircle />} title="WhatsApp" value={formatPhone(siteConfig.whatsapp)} href={contactLinks.whatsapp} /><ContactCard icon={<Mail />} title="Email" value={siteConfig.email} href={contactLinks.email} /><ContactCard icon={<MapPin />} title="Workshop postal address" value={`${siteConfig.address.building}, ${siteConfig.address.street}, ${siteConfig.address.town}, ${siteConfig.address.city}, ${siteConfig.address.postcode}`} /></div><div className="border-t border-white/10 p-6"><h2 className="text-lg font-bold">Follow SOB Autofix</h2><SocialLinks socials={siteConfig.socials} showLabels className="mt-4 text-white" /></div></aside><div className="order-1 lg:order-2" data-motion="off"><EnquiryForm type="general" title="Send a general enquiry" /></div></Container></section></>;
}

function ContactCard({ icon, title, value, href }: { icon: React.ReactNode; title: string; value: string; href?: string }) {
  const body = <><span className="text-[#67B9FF]">{icon}</span><div><strong className="block text-white">{title}</strong><span className="mt-1 block text-sm leading-6 text-[#C6D2DF]">{value}</span></div></>;
  const className = "flex gap-4 bg-white/[.035] p-5 transition hover:bg-[#1974E2]/10";
  return href ? <a href={href} className={className}>{body}</a> : <div className={className}>{body}</div>;
}
