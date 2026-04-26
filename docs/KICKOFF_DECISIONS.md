# Kickoff Decisions

Date: April 26, 2026

## Confirmed

- Repository: `github.com/paulobalonye/WAdoctors`
- Package manager: `pnpm`
- Cloud environment: AWS `dev`
- Base domain (current): `wadoctors.com`
- Dev API domain: `api-dev.wadoctors.com`
- Launch state: `OH` (Ohio)
- Clinical v1 scope: urgent care only
- Architecture mode: `WHATSAPP_PRIMARY` (full consultation chat in WhatsApp)
- PHI channel mode: `WHATSAPP_AND_WEBEX`
- Backend stack: Node.js + PostgreSQL

## Compliance signer note

The compliance signer is the person accountable for approving HIPAA/security decisions before pilot or launch.

Interim recommendation:
- Signer: Founder/owner (`Paulo`) until a dedicated compliance lead is assigned.
- Risk acceptance noted for WhatsApp-primary consult architecture: `2026-04-26`.

Before pilot:
- Add external HIPAA/compliance reviewer and record final sign-off in the release checklist.
