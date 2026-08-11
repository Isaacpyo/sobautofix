// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddVehicleFlow } from "@/components/admin/add-vehicle-flow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const action = vi.fn(async () => ({ status: "idle", message: "" } as const));

describe("registration-first Add Vehicle flow", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts with only the registration lookup", () => {
    render(<AddVehicleFlow action={action} />);
    expect(screen.getByRole("heading", { name: "Find the vehicle" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("AB12 CDE")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("LM17 XXA")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Current mileage")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Asking price (£)")).not.toBeInTheDocument();
  });

  it("normalises lookup input, verifies the result, then reveals sales details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true, vehicle: { registration: "LM17XXA", make: "Vauxhall", model: "Astra", year: 2017, fuelType: "Petrol" }, duplicate: null }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AddVehicleFlow action={action} />);

    await user.type(screen.getByLabelText("Registration number"), "lm17 xxa");
    await user.click(screen.getByRole("button", { name: "Look up vehicle" }));
    await waitFor(() => expect(screen.getByText("Vauxhall Astra")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/inventory/lookup", expect.objectContaining({ body: JSON.stringify({ registration: "LM17XXA" }) }));
    expect(window.location.search).toBe("");

    await user.click(screen.getByRole("button", { name: "Confirm & continue" }));
    expect(screen.getByLabelText("Current mileage")).toBeInTheDocument();
    expect(screen.getByLabelText("Asking price (£)")).toBeInTheDocument();
    expect(screen.getByText("Vehicle photos")).toBeInTheDocument();
  });

  it("blocks a duplicate and links to the existing stock record", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: true, vehicle: { registration: "LM17XXA", make: "Vauxhall", model: "Astra" }, duplicate: { id: "a07a8c80-b78e-47e6-9ef6-90a59d17db75", label: "Vauxhall Astra", status: "draft" } }) }));
    const user = userEvent.setup();
    render(<AddVehicleFlow action={action} />);
    await user.type(screen.getByLabelText("Registration number"), "LM17XXA");
    await user.click(screen.getByRole("button", { name: "Look up vehicle" }));
    await waitFor(() => expect(screen.getByText("This vehicle already exists in Vehicle Stock.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Confirm & continue" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "View existing vehicle" })).toHaveAttribute("href", "/admin/inventory/a07a8c80-b78e-47e6-9ef6-90a59d17db75");
  });

  it("offers manual entry after a provider failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: false, error: { code: "unavailable", message: "Vehicle lookup is temporarily unavailable." } }) }));
    render(<AddVehicleFlow action={action} />);
    fireEvent.change(screen.getByLabelText("Registration number"), { target: { value: "LM17XXA" } });
    fireEvent.click(screen.getByRole("button", { name: "Look up vehicle" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enter details manually" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Enter details manually" }));
    expect(screen.getByLabelText("Make")).toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
  });
});
