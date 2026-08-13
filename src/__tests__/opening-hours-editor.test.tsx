// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpeningHoursEditor } from "@/components/admin/opening-hours-editor";

const initialHours = {
  monday: "",
  tuesday: "",
  wednesday: "",
  thursday: "",
  friday: "",
  saturday: "",
  sunday: "",
  bankHolidays: "",
};

describe("opening-hours editor", () => {
  it("applies one selected range to every day while keeping each day editable", () => {
    render(<OpeningHoursEditor initialHours={initialHours} />);
    fireEvent.change(screen.getByLabelText("All days open time"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("All days close time"), { target: { value: "17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply to all" }));

    for (const day of Object.keys(initialHours)) {
      expect(screen.getByLabelText(`${day}Open time`)).toHaveValue("09:00");
      expect(screen.getByLabelText(`${day}Close time`)).toHaveValue("17:00");
    }

    fireEvent.change(screen.getByLabelText("saturdayClose time"), { target: { value: "14:00" } });
    expect(screen.getByLabelText("saturdayClose time")).toHaveValue("14:00");
    expect(screen.getByLabelText("mondayClose time")).toHaveValue("17:00");
  });
});
