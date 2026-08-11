"use client";

import { startTransition, useEffect, useRef } from "react";

export function MarkEnquiryRead({ enquiryId, action }: { enquiryId: string; action: (id: string) => Promise<void> }) {
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    startTransition(() => { void action(enquiryId).catch(() => { requested.current = false; }); });
  }, [action, enquiryId]);
  return null;
}
