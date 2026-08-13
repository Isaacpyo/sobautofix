// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

describe("ConfirmSubmitButton", () => {
  it("uses an in-page confirmation modal and submits only after confirmation", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={submit}><ConfirmSubmitButton message="Issue this invoice? Its financial details will become immutable." className="button">Issue invoice</ConfirmSubmitButton></form>);

    await user.click(screen.getByRole("button", { name: "Issue invoice" }));
    expect(screen.getByRole("alertdialog", { name: "Confirm action" })).toBeVisible();
    expect(screen.getByText("Issue this invoice? Its financial details will become immutable.")).toBeVisible();
    expect(submit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Issue invoice" }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("closes without submitting when cancelled", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={submit}><ConfirmSubmitButton message="Delete this draft?" className="button">Delete draft</ConfirmSubmitButton></form>);

    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });
});
