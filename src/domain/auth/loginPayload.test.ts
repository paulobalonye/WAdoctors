import { describe, expect, it } from "vitest";
import { parsePortalLoginBody } from "./loginPayload.js";

describe("parsePortalLoginBody", () => {
  it("accepts canonical role payload", () => {
    const parsed = parsePortalLoginBody({
      role: "ADMIN",
      email: "admin@wadoctors.local",
      password: "secret"
    });

    expect(parsed).toEqual({
      role: "ADMIN",
      email: "admin@wadoctors.local",
      password: "secret"
    });
  });

  it("accepts lowercase role and normalizes it", () => {
    const parsed = parsePortalLoginBody({
      role: "doctor",
      email: "doctor@wadoctors.local",
      password: "secret"
    });

    expect(parsed.role).toBe("DOCTOR");
  });

  it("accepts portal alias when role is absent", () => {
    const parsed = parsePortalLoginBody({
      portal: "admin",
      email: "admin@wadoctors.local",
      password: "secret"
    });

    expect(parsed.role).toBe("ADMIN");
  });

  it("rejects payloads without either role or portal", () => {
    expect(() =>
      parsePortalLoginBody({
        email: "admin@wadoctors.local",
        password: "secret"
      })
    ).toThrow(/role/i);
  });

  it("rejects conflicting role and portal combinations", () => {
    expect(() =>
      parsePortalLoginBody({
        role: "DOCTOR",
        portal: "admin",
        email: "doctor@wadoctors.local",
        password: "secret"
      })
    ).toThrow(/conflict/i);
  });
});
