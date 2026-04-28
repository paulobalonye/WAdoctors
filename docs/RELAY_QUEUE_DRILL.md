# Relay Queue Drill Runbook

This runbook validates queue-mode reliability for the WhatsApp bot + Webex bridge.

## Preconditions

1. Local infra running:
   - `pnpm db:up`
2. Queue mode started:
   - `pnpm dev:queue`
3. Admin auth available:
   - JWT or dev headers (`x-user-role: ADMIN`, `x-user-id: <admin-id>`)

## 1) Confirm integration readiness

Request:

```bash
curl -s http://127.0.0.1:3000/api/v1/admin/integrations/status \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: <admin-id>"
```

Expected:
- `relay.dispatchMode` is `queue`
- `relay.ready` is `true`

## 2) Inject a predictable failed relay job

Request:

```bash
curl -s http://127.0.0.1:3000/api/v1/admin/relay/dev/inject-failure \
  -X POST \
  -H "content-type: application/json" \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: <admin-id>" \
  -d '{"direction":"PATIENT_TO_WEBEX","caseId":"case-drill-001"}'
```

Expected:
- `ok: true`
- a `jobId` is returned

## 3) Inspect failed jobs for the drill case

Request:

```bash
curl -s "http://127.0.0.1:3000/api/v1/admin/relay/failed?limit=50&name=PATIENT_TO_WEBEX&caseId=case-drill-001" \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: <admin-id>"
```

Expected:
- `ok: true`
- `totalMatched >= 1`

## 4) Retry targeted Webex failures for the same case

Request:

```bash
curl -s http://127.0.0.1:3000/api/v1/admin/relay/failed/retry-webex \
  -X POST \
  -H "content-type: application/json" \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: <admin-id>" \
  -d '{"limit":50,"caseId":"case-drill-001"}'
```

Expected:
- `ok: true` or `ok: false` with detailed `failures`
- `matched` reflects the targeted case scope

## 5) Verify queue health after retry

Request:

```bash
curl -s "http://127.0.0.1:3000/api/v1/admin/relay/health?failedLimit=50" \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: <admin-id>"
```

Expected:
- `queueReachable: true`
- `alertState` reflects queue risk (`warning`/`critical` when failed backlog persists, `ok` when resolved)
- failed counts trend down after successful remediation

## 6) Cleanup (optional)

Request:

```bash
curl -s http://127.0.0.1:3000/api/v1/admin/relay/failed/clear \
  -X POST \
  -H "content-type: application/json" \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: <admin-id>" \
  -d '{"limit":200,"graceSeconds":300}'
```

Use this only after confirming drill results have been recorded.
