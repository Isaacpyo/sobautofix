// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { AdminBulkActions, AdminItemCheckbox } from "@/components/admin/admin-bulk-actions";

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

describe("AdminBulkActions confirmation", () => {
  it("uses the branded destructive modal before permanent deletion", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ success: true, message: "1 item deleted permanently." }));
    render(<AdminBulkActions entity="reviews" mode="trash" action={action}><AdminItemCheckbox id="11111111-1111-4111-8111-111111111111" label="Select review" /></AdminBulkActions>);

    const checkbox = screen.getByRole("checkbox", { name: "Select review" });
    Object.defineProperty(checkbox, "offsetParent", { configurable: true, value: document.body });
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    const dialog = screen.getByRole("alertdialog", { name: "Permanently delete selected items?" });
    expect(dialog).toBeVisible();
    expect(screen.getByText(/This cannot be undone/)).toBeVisible();
    expect(action).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete permanently" }));
    expect(action).toHaveBeenCalledOnce();
  });

  it("cancels destructive bulk deletion without calling the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ success: true, message: "Deleted." }));
    render(<AdminBulkActions entity="reviews" mode="trash" action={action}><AdminItemCheckbox id="11111111-1111-4111-8111-111111111111" label="Select review" /></AdminBulkActions>);

    const checkbox = screen.getByRole("checkbox", { name: "Select review" });
    Object.defineProperty(checkbox, "offsetParent", { configurable: true, value: document.body });
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
});
