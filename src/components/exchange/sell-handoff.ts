// Hand a registration from the home page to the sell form without putting
// it in the URL. sessionStorage is per-tab and cleared when the tab closes;
// the sell form reads it once and removes it immediately.

const KEY = "sob-exchange-sell-registration";

export function stashSellRegistration(registration: string) {
  const value = registration.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  try {
    if (value) sessionStorage.setItem(KEY, value);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode): the visitor simply types it again.
  }
}

export function takeSellRegistration() {
  try {
    const value = sessionStorage.getItem(KEY) || "";
    sessionStorage.removeItem(KEY);
    return /^[A-Z0-9]{2,8}$/.test(value) ? value : "";
  } catch {
    return "";
  }
}
