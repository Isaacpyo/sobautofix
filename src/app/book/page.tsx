import { CheckCircle2 } from "lucide-react";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { Container, Eyebrow } from "@/components/ui/container";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata(
  "Book a Vehicle Service Appointment",
  "Book a diagnostics, repair, service or inspection appointment directly with SOB Autofix in Doncaster.",
  "/book",
);

export default function BookPage() {
  return (
    <section className="hero-grid min-h-[calc(100vh-4.5rem)] overflow-hidden py-6 text-white sm:py-10 lg:min-h-[calc(100vh-5rem)] lg:py-14">
      <Container className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,0.58fr)_minmax(36rem,1.2fr)] lg:gap-10 xl:gap-14">
        <div className="min-w-0 lg:sticky lg:top-28 lg:pt-8">
          <Eyebrow className="mb-2 text-[#67B9FF] sm:mb-3">Online vehicle booking</Eyebrow>
          <h1 className="text-balance text-4xl leading-[0.95] font-extrabold sm:text-5xl lg:text-6xl xl:text-7xl">
            Book your vehicle in
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#C6D2DF] sm:mt-5 sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
            Tell us about the vehicle and the work first, then choose a live appointment time that suits you.
          </p>
          <ul className="mt-6 grid gap-3 text-sm text-[#D7E3F0]">
            {["Vehicle-first booking", "Workshop and eligible mobile options", "Guest booking — no account needed"].map((item) => <li key={item} className="flex items-center gap-3"><CheckCircle2 className="shrink-0 text-[#67B9FF]" size={19} aria-hidden="true" />{item}</li>)}
          </ul>
        </div>

        <div className="-mx-5 min-w-0 overflow-hidden bg-white text-[#202A36] shadow-[0_24px_70px_rgba(0,0,0,0.3)] sm:mx-0 sm:rounded-3xl">
          <BookingWizard />
        </div>
      </Container>
    </section>
  );
}
