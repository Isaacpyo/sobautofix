"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useExchangeHref } from "./exchange-base";
import { buttonClass } from "./ui";
import { stashSellRegistration } from "./sell-handoff";

/**
 * Registration entry on the home page. The registration is handed to the
 * sell form through sessionStorage only; it never goes into the URL. The
 * input has no `name`, so even without JavaScript nothing is submitted.
 */
export function SellStartForm() {
  const router = useRouter();
  const href = useExchangeHref();
  const id = useId();
  const [registration, setRegistration] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    stashSellRegistration(registration);
    router.push(href("/sell"));
  }

  return (
    <form onSubmit={submit} action={href("/sell")} className="mt-6 flex w-full max-w-lg flex-col gap-3 sm:flex-row" aria-label="Start selling your car">
      <div className="flex-1">
        <label htmlFor={id} className="sr-only">Your registration</label>
        <input
          id={id}
          value={registration}
          onChange={(event) => setRegistration(event.target.value.toUpperCase())}
          placeholder="Enter your registration"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={10}
          className="block min-h-14 w-full rounded-xl border-2 border-[#F2C94C] bg-[#FFD84D] px-4 text-center exchange-display text-[26px] font-bold tracking-[.12em] text-[#0B1220] uppercase placeholder:text-[18px] placeholder:font-semibold placeholder:tracking-normal placeholder:text-[#5C4A00] placeholder:normal-case focus:outline-3 focus:outline-offset-2 focus:outline-white"
        />
      </div>
      <button type="submit" className={buttonClass("primary", "min-h-14 px-6 text-base")}>Start your enquiry <ArrowRight size={18} aria-hidden="true" /></button>
    </form>
  );
}
