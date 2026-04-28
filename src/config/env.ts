import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "test", "staging", "production"]).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  API_BASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("12h"),
  ALLOW_DEV_HEADER_AUTH: z.enum(["true", "false"]).default("true"),
  LAUNCH_STATE: z.string().length(2).default("OH"),
  REDIS_URL: z.string().optional(),
  RELAY_DISPATCH_MODE: z.enum(["inline", "queue"]).default("inline"),
  RELAY_ALERT_PENDING_WARNING: z.coerce.number().int().min(1).default(20),
  RELAY_ALERT_PENDING_CRITICAL: z.coerce.number().int().min(1).default(50),
  RELAY_ALERT_FAILED_WARNING: z.coerce.number().int().min(1).default(5),
  RELAY_ALERT_FAILED_CRITICAL: z.coerce.number().int().min(1).default(10),
  RELAY_ALERT_OLDEST_FAILED_MINUTES_WARNING: z.coerce.number().int().min(1).default(15),
  RELAY_ALERT_OLDEST_FAILED_MINUTES_CRITICAL: z.coerce.number().int().min(1).default(60),
  ARCHITECTURE_MODE: z.enum(["WHATSAPP_PRIMARY", "WEBEX_PRIMARY"]).default("WHATSAPP_PRIMARY"),
  PHI_CHANNEL_MODE: z.enum(["WHATSAPP_AND_WEBEX", "WEBEX_ONLY"]).default("WHATSAPP_AND_WEBEX"),
  AI_TRIAGE_ENABLED: z.enum(["true", "false"]).default("false"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TRIAGE_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_TRIAGE_PROMPT_VERSION: z.string().default("v1"),
  OPENAI_TRIAGE_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.45),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_TRIAGE_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(8000),
  RISK_ACCEPTANCE_SIGNER: z.string().min(1),
  RISK_ACCEPTANCE_DATE: z.string().min(1),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_WEBHOOK_SECRET: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_GRAPH_API_VERSION: z.string().default("v22.0"),
  WEBEX_WEBHOOK_SECRET: z.string().min(1),
  WEBEX_BOT_ACCESS_TOKEN: z.string().optional(),
  WEBEX_BOT_PERSON_ID: z.string().optional(),
  WEBEX_DEFAULT_ROOM_ID: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const appEnv =
  parsed.data.APP_ENV ??
  (parsed.data.NODE_ENV === "production" ? "production" : parsed.data.NODE_ENV);

export const env = {
  ...parsed.data,
  APP_ENV: appEnv
};
