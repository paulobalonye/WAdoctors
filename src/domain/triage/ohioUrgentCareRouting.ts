export type OhioUrgentCareRoute =
  | "ROUTE_TO_DOCTOR"
  | "SEND_SELF_CARE"
  | "ESCALATE_EMERGENCY"
  | "OUT_OF_STATE";

export type OhioUrgentCareInput = {
  patientState: string;
  urgencyScore: number;
};

export function routeOhioUrgentCareCase(input: OhioUrgentCareInput): OhioUrgentCareRoute {
  const normalizedState = input.patientState.trim().toUpperCase();

  if (normalizedState !== "OH") {
    return "OUT_OF_STATE";
  }

  if (input.urgencyScore >= 5) {
    return "ESCALATE_EMERGENCY";
  }

  if (input.urgencyScore >= 3) {
    return "ROUTE_TO_DOCTOR";
  }

  return "SEND_SELF_CARE";
}

export function inferUrgencyFromText(text: string): number {
  const normalized = text.toLowerCase();

  const emergencySignals = ["chest pain", "shortness of breath", "can't breathe", "stroke", "seizure"];
  if (emergencySignals.some((signal) => normalized.includes(signal))) {
    return 5;
  }

  const urgentSignals = ["fever", "vomiting", "infection", "severe pain", "blood", "dizzy", "faint"];
  if (urgentSignals.some((signal) => normalized.includes(signal))) {
    return 4;
  }

  const semiUrgentSignals = ["headache", "cough", "rash", "sore throat", "stomach pain"];
  if (semiUrgentSignals.some((signal) => normalized.includes(signal))) {
    return 3;
  }

  if (normalized.trim().length > 0) {
    return 2;
  }

  return 1;
}
