# Maintenance review — 2026-11-06

## Changes

- Defer workspace pages and chart dependencies until a workspace route is opened.
- Replace authentication-wide user/session collection scans with targeted queries; index session hashes in MongoDB.
- Require subject, expiry and issued-at claims for access-token verification.
- Sanitize database duplicate-key responses so internal index details are not returned.
- Remove unused public-shell imports and obsolete landing-window CSS selectors; move Nodemailer type definitions to development dependencies.
- Rewrite the README to document actual features, deployment prerequisites, credential separation and limitations.

## Validation

Run production build, backend regressions, responsive/public browser checks and npm audit. Provider and MongoDB production behavior must be validated separately; local tests use the file-backed store. This is a bounded source review, not a penetration-test certification.

## Remaining constraints

- Monaco's editor chunk remains large, though it loads only for review pages.
- Rate limits currently use an in-memory store and the default Express proxy identity. Configure a verified trusted proxy boundary and shared limits before multi-instance production; do not blindly enable trust proxy.
- Local locks are process-scoped; a multi-instance deployment needs atomic account/update operations.
- External Gmail delivery, OAuth account consent and Docker execution need live integration checks.
- CSS contains historical responsive overrides. Only confirmed unused selectors were removed; broader consolidation needs visual coverage to avoid removing live states.

## Repository About settings

Description: Private code-review workspace with source-backed findings, optional Gemini assistance, GitHub integration, and approved snapshot fixes.

Website: https://insightcode.vercel.app

Topics: code-review, static-analysis, developer-tools, typescript, react, vite, express, gemini, github-integration

These are intended repository metadata values, not a claim that remote settings have been updated.

## Measured results from this review

- Production entry JavaScript decreased from 940.52 kB (290.79 kB gzip) to 543.61 kB (175.13 kB gzip): about 42% less raw entry code and 40% less transferred gzip data. This is a bundle-size comparison, not a measured page-load speed claim.
- Production build and TypeScript checks passed.
- Existing 19 backend tests passed; the added mandatory-token-claims regression also passed.
- npm audit reported zero known vulnerabilities for production dependencies at review time.
- Remote About updates could not be applied: the connector has no settings action, the GitHub CLI is absent, and browser control failed to initialize.
