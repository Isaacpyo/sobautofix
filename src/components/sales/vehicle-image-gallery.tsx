"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useState } from "react";
import type { SaleVehicle } from "@/types/domain";
import { SoldBanner } from "./sold-banner";

type VehicleImageGalleryProps = {
  images: SaleVehicle["images"];
  vehicleName: string;
  sold?: boolean;
};

export function VehicleImageGallery({ images, vehicleName, sold = false }: VehicleImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  if (!activeImage) {
    return (
      <div className="relative grid aspect-[16/9] place-items-center overflow-hidden bg-[#E4EAF0] text-[#667586]">
        {sold && <SoldBanner size="lg" />}
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <ImageIcon size={20} /> Vehicle photography awaiting approval
        </span>
      </div>
    );
  }

  const showPrevious = () => setActiveIndex((current) => (current - 1 + images.length) % images.length);
  const showNext = () => setActiveIndex((current) => (current + 1) % images.length);
  const hasMultipleImages = images.length > 1;

  return (
    <section className="overflow-hidden border border-[#D7E0E9] bg-[#071127]" aria-label={`${vehicleName} photo gallery`}>
      <div className="group relative aspect-[4/3] w-full sm:aspect-[16/10] xl:aspect-[16/9]">
        <Image
          key={activeImage.id}
          src={activeImage.url}
          alt={activeImage.alt}
          fill
          preload={activeIndex === 0}
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover"
        />
        {sold && <SoldBanner size="lg" />}
        {hasMultipleImages && (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label="Show previous vehicle photo"
              className="absolute top-1/2 left-4 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-white text-[#071127] shadow-lg transition hover:bg-[#1974E2] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60 sm:left-6 sm:size-12"
            >
              <ChevronLeft size={25} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label="Show next vehicle photo"
              className="absolute top-1/2 right-4 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-white text-[#071127] shadow-lg transition hover:bg-[#1974E2] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60 sm:right-6 sm:size-12"
            >
              <ChevronRight size={25} aria-hidden="true" />
            </button>
            <p className="absolute right-4 bottom-4 rounded-full bg-[#071127]/75 px-3 py-1 text-xs font-bold tracking-[.12em] text-white backdrop-blur sm:right-6 sm:bottom-6" aria-live="polite">
              {activeIndex + 1} / {images.length}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
