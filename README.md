# InsightCode

A React/Vite and Express/TypeScript code review workspace.

## Local setup

1. Install Node.js 22 and run `npm ci`.
2. Copy `.env.example` to `.env` and configure the integrations you need.
3. Run `npm run dev`. Open http://127.0.0.1:5173 and create an account.
4. Run `npm test` for API and analysis tests, `npm run build` for the frontend build, and `npx playwright test` for browser checks with the preview running and Chrome installed.

Local development persists data in `data/store.json`. Production requires MongoDB and a persistent JWT_SECRET. Do not commit `.env` or `data/`.

## Available workflows

Accounts with rotating refresh sessions; personal and team projects; pasted code, source file and bounded ZIP uploads; review history; evidence-based rule findings; Monaco source and diff views; approved snapshot patches and reverts; real review metrics; symbol indexing; optional Gemini review/chat/fixes; GitHub repository and PR imports; optional OAuth, encrypted credentials, approved PR comments and signed webhooks.

See [deployment](docs/DEPLOYMENT.md), [API](docs/API.md), and [completion status](docs/STATUS.md).
