import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { devAuthMiddleware } from "./auth/roles.js";
import { env } from "./config/env.js";
import { adminPortalRouter } from "./routes/adminPortal.js";
import { authRouter } from "./routes/auth.js";
import { doctorPortalRouter } from "./routes/doctorPortal.js";
import { webhookRouter } from "./routes/webhooks.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use("/webhooks", webhookRouter);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.redirect("/admin");
});

app.get("/admin", (_req, res) => {
  res.redirect("/portal/admin-login.html");
});

app.get("/doctor", (_req, res) => {
  res.redirect("/portal/doctor-login.html");
});

app.get("/portal", (_req, res) => {
  res.redirect("/admin");
});

app.get("/portal/index.html", (_req, res) => {
  res.redirect("/admin");
});

app.use("/portal", express.static(path.join(process.cwd(), "public")));

app.get("/api/v1/meta", (_req, res) => {
  res.status(200).json({
    app: "wadoctors-api",
    stage: env.NODE_ENV,
    launchState: env.LAUNCH_STATE,
    architectureMode: env.ARCHITECTURE_MODE,
    phiChannelMode: env.PHI_CHANNEL_MODE,
    message: "WhatsApp bot consultation baseline ready"
  });
});

app.use("/api/v1/doctor", devAuthMiddleware, doctorPortalRouter);
app.use("/api/v1/admin", devAuthMiddleware, adminPortalRouter);
app.use("/api/v1/auth", authRouter);
