# Compliance Ownership (Dev Through Launch)

This is the ownership baseline for HIPAA/privacy/security compliance work.

## Accountability model

- **Compliance Owner (business owner):** final sign-off on policy and risk acceptance.
- **Security Engineer (technical owner):** controls implementation, security reviews, and incident process.
- **Backend Lead (implementation owner):** enforces technical safeguards in API, webhooks, and data paths.
- **Clinical Operations Lead:** triage protocol governance and escalation procedure approval.
- **Legal/Privacy Counsel:** BAA review, privacy notice, retention/legal posture.

## Who designs compliance?

Compliance is **cross-functional**:
- Security + backend design and implement controls.
- Compliance/legal define policy requirements and approval gates.
- Product/operations ensure workflows follow approved policy.

No single engineer should unilaterally define compliance policy.

## Minimum launch checklist (Ohio pilot)

1. Signed BAAs with relevant vendors (OpenAI usage posture decided and documented).
2. Written data retention + deletion policy for messages and audit logs.
3. Access control policy for admin and doctor portals.
4. Incident response runbook and escalation contacts.
5. Quarterly secret rotation policy for webhook and API credentials.
6. Audit trail coverage for case status, assignment, and replay actions.
7. Risk acceptance record signed by accountable business owner.
