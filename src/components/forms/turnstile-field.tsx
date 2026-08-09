"use client";

import Script from "next/script";
import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; theme: "light" | "dark" }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileField({ onToken, theme = "light" }: { onToken: (token: string) => void; theme?: "light" | "dark" }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const id = useId();

  useEffect(() => {
    if (!siteKey) onToken("development");
  }, [siteKey, onToken]);

  function render() {
    if (!siteKey || !ref.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      theme,
    });
  }

  useEffect(() => () => {
    if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
  }, []);

  if (!siteKey) return null;
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="lazyOnload" onLoad={render} /><div id={id} ref={ref} /></>;
}
