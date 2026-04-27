import type { AITriageSuggestion, TriageAIProvider } from "../domain/triage/aiTriage.js";

type OpenAITriageProviderOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
};

function parseJsonObject(content: unknown): AITriageSuggestion {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI triage response did not include JSON content");
  }

  const text = content.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI triage response format was invalid");
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as AITriageSuggestion;
  return {
    urgencyScore: parsed.urgencyScore,
    summary: parsed.summary,
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.map((item) => String(item)) : [],
    confidence: parsed.confidence
  };
}

export function createOpenAITriageProvider(options: OpenAITriageProviderOptions): TriageAIProvider | undefined {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    return undefined;
  }

  const model = options.model?.trim() || "gpt-4.1-mini";
  const baseUrl = options.baseUrl?.trim() || "https://api.openai.com/v1";
  const timeoutMs =
    Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) >= 500 ? Number(options.timeoutMs) : 8000;

  return {
    async assess(input) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are a cautious urgent-care triage assistant for Ohio launch. Output only JSON with fields: urgencyScore (1-5), summary (string), redFlags (string[]), confidence (0..1). Prioritize patient safety and never downplay emergency signals."
              },
              {
                role: "user",
                content: JSON.stringify({
                  patientState: input.patientState,
                  patientMessage: input.messageText,
                  baselineUrgency: input.baselineUrgency
                })
              }
            ]
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`OpenAI triage request failed: ${response.status} ${body}`);
        }

        const payload = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;
        };

        const content = payload.choices?.[0]?.message?.content;
        return parseJsonObject(content);
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
