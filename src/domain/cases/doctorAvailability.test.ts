import { describe, expect, it } from "vitest";
import {
  defaultDoctorAvailability,
  isDoctorAvailableNow,
  validateDoctorAvailability
} from "./doctorAvailability.js";

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

  it("supports split-shift weekly schedules", () => {
    const availability = {
      weekly: {
        monday: [
          { start: "08:00", end: "12:00" },
          { start: "13:00", end: "17:00" }
        ]
      }
    };

    expect(isDoctorAvailableNow(availability, new Date("2026-04-27T11:00:00-04:00"))).toBe(true);
    expect(isDoctorAvailableNow(availability, new Date("2026-04-27T12:30:00-04:00"))).toBe(false);
    expect(isDoctorAvailableNow(availability, new Date("2026-04-27T13:30:00-04:00"))).toBe(true);
  });

  it("supports holiday off overrides", () => {
    const availability = {
      weekly: {
        friday: { start: "09:00", end: "17:00" }
      },
      holidays: [{ date: "2026-12-25", isOff: true }]
    };

    expect(isDoctorAvailableNow(availability, new Date("2026-12-25T11:00:00-05:00"))).toBe(false);
  });

  it("supports holiday custom windows that override weekly schedule", () => {
    const availability = {
      weekly: {
        saturday: { start: "09:00", end: "17:00" }
      },
      holidays: [{ date: "2026-12-26", windows: [{ start: "10:00", end: "14:00" }] }]
    };

    expect(isDoctorAvailableNow(availability, new Date("2026-12-26T11:30:00-05:00"))).toBe(true);
    expect(isDoctorAvailableNow(availability, new Date("2026-12-26T15:30:00-05:00"))).toBe(false);
  });

  it("falls back to weekly schedule when holiday entry has no override windows", () => {
    const availability = {
      weekly: {
        monday: { start: "09:00", end: "17:00" }
      },
      holidays: [{ date: "2026-04-27", isOff: false }]
    };

    expect(isDoctorAvailableNow(availability, new Date("2026-04-27T10:30:00-04:00"))).toBe(true);
  });

  it("provides a default template with weekly shifts and holiday overrides", () => {
    const defaults = defaultDoctorAvailability();
    expect(defaults).toMatchObject({
      timezone: "America/New_York",
      weekly: {
        monday: [{ start: "09:00", end: "17:00" }],
        friday: [{ start: "09:00", end: "17:00" }]
      },
      holidays: []
    });
  });

  it("validates legacy and enhanced availability payload shapes", () => {
    expect(
      validateDoctorAvailability({
        monday: { start: "09:00", end: "17:00" }
      })
    ).toBe(true);

    expect(
      validateDoctorAvailability({
        timezone: "America/New_York",
        weekly: {
          monday: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "17:00" }]
        },
        holidays: [{ date: "2026-12-25", isOff: true }]
      })
    ).toBe(true);

    expect(
      validateDoctorAvailability({
        weekly: {
          monday: [{ start: "9am", end: "17:00" }]
        }
      })
    ).toBe(false);

    expect(
      validateDoctorAvailability({
        holidays: [{ date: "12-25-2026", isOff: true }]
      })
    ).toBe(false);
  });
});
