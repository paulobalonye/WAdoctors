# WhatsApp MD Platform v1.1 - Webex-First Compliance Project Plan

> Status update (April 26, 2026): superseded for active execution by [PROJECT_PLAN_WHATSAPP_PRIMARY_v1.2.md](/Users/drpraize/WADoctors-NEW/WAdoctors/docs/PROJECT_PLAN_WHATSAPP_PRIMARY_v1.2.md).

Date: April 26, 2026  
Status: Draft for execution

## 1) Why v1.1 exists

This plan updates the original PRD to a safer implementation path:

- Webex is the PHI-bearing clinical collaboration surface.
- WhatsApp is restricted to non-PHI onboarding, alerts, and routing prompts.
- Clinical conversation content is moved to a HIPAA-ready channel and data boundary.

This lets us preserve the product vision (consumer-first intake + doctor workflow in Webex) while reducing immediate regulatory risk.

## 2) Architecture and compliance decisions

## 2.1 Non-negotiable boundary

- `WhatsApp`: no PHI content in messages, attachments, or bot prompts.
- `Webex + Backend + Encrypted DB`: PHI allowed, audited, role-controlled.
- `AI services`: only in projects and endpoints approved for required HIPAA/BAA posture.

## 2.2 Channel behavior in v1.1

- WhatsApp supports:
  - account creation
  - KYC collection metadata prompts
  - subscription initiation links
  - "you have a new message in your secure consult workspace" notifications
  - emergency instructions and operational messaging
- Clinical chat is not continued in WhatsApp.
- Doctors operate in Webex spaces/cards for triage and consult handling.

## 2.3 Contract and legal gate (must complete before pilot)

- Execute Cisco Webex BAA and confirm licensed scope for intended APIs/features.
- Execute Twilio BAA only for HIPAA-eligible services actually in use.
- Confirm that WhatsApp traffic is non-PHI by policy and technical controls.
- Confirm OpenAI BAA + data retention controls for chosen endpoints/models.
- Document state licensure and eRx policy constraints for launch states.

## 3) Target system design

## 3.0 Locked implementation stack

- Runtime: `Node.js 22 LTS`
- API framework: `Express.js` with TypeScript
- Database: `PostgreSQL 15+`
- ORM and migrations: `Prisma`
- Cache and queues: `Redis + BullMQ`

## 3.1 Core components

- API service (`Express.js` + TypeScript) with RBAC and audit middleware.
- PostgreSQL for transactional data.
- Redis + BullMQ workers for retries, webhook fan-out, and async processing.
- Object storage with KMS for docs/media where needed.
- Event bus pattern for message and case lifecycle transitions.

## 3.2 Channel adapters

- `whatsapp-adapter`
  - webhook ingest
  - policy engine that blocks PHI-bearing payloads
  - templated non-PHI outbound notifications
- `webex-adapter`
  - room/space creation
  - adaptive card actions
  - message sync to internal case timeline

## 3.3 Data domain model (v1.1)

- `patients`, `doctors`, `kyc_submissions`, `subscriptions`, `payments`, `triage_cases`, `messages`, `doctor_payouts`, `audit_log`.
- Add `phi_scope` tags on message records (`NONE`, `POSSIBLE`, `PHI`) and enforce channel constraints:
  - `WHATSAPP` accepts only `NONE`.
  - `WEBEX` accepts `NONE|POSSIBLE|PHI`.

## 4) Delivery phases (16 weeks)

## Phase 0 - Compliance and solution freeze (Week 1-2)

Deliverables:
- Written channel policy: "No PHI in WhatsApp."
- Legal/compliance sign-off checklist.
- Vendor contract tracker with owner and due dates.
- Threat model and data-flow diagram.
- Final architecture decision record (ADR-001).

Exit criteria:
- Compliance owner signs channel boundary.
- Engineering lead signs architecture freeze.

## Phase 1 - Platform foundation (Week 3-5)

Deliverables:
- Repo bootstrap, CI/CD, environments (`dev`, `staging`).
- Node.js TypeScript service skeleton (`Express`) with shared config and logging.
- AuthN/AuthZ and role model (`PATIENT`, `DOCTOR`, `ADMIN`, `SYSTEM`).
- PostgreSQL schema via Prisma migrations and seed data.
- BullMQ queue/retry framework + idempotency utilities.
- Full audit logging with immutable append semantics.

Exit criteria:
- Staging deploy complete.
- Security baseline checks passing.

## Phase 2 - Onboarding + KYC + subscriptions (Week 6-8)

Deliverables:
- Patient onboarding conversational flow (non-PHI safe prompts).
- Doctor portal for onboarding + doc upload.
- KYC pipeline + manual review dashboard.
- Stripe subscription lifecycle (checkout, renewal, failure, cancellation).
- Subscription enforcement middleware.

