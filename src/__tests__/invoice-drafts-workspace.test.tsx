// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InvoiceDraftsWorkspace } from "@/components/admin/invoice-drafts-workspace";

const drafts = [{
  id: "draft-1",
  customerName: "Ada Customer",
  serviceName: "Vehicle diagnostics",
  vehicleLabel: "Ford · Focus · AB12 CDE",
  updatedLabel: "13 Aug 2026, 10:30",
}];

describe("InvoiceDraftsWorkspace", () => {
  it("opens the draft list beside the booking list and closes it again", async () => {
    const user = userEvent.setup();
    render(<InvoiceDraftsWorkspace header={<h1>Choose a booking</h1>} drafts={drafts}><p>Booking list</p></InvoiceDraftsWorkspace>);

    expect(screen.getByText("Booking list")).toBeInTheDocument();
    expect(screen.queryByLabelText("Draft invoices")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Draft invoices/ }));

    expect(screen.getByLabelText("Draft invoices")).toBeInTheDocument();
    expect(screen.getByText("Ada Customer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute("href", "/admin/invoices/draft-1/edit");

    await user.click(screen.getByRole("button", { name: "Close draft invoices" }));
    expect(screen.queryByLabelText("Draft invoices")).not.toBeInTheDocument();
  });
});
