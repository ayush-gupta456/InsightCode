# Review remediation - 2026-11-16

## Implemented

- A single Findings destination with category, severity and status filters. Existing /app/security links redirect to the Security hotspots filter.
- Contextual AI remains in review workspaces; PR selection is reached through the GitHub import form. Existing assistant and PR URLs remain supported.
- Workspace search accurately describes its page/review scope, labels its input and reports empty results and request errors.
- Shared keyboard skip link, visible focus treatment, active-navigation marker, minimum mobile control sizes and reduced-motion CSS.
- Motion page transitions use opacity and transforms; the root MotionConfig respects the OS preference.
- Notification refresh reduced to a two-minute fallback. Completion events still invalidate notifications immediately.
- Explicit trusted-proxy address/CIDR configuration; boolean and numeric hop-count trust are rejected.
- GitHub webhook processing is enqueued in Redis/BullMQ before acknowledgement. Five exponential retries, stable delivery job IDs and subscription checkpoints reduce duplicate processing. Automatic re-review refuses to enable without Redis.
- Frontend response configuration adds framing protection, MIME sniffing protection, referrer policy and restricted unused device permissions.
- Basic search/social metadata and more accurate project-visibility and GitHub publication wording.

## Remaining operational work

- Run exactly one API instance. Rate limits and conflicting-write locks remain process-local. Multiple instances require shared rate limits and atomic database operations; a Redis job queue alone does not solve this.
- Verify trusted proxy addresses and ingress restrictions on the actual host. Do not assume a provider's forwarded headers are trustworthy.
- Verify the deployed Redis worker, failed-job monitoring, OAuth providers, email delivery and isolated Docker image. Source configuration is not proof of availability.
- Webhook processing is at least once. A crash between review submission and saving the checkpoint can still duplicate a review. Delivery records need an operational retention policy.
- Monaco and shared chart-page bundles still need current measurements before further optimization. Existing historical bundle measurements are not new results.
- No license was selected on the owner's behalf. A license and legal service terms require an owner decision.

## Validation

git diff --check passed. npm ci failed with Windows EPERM directory-creation errors; offline installation also failed because required packages are not cached. A separate validation checkout was blocked by directory permissions. The later pre-push review also attempted npm run build and npm test; they could not start because tsc and tsx are unavailable. Dependency audit and live visual verification could not be completed. These changes are unverified and must pass those checks before release.

Pre-push source review corrected the visible search label and moved the completion event after notification persistence so clients can immediately retrieve the notification.
