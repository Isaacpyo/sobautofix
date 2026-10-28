import { Calendar, Cog, Fuel, Gauge, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatMileage, vehicleTitle } from "@/lib/exchange/public/format";
import { cn } from "@/lib/utils";
import type { SaleVehicle } from "@/types/domain";
import { AvailabilityChip, DisclosureBadges, Price } from "./ui";

export function VehicleCard({ vehicle, href, preload = false, headingLevel = "h3" }: { vehicle: SaleVehicle; href: string; preload?: boolean; headingLevel?: "h2" | "h3" }) {
  const image = vehicle.images[0];
  const Heading = headingLevel;
  const sold = vehicle.status === "sold";
  const specs = [
    { icon: Calendar, label: "Year", value: String(vehicle.year) },
    { icon: Gauge, label: "Mileage", value: formatMileage(vehicle.mileage) },
    { icon: Fuel, label: "Fuel", value: vehicle.fuelType },
    { icon: Cog, label: "Transmission", value: vehicle.transmission },
  ];

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#E3E8EF] bg-white shadow-[0_1px_2px_rgba(16,24,40,.05)] transition hover:border-[#B9D4F6] hover:shadow-[0_12px_32px_rgba(11,18,32,.10)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F3F5F8]">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt || `${vehicleTitle(vehicle)} photo`}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 380px"
            className={cn("object-cover transition duration-500 group-hover:scale-[1.03]", sold && "grayscale-[35%]")}
            preload={preload}
          />
        ) : (
          <span className="grid h-full place-items-center text-[#5B6575]">
            <span className="flex flex-col items-center gap-2 text-sm font-medium"><ImageIcon size={28} aria-hidden="true" /> Photos coming soon</span>
          </span>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <AvailabilityChip status={vehicle.status} className="shadow-sm" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <DisclosureBadges vehicle={vehicle} className="mb-3" />
        <Heading className="text-[22px] leading-tight font-bold text-[#0B1220]">
          <Link href={href} className="rounded after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {vehicleTitle(vehicle)}
          </Link>
        </Heading>
        {vehicle.derivative && <p className="mt-1 line-clamp-1 text-[15px] text-[#5B6575]">{vehicle.derivative}</p>}
        <dl className="mt-4 mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-[#344054]">
          {specs.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex min-w-0 items-center gap-2">
              <dt className="sr-only">{label}</dt>
              <Icon size={16} aria-hidden="true" className="shrink-0 text-[#5B6575]" />
              <dd className="truncate">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-[#E3E8EF] pt-4">
          <p>
            <span className="sr-only">{sold ? "Sold price was " : "Price "}</span>
            <Price value={vehicle.price} className={cn("text-[30px] leading-none", sold && "text-[#5B6575]")} />
          </p>
          <span aria-hidden="true" className="inline-flex min-h-10 items-center rounded-xl bg-[#EAF2FD] px-3.5 text-sm font-semibold text-[#1462C4] transition group-hover:bg-[#1974E2] group-hover:text-white">
            View vehicle
          </span>
        </div>
      </div>
      {/* The whole card is clickable through the heading link; this ring shows keyboard focus on the card. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl ring-[#1974E2]/60 group-has-[a:focus-visible]:ring-3" />
    </article>
  );
}
