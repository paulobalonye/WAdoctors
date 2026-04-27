# AI Triage Drill (Dev)

Use this runbook to validate AI-assisted triage behavior for the WhatsApp bot stack in development.

## 1) Preconditions

- API running (`pnpm dev` or `pnpm dev:queue`)
- Admin auth available (JWT or dev headers)
- `OPENAI_API_KEY` set when testing live AI model behavior
- Optional: `AI_TRIAGE_ENABLED=true` (AI also auto-enables when key is present)

## 2) Confirm integration readiness

```bash
curl -s http://127.0.0.1:3000/api/v1/admin/integrations/status \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: <admin-id>"
```

Check `aiTriage.ready=true` when OpenAI credentials are configured.

## 3) Evaluate sample triage inputs (no case creation)

```bash
curl -s http://127.0.0.1:3000/api/v1/admin/triage/evaluate \
  -X POST \
  -H "content-type: application/json" \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: <admin-id>" \
  -d '{
    "patientState": "OH",
    "messageText": "I have chest pain and shortness of breath"
  }'
```

Validate:
- `triage.source` (`AI` or `HEURISTIC`)
- `triage.route`
- `triage.urgencyScore` and `triage.baselineUrgency`
- `triage.redFlags`

## 4) Send live WhatsApp test message

Send a real patient-style WhatsApp message through your configured webhook flow.  
Then verify in Admin/Doctor portal:

- Case row shows triage source + route
- Selected case shows confidence and red flags
- Case thread includes initial `Triage note: ...` system message

## 5) Check triage analytics panel/API

```bash
curl -s "http://127.0.0.1:3000/api/v1/admin/triage/summary?windowHours=24&limit=100" \
  -H "x-user-role: ADMIN" \
  -H "x-user-id: <admin-id>"
```

Validate:
- source counts (AI vs HEURISTIC)
- route distribution
- confidence bands
- top red flags

## 6) Expected fallback behavior

If OpenAI is unavailable, triage should still proceed via heuristic baseline:
- Cases continue to be created and routed
- `triage.source` may become `HEURISTIC`
- Safety floor ensures urgency is never reduced below heuristic baseline
