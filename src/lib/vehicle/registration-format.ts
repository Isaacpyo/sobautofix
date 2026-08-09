export function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatRegistration(value: string) {
  const normalized = normalizeRegistration(value);
  return normalized.length > 4
    ? `${normalized.slice(0, normalized.length - 3)} ${normalized.slice(-3)}`
    : normalized;
}