Exit criteria:
- End-to-end onboarding + payment in staging.
- KYC approval SLA instrumentation live.

## Phase 3 - Triage and case orchestration (Week 9-11)

Deliverables:
- Intake parser and safety classifier.
- Audio transcription pipeline where policy permits.
- Urgency scoring + deterministic safety rules.
- Case creation and doctor assignment service.
- Emergency branch (911 guidance + escalation logging).

Exit criteria:
- Test scenarios for urgency 1-5 pass.
- Clinical safety review of rule set completed.

## Phase 4 - Webex clinical workflow (Week 12-14)

Deliverables:
- Webex bot integration and webhook handling.
- Case room creation and adaptive case card actions.
- Doctor accept/decline/request-info flows.
- Clinical timeline and close-case summary generation.
- Notification bridge to WhatsApp (non-PHI alerts only).

Exit criteria:
- Full case lifecycle works in staging with 2+ doctor test accounts.

## Phase 5 - Hardening and pilot launch (Week 15-16)

Deliverables:
- Security and penetration testing.
- Load test for concurrent active cases.
- Runbooks for incidents, outages, and on-call response.
- Pilot cohort enablement (10 doctors, controlled patient volume).

Exit criteria:
- Go-live checklist signed by Product, Engineering, Security, and Clinical lead.

## 5) Critical path and dependencies

1. Compliance boundary sign-off -> all downstream work depends on this.
2. Contract readiness (Webex/OpenAI/Twilio posture) -> needed before PHI-bearing pilot scenarios.
3. Identity/RBAC/audit foundations -> required for KYC, triage, and clinical workflows.
4. Subscription enforcement -> required before production consultation handling.
5. Webex adapter reliability -> required before pilot launch.

## 6) Updated success metrics

- KYC completion rate: `>85%`
- Doctor KYC decision time: `<48h`
- Conversion from KYC-approved to subscribed: `>30%`
- Urgency scoring agreement with clinicians: `>90%`
- Premium doctor response (P90): `<2h`
- Basic doctor response (P90): `<24h`
- Consultation completion: `>95%`
- Pilot patient NPS: `>50`
- PHI policy violations in WhatsApp: `0`

## 7) v1.1 risk register

1. WhatsApp users share PHI despite warnings  
Mitigation: pre-send classifier, user warning interstitial, PHI-redaction + block rules.

2. Contract delays (BAA/procurement)  
Mitigation: assign legal owner, weekly exec unblock, parallel technical prep.

3. Clinical safety regression in triage  
Mitigation: deterministic red-flag overrides, clinician review set, rollback switch.

4. Webex API limits or downtime  
Mitigation: queue + retry + dead-letter + graceful degradation runbook.

5. Doctor adoption friction  
Mitigation: one-click card actions, concise summaries, onboarding concierge.

## 8) Team plan (minimum)

- Product Lead: scope and acceptance criteria.
- Engineering Lead: architecture and release control.
- Backend Engineer x2: core services, adapters, data model.
- Frontend Engineer x1: doctor/admin portals.
- QA/Automation x1: integration/e2e coverage.
- Security/Compliance owner x1: controls, evidence, audits.
- Clinical advisor x1: triage safety governance.

## 9) First 2-week execution sprint (ready now)

## Sprint goal
Ship the compliance boundary and technical skeleton needed for all later phases.

## Planned backlog

- `PLAT-001`: Node.js monorepo/service bootstrap and CI.
- `PLAT-002`: auth, RBAC, and service identity.
- `PLAT-003`: Prisma schema + core PostgreSQL migrations for v1.1 entities.
- `PLAT-004`: BullMQ setup + audit logging middleware and query API.
- `CMP-001`: data-flow diagram + threat model.
- `CMP-002`: channel policy enforcement spec ("no PHI on WhatsApp").
- `INT-001`: WhatsApp webhook receiver stub + payload policy hook.
- `INT-002`: Webex webhook receiver stub + signature validation.
- `OPS-001`: staging environment and secrets management baseline.

## Done definition

- All backlog items merged to main with tests.
- Staging deployment successful.
- Compliance checkpoint signed for Phase 0 exit.

## 10) Decisions still required this week

1. Launch-state policy: which U.S. states are in initial doctor coverage.
2. Clinical scope: urgent care only vs urgent + chronic follow-up in pilot.
3. Family plan handling: in v1.1 or deferred to post-pilot.
4. Payout cadence: net-7 default vs configurable.

## 11) Immediate next action

Start Phase 0 with a 60-minute architecture/compliance working session and freeze ADR-001 by end of week.
