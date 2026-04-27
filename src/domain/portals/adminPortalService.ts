import { DoctorKycStatus, type CaseStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { hashPortalPassword } from "../auth/authService.js";

const ACTIVE_CASE_STATUSES: CaseStatus[] = ["NEW", "TRIAGING", "ASSIGNED", "IN_PROGRESS", "ESCALATED"];

export async function getAdminOverview() {
  const [patients, doctors, activeDoctors, totalCases, openCases, completedCases] = await Promise.all([
    prisma.patient.count(),
    prisma.doctor.count(),
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.triageCase.count(),
    prisma.triageCase.count({
      where: {
        status: {
          in: ACTIVE_CASE_STATUSES
        }
      }
    }),
    prisma.triageCase.count({
      where: {
        status: "COMPLETED"
      }
    })
  ]);

  const casesByStatusRaw = await prisma.triageCase.groupBy({
    by: ["status"],
    _count: {
      _all: true
    }
  });

  const casesByStatus = Object.fromEntries(casesByStatusRaw.map((item) => [item.status, item._count._all]));

  return {
    patients,
    doctors,
    activeDoctors,
    totalCases,
    openCases,
    completedCases,
    casesByStatus
  };
}

export async function listAdminCases(params: { status?: CaseStatus; limit: number }) {
  return prisma.triageCase.findMany({
    where: {
      ...(params.status ? { status: params.status } : {})
    },
    include: {
      patient: {
        select: {
          id: true,
          whatsappPhone: true,
          fullName: true
        }
      },
      assignedDoctor: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: params.limit
  });
}

export async function getAdminCase(caseId: string) {
  return prisma.triageCase.findUnique({
    where: { id: caseId },
    include: {
      patient: true,
      assignedDoctor: true
    }
  });
}

export async function getAdminCaseMessages(caseId: string) {
  return prisma.message.findMany({
    where: { caseId },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function setAdminCaseStatus(params: {
  caseId: string;
  status: CaseStatus;
  actorId: string;
}) {
  const existing = await prisma.triageCase.findUnique({
    where: { id: params.caseId }
  });

  if (!existing) {
    throw new Error("Case not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const triageCase = await tx.triageCase.update({
      where: { id: params.caseId },
      data: {
        status: params.status
      }
    });

    await tx.auditLog.create({
      data: {
        tableName: "triage_cases",
        recordId: params.caseId,
        action: "UPDATE",
        actorId: params.actorId,
        actorType: "ADMIN",
        oldValues: { status: existing.status },
        newValues: { status: params.status, reason: "Updated by admin portal" }
      }
    });

    return triageCase;
  });

  return updated;
}

export async function assignAdminCaseDoctor(params: {
  caseId: string;
  doctorId: string | null;
  actorId: string;
}) {
  const existing = await prisma.triageCase.findUnique({
    where: { id: params.caseId }
  });

  if (!existing) {
    throw new Error("Case not found");
  }

  if (params.doctorId) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: params.doctorId }
    });
    if (!doctor) {
      throw new Error("Doctor not found");
    }
  }

  return prisma.$transaction(async (tx) => {
    const triageCase = await tx.triageCase.update({
      where: { id: params.caseId },
      data: {
        assignedDoctorId: params.doctorId
      }
    });

    await tx.auditLog.create({
      data: {
        tableName: "triage_cases",
        recordId: params.caseId,
        action: "UPDATE",
        actorId: params.actorId,
        actorType: "ADMIN",
        oldValues: { assignedDoctorId: existing.assignedDoctorId ?? null },
        newValues: {
          assignedDoctorId: params.doctorId,
          reason: "Updated assignment by admin portal"
        }
      }
    });

    return triageCase;
  });
}

export async function listAdminDoctors() {
  const doctors = await prisma.doctor.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  const caseLoad = await prisma.triageCase.groupBy({
    by: ["assignedDoctorId"],
    where: {
      status: {
        in: ACTIVE_CASE_STATUSES
      }
    },
    _count: {
      _all: true
    }
  });

  const caseLoadMap = new Map(
    caseLoad.filter((item) => item.assignedDoctorId).map((item) => [item.assignedDoctorId as string, item._count._all])
  );

  return doctors.map((doctor) => ({
    ...doctor,
    activeCaseLoad: caseLoadMap.get(doctor.id) ?? 0
  }));
}

export async function createAdminDoctor(params: {
  email: string;
  fullName: string;
  password: string;
  npiNumber: string;
  licenseState?: string;
  specialty?: string;
  webexPersonId?: string;
  isActive?: boolean;
  kycStatus?: DoctorKycStatus;
}) {
  const passwordHash = await hashPortalPassword(params.password);

  return prisma.doctor.create({
    data: {
      email: params.email.trim().toLowerCase(),
      fullName: params.fullName,
      passwordHash,
      npiNumber: params.npiNumber,
      licenseState: params.licenseState,
      specialty: params.specialty,
      webexPersonId: params.webexPersonId,
      isActive: params.isActive ?? false,
      kycStatus: params.kycStatus ?? DoctorKycStatus.PENDING
    }
  });
}

export async function createAdminUser(params: {
  email: string;
  fullName: string;
  password: string;
}) {
  const passwordHash = await hashPortalPassword(params.password);

  return prisma.adminUser.create({
    data: {
      email: params.email.trim().toLowerCase(),
      fullName: params.fullName,
      passwordHash
    }
  });
}

export async function resetDoctorPortalPassword(params: { doctorId: string; password: string }) {
  const passwordHash = await hashPortalPassword(params.password);

  return prisma.doctor.update({
    where: { id: params.doctorId },
    data: {
      passwordHash
    }
  });
}

export async function setDoctorActive(params: { doctorId: string; isActive: boolean }) {
  return prisma.doctor.update({
    where: { id: params.doctorId },
    data: {
      isActive: params.isActive
    }
  });
}

export async function setDoctorKycStatus(params: {
  doctorId: string;
  kycStatus: DoctorKycStatus;
}) {
  return prisma.doctor.update({
    where: { id: params.doctorId },
    data: {
      kycStatus: params.kycStatus
    }
  });
}

export async function listRecentWebhookEvents(limit: number) {
  return prisma.webhookEvent.findMany({
    orderBy: {
      receivedAt: "desc"
    },
    take: limit
  });
}
