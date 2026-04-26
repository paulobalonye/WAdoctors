import { env } from "../config/env.js";

export type SendWhatsAppTextParams = {
  to: string;
  body: string;
};

export type SendWhatsAppTextResult = {
  sent: boolean;
  messageId?: string;
  reason?: string;
};

export async function sendWhatsAppTextMessage(
  params: SendWhatsAppTextParams
): Promise<SendWhatsAppTextResult> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return {
      sent: false,
      reason: "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing"
    };
  }

  const url = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "text",
      text: {
        body: params.body
      }
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    return {
      sent: false,
      reason: `WhatsApp API error (${response.status}): ${responseText}`
    };
  }

  const data = (await response.json()) as { messages?: Array<{ id?: string }> };
  return {
    sent: true,
    messageId: data.messages?.[0]?.id
  };
}
