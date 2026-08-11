import { Mail, Phone } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { ManageBooking } from "@/components/booking/manage-booking";
import { PageHero } from "@/components/marketing/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { linksForSettings } from "@/config/settings";
import { getSiteSettings } from "@/lib/settings/repository";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...createMetadata("Manage Your Booking", "Find, reschedule or cancel your SOB Autofix vehicle service or diagnostic appointment online.", "/manage-booking"),
  title: { absolute: "Manage Your Booking | SOB Autofix" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function ManageBookingPage() {
  const settings = await getSiteSettings();
  const links = linksForSettings(settings);
  return (
    <>
      <PageHero title="Manage your booking" body="Need to change your appointment? Find your booking below to reschedule or cancel it." cta={false} compact showTrustFacts={false} />
      <section className="bg-[#F4F7FA] py-8 sm:py-10 lg:py-12">
        <Container className="max-w-6xl">
          <ManageBooking />
          <aside className="mt-8 rounded-3xl bg-[#071127] p-6 text-white sm:p-8">
            <h2 className="text-2xl font-extrabold">Need help with your booking?</h2>
            <p className="mt-3 max-w-3xl leading-7 text-[#C6D2DF]">If your appointment is very close, work has already started, or you are unable to make changes online, please contact SOB Autofix directly and we&apos;ll help you.</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <a href={links.phone} className="inline-flex items-center gap-2 font-bold text-[#67B9FF] hover:text-white"><Phone size={17} aria-hidden="true" /> {settings.phone}</a>
              <a href={links.email} className="inline-flex items-center gap-2 font-bold text-[#67B9FF] hover:text-white"><Mail size={17} aria-hidden="true" /> {settings.email}</a>
            </div>
            <ButtonLink href="/contact" className="mt-6">Contact us</ButtonLink>
          </aside>
          <p className="mt-6 text-center text-xs text-[#667586]">Looking to make a new appointment? <Link href="/book" className="font-bold text-[#1974E2]">Book online</Link>.</p>
        </Container>
      </section>
    </>
  );
}
