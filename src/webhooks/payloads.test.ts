import { describe, expect, it } from "vitest";
import { extractWhatsAppExternalId, extractWhatsAppMessages } from "./payloads.js";

describe("extractWhatsAppMessages", () => {
  it("parses messages across all entries and changes", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { display_phone_number: "+15551234567" }
              }
            },
            {
              value: {
                messages: [
                  {
                    id: "wamid-1",
                    from: "15550000001",
                    type: "text",
                    timestamp: "1713000000",
                    text: { body: "hello doctor" }
                  }
                ]
              }
            }
          ]
        },
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wamid-2",
                    from: "15550000001",
                    type: "image",
                    timestamp: "1713000001"
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const messages = extractWhatsAppMessages(payload);
    expect(messages).toHaveLength(2);
    expect(messages.map((item) => item.id)).toEqual(["wamid-1", "wamid-2"]);
    expect(messages[1]).toMatchObject({
      id: "wamid-2",
      from: "15550000001",
      type: "image",
      text: "[image message]"
    });
  });

  it("deduplicates repeated message ids inside one webhook payload", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wamid-dup",
                    from: "15550000001",
                    type: "text",
                    text: { body: "first copy" }
                  }
                ]
              }
            }
          ]
        },
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wamid-dup",
                    from: "15550000001",
                    type: "text",
                    text: { body: "duplicate copy" }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const messages = extractWhatsAppMessages(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: "wamid-dup",
      text: "first copy"
    });
  });
});

describe("extractWhatsAppExternalId", () => {
  it("falls back to status ids across all changes when no messages exist", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: []
              }
            },
            {
              value: {
                statuses: [
                  {
                    id: "status-from-second-change"
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    expect(extractWhatsAppExternalId(payload)).toBe("status-from-second-change");
  });
});
