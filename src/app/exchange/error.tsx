"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useExchangeHref } from "@/components/exchange/exchange-base";
import { buttonClass, Container } from "@/components/exchange/ui";

export default function ExchangeError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const href = useExchangeHref();
  return (
    <Container className="py-16 text-center sm:py-24">
      <h1 className="text-[40px] leading-none font-bold text-[#0B1220]">Something went wrong</h1>
      <p className="mx-auto mt-4 max-w-md leading-7 text-[#5B6575]">This page could not be loaded just now. Please try again. If it keeps happening, call us and we will help.</p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={() => retry()} className={buttonClass("primary")}><RotateCcw size={18} aria-hidden="true" /> Try again</button>
        <Link href={href("/")} className={buttonClass("secondary")}>Go to the home page</Link>
      </div>
    </Container>
  );
}
