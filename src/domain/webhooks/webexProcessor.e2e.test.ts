import { CaseStatus, DoctorKycStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/prisma.js";
import { processWebexWebhookPayload } from "./webexProcessor.js";
import { fetchWebexMessageById } from "../../integrations/webexClient.js";
import { sendWhatsAppTextMessage } from "../../integrations/whatsappClient.js";

vi.mock("../../integrations/webexClient.js", () => ({
  createWebexRoom: vi.fn(),
  addWebexRoomMember: vi.fn(),
  sendWebexTextMessage: vi.fn(),
  fetchWebexMessageById: vi.fn()
}));

vi.mock("../../integrations/whatsappClient.js", () => ({
  sendWhatsAppTextMessage: vi.fn()
}));

const createdCaseIds: string[] = [];
const createdPatientIds: string[] = [];
const createdDoctorIds: string[] = [];

function uniqueToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

afterEach(async () => {
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

describe("processWebexWebhookPayload e2e", () => {
  it("stores doctor message, transitions status, and relays to WhatsApp", async () => {
    const token = uniqueToken();
    const roomId = `room-${token}`;
    const phone = `+1556${token.replace(/[^0-9]/g, "").slice(0, 8)}`;

    const fetchMessageMock = vi.mocked(fetchWebexMessageById);
    const sendWhatsAppMock = vi.mocked(sendWhatsAppTextMessage);

    fetchMessageMock.mockResolvedValue({
      id: `webex-message-${token}`,
      roomId,
      text: "Please monitor symptoms and hydrate well.",
      personId: `doctor-person-${token}`
    });

    sendWhatsAppMock.mockResolvedValue({
      sent: true,
      messageId: `wamid-out-${token}`
    });

    const patient = await prisma.patient.create({
      data: {
        whatsappPhone: phone,
        fullName: "Patient Webex E2E"
      }
    });
    createdPatientIds.push(patient.id);

    const doctor = await prisma.doctor.create({
      data: {
        email: `webex-e2e-${token}@test.local`,
        fullName: "Dr E2E Webex",
        npiNumber: `webex-npi-${token}`,
        isActive: true,
        kycStatus: DoctorKycStatus.APPROVED
      }
    });
    createdDoctorIds.push(doctor.id);

    const triageCase = await prisma.triageCase.create({
      data: {
        patientId: patient.id,
        assignedDoctorId: doctor.id,
        status: CaseStatus.ASSIGNED,
        webexSpaceId: roomId,
        chiefComplaint: "Persistent cough",
        startedAt: new Date()
      }
    });
    createdCaseIds.push(triageCase.id);

    const payload = {
      id: `webhook-event-${token}`,
      resource: "messages",
      event: "created",
      data: {
        id: `webex-message-${token}`,
        roomId,
        personId: `doctor-person-${token}`
      }
    };

    const result = await processWebexWebhookPayload(payload);

    expect(result).toMatchObject({
      processed: true,
      caseId: triageCase.id,
      relayedToWhatsApp: true
    });

    const refreshedCase = await prisma.triageCase.findUnique({
      where: { id: triageCase.id }
    });
    expect(refreshedCase?.status).toBe(CaseStatus.IN_PROGRESS);

    const messages = await prisma.message.findMany({
      where: {
        caseId: triageCase.id
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      senderType: "DOCTOR",
      platform: "WEBEX",
      content: "Please monitor symptoms and hydrate well."
    });

    expect(fetchMessageMock).toHaveBeenCalledWith(`webex-message-${token}`);
    expect(sendWhatsAppMock).toHaveBeenCalledWith({
      to: phone,
      body: "Doctor: Please monitor symptoms and hydrate well."
    });
  });

  it("ignores relayed patient echo text to prevent loops", async () => {
    const token = uniqueToken();
    const roomId = `room-loop-${token}`;
    const phone = `+1557${token.replace(/[^0-9]/g, "").slice(0, 8)}`;

    const fetchMessageMock = vi.mocked(fetchWebexMessageById);
    const sendWhatsAppMock = vi.mocked(sendWhatsAppTextMessage);

    fetchMessageMock.mockResolvedValue({
      id: `webex-message-loop-${token}`,
      roomId,
      text: `Patient ${phone}: still dizzy and weak`,
      personId: `person-loop-${token}`
    });

    const patient = await prisma.patient.create({
      data: {
        whatsappPhone: phone,
        fullName: "Patient Loop Guard"
      }
    });
    createdPatientIds.push(patient.id);

    const doctor = await prisma.doctor.create({
      data: {
        email: `webex-loop-${token}@test.local`,
        fullName: "Dr Loop Guard",
        npiNumber: `loop-npi-${token}`,
        isActive: true,
        kycStatus: DoctorKycStatus.APPROVED
      }
    });
    createdDoctorIds.push(doctor.id);

    const triageCase = await prisma.triageCase.create({
      data: {
        patientId: patient.id,
        assignedDoctorId: doctor.id,
        status: CaseStatus.IN_PROGRESS,
        webexSpaceId: roomId,
        chiefComplaint: "Follow-up",
        startedAt: new Date()
      }
    });
    createdCaseIds.push(triageCase.id);

    const payload = {
      id: `webhook-event-loop-${token}`,
      resource: "messages",
      event: "created",
      data: {
        id: `webex-message-loop-${token}`,
        roomId,
        personId: `person-loop-${token}`
      }
    };

    const result = await processWebexWebhookPayload(payload);
    expect(result).toEqual({
      processed: false,
      reason: "Ignoring relayed patient message echo"
    });

    const messages = await prisma.message.findMany({
      where: { caseId: triageCase.id }
    });
    expect(messages).toHaveLength(0);
    expect(sendWhatsAppMock).not.toHaveBeenCalled();
  });
});
