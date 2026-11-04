# Deployment

The frontend builds to `dist/` with `npm run build`. Host this directory on Vercel with an SPA fallback to index.html. Proxy `/api` and `/socket.io` to the Node service; WebSocket forwarding is required for live updates. Keep cookies on the same public site. Set FRONTEND_ORIGIN and PUBLIC_API_ORIGIN to the public HTTPS origin.

Run the API with `npm start` on a persistent Node 22 host. Set NODE_ENV=production, MONGODB_URI, JWT_SECRET (32 or more random characters), HOST=0.0.0.0 and PORT. Configure TLS at the reverse proxy. Restrict MongoDB and Redis to private network access. REDIS_URL enables BullMQ. Use one API instance: write locking and webhook deduplication are currently process-local. Horizontal scaling requires distributed concurrency controls.

## Gemini
Set GEMINI_API_KEY and GEMINI_MODEL to an available model in your account. AI is opt-in for source analysis. Live provider calls require credentials and have not been verified in this environment.

## GitHub
Create an OAuth application with callback `${PUBLIC_API_ORIGIN}/api/github/callback`. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and INTEGRATION_ENCRYPTION_KEY (base64-encoded 32 random bytes). Connect from Settings. Public reads need no connection. Private repository permissions and publishing permissions are requested explicitly.

Configure a repository pull_request webhook at `/api/github/webhook`, with the same secret as GITHUB_WEBHOOK_SECRET. Enable private re-review from a PR review. Webhook imports currently run within the request and need a durable webhook ingestion queue for large repositories and reliable production retries.

## Analyzer workers
Build `docker build -f workers/Dockerfile -t insightcode-analyzers .`, then set ANALYZER_IMAGE=insightcode-analyzers. The supplied image includes ESLint, TypeScript syntax checks, Ruff and Bandit. The other adapter names require a custom image containing their executables and trusted rules under `/opt/rules`; OSV also needs an offline database. Do not enable unavailable analyzers.

Containers use no network, an unprivileged user, read-only source and root filesystem, bounded scratch space, CPU/memory/PID limits and execution timeouts. Run this service on a dedicated worker host before handling arbitrary public submissions. Docker is required; the worker image was not built or exercised in this environment.

## Operations
Monitor `/api/health`, API process logs, failed review logs, queue failures, disk use and database availability. Configure encrypted backups and test restoration before launch. Keep integration encryption keys backed up separately. Review data retention, account recovery, abuse protection and dependency updates before public launch. No cloud resources have been provisioned or deployed by this project.
