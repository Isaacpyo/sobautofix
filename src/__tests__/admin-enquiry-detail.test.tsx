import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient, createAdminReadClient: mocks.createClient }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/navigation")>(),
  notFound: mocks.notFound,
}));
vi.mock("@/lib/enquiries/inbound-config", () => ({ getCloudflareInboundConfig: () => ({}) }));
vi.mock("@/components/admin/mark-enquiry-read", () => ({ MarkEnquiryRead: () => null }));
vi.mock("@/components/admin/enquiry-reply-composer", () => ({ EnquiryReplyComposer: () => null }));
vi.mock("@/app/admin/(protected)/actions", () => ({
  markEnquiryThreadReadAction: vi.fn(),
  saveInternalNoteAction: vi.fn(),
  sendEnquiryReplyAction: vi.fn(),
  updateEnquiryStatus: vi.fn(),
}));

import EnquiryConversationPage from "@/app/admin/(protected)/enquiries/[id]/page";

const enquiryId = "11111111-1111-4111-8111-111111111111";
const enquiry = {
  id: enquiryId,
  type: "general",
  description: "Production routing test",
  location_postcode: null,
  status: "new",
  notification_status: "sent",
  created_at: "2026-08-11T17:58:55.438685+00:00",
  customers: null,
  vehicles: null,
  enquiry_attachments: [],
};

function queryHarness(options: {
  enquiryData?: typeof enquiry | null;
  enquiryError?: { message: string } | null;
  messagesError?: { message: string } | null;
} = {}) {
  const enquiryEq = vi.fn(() => ({
    maybeSingle: async () => ({ data: options.enquiryData === undefined ? enquiry : options.enquiryData, error: options.enquiryError || null }),
  }));
  const enquirySelect = vi.fn((columns: string) => {
    void columns;
    return { eq: enquiryEq };
  });
  const secondOrder = vi.fn(async () => ({ data: [], error: options.messagesError || null }));
  const firstOrder = vi.fn(() => ({ order: secondOrder }));
  const messageEq = vi.fn(() => ({ order: firstOrder }));
  const messageSelect = vi.fn((columns: string) => {
    void columns;
    return { eq: messageEq };
  });
  const invoiceSelect = vi.fn(() => ({
    eq: () => ({
      neq: () => ({
        order: () => ({
          limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
    }),
  }));
  const from = vi.fn((table: string) => {
    if (table === "enquiries") return { select: enquirySelect };
    if (table === "enquiry_messages") return { select: messageSelect };
    if (table === "invoices") return { select: invoiceSelect };
    throw new Error(`Unexpected table: ${table}`);
  });
  return { client: { from }, enquiryEq, enquirySelect, messageEq };
}

describe("admin enquiry detail routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });
  });

  it("uses the enquiry ID for both the detail row and its conversation messages", async () => {
    const harness = queryHarness();
    mocks.createClient.mockResolvedValue(harness.client);

    const page = await EnquiryConversationPage({ params: Promise.resolve({ id: enquiryId }) });

    expect(page).toBeTruthy();
    expect(harness.enquiryEq).toHaveBeenCalledWith("id", enquiryId);
    expect(harness.messageEq).toHaveBeenCalledWith("enquiry_id", enquiryId);
    const selectedColumns = harness.enquirySelect.mock.calls[0]?.[0] as string | undefined;
    expect(selectedColumns).not.toContain("contact_preference");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("keeps the inbox link stable on the enquiry ID", () => {
    const inbox = readFileSync(join(process.cwd(), "src/app/admin/(protected)/enquiries/page.tsx"), "utf8");
    expect(inbox).toContain('href={`/admin/enquiries/${enquiry.id}`}');
    expect(inbox).not.toContain('href={`/admin/enquiries/${conversation.id}`}');
  });

  it("returns not found only when the enquiry genuinely does not exist", async () => {
    const harness = queryHarness({ enquiryData: null });
    mocks.createClient.mockResolvedValue(harness.client);

    await expect(EnquiryConversationPage({ params: Promise.resolve({ id: enquiryId }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("does not disguise a database query failure as a missing enquiry", async () => {
    const harness = queryHarness({ enquiryData: null, enquiryError: { message: "schema error" } });
    mocks.createClient.mockResolvedValue(harness.client);

    await expect(EnquiryConversationPage({ params: Promise.resolve({ id: enquiryId }) })).rejects.toThrow("Could not load the enquiry");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
