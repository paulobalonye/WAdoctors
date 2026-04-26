import { CaseStatus, type Doctor, type TriageCase } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { transitionCaseStatus } from "./caseRepository.js";

type CaseWithPatient = TriageCase & {
  patient: {
    id: string;
    whatsappPhone: string;
  };
};

const ACTIVE_DOCTOR_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.ASSIGNED,
  CaseStatus.IN_PROGRESS,
  CaseStatus.ESCALATED
];

async function findDoctorCandidates() {
  const strictCandidates = await prisma.doctor.findMany({
    where: {
      isActive: true,
      kycStatus: "APPROVED",
      OR: [{ licenseState: env.LAUNCH_STATE }, { licenseState: null }]
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (strictCandidates.length > 0) {
    return strictCandidates;
  }

  return prisma.doctor.findMany({
    where: {
      isActive: true,
      kycStatus: "APPROVED"
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

async function pickLeastBusyDoctor(doctors: Doctor[]): Promise<Doctor | null> {
  if (doctors.length === 0) {
    return null;
  }

  const counts = await prisma.triageCase.groupBy({
    by: ["assignedDoctorId"],
    where: {
      assignedDoctorId: {
        in: doctors.map((doctor) => doctor.id)
      },
      status: {
        in: ACTIVE_DOCTOR_CASE_STATUSES
      }
    },
    _count: {
      _all: true
    }
  });

  const loadByDoctorId = new Map<string, number>();
  for (const item of counts) {
    if (item.assignedDoctorId) {
      loadByDoctorId.set(item.assignedDoctorId, item._count._all);
    }
  }

  let selected: Doctor | null = null;
  let selectedLoad = Number.POSITIVE_INFINITY;

  for (const doctor of doctors) {
    const load = loadByDoctorId.get(doctor.id) ?? 0;
    if (load < selectedLoad) {
      selected = doctor;
      selectedLoad = load;
    }
  }

  return selected;
}

export type AssignmentResult = {
  caseRecord: CaseWithPatient;
  assigned: boolean;
  doctor?: Doctor;
  reason?: string;
};

export async function assignDoctorIfNeeded(caseId: string): Promise<AssignmentResult> {
  const caseRecord = await prisma.triageCase.findUnique({
    where: { id: caseId },
    include: {
      patient: {
        select: {
          id: true,
          whatsappPhone: true
        }
      }
    }
  });

  if (!caseRecord) {
    throw new Error(`Case not found: ${caseId}`);
  }

  if (caseRecord.assignedDoctorId) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: caseRecord.assignedDoctorId }
    });

    return {
      caseRecord,
      assigned: Boolean(doctor),
      doctor: doctor ?? undefined,
      reason: doctor ? undefined : "Assigned doctor missing from database"
    };
  }

  if (caseRecord.status !== CaseStatus.ASSIGNED) {
    return {
      caseRecord,
      assigned: false,
      reason: `Case status ${caseRecord.status} does not require doctor assignment`
    };
  }

  const candidates = await findDoctorCandidates();
  const selectedDoctor = await pickLeastBusyDoctor(candidates);

  if (!selectedDoctor) {
    await transitionCaseStatus({
      caseId: caseRecord.id,
      to: CaseStatus.ESCALATED,
      actorId: "SYSTEM_ASSIGNMENT",
      actorType: "SYSTEM",
      reason: "No active approved doctor available for assignment"
    });

    const escalatedCase = await prisma.triageCase.findUnique({
      where: { id: caseRecord.id },
      include: {
        patient: {
          select: {
            id: true,
            whatsappPhone: true
          }
        }
      }
    });

    if (!escalatedCase) {
      throw new Error(`Case disappeared after escalation: ${caseId}`);
    }

    return {
      caseRecord: escalatedCase,
      assigned: false,
      reason: "No active approved doctor available"
    };
  }

  const updatedCase = await prisma.$transaction(async (tx) => {
    const updated = await tx.triageCase.update({
      where: { id: caseRecord.id },
      data: {
        assignedDoctorId: selectedDoctor.id
      },
      include: {
        patient: {
          select: {
            id: true,
            whatsappPhone: true
          }
        }
      }
    });

    await tx.auditLog.create({
      data: {
        tableName: "triage_cases",
        recordId: caseRecord.id,
        action: "UPDATE",
        actorId: "SYSTEM_ASSIGNMENT",
        actorType: "SYSTEM",
        oldValues: { assignedDoctorId: caseRecord.assignedDoctorId ?? null },
        newValues: {
          assignedDoctorId: selectedDoctor.id,
          reason: "Automatic least-load doctor assignment"
        }
      }
    });

    return updated;
  });

  return {
    caseRecord: updatedCase,
    assigned: true,
    doctor: selectedDoctor
  };
}
