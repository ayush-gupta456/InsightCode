# Architecture

InsightCode combines a React/Vite frontend with an Express/TypeScript API. The frontend uses the same-origin `/api` proxy; Socket.IO polling provides review updates. See the README for the component diagram and `docs/DEPLOYMENT.md` for production topology.

## Frontend

`src/App.tsx` declares public routes and the authenticated workspace shell. Workspace routes lazy-load review, chart and integration views. `src/Landing.tsx` contains the marketing site and clearly labeled illustrative review. `src/auth-story.tsx` is the lightweight shared authentication companion; authentication does not import the entire landing module.

`ui.tsx`, `motion-ui.tsx`, `theme.tsx` and `status.tsx` provide shared components, restrained motion, theme state and recovery screens. Styles use shared semantic tokens with responsive rules. Monaco and diff tooling live in `editor.tsx` and load for review workflows.

## API and persistence

`server/app.ts` assembles validated routes. Signed access tokens, rotating refresh sessions, ownership checks and team roles govern access. `store.ts` uses MongoDB in production and a single-process JSON development driver otherwise. Users own projects, reviews, findings, conversations and proposed fixes; analytics derive from stored review data.

## Review pipeline

Bounded source input becomes an isolated review snapshot. Static rules and language helpers report evidence with source locations; indexing derives symbols/imports for context. Gemini can add optional analysis and assistance, with schema and evidence validation. Scores summarize detected findings and do not certify correctness.

Proposed changes are previewed as diffs and applied to snapshots only after approval. Reverts operate on those snapshots. GitHub publication is a separate, explicitly approved action with repository-head checks.

## Jobs and integrations

Redis/BullMQ enables queued review and webhook jobs. Webhook requests verify raw-payload signatures, enqueue before acknowledgement and use delivery IDs/retries. This supports at-least-once processing; do not claim exactly-once external effects.

Optional integrations include GitHub OAuth/imports/comments, Google sign-in and configured email delivery. Their availability depends on real provider configuration. External source transmission occurs when the associated AI/integration feature is enabled.

## Execution boundary

The API never directly executes submitted source. Optional Docker analyzers run with networking disabled, read-only roots, unprivileged users, timeouts and resource/output limits. Use a dedicated Docker-capable host and inspect `workers/` for the implemented tools.

## Scaling limits

Application locks and rate limits remain process-local. Use one API instance until distributed coordination and shared limits exist. Trust proxy addresses only through verified explicit IP/CIDR configuration. Production persistence, provider consent/delivery, workers and backup restoration require environment-specific verification.
