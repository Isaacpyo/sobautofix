// Navigation model for SOB Auto Exchange (paths on the exchange host).

import { toExchangePublicPath } from "@/lib/exchange/host";

export const desktopNavigation = [
  { label: "Buy a Car", path: "/cars" },
  { label: "Sell Your Car", path: "/sell" },
  { label: "Part Exchange", path: "/part-exchange" },
  { label: "How Buying Works", path: "/how-buying-works" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" },
] as const;

export type BottomNavKey = "home" | "cars" | "sell" | "contact" | "more";

/** Which bottom-nav item a page belongs to. */
export function bottomNavSection(pathname: string): BottomNavKey | null {
  const path = toExchangePublicPath(pathname);
  if (path === "/") return "home";
  if (path === "/cars" || path.startsWith("/cars/")) return "cars";
  if (path === "/sell") return "sell";
  if (path === "/contact") return "contact";
  if (["/more", "/about", "/how-buying-works", "/part-exchange"].includes(path) || path.startsWith("/policies")) return "more";
  return null;
}

/** Whether a desktop navigation item is the current section. */
export function isActivePath(pathname: string, itemPath: string) {
  const path = toExchangePublicPath(pathname);
  if (itemPath === "/cars") return path === "/cars" || path.startsWith("/cars/");
  return path === itemPath;
}
