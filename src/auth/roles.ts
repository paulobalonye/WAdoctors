import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

export type AppRole = "ADMIN" | "DOCTOR";

export type AuthContext = {
  role: AppRole;
  userId: string;
};

export type AuthedRequest = Request & {
  auth?: AuthContext;
};

function parseRole(value: string | undefined): AppRole | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "ADMIN" || normalized === "DOCTOR") {
    return normalized;
  }

  return null;
}

function parseBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.trim().split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

function parseJwtAuth(token: string): AuthContext | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (!decoded || typeof decoded !== "object") {
      return null;
    }

    const role = parseRole("role" in decoded ? String(decoded.role) : undefined);
    const userId = "sub" in decoded ? String(decoded.sub) : "";

    if (!role || !userId) {
      return null;
    }

    return { role, userId };
  } catch {
    return null;
  }
}

export function isDevHeaderAuthEnabled(): boolean {
  const isLiveEnv = env.APP_ENV === "staging" || env.APP_ENV === "production";
  return env.ALLOW_DEV_HEADER_AUTH === "true" && !isLiveEnv;
}

export function devAuthMiddleware(req: AuthedRequest, res: Response, next: NextFunction): void {
  const bearerToken = parseBearerToken(req.header("authorization") ?? undefined);
  if (bearerToken) {
    const jwtAuth = parseJwtAuth(bearerToken);
    if (jwtAuth) {
      req.auth = jwtAuth;
      next();
      return;
    }

    res.status(401).json({ error: "Invalid or expired bearer token" });
    return;
  }

  if (!isDevHeaderAuthEnabled()) {
    res.status(401).json({
      error: "Authorization required"
    });
    return;
  }

  const role = parseRole(req.header("x-user-role") ?? undefined);
  const userId = req.header("x-user-id")?.trim();

  if (!role || !userId) {
    res.status(401).json({
      error: "Missing auth headers",
      requiredHeaders: ["x-user-role", "x-user-id"]
    });
    return;
  }

  req.auth = { role, userId };
  next();
}

export function requireRole(...allowedRoles: AppRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({
        error: "Forbidden",
        requiredRole: allowedRoles
      });
      return;
    }

    next();
  };
}
