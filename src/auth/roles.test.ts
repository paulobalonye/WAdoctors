import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import { devAuthMiddleware, isDevHeaderAuthEnabled, type AuthedRequest } from "./roles.js";

const originalNodeEnv = env.NODE_ENV;
const originalAllowDevHeaderAuth = env.ALLOW_DEV_HEADER_AUTH;

function buildRequest(headers: Record<string, string | undefined>): AuthedRequest {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }

  return {
    header(name: string) {
      return normalized[name.toLowerCase()];
    }
  } as unknown as AuthedRequest;
}

function buildResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    }
  };

  return res;
}

afterEach(() => {
  (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = originalNodeEnv;
  (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH =
    originalAllowDevHeaderAuth;
});

describe("isDevHeaderAuthEnabled", () => {
  it("returns true only in non-production when ALLOW_DEV_HEADER_AUTH=true", () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "development";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";
    expect(isDevHeaderAuthEnabled()).toBe(true);

    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "production";
    expect(isDevHeaderAuthEnabled()).toBe(false);
  });
});

describe("devAuthMiddleware", () => {
  it("rejects header-only auth when running in production", () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "production";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";

    const req = buildRequest({
      "x-user-role": "ADMIN",
      "x-user-id": "admin-1"
    });
    const res = buildResponse();
    const next = vi.fn();

    devAuthMiddleware(req, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: "Authorization required" });
  });

  it("accepts header auth in development when enabled", () => {
    (env as { NODE_ENV: "development" | "test" | "production" }).NODE_ENV = "development";
    (env as { ALLOW_DEV_HEADER_AUTH: "true" | "false" }).ALLOW_DEV_HEADER_AUTH = "true";

    const req = buildRequest({
      "x-user-role": "DOCTOR",
      "x-user-id": "doctor-1"
    });
    const res = buildResponse();
    const next = vi.fn();

    devAuthMiddleware(req, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.auth).toEqual({
      role: "DOCTOR",
      userId: "doctor-1"
    });
  });
});
