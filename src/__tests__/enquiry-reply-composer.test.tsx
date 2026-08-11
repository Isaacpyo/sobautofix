// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EnquiryReplyComposer } from "@/components/admin/enquiry-reply-composer";
import type { ReplyState } from "@/lib/enquiries/thread-repository";

const initialId = "9f99f1f0-2252-4b5e-9000-9bc913650f15";

describe("enquiry reply composer", () => {
  it("shows the customer destination and submits the reply body", async () => {
    const user = userEvent.setup();
    let submitted: FormData | undefined;
    const replyAction = vi.fn(async (state: ReplyState, data: FormData): Promise<ReplyState> => {
      submitted = data;
      return { ...state, status: "sent", message: "Reply sent to the customer.", draft: "", clientRequestId: initialId };
    });
    render(<EnquiryReplyComposer enquiryId="68ae0835-6325-485b-b7e7-cb29e08f2f10" customerEmail="customer@example.com" initialClientRequestId={initialId} replyAction={replyAction} noteAction={vi.fn()} />);
    expect(screen.getByText("customer@example.com")).toBeVisible();
    await user.type(screen.getByLabelText("Reply to customer"), "Thanks for your message.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(replyAction).toHaveBeenCalledOnce());
    expect(submitted?.get("body")).toBe("Thanks for your message.");
    expect(submitted?.get("clientRequestId")).toBe(initialId);
  });

  it("labels staff notes as private and routes them only to the note action", async () => {
    const user = userEvent.setup();
    const replyAction = vi.fn();
    const noteAction = vi.fn(async (): Promise<ReplyState> => ({ status: "sent", message: "Internal note saved. It was not emailed.", draft: "", clientRequestId: initialId }));
    render(<EnquiryReplyComposer enquiryId="68ae0835-6325-485b-b7e7-cb29e08f2f10" customerEmail="customer@example.com" initialClientRequestId={initialId} replyAction={replyAction} noteAction={noteAction} />);
    await user.click(screen.getByRole("button", { name: "Internal note" }));
    expect(screen.getByText(/will never be emailed/i)).toBeVisible();
    await user.type(screen.getByLabelText("Internal note"), "Customer asked for a call tomorrow.");
    await user.click(screen.getByRole("button", { name: "Save as note" }));
    await waitFor(() => expect(noteAction).toHaveBeenCalledOnce());
    expect(replyAction).not.toHaveBeenCalled();
  });

  it("disables customer replies when an enquiry has no email address", () => {
    render(<EnquiryReplyComposer enquiryId="68ae0835-6325-485b-b7e7-cb29e08f2f10" customerEmail={null} initialClientRequestId={initialId} replyAction={vi.fn()} noteAction={vi.fn()} />);
    expect(screen.getByLabelText("Reply to customer")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
  });
});
