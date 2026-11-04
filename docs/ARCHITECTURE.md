# Architecture and implementation plan

## Inspection

The workspace contains an unborn Git repository. Its configured origin, https://github.com/ayush-gupta456/InsightCode.git, returns no refs; the GitHub contents API confirms it is empty. No source, environment configuration, existing Gemini integration, models or deployment configuration exists to preserve. The deployed URL could not be fetched by the research tool. The user explicitly authorized a new application here.

## Implementation sequence

1. Establish a typed React/Vite interface and Express API, validation, authentication and durable storage.
2. Deliver the code-review vertical slice: projects, pasted code, text files, bounded ZIP import, deterministic evidence-based analysis, optional Gemini enrichment, review workspace and history.
3. Add repository indexing, GitHub read integration, conversations, patch preview/approval/revert and actual analytics.
4. Verify security boundaries, integration behavior and builds; document the exact completion status and remaining infrastructure work.

## Boundaries

Browser -> same-origin /api -> Express -> persistence and analysis services. All external input is validated. Authentication uses short-lived signed bearer tokens. Local storage is single-process JSON for development; MongoDB persistence, optional BullMQ, OAuth, refresh rotation and team roles are implemented. Production integration verification and distributed concurrency controls remain required. The API never executes submitted code directly; optional Docker workers execute bounded checks. Rules report hotspots, not verified exploitable vulnerabilities. Generated fixes are only applied to stored review snapshots after explicit approval; no Git writes are performed.

## Data

Users own projects, reviews, conversations and fixes. Every object route checks ownership. Reviews retain source snapshots, findings, logs and deterministic scores. Metrics derive from stored reviews; empty accounts have zero values.

## Research

- https://ai.google.dev/gemini-api/docs/structured-output — JSON schema responses still need semantic validation.
- https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries — verify the raw payload with HMAC SHA-256 and constant-time comparison.

## Deployment direction

Vercel for static frontend; private Node service behind TLS for API; MongoDB Atlas, Redis/BullMQ and a dedicated Docker worker tier for production. Do not execute source on the API host. Configured analyzer execution uses short-lived, network-disabled containers with read-only roots, unprivileged users, memory/CPU/PID limits, timeouts and bounded output. Never run repository scripts to inspect uploaded code.
