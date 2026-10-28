"use client";

import { ChevronLeft, ChevronRight, Expand, ImageIcon, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./feedback";
import type { SaleVehicle } from "@/types/domain";

type GalleryImage = SaleVehicle["images"][number];

function useSwipe(onPrevious: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (event: React.PointerEvent) => { if (event.pointerType !== "mouse") start.current = { x: event.clientX, y: event.clientY }; },
    onPointerUp: (event: React.PointerEvent) => {
      const origin = start.current;
      start.current = null;
      if (!origin) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) (dx > 0 ? onPrevious : onNext)();
    },
    onPointerCancel: () => { start.current = null; },
  };
}

const arrowClass = "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#0B1220] shadow-lg transition hover:bg-white";

export function VehicleGallery({ images, vehicleName, sold = false }: { images: GalleryImage[]; vehicleName: string; sold?: boolean }) {
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbsRef = useRef<HTMLUListElement>(null);
  const count = images.length;
  const previous = useCallback(() => setIndex((current) => (current - 1 + count) % count), [count]);
  const next = useCallback(() => setIndex((current) => (current + 1) % count), [count]);
  const swipe = useSwipe(previous, next);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (viewerOpen && !dialog.open) dialog.showModal();
    if (!viewerOpen && dialog.open) dialog.close();
  }, [viewerOpen]);

  useEffect(() => {
    thumbsRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [index]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
    if (event.key === "ArrowRight") { event.preventDefault(); next(); }
  }

  const active = images[index];
  if (!active) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-[#F3F5F8] text-[#5B6575]">
        <span className="flex flex-col items-center gap-2 text-sm font-medium"><ImageIcon size={32} aria-hidden="true" /> Photos coming soon</span>
      </div>
    );
  }

  return (
    <section aria-roledescription="carousel" aria-label={`Photos of the ${vehicleName}`} onKeyDown={onKeyDown}>
      <div className="relative overflow-hidden rounded-2xl bg-[#0B1220] select-none" {...swipe}>
        <div className="relative aspect-[4/3]">
          <Image key={active.id} src={active.url} alt={active.alt || `${vehicleName}, photo ${index + 1}`} fill preload={index === 0} sizes="(max-width: 1023px) 100vw, 720px" className={cn("object-cover", sold && "grayscale-[35%]")} />
        </div>
        <button type="button" onClick={() => setViewerOpen(true)} className="absolute right-3 bottom-3 z-10 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0B1220]/80 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-[#0B1220]">
          <Expand size={16} aria-hidden="true" /> Full screen
        </button>
        {count > 1 && (
          <>
            <button type="button" onClick={previous} className={cn(arrowClass, "left-3")} aria-label="Previous photo"><ChevronLeft size={24} aria-hidden="true" /></button>
            <button type="button" onClick={next} className={cn(arrowClass, "right-3")} aria-label="Next photo"><ChevronRight size={24} aria-hidden="true" /></button>
            <p className="absolute top-3 right-3 rounded-full bg-[#0B1220]/80 px-3 py-1 text-[13px] font-semibold text-white" aria-live="polite">
              Photo {index + 1} of {count}
            </p>
          </>
        )}
      </div>
      {count > 1 && (
        <ul ref={thumbsRef} className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1" aria-label="Choose a photo">
          {images.map((image, position) => (
            <li key={image.id} className="shrink-0 snap-start" data-index={position}>
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Show photo ${position + 1} of ${count}`}
                aria-current={position === index ? "true" : undefined}
                className={cn("relative block h-16 w-24 overflow-hidden rounded-xl ring-2 ring-transparent ring-offset-2 transition sm:h-[72px] sm:w-[104px]", position === index ? "ring-[#1974E2]" : "opacity-75 hover:opacity-100")}
              >
                <Image src={image.url} alt="" fill sizes="104px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <dialog
        ref={dialogRef}
        onClose={() => setViewerOpen(false)}
        aria-label={`${vehicleName} photos, full screen`}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#05080F] p-0 text-white backdrop:bg-black"
      >
        {viewerOpen && (
          <div className="flex h-full flex-col" onKeyDown={onKeyDown}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-sm font-semibold" aria-live="polite">Photo {index + 1} of {count}</p>
              <button type="button" onClick={() => setViewerOpen(false)} className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close full screen photos" autoFocus>
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1 select-none" {...swipe}>
              <Image src={active.url} alt={active.alt || `${vehicleName}, photo ${index + 1}`} fill sizes="100vw" className="object-contain" />
              {count > 1 && (
                <>
                  <button type="button" onClick={previous} className={cn(arrowClass, "left-3")} aria-label="Previous photo"><ChevronLeft size={24} aria-hidden="true" /></button>
                  <button type="button" onClick={next} className={cn(arrowClass, "right-3")} aria-label="Next photo"><ChevronRight size={24} aria-hidden="true" /></button>
                </>
              )}
            </div>
            <p className="px-4 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))] text-center text-sm text-[#AEB6C2]">Swipe or use the arrow keys to see more photos.</p>
          </div>
        )}
      </dialog>
    </section>
  );
}
