import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { env } from "../config/env.js";
import { app } from "../app.js";

const originalDispatchMode = env.RELAY_DISPATCH_MODE;
const originalNodeEnv = env.NODE_ENV;
const originalAllowDevHeaderAuth = env.ALLOW_DEV_HEADER_AUTH;

function adminHeaders() {
  return {
    "x-user-role": "ADMIN",
    "x-user-id": "admin-test",
    "content-type": "application/json"
  };
}

afterEach(() => {
  (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = originalDispatchMode;
  (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = originalNodeEnv;
  (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH =
    originalAllowDevHeaderAuth;
});

describe("admin relay routes", () => {
  it("returns structured disabled responses for retry endpoints in inline mode", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";
    (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = "inline";

    const webexRes = await request(app)
      .post("/api/v1/admin/relay/failed/retry-webex")
      .set(adminHeaders())
      .send({ limit: 10 })
      .expect(200);

    expect(webexRes.body).toMatchObject({
      ok: false,
      requestedLimit: 10,
      matched: 0,
      retried: 0
    });
    expect(String(webexRes.body.reason || "")).toContain("dispatch mode is inline");

    const whatsappRes = await request(app)
      .post("/api/v1/admin/relay/failed/retry-whatsapp")
      .set(adminHeaders())
      .send({ limit: 10 })
      .expect(200);

    expect(whatsappRes.body).toMatchObject({
      ok: false,
      requestedLimit: 10,
      matched: 0,
      retried: 0
    });
    expect(String(whatsappRes.body.reason || "")).toContain("dispatch mode is inline");
  });

  it("validates retry body for relay routes", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";
    (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = "inline";

    const res = await request(app)
      .post("/api/v1/admin/relay/failed/retry-whatsapp")
      .set(adminHeaders())
      .send({ limit: 999 })
      .expect(400);

    expect(res.body).toMatchObject({
      error: "Invalid body"
    });
  });

  it("accepts caseId in targeted retry payloads", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";
    (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = "inline";

    const res = await request(app)
      .post("/api/v1/admin/relay/failed/retry-webex")
      .set(adminHeaders())
      .send({ limit: 10, caseId: "case-123" })
      .expect(200);

    expect(res.body).toMatchObject({
      ok: false,
      requestedLimit: 10,
      matched: 0,
      retried: 0
    });
  });
});
