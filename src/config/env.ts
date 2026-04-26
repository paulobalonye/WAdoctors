import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  API_BASE_URL: z.string().url(),
  LAUNCH_STATE: z.string().length(2).default("OH"),
  REDIS_URL: z.string().optional(),
  RELAY_DISPATCH_MODE: z.enum(["inline", "queue"]).default("inline"),
  ARCHITECTURE_MODE: z.enum(["WHATSAPP_PRIMARY", "WEBEX_PRIMARY"]).default("WHATSAPP_PRIMARY"),
  PHI_CHANNEL_MODE: z.enum(["WHATSAPP_AND_WEBEX", "WEBEX_ONLY"]).default("WHATSAPP_AND_WEBEX"),
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

export const env = parsed.data;
