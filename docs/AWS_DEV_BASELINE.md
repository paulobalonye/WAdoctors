# AWS Dev Baseline (WhatsApp Bot + Webex Bridge)

This document defines the baseline dev deployment shape for WAdoctors on AWS.

## 1) Service topology

- `api` service (Express API + webhook handlers)
- `relay-worker` service (BullMQ worker)
- `postgres` (RDS PostgreSQL in AWS, local Postgres in Docker)
- `redis` (ElastiCache Redis in AWS, local Redis in Docker)

For local parity, use:

```bash
pnpm awsdev:up
```

This runs API + worker + Postgres + Redis from `docker-compose.aws-dev.yml`.

## 2) AWS dev target architecture

- ECS Fargate service: `wadoctors-api-dev`
- ECS Fargate service: `wadoctors-worker-dev`
- Application Load Balancer in front of API
- RDS PostgreSQL (`wadoctors_dev`)
- ElastiCache Redis
- Secrets Manager for:
  - `OPENAI_API_KEY`
  - `WHATSAPP_*`
  - `WEBEX_*`
  - `STRIPE_WEBHOOK_SECRET`
  - `JWT_SECRET`

## 3) API and webhook routing

- Public routes:
  - `/health`
  - `/api/v1/meta`
  - `/webhooks/whatsapp`
  - `/webhooks/webex`
  - `/webhooks/stripe`
- Restrict admin/doctor APIs behind auth + network controls.
- Keep webhook paths on HTTPS only; do not terminate on plain HTTP.

## 4) Webhook reliability controls (required)

- Signature verification for each provider (already implemented).
- Idempotency persistence for webhook deliveries (already implemented).
- Queue fallback and retries for relay dispatch (already implemented).
- Replay and retry operations from admin portal for incident recovery.
- Relay dead-letter alert state exposed via `GET /api/v1/admin/relay/health`.

## 5) Deploy order for dev

1. Provision RDS + Redis.
2. Deploy API task definition.
3. Run `pnpm prisma:deploy` against dev DB.
4. Deploy worker task definition.
5. Register/update webhook endpoints for WhatsApp + Webex.
6. Run drill runbooks:
   - `docs/RELAY_QUEUE_DRILL.md`
   - `docs/AI_TRIAGE_DRILL.md`

## 6) Webhook recommendations

- Keep provider secrets in Secrets Manager and rotate quarterly.
- Always preserve raw request body for signature validation.
- Do not add middleware that mutates webhook payload before verification.
- Alert on repeated signature failures and idempotency duplicate spikes.
