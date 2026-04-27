import { describe, expect, it } from "vitest";
import { defaultDoctorAvailability, isDoctorAvailableNow } from "./doctorAvailability.js";

describe("doctor availability", () => {
  it("defaults to available if no structured availability is provided", () => {
    expect(isDoctorAvailableNow(null)).toBe(true);
  });

  it("returns true when now falls inside configured New York hours", () => {
    const mondayAfternoonNY = new Date("2026-04-27T14:00:00-04:00");
    const availability = {
      monday: { start: "09:00", end: "17:00" }
    };

    expect(isDoctorAvailableNow(availability, mondayAfternoonNY)).toBe(true);
  });

  it("returns false when outside configured hours", () => {
    const mondayEveningNY = new Date("2026-04-27T20:30:00-04:00");
    const availability = {
      monday: { start: "09:00", end: "17:00" }
    };

    expect(isDoctorAvailableNow(availability, mondayEveningNY)).toBe(false);
  });

  it("returns false for malformed windows", () => {
    const mondayAfternoonNY = new Date("2026-04-27T14:00:00-04:00");
    const availability = {
      monday: { start: "9am", end: "5pm" }
    };

    expect(isDoctorAvailableNow(availability, mondayAfternoonNY)).toBe(false);
  });

  it("provides a weekdays-only default availability template", () => {
    const defaults = defaultDoctorAvailability();
    expect(defaults.monday).toEqual({ start: "09:00", end: "17:00" });
    expect(defaults.saturday).toBeUndefined();
  });
});
