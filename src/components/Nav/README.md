# Menu layout experiment

`menu-layout-v1` compares the existing main menu (A, from `public/pages.json`) with the grouped menu (B, from `menuVariant.ts`). A aligns Equities child labels to the parent text. B groups destinations and adds Rewards to Tools. The current page’s group opens automatically, including after refresh; visitors can open another group or collapse it, with at most one group open at a time. Premium, pinned pages, personal dashboards, Old Menu, and footer destinations stay available in both variants.

The experiment reuses the site's persistent 50/50 `defillama-ab-group` assignment, established by the proxy and `_app`. It does not rerandomize on navigation. Both layouts are server-rendered; the head bootstrap's `data-ab-group` attribute selects the matching layout with the existing A/B CSS before paint. The fallback when assignment is unavailable is A. This shares cohorts with existing site experiments; it is not an independent randomization.

## Events

`menuAnalytics.ts` sends the generic ingestion contract through the shared helpers in `src/utils/analytics/experiment.ts`, where `menu-layout-v1` is registered as a `site` experiment that reads `data-ab-group`. It does not depend on an A/B tag:

- `experiment-exposure`: `{ experiment: 'menu-layout-v1', variant: 'a' | 'b', layout: 'desktop' | 'mobile' }`.
- `experiment-action`: the same context plus `metric`.

An exposure requires the actual navigation to intersect the viewport while the document is visible. The hidden desktop layout and closed mobile drawer do not count. Exposure is deduplicated once per tab session by the shared helper, using session storage and an in-memory fallback when storage is blocked. Rerenders, route changes, StrictMode, drawer reopening, and switching between mobile and desktop do not add exposures. `layout` on the exposure identifies the first visible menu; each action uses its current layout.

Metrics distinguish destinations from other interactions:

- `navigate:/chains`, `navigate:/cexs`, etc. The same destination has the same metric in A and B, regardless of its label or grouping.
- `navigate:chainlist.org`, `navigate:swap.defillama.com`, etc. for external destinations.
- `group-open:tools`, `group-close:tools`, etc. for disclosure clicks, including keyboard activation.
- `action:close-navigation-menu`, `action:toggle-theme`, etc. for named buttons inside the navigation.

Queries and fragments are excluded, and personal dashboard routes are normalized to `/pro/:dashboard`. Repeat actions are retained. Left/keyboard clicks and middle-click links count; right-clicks and disabled controls do not. Existing feature-specific link events remain intact. Events wait in order for the lazy Umami script, including exposure before an early action; analytics never blocks navigation.

Use `navigate:` metrics to compare navigation engagement; group toggles are interaction breakdowns, not destination conversions. Generic ingestion accepts production events only from `defillama.com` and `www.defillama.com`, hourly at :30. Local preview events are not ingested. No backend registration is needed.

## Verification

`bun run test src/components/Nav/__tests__/menuExperiment.test.tsx` covers server hydration, A/B menu contents, disclosure state, visibility, per-session deduplication, late Umami loading, mobile navigation, and blocked storage. Browser checks cover both variants on desktop and at 375px in light/dark mode.
