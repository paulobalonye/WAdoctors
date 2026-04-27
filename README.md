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

5. Run migrations and seed bootstrap users:

```bash
pnpm prisma:migrate --name init
pnpm prisma:seed
```

6. Start dev server:

```bash
pnpm dev
```

7. Optional: run relay worker when `RELAY_DISPATCH_MODE=queue`:

```bash
pnpm worker:relay
```

8. Open portals:

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
- `GET /api/v1/admin/cases`
- `GET /api/v1/admin/cases/:caseId`
- `GET /api/v1/admin/cases/:caseId/messages`
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

## Portal auth

Primary mode:
- `POST /api/v1/auth/login` returns JWT token for `ADMIN` and `DOCTOR`.
- Portal requests send `Authorization: Bearer <token>`.

Development fallback (enabled by `ALLOW_DEV_HEADER_AUTH=true`):

- `x-user-role: DOCTOR` or `x-user-role: ADMIN`
- `x-user-id: <doctor-or-admin-id>`

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

## Next implementation steps

1. Add dead-letter monitoring dashboards and queue alerting.
2. Add calendar-based shifts and holiday overrides for doctor availability.
3. Disable header fallback in staging/prod (`ALLOW_DEV_HEADER_AUTH=false`) and enforce JWT-only portal access.
4. Add first Prisma migration set and seed pipeline.
