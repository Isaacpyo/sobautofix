"use client";

import { startTransition, useEffect, useRef } from "react";

export function MarkBookingSeen({ bookingId, action }: { bookingId: string; action: (id: string) => Promise<void> }) {
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    startTransition(() => { void action(bookingId).catch(() => { requested.current = false; }); });
  }, [action, bookingId]);
  return null;
}
