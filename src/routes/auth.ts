import { Router, type Response } from "express";
import { z } from "zod";
import { type AuthedRequest, devAuthMiddleware } from "../auth/roles.js";
import { getPortalUserByRole, loginPortalUser } from "../domain/auth/authService.js";

const loginBodySchema = z.object({
  role: z.enum(["ADMIN", "DOCTOR"]),
  email: z.string().email(),
  password: z.string().min(1)
});

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid login payload",
        details: parsed.error.flatten().fieldErrors
      });
      return;
    }

    const result = await loginPortalUser(parsed.data);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    res.status(401).json({ error: message });
  }
});

authRouter.get("/me", devAuthMiddleware, async (req: AuthedRequest, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getPortalUserByRole({
    role: req.auth.role,
    userId: req.auth.userId
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json(user);
});
