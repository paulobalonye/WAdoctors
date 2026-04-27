# WAdoctors v1.2 - WhatsApp-Primary Bot Project Plan

Date: April 26, 2026  
Status: Active execution plan

## 0) Progress checkpoint (April 26, 2026)

- Sprint A complete:
  - webhook signature verification (WhatsApp/Webex/Stripe)
  - webhook idempotency pipeline (`WebhookEvent`)
  - consultation state machine skeleton
  - Ohio urgent-care route rules
- Sprint B baseline complete:
  - WhatsApp webhook processor persists patients/cases/messages
  - Case transitions persist with audit-log entries
  - Webex webhook processor persists doctor messages and relays to WhatsApp
  - Automatic doctor assignment for `ASSIGNED` cases
  - Dedicated Webex room creation per case + initial case summary posting
  - BullMQ relay queue + worker scaffolding with inline fallback mode
  - Doctor portal and admin portal API foundation with role-protected endpoints
  - Doctor and admin portal UI pages served at `/portal/*`
  - JWT login endpoints and token-based auth for doctor/admin portals
  - Doctor assignment checks availability windows and max concurrent capacity

## 1) Product mode (locked)

- Mode: `Option 2` (full consultation chat inside WhatsApp).
- Launch state: `OH` (Ohio).
- Scope: urgent care only for initial pilot.
- Base domain: `wadoctors.com` (`api-dev.wadoctors.com` in dev).

## 2) Architecture

- Patient channel: WhatsApp bot for onboarding, triage, consultation chat, and closure.
- Doctor channel: Webex workspace for case handling and collaboration.
- Backend: Node.js + Express + PostgreSQL + Prisma + Redis/BullMQ.
- Core pattern: event-driven case state machine with webhook ingress adapters.

## 3) Core flows to implement

1. Patient onboarding and plan activation in WhatsApp.
2. Consultation intake (text/audio/media) in WhatsApp.
3. Triage scoring and case creation.
4. Doctor assignment and Webex case room update.
5. Bidirectional message sync (WhatsApp <-> Webex) during active case.
6. Case closeout summary and patient follow-up in WhatsApp.

## 4) First 2 sprint milestones

## Sprint A (Week 1)

- Implement webhook signature verification for WhatsApp, Webex, Stripe.
- Create `WebhookEvent` idempotency processing pipeline.
- Add consultation state machine skeleton:
  - `NEW`
  - `TRIAGING`
  - `ASSIGNED`
  - `IN_PROGRESS`
  - `COMPLETED`
  - `ESCALATED`
- Add first routing rules for urgent care in Ohio.

## Sprint B (Week 2)

- Build WhatsApp conversation orchestrator service.
- Add doctor assignment service and Webex card dispatch.
- Add message relay workers (WhatsApp->Webex, Webex->WhatsApp).
- Add audit logging for case transitions and outbound messaging.

## 5) Operational and risk controls

- Maintain explicit architecture decision record for WhatsApp-primary mode.
- Track legal/compliance review outcomes before production pilot.
- Add safety overrides for emergency red flags and 911 guidance.
- Add queue retry + dead-letter handling for webhook/provider outages.

## 6) Success criteria for kickoff

- End-to-end simulated case can be created from WhatsApp message and routed to a doctor.
- Doctor reply from Webex arrives back in patient WhatsApp thread.
- Case can be closed and summary sent in WhatsApp.
- All webhook handlers enforce signature validation and idempotency.
