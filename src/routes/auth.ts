import { Router, type Response } from "express";
import { type AuthedRequest, devAuthMiddleware } from "../auth/roles.js";
import { getPortalUserByRole, loginPortalUser } from "../domain/auth/authService.js";
import { parsePortalLoginBody } from "../domain/auth/loginPayload.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  let loginPayload: { role: "ADMIN" | "DOCTOR"; email: string; password: string };
  try {
    loginPayload = parsePortalLoginBody(req.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid login payload";
    res.status(400).json({ error: message });
    return;
  }

  try {
    const result = await loginPortalUser(loginPayload);
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
