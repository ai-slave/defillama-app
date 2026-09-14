# Protocol list pagination migration

Base: local `main` at `8b8a422c961fbf603ab535950a6d4c072beaa626`.
Worktree: `/private/tmp/defillama-protocol-lists`.
Branch: `mintdart/server-protocol-lists`.

## Changes

- `/protocols` now passes `protocolRankings` and the first 50 rows from the existing
  rankings snapshot. It uses the homepage/chain remote table, pagination API, TVL
  preparation, custom sorting and full filtered CSV export. Its existing columns,
  presets and parent/child behavior stay in the shared rankings table.
- `/airdrops` and `/recent` retain their eligibility builders and their existing
  table columns. A shared server snapshot retains the complete eligible population;
  initial props contain 50 prepared rows and compact filter metadata.
- The new `/api/public/protocol-lists` uses the shared immutable Redis blob store,
  prepared-row cache, cursor validation and `useTablePages` client state machine.
  Subsequent pages contain at most 75 rows. Filtering, chain TVL scope, additive
  settings, bounds, search and sorting run before slicing.
- CSV uses the identical prepared population and snapshot, including all matching
  rows. Funding exports retain disclosed subtotals and undisclosed-round counts.
  Dates remain Unix seconds. The existing CSV serializer handles quoting and
  spreadsheet formula prefixes.
- Per-chain TVL sections and fork lookup maps are server-only. Hydration does not
  fetch the whole dataset. URL filters, new URL-backed search/sort state, retry,
  retained rows during replacement and automatic cursor loading use the shared
  table conventions. Airdrop claim links and address checks remain in place.

Airdrop membership still requires `symbol === '-'`, the explicit exclusion set,
parent-token exclusions, and successful funding/claim-directory acquisition.
Recent rows still require `listedAt`, including zero, and remain individual listings.
Both tables default to newest first, as the previous table did. Equal sort values
now use protocol ID for deterministic cursor boundaries. Nullable exact TVL,
selected-chain coverage, zero-valued bounds and the four additive settings retain
existing semantics. Explicit empty categories and legacy `category=All`/`None`
empty results are preserved.

## Comparable initial-props measurements

UTF-8 bytes of `JSON.stringify(props)`; neither compressed transfer size nor full
HTML size. Both sides use identical captured inputs and the current main transforms.
The after values come from the actual three `getStaticProps` functions.

| Page         | Source rows | Initial rows after | Before bytes | After bytes | Reduction |
| ------------ | ----------: | -----------------: | -----------: | ----------: | --------: |
| `/protocols` |       6,529 |                 50 |    4,544,520 |     110,107 |     97.6% |
| `/airdrops`  |       3,574 |                 50 |    2,669,035 |      33,847 |     98.7% |
| `/recent`    |       6,482 |                 50 |    5,548,613 |      29,779 |     99.5% |

Inputs were captured September 14, 2026 UTC: the public `/lite/protocols2?zz=19`
response (8,082 protocols), public airdrop config, and the existing local metadata
and Raises artifacts. Raises used snapshot
`1789378491105-b00f0bc4-299a-40fe-8efa-d2e76501684f`.
Public `/raises` returned 402; the public `/protocols` page returned 403.

For rankings, adapter metrics, emissions and token-price lookups are deliberately
held unavailable on both sides; canonical TVL rows and parent grouping use the
captured real listing and metadata. Thus the rankings comparison is controlled,
not a reproduction of the profiler's roughly 9.7 MB production payload. Snapshot
storage is mocked for this replay, and is tested separately with explicit success
and failure cases.

The local captures and machine-readable result are in
`/private/tmp/protocol-list-measurement/`. No datasets are added to the repository.
To replay, supply `lite.json`, `claims.json`, `raises.json` (raw Raises API shape),
and `metadata.json` (protocol metadata) in one directory, then run:

```sh
PROTOCOL_LIST_MEASUREMENT_DIR=/path/to/capture bun run test src/containers/ProtocolLists/__tests__/payload.measurement.test.ts
```

The measurement test skips in ordinary test runs. It writes `results.json` beside
its supplied captures and performs no network requests.

## Verification and limits

- Full formatting, lint, application typecheck and test typecheck pass.
- Relevant ProtocolLists, ProtocolRankings and table-page suites pass: 208 tests.
  API route catalog checks add 9 passing tests. The opt-in capture replay also passes.
- Concrete behavior cases cover page boundaries, whole-population filtering and
  sorting, token and parent-token exclusions, listed dates, null/zero semantics,
  chain/category inclusion and exclusion, forks, funding and complete filtered CSV.
- DOM hydration/interaction checks run in normal and React Compiler modes. They
  exercise SSR rows without a mount fetch, pinned append, URL sorting, combined
  filters, search/TVL requests, stale-row retention, retry and export requests.
  These are component tests with mocked network and table presentation, not a live
  browser or production validation.
- Browser QA on port 3000 checked all three pages, scrolling, search, sorting,
  chain/category filters, TVL bounds, fork exclusion, recent-query reload, airdrop
  funding and the claim dialog, and rankings parent expansion. Rankings recovered
  from a stale snapshot by replacing rows. No browser console errors were observed.
