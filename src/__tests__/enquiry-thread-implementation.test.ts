import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("threaded enquiry implementation safeguards", () => {
  it("creates isolated RLS-protected conversation, message and webhook tables", () => {
    const migration = read("supabase/migrations/202608110001_enquiry_email_threads.sql");
    for (const table of ["enquiry_conversations", "enquiry_messages", "resend_webhook_events", "unmatched_inbound_emails"]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("client_request_id");
    expect(migration).toContain("provider_email_id");
    expect(migration).toContain("message_id");
    expect(migration).toContain("enquiry_message_id uuid references public.enquiry_messages");
  });

  it("verifies raw webhook bodies and protects duplicate delivery", () => {
    const route = read("src/app/api/webhooks/resend/route.ts");
    expect(route).toContain("await request.text()");
    expect(route).toContain("verifyResendWebhook");
    expect(route).toContain("beginWebhookEvent");
    expect(route).toContain("duplicate: true");
  });

  it("uses a provider-neutral Cloudflare event ledger and atomic inbound storage", () => {
    const migration = read("supabase/migrations/202608110007_cloudflare_inbound_email.sql");
    expect(migration).toContain("public.inbound_email_events");
    expect(migration).toContain("public.claim_inbound_email_event");
    expect(migration).toContain("public.store_inbound_email_message");
    expect(migration).toContain("unread_count = unread_count + 1");
    expect(migration).toContain("on conflict do nothing");
    expect(migration).toContain("provider in ('resend', 'cloudflare')");
  });

  it("uses a secure Reply-To, real threading headers and Resend idempotency", () => {
    const repository = read("src/lib/enquiries/thread-repository.ts");
    expect(repository).toContain("buildEnquiryReplyAddress");
    expect(repository).toContain('"In-Reply-To"');
    expect(repository).toContain("References");
    expect(repository).toContain("idempotencyKey");
    expect(repository).toContain("html: rendered.html");
    expect(repository).toContain("text: rendered.text");
    expect(repository).not.toContain("sender_email: parsed.body");
  });

  it("keeps internal notes out of the email send path", () => {
    const repository = read("src/lib/enquiries/thread-repository.ts");
    const noteBody = repository.slice(repository.indexOf("export async function addInternalNote"), repository.indexOf("export async function markEnquiryThreadRead"));
    expect(noteBody).toContain('direction: "internal"');
    expect(noteBody).not.toContain("sendTransactionalEmail");
  });

  it("provides a protected detail route with legacy original-message fallback", () => {
    const page = read("src/app/admin/(protected)/enquiries/[id]/page.tsx");
    expect(page).toContain('message_type: "website_enquiry"');
    expect(page).toContain("legacy-");
    expect(page).toContain("EnquiryReplyComposer");
    expect(read("src/app/admin/(protected)/layout.tsx")).toContain('redirect("/admin/login")');
  });
});
