# Responsive interface and recovery states

Implemented locally on 2026-11-16:

- Public navigation uses a deliberate two-row layout below 1000px, then a full-width primary action below 480px. Links do not wrap inside labels.
- Hero typography and spacing scale with the viewport. Safeguard items wrap as semantic list entries instead of broken separator characters.
- Preview code scrolls within its panel. Phone workspace panels stack, dialogs are bounded by dynamic viewport height, and touch controls retain their hit areas.
- Initial HTML includes a branded loading state before React loads. Session restoration, lazy page imports, data loading and editor initialization share branded loading UI. No artificial loading delay or fake percentage is introduced.
- Missing routes use a custom 404 with a home action. Render failures and rejected lazy imports show a recovery screen with reload/home actions. Route-level boundaries preserve workspace navigation and reset on route changes.
- Root MotionConfig and CSS respect reduced motion. Storage restrictions no longer prevent theme initialization.
- Monaco respects theme changes; comparisons switch from side-by-side to inline below 900px.

Validation: relative source imports resolve, responsive CSS braces balance, and git diff --check passes. Build and unit test commands were attempted but cannot start without tsc/tsx. Dependency installation was retried and stopped after making no observable progress; dependencies remain unavailable. Browser coverage was extended to 320, 390, 625, 768, 955, 1024, 1440 and 1920px, plus 404 recovery and reduced-motion session loading; execution remains pending until dependencies/browser are available. No claim of visual verification or universal device coverage is made.
