// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/(protected)/invoices/actions", () => ({
  saveInvoiceDraftAction: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useActionState: vi.fn().mockReturnValue([{ error: "" }, vi.fn(), false]) };
});

import { InvoiceForm, type InvoiceFormInitial } from "@/components/admin/invoice-form";

const initial: InvoiceFormInitial = {
  sourceType: "manual",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerAddress: "",
  vehicleRegistration: "",
  vehicleMake: "",
  vehicleModel: "",
  serviceName: "",
  appointmentStart: "",
  issueDate: "2026-09-27",
  dueDate: "2026-10-04",
  discount: "0.00",
  notes: "",
  paymentTerms: "",
  items: [{ description: "", quantity: "1", unitPrice: "0.00" }],
};

describe("InvoiceForm item editor", () => {
  it("locks saved rows and sends later catalogue selections to the newly added row", async () => {
    const user = userEvent.setup();
    render(<InvoiceForm initial={initial} />);

    await user.click(screen.getByRole("button", { name: "Battery Replacement" }));
    const description = screen.getAllByLabelText("Description").at(0)!;
    const price = screen.getAllByLabelText("Unit price (£)").at(0)!;
    expect(description).toHaveValue("Battery Replacement");

    await user.clear(price);
    await user.type(price, "500");
    await user.click(screen.getByRole("button", { name: "Save item 1" }));
    expect(description).toBeDisabled();
    expect(price).toBeDisabled();
    expect(screen.getByLabelText("Quantity for item 1")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit item 1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.click(screen.getAllByRole("button", { name: "Starting System Diagnosis" }).at(0)!);
    expect(screen.getAllByLabelText("Description").at(1)).toHaveValue("Starting System Diagnosis");
    expect(screen.getByLabelText("Quantity for item 2").tagName).toBe("SELECT");

    await user.click(screen.getByRole("button", { name: "Edit item 1" }));
    expect(screen.getAllByLabelText("Description").at(0)).not.toBeDisabled();
    expect(screen.getAllByLabelText("Unit price (£)").at(0)).not.toBeDisabled();
  });
});
