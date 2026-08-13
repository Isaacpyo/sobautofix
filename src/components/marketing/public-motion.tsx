"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TARGETS = ":scope > section:not([data-motion='off']), [data-reveal]";

export function PublicMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main[data-public-site]");
    if (!main || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = Array.from(main.querySelectorAll<HTMLElement>(TARGETS));
    if (!targets.length) return;

    main.dataset.motionReady = "true";
    targets.forEach((target) => {
      target.dataset.motionItem = "true";
      if (target.getBoundingClientRect().top < window.innerHeight * 0.92) target.dataset.motionVisible = "true";
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.motionVisible = "true";
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 },
    );

    targets.filter((target) => !target.dataset.motionVisible).forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
