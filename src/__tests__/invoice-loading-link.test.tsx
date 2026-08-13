// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvoiceLoadingLink } from "@/components/admin/invoice-loading-link";

describe("invoice loading link", () => {
  it("shows an accessible loading modal when invoice navigation begins", () => {
    render(<InvoiceLoadingLink href="/admin/invoices/invoice-1">View</InvoiceLoadingLink>);

    fireEvent.click(screen.getByRole("link", { name: "View" }));

    expect(screen.getByRole("dialog", { name: "Loading invoice" })).toBeVisible();
    expect(screen.getByText("Please wait while the invoice record opens.")).toBeVisible();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("aria-busy", "true");
  });

  it("shows PDF-specific loading feedback", () => {
    render(<InvoiceLoadingLink href="/api/admin/invoices/invoice-1/pdf" transient loadingTitle="Preparing PDF" loadingDescription="Please wait while the invoice PDF downloads.">PDF</InvoiceLoadingLink>);

    fireEvent.click(screen.getByRole("link", { name: "PDF" }));

    expect(screen.getByRole("dialog", { name: "Preparing PDF" })).toBeVisible();
    expect(screen.getByText("Please wait while the invoice PDF downloads.")).toBeVisible();
  });
});
