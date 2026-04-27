import { getAdminIntegrationStatus } from "../domain/portals/adminPortalService.js";
import type { IntegrationStatusResult } from "../domain/portals/integrationStatus.js";

type LoggerLike = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

export function formatIntegrationReadinessWarnings(status: IntegrationStatusResult): string[] {
  if (status.summary.readyCount === status.summary.total) {
    return [];
  }

  const warnings = [`Integration readiness: ${status.summary.readyCount}/${status.summary.total} ready.`];

  const entries: Array<{ name: string; ready: boolean; missing: string[]; notes?: string[] }> = [
    { name: "WhatsApp", ready: status.whatsapp.ready, missing: status.whatsapp.missing, notes: status.whatsapp.notes },
    { name: "Webex", ready: status.webex.ready, missing: status.webex.missing, notes: status.webex.notes },
    { name: "Stripe", ready: status.stripe.ready, missing: status.stripe.missing, notes: status.stripe.notes },
    { name: "Relay Queue", ready: status.relay.ready, missing: status.relay.missing, notes: status.relay.notes }
  ];

  for (const entry of entries) {
    if (!entry.ready && entry.missing.length > 0) {
      warnings.push(`${entry.name} missing: ${entry.missing.join(", ")}`);
    }
    if (entry.notes && entry.notes.length > 0 && entry.name === "Relay Queue") {
      warnings.push(`${entry.name} notes: ${entry.notes.join(", ")}`);
    }
  }

  return warnings;
}

export function logIntegrationReadiness(logger: LoggerLike = console): void {
  const status = getAdminIntegrationStatus();
  const warnings = formatIntegrationReadinessWarnings(status);

  if (warnings.length === 0) {
    logger.info("Integration readiness: all systems ready.");
    return;
  }

  for (const line of warnings) {
    logger.warn(line);
  }
}
