import { env } from "../../config/env.js";
import { createOpenAITriageProvider } from "../../integrations/openaiTriageProvider.js";

export const triageAIProvider = createOpenAITriageProvider({
  apiKey: env.OPENAI_API_KEY,
  model: env.OPENAI_TRIAGE_MODEL,
  baseUrl: env.OPENAI_BASE_URL,
  timeoutMs: env.OPENAI_TRIAGE_TIMEOUT_MS
});

export const triageAIEnabled = env.AI_TRIAGE_ENABLED === "true" || Boolean(env.OPENAI_API_KEY?.trim());
