import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { env } from "../config/env.js";
import { app } from "../app.js";

const originalNodeEnv = env.NODE_ENV;
const originalAllowDevHeaderAuth = env.ALLOW_DEV_HEADER_AUTH;

function doctorHeaders() {
  return {
    "x-user-role": "DOCTOR",
    "x-user-id": "doctor-test",
    "content-type": "application/json"
  };
}

afterEach(() => {
  (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = originalNodeEnv;
  (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = originalAllowDevHeaderAuth;
});

describe("doctor portal routes", () => {
  it("validates triage source filter on case list route", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";

    const res = await request(app)
      .get("/api/v1/doctor/cases?triageSource=INVALID")
      .set(doctorHeaders())
      .expect(400);

    expect(res.body).toMatchObject({
      error: "Invalid triage source filter"
    });
  });

  it("validates triage route filter on case list route", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";

    const res = await request(app)
      .get("/api/v1/doctor/cases?triageRoute=INVALID_ROUTE")
      .set(doctorHeaders())
      .expect(400);

    expect(res.body).toMatchObject({
      error: "Invalid triage route filter"
    });
  });

  it("accepts valid triage filters on case list route", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";

    const res = await request(app)
      .get("/api/v1/doctor/cases?triageSource=AI&triageRoute=ROUTE_TO_DOCTOR")
      .set(doctorHeaders())
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
