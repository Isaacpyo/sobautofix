"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useState } from "react";
import type { SaleVehicle } from "@/types/domain";

type VehicleImageGalleryProps = {
  images: SaleVehicle["images"];
  vehicleName: string;
};

export function VehicleImageGallery({ images, vehicleName }: VehicleImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  if (!activeImage) {
    return (
      <div className="grid aspect-[16/9] place-items-center bg-[#E4EAF0] text-[#667586]">
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
      <div className="group relative aspect-[16/10] min-h-72 sm:aspect-[16/9] lg:min-h-[34rem]">
        <Image
          key={activeImage.id}
          src={activeImage.url}
          alt={activeImage.alt}
          fill
          preload={activeIndex === 0}
          sizes="(max-width: 1280px) 100vw, 75vw"
          className="object-cover"
        />
        {hasMultipleImages && (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label="Show previous vehicle photo"
              className="absolute top-1/2 left-4 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-[#071127]/75 text-white backdrop-blur transition hover:bg-[#1974E2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60 sm:left-6 sm:size-12"
            >
              <ChevronLeft size={25} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label="Show next vehicle photo"
              className="absolute top-1/2 right-4 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-[#071127]/75 text-white backdrop-blur transition hover:bg-[#1974E2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60 sm:right-6 sm:size-12"
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
