"use client";

import { createContext, useCallback, useContext } from "react";
import { exchangeHref } from "@/lib/exchange/host";

const ExchangeBaseContext = createContext<string>("/exchange");

export function ExchangeBaseProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <ExchangeBaseContext.Provider value={base}>{children}</ExchangeBaseContext.Provider>;
}

/** The current exchange path prefix: "" on the exchange host, "/exchange" elsewhere. */
export function useExchangeBase() {
  return useContext(ExchangeBaseContext);
}

/** Returns a function that turns "/cars" into the correct in-app href for this host. */
export function useExchangeHref() {
  const base = useExchangeBase();
  return useCallback((path: string) => exchangeHref(base, path), [base]);
}
