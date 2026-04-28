# WAdoctors API

WhatsApp-bot-first telemedicine backend baseline using Node.js, Express, PostgreSQL, Prisma, Redis, and BullMQ.

## Stack

- Node.js 22 LTS
- pnpm
- Express + TypeScript
- PostgreSQL 15+
- Prisma ORM
- Redis + BullMQ

## Kickoff decisions (locked)

- Base domain: `wadoctors.com`
- Dev API base URL: `https://api-dev.wadoctors.com`
- Launch state: `OH` (Ohio)
- Clinical v1 scope: urgent care only
- Architecture mode: WhatsApp-primary consultation (`Option 2`)
- PHI channel mode: WhatsApp + Webex

## Getting started

1. Copy env file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pnpm install
```

3. Generate Prisma client:

```bash
pnpm prisma:generate
```

4. Start local data services (PostgreSQL + Redis):

```bash
pnpm db:up
```

Default local ports:
- PostgreSQL: `127.0.0.1:5433`
- Redis: `127.0.0.1:6380`

5. Run migrations and seed bootstrap users:

```bash
pnpm prisma:deploy
pnpm prisma:seed
```

6. Run automated tests:

```bash
pnpm test
```

7. Start dev server:

```bash
pnpm dev
```

8. Optional: run relay worker when `RELAY_DISPATCH_MODE=queue`:

```bash
pnpm worker:relay
```

For local queue-mode workflow (API + relay worker together):

```bash
pnpm dev:queue
```

For Docker-based AWS-dev parity (API + worker + Postgres + Redis):

```bash
pnpm awsdev:up
```

Portal URLs in Docker mode:
- `http://localhost:38080/portal/admin.html`
- `http://localhost:38080/portal/doctor.html`
- `http://localhost:38080/portal/index.html`

The Docker API container runs `prisma deploy` and `prisma seed` on startup, so bootstrap admin/doctor users are available for login.

9. Open portals:

- `http://localhost:3000/portal/index.html`
- `http://localhost:3000/portal/doctor.html`
- `http://localhost:3000/portal/admin.html`

## Current endpoints

