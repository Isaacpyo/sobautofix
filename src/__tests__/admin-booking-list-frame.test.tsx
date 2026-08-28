// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminBookingListFrame } from "@/components/admin/admin-booking-list-frame";

describe("admin booking list pagination feedback", () => {
  it("shows a loading overlay over the list after a pagination link is clicked", () => {
    render(
      <AdminBookingListFrame
        pagination={<a href="#page-2" data-admin-pagination-link>Next</a>}
      >
        <div>Appointment rows</div>
      </AdminBookingListFrame>,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Next" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading appointments…");
    expect(screen.getByText("Appointment rows").parentElement).toHaveAttribute("aria-busy", "true");
  });
});