- Local CSV responses contained all 2,199 filtered airdrops and the two matching
  recent rows. Browser file-saving was not confirmed. With live development inputs,
  `/protocols` still triggered Next's 229 KB page-data warning; this differs from
  the controlled measurement above, which omits activity and token-price inputs.
- No production build or repository-wide unit-test run was performed.

New list snapshots share rankings' nonfatal Redis publication behavior. Healthy
snapshots are retained in the bounded four-hour process cache, including in
`next dev`, where Redis is disabled. A worker missing the version may rebuild, but
only an identical content hash can answer the pinned request. Otherwise pages
replace explicitly and exports fail. Redis outages or cache eviction can therefore
cause replacement or export failure; no response combines different versions.
Source acquisition failures still fail regeneration, preserving ISR's previous page.
Existing rankings snapshot availability behavior is reused without modification.

Server-side source parsing, snapshot serialization and rebuilding still exist on
cache misses. These measurements establish reduced initial props, not that the
production stale-regeneration slowdown is fixed. Live profiling is still needed.
No profiler branch code, operations repository, Coolify or production configuration
is changed.

## Other lite/protocols2 consumers

Inventory includes direct uses of `ProtocolLists/api.fetchProtocols` and explicit
lite URL references. It excludes unrelated functions also named `fetchProtocols`,
such as the token-usage API helper. No additional consumer is migrated here.

| Consumer                                                                                     | Current use and migration assessment                                                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pages/top-gainers-and-losers.tsx`                                                           | Strong candidate: spreads every raw protocol, including chain snapshots, into props; browser computes changes and rankings.                                                          |
| `ProDashboard/queries.ts`                                                                    | Strong candidate: `useProtocolsAndChains` fetches the complete lite listing in the browser to build its catalog. Prefer a compact catalog source or server query tailored to the UI. |
| `ProtocolTaxonomy/queries.tsx`                                                               | Category/tag list builders consume the full source. Measure returned ranking payloads; reuse bounded delivery while retaining taxonomy membership and parent rules.                  |
| `ProtocolLists/queries.ts` remaining token lists                                             | Market caps, FDV, prices and outstanding FDV return complete transformed tables. Measure compact rows before promoting them to remote delivery.                                      |
| `ProtocolLists/queries.ts` remaining extra-TVL lists                                         | Active loans, total staked and pool2 return scoped/grouped tables plus charts. Measure per-route size; keep aggregation and charts separate from pagination.                         |
| `pages/directory.tsx`                                                                        | All names/logos/URLs are projected into props. Candidate for a compact searchable catalog if measured size warrants it.                                                              |
| `CompareTokens/queries.ts`                                                                   | Builds comparison choices from protocols plus token/adapter data. Assess a compact lookup rather than generic ranking pagination.                                                    |
| `LST/queries.tsx`, `Forks/queries.tsx`, `Oracles/queries.tsx`                                | Scoped populations, measurements and metadata enrichment. Measure output first; source-list acquisition alone does not establish a large-props problem.                              |
| `pages/top-protocols.tsx`                                                                    | Already reduces the source to winners by chain/category; primarily a source-fetch optimization candidate.                                                                            |
| `pages/expenses.tsx`, `pages/donations.tsx`                                                  | Join specific expense/donation populations with protocol metadata. Assess compact metadata acquisition, not automatic pagination.                                                    |
| `CompareChains/queries.ts`                                                                   | Uses only the chains list; a chain-only source would avoid fetching all protocols.                                                                                                   |
| `ProtocolRankings/queries.server.ts`                                                         | Canonical ranking builder retained for homepage, chain and protocol ranking consumers. Pagination already exists; source rebuilding is a separate concern.                           |
| `ProtocolOverview/queries.tsx`, `AdapterMetrics/queries.tsx`                                 | Server enrichment/lookup joins. Candidate for narrower metadata sources, not necessarily remote table delivery.                                                                      |
| `Articles/server/entityPreviewBuilders.ts`                                                   | Cached server entity-preview lookup; a compact metadata lookup could reduce acquisition cost.                                                                                        |
| `Yields/data/server/raiseValuations.ts`                                                      | Server funding valuation join; evaluate narrower metadata acquisition.                                                                                                               |
| `ProDashboard/queries.server.tsx`, `server/stream/index.ts`                                  | Server catalog/bootstrap consumers. Coordinate a compact source with the browser catalog candidate.                                                                                  |
| `ProDashboard/server/chartBuilder/protocols/breakdowns/tvl.ts`                               | Server chart breakdown membership and TVL data; preserve chart semantics if narrowing the source.                                                                                    |
| `ProDashboard/server/chartBuilder/adapterMetrics/breakdowns/{chainSeries,protocolSeries}.ts` | Server adapter metadata joins; source optimization candidates.                                                                                                                       |
| `ProDashboard/server/chartBuilder/protocolTvlCsv.ts`                                         | Server export metadata; full exports are intentional, but metadata acquisition can be narrowed.                                                                                      |
| `Downloads/datasets.ts`, `Downloads/chart-datasets.ts`                                       | Explicit complete dataset export and chart-option sources. Full export is intentional; chart options may benefit from a compact source.                                              |
