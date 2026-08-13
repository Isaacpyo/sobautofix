import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function VehicleDetailLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div>
      <div className="bg-[#071127] px-4 pt-4 sm:px-6">
        <Link
          href="/cars-for-sale"
          aria-label="Back to vehicle stock"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:-translate-x-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#67B9FF]/40 sm:px-4"
        >
          <ArrowLeft aria-hidden="true" size={19} />
          <span className="hidden sm:inline">Back to stock</span>
        </Link>
      </div>
      <div className="vehicle-detail-page [&>section:first-of-type]:sticky [&>section:first-of-type]:top-[4.5rem] [&>section:first-of-type]:z-30 [&>section:first-of-type]:!py-4 [&>section:first-of-type]:shadow-xl xl:[&>section:first-of-type]:top-20">
        {children}
      </div>
    </div>
  );
}
