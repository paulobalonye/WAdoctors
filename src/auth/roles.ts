import type { Request, Response, NextFunction } from "express";

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

export function devAuthMiddleware(req: AuthedRequest, res: Response, next: NextFunction): void {
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
