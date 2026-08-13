import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { emailPreviewFixtures } from "@/lib/email/preview-fixtures";
import { renderEnquiryReply } from "@/lib/email/templates/enquiries";

const fixtures = emailPreviewFixtures();

describe("transactional email templates", () => {
  it.each(Object.entries(fixtures))("renders HTML and text for %s", (name, rendered) => {
    expect(rendered.html.length, name).toBeGreaterThan(1_000);
    expect(rendered.text.length, name).toBeGreaterThan(80);
    expect(rendered.html, name).toContain("SOB Autofix Limited");
    expect(rendered.text, name).toContain("Professional Diagnostics. Not Guesswork.");
    expect(Buffer.byteLength(rendered.html), name).toBeLessThan(100_000);
  });

  it("escapes generated content and preserves line breaks", () => {
    const dangerous = `<script>alert(1)</script>\n<img src=x onerror=alert(1)>`;
    const rendered = renderEnquiryReply({ customerName: dangerous, body: dangerous });
    expect(rendered.html).not.toContain("<script>alert(1)</script>");
    expect(rendered.html).not.toContain("<img src=x onerror=alert(1)>");
    expect(rendered.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;<br>&lt;img src=x onerror=alert(1)&gt;");
  });

  it("uses the right actions and visible statuses", () => {
    expect(fixtures["enquiry-business-notification"].html).toContain("View enquiry");
    expect(fixtures["booking-confirmed"].html).toContain("Manage booking");
    expect(fixtures["booking-cancelled"].html).toContain("Book another appointment");
    expect(fixtures["booking-cancelled"].html).not.toContain(">Manage booking<");
    expect(fixtures["invoice-unpaid"].html).toContain("PDF invoice attached");
    expect(fixtures["invoice-paid"].html).toContain("PAID / SETTLED");
  });

  it("uses the Supabase token hash with the server-side recovery callback", () => {
    const recovery = readFileSync(resolve("supabase/templates/recovery.html"), "utf8");
    expect(recovery).toContain(
      'href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/admin/reset-password"',
    );
    expect(recovery).not.toContain("{{ .ConfirmationURL }}");
    expect(recovery).not.toMatch(/password\s*[:=]/i);
  });

  it("can write safe local preview files without sending email", () => {
    const output = process.env.EMAIL_PREVIEW_DIR;
    if (!output) return;
    mkdirSync(output, { recursive: true });
    for (const [name, rendered] of Object.entries(fixtures)) writeFileSync(join(output, `${name}.html`), rendered.html);
  });
});
