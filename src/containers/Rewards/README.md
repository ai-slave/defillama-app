# Rewards ranking and analytics

Group A places public, published programs with positive integer `featured_rank` values first, then ranks the rest by exact canonical project-page views over the backend's 90-day window. The API currently publishes editor ranks as strings. Missing ranks fall through to popularity; invalid or duplicate ranks fail page generation rather than publishing an ambiguous order. The backend adds `project_path` to `/rewards` and publishes `rewards-popularity.json` on the datasets host. Row names, internal links, CEX link suppression, and outbound destinations remain independent of ranking identity. Programs for one project share its count.

Deploy the backend contract and first snapshot before this frontend. `getRewardsPageData` requires the snapshot; a failed ISR refresh throws so Next retains the previous generated page, rather than publishing a new partially ranked page. After featured programs, the server sorts by page views with alphabetical ties, placing unmeasured projects after measured zeroes. Ranks and counts are never included in page props. The client uses the supplied order initially, with optional local header sorting. Reset restores the assigned group's server order. Sort/order URL parameters are ignored; filters remain URL-driven. Search and pagination remain local. There are no fee/TVL requests or rankings in this feature.

The server rejects catalog records that omit `project_path` so an old backend payload cannot silently remove popularity ranking. Explicit `null` remains valid for unresolved projects.

## Featured-card experiment

`rewards-featured-cards-v1` reuses the site's stable A/B cookie assignment:

- A preserves every `featured_rank` promotion, with no five-program cap.
- B sorts the entire table by page views and shows up to three cards, ordered by `featured_rank_card`, between the Status and Reward controls. Both variants retain the same popularity tie-breakers.
- Card programs remain in B's table. The whole card section hides whenever search, status, reward type, or Hide unverified is active, and returns when filters are cleared. Whitespace-only search is treated as empty. Desktop uses three columns; mobile stacks the cards. Content and referral destinations come from the catalog, not hardcoded offers.
- Only public, published programs are eligible. Fewer than three card ranks produces fewer cards, including zero. Both rank fields must contain unique positive integer strings within their own list; malformed or duplicate editor ranks fail generation.
- The server sends program data once, plus ordered program IDs for B and the cards. Page-view counts and editor ranks stay server-side. Hydration selects the assigned variant; B hides the initial A markup until that selection completes.

## Analytics

Rewards uses the shared Umami script configured in `_app.tsx`. Its `data-domains` allowlist controls sending for pageviews and custom events alike, so localhost and preview hosts cannot send events to production analytics. No rewards-specific environment flag or hostname gate is required. Tracking begins after the A/B assignment is resolved. Every rewards event, including filter and interaction events, queues in memory until Umami is ready and is discarded if the Rewards page unmounts first.

Events:

- `rewards-program-impression`: one per program, placement, and variant per tab session, deduplicated with `sessionStorage` and an in-memory set.
- `rewards-outbound-click`: every deliberate activation of a program's referral link, including middle-click. No client-side repeat-click suppression.
- `rewards-experiment-exposure`: once per variant per tab session when the Rewards page is in the foreground.
- `rewards-experiment-conversion`: once per variant per tab session on the first outbound referral click, across cards and table combined. Includes `placement` (`card` or `table`) from that first click.

- `rewards-filter-status`: each status change, with `value` (`All`, `Live`, `Season Gap`, `Ended`, or `Unknown`).
- `rewards-filter-reward-type`: each reward-type interaction, with the toggled `value` (a type name, or `All` when cleared) and boolean `selected` (`false` when a type is deselected).
- `rewards-filter-hide-unverified`: each checkbox interaction, with boolean `value`.
- `rewards-filter-reset`: each Reset click; does not also emit individual filter or sorting events.
- `rewards-search`: after a nonempty query settles for 600ms, with trimmed, lowercase `term` and matching row count `results`. Clearing search sends nothing.
- `rewards-table-sort`: each sorting change, with `column` and `direction` (`asc`, `desc`, or `none` when cleared). Does not fire on initial render.
- `rewards-row-expand`: each row expansion, with `program_id` and nullable `project_path`. Collapse sends nothing.
- `rewards-protocol-click`: each left-click or middle-click on a table protocol link, with `program_id` and nullable `project_path`. Does not count as an outbound referral conversion.
- `rewards-submit-click`: each left-click or middle-click on Add Your Rewards.

Filter and interaction events are not deduplicated; repeating an interaction sends another event. Clicking the already-active Status pill or the reward All pill when nothing is selected changes nothing and sends nothing. Interaction events follow the same queue lifecycle as impressions: they wait in memory until the Umami script signals ready, flush in order, and are discarded when the Rewards page unmounts before that. Umami attributes an event to the page current at send time, so a queue that outlived the page would credit the next page and could produce interactions with no matching exposure. All events carry `experiment` and `variant`. Program impressions and outbound clicks also carry `program_id`, nullable `project_path`, and `placement` (`card` or `table`). Program events do not include referral URLs, search text, or source links. Only `rewards-search` includes the normalized search term. One shared IntersectionObserver measures the card links and table Open buttons, requiring 50% visibility for one continuous second while the document is visible. Clicks also establish an impression if the dwell threshold has not been reached. Changing table pages replaces the observer targets but preserves deduplication. Tracker delivery is best-effort; blocked analytics never prevents navigation. If storage is unavailable, deduplication lasts only for the current mounted page.

Observation starts immediately, independently of the lazy Umami script. Early impressions and clicks wait in a page-local queue; the script's `onReady` signal flushes them without a polling timeout. Filtering and pagination retain that queue. Only dispatched deduplicated events are persisted in session storage. Leaving the Rewards page or closing the tab before the script becomes ready discards queued events; this is not a durable delivery queue. Umami timestamps queued events when they are dispatched.

Visitors without the group cookie are tracked as variant `a` but carry no Umami A/B tag. Analyses should filter to tagged events or accept this small contamination of group A.

The featured section hides when any filter or search is active. A filter event followed by zero card impressions is expected behavior, not missing instrumentation.

Record the public launch timestamp and verify event properties in Umami after deployment. Staff should disable their own Umami tracking. Local QA can inspect or mock the tracker without changing the production allowlist. Do not use pre-launch traffic for ranking.

Clicks are not used in ranking yet. Before introducing click-through ranking, verify compatible unique-click and exposure aggregation: raw click totals divided by tab-deduplicated impressions are not a unique-session click-through rate. Retain raw clicks for that later analysis.

### Comparing A and B

In Umami, filter to experiment `rewards-featured-cards-v1` and the same post-launch date range. For each variant, divide the total `rewards-experiment-conversion` event count by the total `rewards-experiment-exposure` event count. These events each fire once per tab session, so repeat clicks and the same program appearing in a card and table cannot inflate the primary conversion rate. Use event counts, not Umami's distinct-visitor counts, for this ratio.

The `rewards-filter-*` events let analysts split conversion by whether the tab session filtered, using session-level event association rather than raw filter counts. Conversion `placement` shows whether B's first conversion came through a card or the table.

Use `rewards-outbound-click` split by `variant`, `placement`, and `program_id` to understand where engagement happens. These are raw click counts, not unique-session conversion rates. Exposures and conversions use tab-session storage rather than Umami's inactivity-based session definition; a tab left open across days can span reporting windows. Compare over the full experiment period, allow enough traffic, and examine uncertainty before declaring a winner. The code emits measurement events; it does not automatically select a winning variant.
