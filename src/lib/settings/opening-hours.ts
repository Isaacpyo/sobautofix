export const openingTimeOptions = Array.from({ length: 31 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
});

export function parseOpeningHours(value: string) {
  const match = value.trim().match(/^(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})$/);
  return { open: match?.[1] || "", close: match?.[2] || "" };
}

export function formatOpeningHours(openValue: FormDataEntryValue | null, closeValue: FormDataEntryValue | null) {
  const open = String(openValue || "").trim();
  const close = String(closeValue || "").trim();
  if (!open && !close) return "";
  if (!openingTimeOptions.includes(open) || !openingTimeOptions.includes(close)) throw new Error("Choose both opening and closing times between 06:00 and 21:00.");
  if (close <= open) throw new Error("Closing time must be later than opening time.");
  return `${open}–${close}`;
}
