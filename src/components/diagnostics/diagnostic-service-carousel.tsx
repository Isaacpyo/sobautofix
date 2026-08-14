"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { ServiceCard } from "@/components/marketing/service-card";
import type { ServiceDefinition } from "@/config/site";
import styles from "./diagnostic-service-carousel.module.css";

export function DiagnosticServiceCarousel({
  items,
}: {
  items: ServiceDefinition[];
}) {
  const viewportRef = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({ left: viewport.clientWidth * direction * 0.84, behavior: "smooth" });
  }

  return (
    <div className={styles.shell}>
      <div ref={viewportRef} className={styles.viewport} role="region" aria-label="Diagnostic services">
        {items.map((item) => (
          <div key={item.slug} className={styles.slide}>
            <ServiceCard
              title={item.name}
              body={item.summary}
              href={`/diagnostics/${item.slug}`}
            />
          </div>
        ))}
      </div>
      <div className={styles.controls} aria-label="Diagnostic service carousel controls">
        <button type="button" onClick={() => scroll(-1)} aria-label="Show previous diagnostic services"><ChevronLeft size={18} aria-hidden="true" /></button>
        <button type="button" onClick={() => scroll(1)} aria-label="Show next diagnostic services"><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
