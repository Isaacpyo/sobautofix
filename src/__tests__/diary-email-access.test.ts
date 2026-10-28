import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderViewingEmail } from "@/lib/email/templates/diary";
import { guardExchangeContent } from "@/lib/content-guard";

const base = {
  businessName: "SOB Auto Exchange",
  customerName: "Dana <Buyer>",
  vehicle: "2019 Ford Focus",
  when: "Friday 30 October 2026 at 11:00",
  address: "Cumbrae, Station Road, Norton, Doncaster, DN6 9HF",
};

describe("viewing emails to customers", () => {
  it("confirms with the car, the UK time and the address, and escapes customer input", () => {
    const email = renderViewingEmail({ ...base, type: "confirmed" });
    expect(email.subject).toBe("Viewing confirmed: 2019 Ford Focus, Friday 30 October 2026 at 11:00");
    expect(email.text).toContain("Date and time: Friday 30 October 2026 at 11:00 (UK time)");
    expect(email.text).toContain("Address: Cumbrae, Station Road");
    expect(email.html).toContain("Dana &lt;Buyer&gt;");
    expect(email.html).not.toContain("Dana <Buyer>");
  });

  it("makes clear a suggested time is not booked yet", () => {
    const email = renderViewingEmail({ ...base, type: "proposed", previousWhen: "Thursday 29 October 2026 at 10:00", message: "Mornings are busy" });
    expect(email.text).toContain("not booked until we confirm it");
    expect(email.text).toContain("You asked for: Thursday 29 October 2026 at 10:00");
    expect(email.text).toContain("Mornings are busy");
  });

  it("gives the reason when cancelled and leaves out the address", () => {
    const email = renderViewingEmail({ ...base, type: "cancelled", message: "The car has been sold" });
    expect(email.text).toContain("Reason: The car has been sold");
    expect(email.text).not.toContain("Address:");
  });

  it("never promises anything the business has not confirmed", () => {
    for (const type of ["confirmed", "rescheduled", "proposed", "cancelled"] as const) {
      const email = renderViewingEmail({ ...base, type, previousWhen: base.when });
      expect(guardExchangeContent(email.text).safe).toBe(true);
      expect(guardExchangeContent(email.html).safe).toBe(true);
      expect(email.text).not.toMatch(/warranty|guarantee|within \d+ (hours|minutes)/i);
    }
  });
});

describe("server-side access checks", () => {
  const files = globSync("src/app/admin/(protected)/{diary,today,customers,exchange/viewings}/**/*.{ts,tsx}");

  it("checks the staff role in every diary, Today, customer and viewings page", () => {
    const pages = files.filter((file) => file.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThanOrEqual(7);
    for (const page of pages) expect(readFileSync(page, "utf8"), page).toMatch(/requireStaffPage\("(diary\.manage|customers\.view|exchange\.view)"\)/);
    for (const page of pages.filter((file) => file.includes("/customers/"))) expect(readFileSync(page, "utf8")).toContain('requireStaffPage("customers.view")');
  });

  it("checks the staff role in every server action", () => {
    const actions = files.filter((file) => file.endsWith("actions.ts"));
    expect(actions.length).toBeGreaterThanOrEqual(4);
    for (const file of actions) {
      const source = readFileSync(file, "utf8");
      expect(source.startsWith('"use server"')).toBe(true);
      const exported = source.match(/export async function \w+/g) ?? [];
      const checks = source.match(/requireStaffAction\(/g) ?? [];
      expect(checks.length, file).toBeGreaterThanOrEqual(1);
      expect(exported.length, file).toBeGreaterThanOrEqual(1);
    }
    // Contacting customers about a viewing needs the sales permission.
    expect(readFileSync("src/app/admin/(protected)/exchange/viewings/actions.ts", "utf8")).toContain('requireStaffAction("sales.manage")');
  });

  it("keeps customer searches out of URLs", () => {
    const page = readFileSync("src/app/admin/(protected)/customers/page.tsx", "utf8");
    expect(page).not.toContain("searchParams");
    const search = readFileSync("src/components/admin/diary/customer-search.tsx", "utf8");
    expect(search).toContain("event.preventDefault()");
    expect(search).not.toMatch(/router\.push|URLSearchParams|\?q=/);
    const picker = readFileSync("src/components/admin/diary/link-picker.tsx", "utf8");
    expect(picker).not.toMatch(/router\.push|URLSearchParams|\?q=/);
  });
});
