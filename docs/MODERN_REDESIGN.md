# InsightCode product redesign

## Design and implementation

The public site introduces a split hero, source-to-decision diagram, interactive review example, three-step workflow, capability grid and a final workspace CTA. The example is labeled illustrative; it never impersonates live repository data. Source, Finding and Proposed patch tabs support arrow keys, Home and End.

Shared graphite/violet and light-theme tokens cover the workspace shell, dashboards, project cards, findings, tables, forms, review tools, dialogs, loading and recovery screens. Authentication and password recovery use a consistent split layout on wide screens and a focused single-column form on smaller screens. Mobile public navigation uses the existing accessible Radix dialog.

Motion uses the existing `motion/react` dependency: brief one-time reveals, tab-indicator movement, crossfades and theme transitions. Original Lucide-based animated icons respond to hover, keyboard focus and presses. Reduced-motion users get static transforms. No new production library, icon pack, paid component or skill installation is claimed.

The dashboard no longer repeats its primary review CTA in the welcome banner. Existing application routes, API operations and GitHub approval boundaries are retained. The landing route is lazy loaded. Dialogs restore keyboard focus to the opening control, and theme indicators use instance-specific IDs.

## Validation

- `npm run build`: passes, including full TypeScript checking and Vite production output.
- `node --import tsx --test tests/*.test.ts`: 19 passed, 1 Java-runtime test skipped, 0 failures.
- `git -c core.whitespace=cr-at-eol diff --check`: passes; existing files retain repository CRLF endings.
- Playwright coverage includes widths 320–1920, theme persistence, auth forms, example-tab keyboard behavior, mobile menu focus restoration, reduced motion and custom recovery states. Browser checks could not execute here: Chromium startup fails because this execution environment disallows its socket operation. The connected cloud browser cannot reach the local preview. These are unverified checks, not passing tests.
- Vite still reports the pre-existing large Monaco review chunk; it is separate from the landing route. No live-backend, real-GitHub integration or device-performance validation is claimed.

Run the UI checks in an environment with Chrome available:

```sh
npx vite --host 127.0.0.1 --port 5173
npx playwright test e2e/auth.spec.ts e2e/public-experience.spec.ts e2e/responsive.spec.ts e2e/redesign.spec.ts
```

For an alternate installed Chromium executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its absolute path. Screenshots and traces are written under `test-results/`.
