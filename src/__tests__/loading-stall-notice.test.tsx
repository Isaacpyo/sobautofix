// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadingStallNotice } from "@/components/admin/loading-stall-notice";

describe("admin loading stall notice", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stays hidden while the page is loading normally", () => {
    render(<LoadingStallNotice delayMs={12_000} />);
    act(() => { vi.advanceTimersByTime(11_000); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains the delay and offers a reload once loading stalls", () => {
    render(<LoadingStallNotice delayMs={12_000} />);
    act(() => { vi.advanceTimersByTime(12_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("taking longer than usual");
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
  });
});
