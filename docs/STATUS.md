# Project status

InsightCode implements the review workflow, authentication/recovery, projects, team roles, source indexing, optional Gemini assistance and configured GitHub integrations. Source input becomes an isolated snapshot; proposed changes and repository publication require explicit actions.

The modern interface is developed on the redesign branch. A successful build and Vercel preview build were recorded for that branch; production appearance may differ. Browser verification remains pending where the execution environment cannot launch Chromium or access the protected preview.

## Deployment prerequisites

Use MongoDB and stable secrets in production. Redis is required for durable webhook ingestion and subscriptions. Configure OAuth, email, Gemini and Docker analyzers individually and verify each external integration with real services.

## Remaining constraints

- Locks and rate-limit storage are process-local; retain one API instance until distributed coordination is implemented.
- Webhook processing is at least once; an external-side-effect crash window remains.
- Static rules, scores and AI output support review and are not correctness or security certifications.
- The Monaco editor bundle is large and loads for review pages.
- Production proxy identity, backups, provider delivery, Docker execution and browser/device behavior need deployment-specific validation.
- Paid subscription/payment collection is not implemented.

Use [deployment documentation](DEPLOYMENT.md), [architecture](ARCHITECTURE.md) and [review validation](REVIEW_VALIDATION.md) for current boundaries. Earlier audit files are historical records rather than current readiness certificates.
