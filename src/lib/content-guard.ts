const forbiddenRouteParts = ["tyre-fitting", "mobile-tyre", "puncture-repair", "wheel-balancing", "winter-tyre", "run-flat", "alloy-wheel"];
const forbiddenWord = new RegExp("\\b" + ["M", "O", "T"].join("") + "\\b", "i");

export type GuardResult = { safe: true } | { safe: false; reason: string };

export function guardCustomerFacingContent(value: unknown): GuardResult {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (forbiddenWord.test(serialized)) {
    return { safe: false, reason: "Content includes a prohibited service term." };
  }

  const lower = serialized.toLowerCase();
  const route = forbiddenRouteParts.find((part) => lower.includes(part));
  if (route) {
    return { safe: false, reason: "Content includes a prohibited tyre-service route or phrase." };
  }

  return { safe: true };
}

export function assertCustomerFacingContent(value: unknown) {
  const result = guardCustomerFacingContent(value);
  if (!result.safe) throw new Error(result.reason);
}
