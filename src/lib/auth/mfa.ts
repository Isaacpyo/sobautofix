export function safeAdminReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/admin") || value.startsWith("//")) return "/admin";
  try {
    const parsed = new URL(value, "http://localhost");
    if (parsed.origin !== "http://localhost" || parsed.pathname === "/admin/mfa") return "/admin";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/admin";
  }
}

export function isSixDigitMfaCode(value: string) {
  return /^\d{6}$/.test(value.trim());
}

export function requiresMfaChallenge(assurance: { currentLevel: string | null; nextLevel: string | null }) {
  return assurance.currentLevel === "aal1" && assurance.nextLevel === "aal2";
}

export function canChangeAdminPassword(assurance: {
  currentLevel: string | null;
  currentAuthenticationMethods?: Array<string | { method: string }>;
}) {
  return assurance.currentLevel === "aal2"
    || assurance.currentAuthenticationMethods?.some((entry) =>
      (typeof entry === "string" ? entry : entry.method) === "recovery") === true;
}
