import { Bell, Building2, Clock3, Contact, HeartPulse, ImageIcon, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { saveSettings } from "../actions";
import { AdminField } from "@/components/admin/content-editor";
import { OpeningHoursEditor } from "@/components/admin/opening-hours-editor";
import { siteConfig } from "@/config/site";
import { createAdminReadClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const client = await createAdminReadClient();
  const { data } = client
    ? await client.from("site_settings").select("value").eq("id", true).maybeSingle()
    : { data: null };
  const override = (data?.value || {}) as Partial<typeof siteConfig>;
  const current = {
    ...siteConfig,
    ...override,
    address: { ...siteConfig.address, ...(override.address || {}) },
    openingHours: { ...siteConfig.openingHours, ...(override.openingHours || {}) },
  };

  return (
    <>
      <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Configuration</p>
      <h1 className="mt-2 text-4xl font-extrabold text-[#071127]">Settings</h1>
      <p className="mt-3 text-[#586575]">Manage the business details used across the website and customer communications.</p>

      <nav aria-label="Configuration pages" className="mt-6 flex w-fit gap-1 rounded-xl border border-[#D7E0E9] bg-white p-1">
        <Link href="/admin/settings" aria-current="page" className="rounded-lg bg-[#071127] px-4 py-2 text-sm font-bold text-white">Settings</Link>
        <Link href="/admin/configuration/security" className="rounded-lg px-4 py-2 text-sm font-bold text-[#586575] hover:bg-[#F4F7FA] hover:text-[#1974E2]">Security</Link>
      </nav>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="rounded-2xl border border-[#E4EAF0] bg-white p-2 lg:sticky lg:top-6">
          <p className="px-3 pb-2 pt-2 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-[#8794A3]">General</p>
          <SettingsLink href="#business-profile" label="Business profile" icon={<Building2 />} active />
          <SettingsLink href="#contact-details" label="Contact details" icon={<Contact />} />
          <SettingsLink href="#location" label="Location" icon={<MapPin />} />
          <SettingsLink href="#opening-hours" label="Opening hours" icon={<Clock3 />} />

          <p className="mt-4 px-3 pb-2 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-[#8794A3]">Website</p>
          <SettingsLink href="#media-settings" label="Media library" icon={<ImageIcon />} />
          <SettingsLink href="#publishing-controls" label="Publishing controls" icon={<ShieldCheck />} />

          <p className="mt-4 px-3 pb-2 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-[#8794A3]">Operations</p>
          <SettingsLink href="#notification-settings" label="Notifications" icon={<Bell />} />
          <SettingsLink href="#system-settings" label="System health" icon={<HeartPulse />} />
        </nav>

        <div className="min-w-0">
          <form action={saveSettings} className="grid gap-6">
            <SettingsSection id="business-profile" icon={<Building2 />} title="Business profile" description="Core identity and registration details shown throughout the site.">
              <AdminField label="Business name"><input name="name" required defaultValue={current.name} /></AdminField>
              <AdminField label="Legal name"><input name="legalName" required defaultValue={current.legalName} /></AdminField>
              <AdminField label="Company number"><input name="companyNumber" required defaultValue={current.companyNumber} /></AdminField>
            </SettingsSection>

            <SettingsSection id="contact-details" icon={<Contact />} title="Contact details" description="Public channels customers use to contact the garage.">
              <AdminField label="Phone"><input name="phone" required defaultValue={current.phone} /></AdminField>
              <AdminField label="WhatsApp"><input name="whatsapp" required defaultValue={current.whatsapp} /></AdminField>
              <AdminField label="Email"><input name="email" type="email" required defaultValue={current.email} /></AdminField>
            </SettingsSection>

            <SettingsSection id="location" icon={<MapPin />} title="Location" description="Workshop address and the destination used by map links.">
              <AdminField label="Building"><input name="building" required defaultValue={current.address.building} /></AdminField>
              <AdminField label="Street"><input name="street" required defaultValue={current.address.street} /></AdminField>
              <AdminField label="Town"><input name="town" required defaultValue={current.address.town} /></AdminField>
              <AdminField label="City"><input name="city" required defaultValue={current.address.city} /></AdminField>
              <AdminField label="Postcode"><input name="postcode" required defaultValue={current.address.postcode} /></AdminField>
              <AdminField label="Google Maps URL"><input name="googleMapsUrl" type="url" defaultValue={"googleMapsUrl" in current ? String(current.googleMapsUrl || "") : ""} /></AdminField>
            </SettingsSection>

            <SettingsSection id="opening-hours" icon={<Clock3 />} title="Opening hours" description="Leave an entry blank when the hours are not confirmed; blank hours are not published.">
              <OpeningHoursEditor initialHours={current.openingHours} />
            </SettingsSection>

            <div className="sticky bottom-4 z-10 flex justify-end rounded-2xl border border-[#D7E0E9] bg-white/95 p-4 shadow-[0_12px_35px_rgba(7,17,39,0.12)] backdrop-blur">
              <button className="min-h-12 w-full rounded-xl bg-[#1974E2] px-7 font-bold text-white sm:w-auto">Save all settings</button>
            </div>
          </form>

          <div className="mt-6 grid gap-6">
            <ManagementSection id="media-settings" icon={<ImageIcon />} title="Media library" description="Manage approved website images, publication status and accessible alternative text." href="/admin/media" action="Open media library" />
            <ManagementSection id="notification-settings" icon={<Bell />} title="Notifications" description="Review new enquiries, pending messages and email delivery issues requiring attention." href="/admin/notifications" action="Review notifications" />
            <ManagementSection id="system-settings" icon={<HeartPulse />} title="System health" description="Check integration readiness, publishing health and the services used by the website." href="/admin#system-health" action="View system health" />
          </div>

      <section id="publishing-controls" className="mt-6 scroll-mt-6 rounded-2xl border border-[#E4EAF0] bg-white p-6" aria-labelledby="safeguards-heading">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Publishing controls</p>
            <h2 id="safeguards-heading" className="mt-1 text-2xl font-bold text-[#071127]">Launch safeguards</h2>
          </div>
        </div>
        <ul className="mt-5 grid gap-3 text-sm leading-6 text-[#586575] md:grid-cols-2">
          <li className="rounded-xl bg-[#F8FAFC] p-4">Draft content is never public or included in the sitemap.</li>
          <li className="rounded-xl bg-[#F8FAFC] p-4">Publishing validates SEO fields, structured sections and prohibited customer-facing terms.</li>
          <li className="rounded-xl bg-[#F8FAFC] p-4">Missing integrations are reported without exposing secret names or values.</li>
          <li className="rounded-xl bg-[#F8FAFC] p-4">Public photos require useful alternative text before publication.</li>
        </ul>
      </section>
        </div>
      </div>
    </>
  );
}

function SettingsLink({ href, label, icon, active = false }: { href: string; label: string; icon: React.ReactNode; active?: boolean }) {
  const className = `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors ${active ? "bg-[#071127] text-white" : "text-[#586575] hover:bg-[#F4F7FA] hover:text-[#1974E2]"}`;
  return <a href={href} className={className}><span className="[&_svg]:size-[17px]" aria-hidden="true">{icon}</span>{label}</a>;
}

function ManagementSection({ id, icon, title, description, href, action }: { id: string; icon: React.ReactNode; title: string; description: string; href: string; action: string }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border border-[#E4EAF0] bg-white p-6" aria-labelledby={`${id}-heading`}>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2] [&_svg]:size-5" aria-hidden="true">{icon}</span>
          <div><h2 id={`${id}-heading`} className="text-xl font-bold text-[#071127]">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#586575]">{description}</p></div>
        </div>
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#BCD6F6] px-4 text-sm font-bold text-[#1974E2] hover:bg-[#EAF3FF]">{action}</Link>
      </div>
    </section>
  );
}

function SettingsSection({ id, icon, title, description, children }: { id: string; icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border border-[#E4EAF0] bg-white p-6" aria-labelledby={`${id}-heading`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2] [&_svg]:size-5" aria-hidden="true">{icon}</span>
        <div><h2 id={`${id}-heading`} className="text-xl font-bold text-[#071127]">{title}</h2><p className="mt-1 text-sm leading-6 text-[#586575]">{description}</p></div>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}
