"use client";

import Image from "next/image";
import Link from "next/link";
import { Gauge, ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { SaleVehicle } from "@/types/domain";

export function InventoryGrid({ vehicles }: { vehicles: SaleVehicle[] }) {
  const [make, setMake] = useState("");
  const [fuel, setFuel] = useState("");
  const [transmission, setTransmission] = useState("");
  const filtered = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          (!make || vehicle.make === make) &&
          (!fuel || vehicle.fuelType === fuel) &&
          (!transmission || vehicle.transmission === transmission),
      ),
    [vehicles, make, fuel, transmission],
  );
  const unique = (field: "make" | "fuelType" | "transmission") =>
    [...new Set(vehicles.map((vehicle) => vehicle[field]))].sort();

  if (!vehicles.length)
    return (
      <div className="rounded-[2rem_.4rem_2rem_.4rem] border border-[#E4EAF0] bg-[#F4F7FA] p-10 text-center">
        <ImageIcon className="mx-auto text-[#1974E2]" size={40} />
        <h2 className="mt-4 text-3xl font-bold text-[#071127]">
          No vehicles are currently listed
        </h2>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-[#586575]">
          New stock will appear here only when genuine vehicle information and
          photography have been approved.
        </p>
        <Link
          className="mt-6 inline-block font-bold text-[#1974E2]"
          href="/contact"
        >
          Ask about upcoming stock →
        </Link>
      </div>
    );

  return (
    <>
      <div className="mb-8 grid gap-3 border border-[#E4EAF0] bg-[#F4F7FA] p-4 sm:grid-cols-3">
        <Filter
          label="Make"
          value={make}
          values={unique("make")}
          onChange={setMake}
        />
        <Filter
          label="Fuel"
          value={fuel}
          values={unique("fuelType")}
          onChange={setFuel}
        />
        <Filter
          label="Transmission"
          value={transmission}
          values={unique("transmission")}
          onChange={setTransmission}
        />
      </div>
      <div className="grid gap-5 bg-transparent md:grid-cols-2 md:gap-px md:overflow-hidden md:border md:border-[#E4EAF0] md:bg-[#E4EAF0] lg:grid-cols-3">
        {filtered.map((vehicle) => (
          <Link
            href={`/cars-for-sale/${vehicle.slug}`}
            key={vehicle.id}
            className="premium-card group overflow-hidden rounded-2xl border border-[#D7E0E9] bg-white shadow-sm transition hover:-translate-y-1 hover:border-[#1974E2]/50 hover:shadow-xl md:rounded-none md:border-0 md:shadow-none"
            data-reveal
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-[#E4EAF0]">
              {vehicle.images[0] ? (
                <Image
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  src={vehicle.images[0].url}
                  alt={vehicle.images[0].alt}
                />
              ) : (
                <span className="grid h-full place-items-center text-[#9AA7B6]">
                  <ImageIcon size={40} />
                </span>
              )}
              {vehicle.status === "reserved" && (
                <span className="absolute top-4 left-4 rounded-md bg-[#071127] px-3 py-1 text-xs font-black text-white uppercase">
                  Reserved
                </span>
              )}
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3 md:block">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">
                    {vehicle.year} · {vehicle.fuelType}
                  </p>
                  <h2 className="mt-2 text-3xl font-extrabold text-[#071127]">
                    {vehicle.make} {vehicle.model}
                  </h2>
                  <p className="mt-1 text-sm text-[#667586]">
                    {vehicle.derivative}
                  </p>
                </div>
                <p className="shrink-0 text-2xl font-black text-[#071127] md:mt-5">
                  {formatCurrency(vehicle.price)}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-[#E4EAF0] pt-4 text-sm text-[#586575]">
                <Gauge size={17} className="text-[#1974E2]" />{" "}
                {vehicle.mileage.toLocaleString("en-GB")} miles ·{" "}
                {vehicle.transmission}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function Filter({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-bold text-[#586575] uppercase">
      {label}
      <select
        className="mt-1 block min-h-11 w-full rounded-lg border border-[#D7E0E9] bg-white px-3 text-sm text-[#071127]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {values.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