- `GET /health`
- `GET /api/v1/meta`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /webhooks/whatsapp` (verification)
- `POST /webhooks/whatsapp`
- `POST /webhooks/webex`
- `POST /webhooks/stripe`
- `GET /api/v1/doctor/me`
- `GET /api/v1/doctor/cases`
- `GET /api/v1/doctor/cases/:caseId/messages`
- `POST /api/v1/doctor/cases/:caseId/messages`
- `POST /api/v1/doctor/cases/:caseId/close`
- `GET /api/v1/admin/overview`
- `GET /api/v1/admin/integrations/status`
- `GET /api/v1/admin/cases`
- `GET /api/v1/admin/cases/:caseId`
- `GET /api/v1/admin/cases/:caseId/messages`
- `POST /api/v1/admin/cases/:caseId/replay`
- `PATCH /api/v1/admin/cases/:caseId/status`
- `PATCH /api/v1/admin/cases/:caseId/assign`
- `GET /api/v1/admin/doctors`
- `POST /api/v1/admin/doctors`
- `PATCH /api/v1/admin/doctors/:doctorId/active`
- `PATCH /api/v1/admin/doctors/:doctorId/kyc`
- `PATCH /api/v1/admin/doctors/:doctorId/password`
- `PATCH /api/v1/admin/doctors/:doctorId/schedule`
- `POST /api/v1/admin/admin-users`
- `GET /api/v1/admin/webhooks`
- `GET /api/v1/admin/webhooks/summary`
- `GET /api/v1/admin/triage/summary`
- `POST /api/v1/admin/triage/evaluate`
- `GET /api/v1/admin/relay/health`
- `GET /api/v1/admin/relay/failed`
- `POST /api/v1/admin/relay/failed/:jobId/retry`
- `POST /api/v1/admin/relay/failed/retry`
- `POST /api/v1/admin/relay/failed/retry-webex`
- `POST /api/v1/admin/relay/failed/retry-whatsapp`
- `POST /api/v1/admin/relay/failed/clear`
- `POST /api/v1/admin/relay/dev/inject-failure` (non-production only)

Relay retry request bodies may include optional `caseId` for targeted retries.
`GET /api/v1/admin/relay/failed` accepts `limit` plus optional `name` (`PATIENT_TO_WEBEX` or `DOCTOR_TO_WHATSAPP`) and `caseId` filters.
`GET /api/v1/admin/cases` accepts optional triage filters: `triageSource` (`AI`/`HEURISTIC`) and `triageRoute`.
`GET /api/v1/doctor/cases` accepts optional triage filters: `triageSource` (`AI`/`HEURISTIC`) and `triageRoute`.
`POST /api/v1/admin/triage/evaluate` accepts `messageText` plus optional `patientState` for simulation.
`/api/v1/admin/relay/dev/inject-failure` is for non-production queue-mode drills and accepts `direction` + optional `caseId`.
`POST /api/v1/admin/cases/:caseId/replay` supports manual relay replay with body `{ "direction": "PATIENT_TO_WEBEX" | "DOCTOR_TO_WHATSAPP", "messageId?": "<optional>" }`.
`GET /api/v1/admin/relay/health` now includes queue alert state (`ok`/`warning`/`critical`) and active alert details for dead-letter/backlog conditions.
Doctor availability schedule payloads support legacy weekday windows and enhanced calendar config:
- `timezone` (IANA zone, defaults to `America/New_York`)
- `weekly` map with single or split shifts per day
- `holidays` overrides by `YYYY-MM-DD` (`isOff` or custom `windows`)
Queue drill steps are documented in `docs/RELAY_QUEUE_DRILL.md`.
AI triage drill steps are documented in `docs/AI_TRIAGE_DRILL.md`.
AWS dev deployment baseline is documented in `docs/AWS_DEV_BASELINE.md`.
Compliance ownership baseline is documented in `docs/COMPLIANCE_OWNERSHIP.md`.

AI triage can be enabled with:
- `OPENAI_API_KEY=<key>` (auto-enables AI triage)
- Optional explicit flag: `AI_TRIAGE_ENABLED=true`
- Optional model/prompt/threshold/timeout overrides:
  - `OPENAI_TRIAGE_MODEL`
  - `OPENAI_TRIAGE_PROMPT_VERSION`
  - `OPENAI_TRIAGE_MIN_CONFIDENCE`
  - `OPENAI_TRIAGE_TIMEOUT_MS`

When enabled, AI urgency is blended with a safety floor from the existing keyword heuristic (never lower than baseline), and fallback stays active if AI is unavailable.

Relay queue alert thresholds can be tuned with:
- `RELAY_ALERT_PENDING_WARNING`
- `RELAY_ALERT_PENDING_CRITICAL`
- `RELAY_ALERT_FAILED_WARNING`
- `RELAY_ALERT_FAILED_CRITICAL`
- `RELAY_ALERT_OLDEST_FAILED_MINUTES_WARNING`
- `RELAY_ALERT_OLDEST_FAILED_MINUTES_CRITICAL`

## Portal auth

Primary mode:
- `POST /api/v1/auth/login` returns JWT token for `ADMIN` and `DOCTOR`.
  - Request body accepts either `role` (`ADMIN`/`DOCTOR`) or `portal` (`admin`/`doctor`).
- Portal requests send `Authorization: Bearer <token>`.

Development fallback (enabled by `ALLOW_DEV_HEADER_AUTH=true`):

- `x-user-role: DOCTOR` or `x-user-role: ADMIN`
- `x-user-id: <doctor-or-admin-id>`

Safety guard:
- Header fallback is automatically disabled when `APP_ENV=staging` or `APP_ENV=production`, even if `ALLOW_DEV_HEADER_AUTH=true`.

## Implemented in kickoff

1. Signature verification for WhatsApp, Webex, and Stripe webhooks.
2. Webhook idempotency registration in PostgreSQL (`WebhookEvent`).
3. Consultation state machine with persisted transitions and audit records.
4. WhatsApp ingress processor with patient/case/message persistence.
5. Webex ingress processor with doctor-message relay back to WhatsApp.
6. Relay clients for WhatsApp Cloud API and Webex API.
7. Automatic doctor assignment for `ASSIGNED` cases.
8. Dedicated Webex room provisioning per case with initial case summary post.
9. Relay queue infrastructure with BullMQ + Redis and worker process.
10. Doctor portal and admin portal API foundations with role-based route guards.
11. Doctor portal and admin portal frontend pages served by the backend app.
12. JWT login flow for Doctor and Admin portals with optional dev-header fallback.
13. Docker-based local Postgres/Redis and Prisma seed pipeline for bootstrap users.
14. Doctor assignment now respects schedule availability and max concurrent case limits.
15. Baseline Prisma migration checked in at `prisma/migrations/20260426180000_init`.
16. AI-assisted triage scoring path added (OpenAI-backed, feature-flagged, heuristic fallback).
17. AI triage metadata is persisted on new cases (`aiSummary` + structured `aiTranscript`) and shown in admin/doctor case context.
18. Admin and doctor case-list payloads now include normalized `triage` objects for source, route, confidence, red flags, and summary.
19. Webex case-room bootstrap message now includes triage context (source, route, confidence, red flags, summary).
20. Admin triage insights summary endpoint and portal panel for source/route/confidence/red-flag monitoring.
21. Admin and doctor case tables now show triage source/route, and doctor case list can be filtered by triage source.
22. Admin case list now supports triage source and triage route filters via API and portal controls.
23. Admin triage evaluator endpoint + portal tool for rapid sample-message triage simulation.
24. Doctor case list now supports both triage source and triage route filters via API and portal controls.
25. Relay queue dedupe keys now prevent duplicate queue jobs for the same source message.
26. Webhook processors now include loop/echo guards for relayed content patterns.
27. Admin replay-by-case endpoint added for controlled relay recovery actions.
28. Dockerized AWS-dev baseline added (API + worker + Postgres + Redis).
29. Relay queue health now emits dead-letter alert severity (`ok`/`warning`/`critical`) with actionable queue alert details in API and admin portal.
30. Doctor availability now supports calendar-style split shifts and holiday overrides (with validation on admin create/update schedule flows).

## Next implementation steps

1. Add a visual doctor schedule editor in admin portal (replace raw JSON prompt workflow).
2. Add webhook signature-failure and duplicate-event alerting panels in admin portal.
3. Add staged go-live rehearsal checklist (webhooks, relay queue, AI triage, rollback path).
