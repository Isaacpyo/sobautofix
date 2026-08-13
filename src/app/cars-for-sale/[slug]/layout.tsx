import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function VehicleDetailLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative">
      <div className="vehicle-detail-page [&>section:first-of-type]:sticky [&>section:first-of-type]:top-[4.5rem] [&>section:first-of-type]:z-30 [&>section:first-of-type]:!py-3 [&>section:first-of-type]:shadow-xl [&>section:first-of-type_h1]:!text-3xl [&>section:first-of-type_h1]:!leading-none [&>section:first-of-type_p]:!mt-1 [&>section:first-of-type_p]:!text-sm [&>section:first-of-type_strong]:!text-2xl lg:[&>section:nth-of-type(2)_aside]:!top-48 xl:[&>section:first-of-type]:top-20 xl:[&>section:first-of-type_h1]:!text-4xl">
        {children}
      </div>
      <Link
        href="/cars-for-sale"
        aria-label="Back to vehicle stock"
        className="vehicle-back-to-stock absolute z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 bg-[#071127]/80 px-3 text-sm font-bold text-white shadow-xl backdrop-blur-md transition hover:-translate-x-0.5 hover:bg-[#071127]/95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#67B9FF]/50 sm:px-4"
      >
        <ArrowLeft aria-hidden="true" size={19} />
        <span>Back to stock</span>
      </Link>
    </div>
  );
}
