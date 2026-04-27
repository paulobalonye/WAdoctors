import { DoctorKycStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { parseCaseTriageStorage } from "../consultations/triageStorage.js";
import { processWhatsAppWebhookPayload } from "./whatsappProcessor.js";
import {
  addWebexRoomMember,
  createWebexRoom,
  sendWebexTextMessage
} from "../../integrations/webexClient.js";

vi.mock("../../integrations/webexClient.js", () => ({
  createWebexRoom: vi.fn(),
  addWebexRoomMember: vi.fn(),
  sendWebexTextMessage: vi.fn(),
  fetchWebexMessageById: vi.fn()
}));

const originalDispatchMode = env.RELAY_DISPATCH_MODE;

const createdCaseIds: string[] = [];
const createdPatientIds: string[] = [];
const createdDoctorIds: string[] = [];

function uniqueToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function uniquePhone() {
  const local = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`
    .replace(/[^0-9]/g, "")
    .slice(-10)
    .padStart(10, "0");
  return `+1${local}`;
}

afterEach(async () => {
  (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = originalDispatchMode;
  vi.clearAllMocks();

  if (createdCaseIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        recordId: {
          in: createdCaseIds
        }
      }
    });

    await prisma.triageCase.deleteMany({
      where: {
        id: {
          in: createdCaseIds
        }
      }
    });
    createdCaseIds.length = 0;
  }

  if (createdPatientIds.length > 0) {
    await prisma.patient.deleteMany({
      where: {
        id: {
          in: createdPatientIds
        }
      }
    });
    createdPatientIds.length = 0;
  }

  if (createdDoctorIds.length > 0) {
    await prisma.doctor.deleteMany({
      where: {
        id: {
          in: createdDoctorIds
        }
      }
    });
    createdDoctorIds.length = 0;
  }
});

describe("processWhatsAppWebhookPayload e2e", () => {
  it("creates, assigns, provisions workspace, and relays to Webex", async () => {
    (env as { RELAY_DISPATCH_MODE: "inline" | "queue" }).RELAY_DISPATCH_MODE = "inline";

    const token = uniqueToken();
    const phone = uniquePhone();
    const roomId = `room-${token}`;

    const createRoomMock = vi.mocked(createWebexRoom);
    const addMemberMock = vi.mocked(addWebexRoomMember);
    const sendTextMock = vi.mocked(sendWebexTextMessage);

    createRoomMock.mockResolvedValue({
      created: true,
      roomId
    });
    addMemberMock.mockResolvedValue({
      added: true,
      membershipId: `membership-${token}`
    });
    sendTextMock.mockResolvedValue({
      sent: true,
      messageId: `message-${token}`
    });

    const doctor = await prisma.doctor.create({
      data: {
        email: `whatsapp-e2e-${token}@test.local`,
        fullName: "Dr E2E WhatsApp",
        npiNumber: `npi-${token}`,
        isActive: true,
        kycStatus: DoctorKycStatus.APPROVED,
        webexPersonId: `person-${token}`,
        licenseState: env.LAUNCH_STATE
      }
    });
    createdDoctorIds.push(doctor.id);

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: `wamid-${token}`,
                    from: phone,
                    type: "text",
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    text: {
                      body: "I have a cough, sore throat, and fever"
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const result = await processWhatsAppWebhookPayload(payload);
    createdCaseIds.push(...result.caseIds);

    expect(result.processedCount).toBe(1);
    expect(result.caseIds).toHaveLength(1);
    expect(result.relays).toHaveLength(1);
    expect(result.relays[0]).toMatchObject({
      caseId: result.caseIds[0],
      relayed: true
    });

    const triageCase = await prisma.triageCase.findUnique({
      where: { id: result.caseIds[0] },
      include: {
        patient: true,
        messages: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    expect(triageCase).not.toBeNull();
    if (!triageCase) {
      return;
    }

    createdPatientIds.push(triageCase.patientId);

    const transcript = parseCaseTriageStorage(triageCase.aiTranscript);

    expect(triageCase.assignedDoctorId).toBeTruthy();
    expect(triageCase.webexSpaceId).toBe(roomId);
    expect(triageCase.status).toBe("IN_PROGRESS");
    expect(transcript?.route).toBe("ROUTE_TO_DOCTOR");
    expect(transcript?.urgencyScore).toBeGreaterThanOrEqual(3);
    expect(transcript?.triageSource).toBe("HEURISTIC");

    const systemMessage = triageCase.messages.find((message) => message.senderType === "SYSTEM");
    const patientMessage = triageCase.messages.find((message) => message.senderType === "PATIENT");

    expect(systemMessage?.content ?? "").toContain("Triage note:");
    expect(patientMessage?.content).toContain("cough");

    expect(createRoomMock).toHaveBeenCalledTimes(1);
    if (doctor.webexPersonId && triageCase.assignedDoctorId === doctor.id) {
      expect(addMemberMock).toHaveBeenCalledWith({
        roomId,
        personId: doctor.webexPersonId
      });
    }
    expect(sendTextMock).toHaveBeenCalledTimes(2);

    const dispatchedTexts = sendTextMock.mock.calls.map((call) => call[0].text);
    expect(dispatchedTexts.some((text) => text.includes("New Case Assigned"))).toBe(true);
    expect(dispatchedTexts.some((text) => text.includes(`Patient ${phone}:`))).toBe(true);
  });
});
