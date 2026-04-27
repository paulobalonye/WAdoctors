import { z } from "zod";
import type { AppRole } from "../../auth/roles.js";

const loginBodySchema = z.object({
  role: z.string().optional(),
  portal: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(1)
});

function normalizeRoleLike(value: string | undefined): AppRole | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "admin") {
    return "ADMIN";
  }

  if (normalized === "doctor") {
    return "DOCTOR";
  }

  return undefined;
}

export function parsePortalLoginBody(payload: unknown): {
  role: AppRole;
  email: string;
  password: string;
} {
  const parsed = loginBodySchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid login payload: email and password are required");
  }

  const role = normalizeRoleLike(parsed.data.role);
  const portalRole = normalizeRoleLike(parsed.data.portal);

  if (role && portalRole && role !== portalRole) {
    throw new Error("Invalid login payload: role and portal conflict");
  }

  const resolvedRole = role ?? portalRole;
  if (!resolvedRole) {
    throw new Error("Invalid login payload: role or portal is required");
  }

  return {
    role: resolvedRole,
    email: parsed.data.email,
    password: parsed.data.password
  };
}
