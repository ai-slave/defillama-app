# Rewards ranking and analytics

Rewards places public, published programs with positive integer `featured_rank` values first, then ranks the rest by exact canonical project-page views over the backend's 90-day window. The API currently publishes editor ranks as strings. Missing ranks fall through to popularity; invalid or duplicate ranks fail page generation rather than publishing an ambiguous order. The backend adds `project_path` to `/rewards` and publishes `rewards-popularity.json` on the datasets host. Row names, internal links, CEX link suppression, and outbound destinations remain independent of ranking identity. Programs for one project share its count.

Deploy the backend contract and first snapshot before this frontend. `getRewardsPageData` requires the snapshot; a failed ISR refresh throws so Next retains the previous generated page, rather than publishing a new partially ranked page. After featured programs, the server sorts by page views with alphabetical ties, placing unmeasured projects after measured zeroes. Ranks and counts are never included in page props. The client uses the supplied order initially, with optional local header sorting. Reset restores server order. Sort/order URL parameters are ignored; filters remain URL-driven. Search and pagination remain local. There are no fee/TVL requests or rankings in this feature.

The server rejects catalog records that omit `project_path` so an old backend payload cannot silently remove popularity ranking. Explicit `null` remains valid for unresolved projects.

## Analytics

Set server environment `REWARDS_ANALYTICS_MODE` to `off` (default), `test`, or `production`. This non-secret mode is passed to the page through ISR props; changing it requires page regeneration or deployment. Use test mode during internal QA. Production mode sends events only on `defillama.com` or `www.defillama.com`.

Events:

- `rewards-program-impression`: one per program per tab session, deduplicated with `sessionStorage` and an in-memory set.
- `rewards-outbound-click`: every deliberate activation of a program's Open button, including middle-click. No client-side repeat-click suppression.
- Test mode prefixes both names with `rewards-test-` instead of `rewards-`, with separate impression storage keys.

Both events carry `program_id` and nullable `project_path`. They do not include referral URLs, search text, or source links. One shared IntersectionObserver measures the Open buttons, requiring 50% visibility for one continuous second while the document is visible. Clicks also establish an impression if the dwell threshold has not been reached. Changing table pages replaces the observer targets but preserves deduplication. Tracker delivery is best-effort; blocked analytics never prevents navigation. If storage is unavailable, deduplication lasts only for the current mounted page.

Observation starts immediately, independently of the lazy Umami script. Early impressions and clicks wait in a page-local queue; the script's `onReady` signal flushes them without a polling timeout. Filtering and pagination retain that queue. Only dispatched impressions are persisted in session storage. Leaving the Rewards page or closing the tab before the script becomes ready discards queued events; this is not a durable delivery queue. Umami timestamps queued events when they are dispatched.

Before launch, verify test events in a foreground browser and their property aggregation in Umami. Enable production mode and record the public launch timestamp separately. Staff should disable their own Umami tracking. Do not use test events or pre-launch traffic for ranking.

Clicks are not used in ranking yet. Before introducing click-through ranking, verify compatible unique-click and exposure aggregation: raw click totals divided by tab-deduplicated impressions are not a unique-session click-through rate. Retain raw clicks for that later analysis.
