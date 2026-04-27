import request from "supertest";
import jwt from "jsonwebtoken";
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
  it("blocks relay failure injection in production", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "production";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "false";

    const token = jwt.sign({ role: "ADMIN", email: "admin@test.local" }, env.JWT_SECRET, {
      subject: "admin-test",
      expiresIn: "5m"
    });

    const res = await request(app)
      .post("/api/v1/admin/relay/dev/inject-failure")
      .set({
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      })
      .send({ direction: "PATIENT_TO_WEBEX" })
      .expect(403);

    expect(res.body).toMatchObject({
      error: "Relay failure injection is disabled in production"
    });
  });

  it("returns structured disabled response when injection requested in inline mode", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";
    (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = "inline";

    const res = await request(app)
      .post("/api/v1/admin/relay/dev/inject-failure")
      .set(adminHeaders())
      .send({ direction: "PATIENT_TO_WEBEX" })
      .expect(200);

    expect(res.body).toMatchObject({
      ok: false
    });
    expect(String(res.body.reason || "")).toContain("dispatch mode is inline");
  });

  it("validates inject-failure request body", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";
    (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = "inline";

    const res = await request(app)
      .post("/api/v1/admin/relay/dev/inject-failure")
      .set(adminHeaders())
      .send({ direction: "INVALID_DIRECTION" })
      .expect(400);

    expect(res.body).toMatchObject({
      error: "Invalid body"
    });
  });

  it("returns integration readiness status", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";

    const res = await request(app)
      .get("/api/v1/admin/integrations/status")
      .set(adminHeaders())
      .expect(200);

    expect(res.body).toMatchObject({
      summary: {
        readyCount: expect.any(Number),
        total: 4
      },
      whatsapp: {
        ready: expect.any(Boolean),
        missing: expect.any(Array)
      },
      webex: {
        ready: expect.any(Boolean),
        missing: expect.any(Array)
      },
      relay: {
        ready: expect.any(Boolean),
        dispatchMode: expect.any(String)
      }
    });
  });

  it("returns structured disabled response for failed relay list in inline mode", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";
    (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = "inline";

    const res = await request(app)
      .get("/api/v1/admin/relay/failed?limit=20&name=PATIENT_TO_WEBEX&caseId=case-1")
      .set(adminHeaders())
      .expect(200);

    expect(res.body).toMatchObject({
      ok: false,
      requestedLimit: 20,
      totalFetched: 0,
      totalMatched: 0,
      jobs: []
    });
    expect(String(res.body.reason || "")).toContain("dispatch mode is inline");
  });

  it("validates failed relay list name filter", async () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "test";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";

    const res = await request(app)
      .get("/api/v1/admin/relay/failed?name=INVALID_NAME")
      .set(adminHeaders())
      .expect(400);

    expect(res.body).toMatchObject({
      error: "Invalid relay job name filter"
    });
  });

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
