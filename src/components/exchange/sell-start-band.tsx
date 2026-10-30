"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useExchangeHref } from "./exchange-base";
import { NumberPlateInput } from "./number-plate";
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
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="sr-only">Your registration</label>
        <NumberPlateInput
          id={id}
          value={registration}
          onChange={(event) => setRegistration(event.target.value.toUpperCase())}
          wrapperClassName="focus-within:outline-white"
        />
      </div>
      <button type="submit" className={buttonClass("primary", "min-h-14 shrink-0 px-6 text-base")}>Start your enquiry <ArrowRight size={18} aria-hidden="true" /></button>
    </form>
  );
}
