# Exchanges

Exchanges reads the orderbook-watch exchanges cache served from `MARKETS_SERVER_URL`. `master.types.ts` owns the wire shapes, and `master.mappers.ts` maps them into the read models in `models.ts`. Components import models, never wire types. Token market rows belong to `src/containers/Markets/README.md`.

## Endpoints and failure

| Surface                                                               | Cache file                                                                                                    | When it fails                                                                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `/exchanges`, `/exchanges/tokens`                                     | `exchanges/directory.json`                                                                                    | The build fails                                                                                                                            |
| Execution columns, the BTC execution table, the profile Execution tab | `exchanges/execution-quality.json`                                                                            | The page renders without them                                                                                                              |
| `/exchanges/rank`, the profile ranking card                           | `exchanges/quality-ranks.json`, `exchanges/rank-methodology.json`                                             | The page explains the absence; the profile drops the card                                                                                  |
| The `/exchanges` overview chart                                       | `exchanges/series/<range>.json` through `/api/public/exchanges/series`                                        | The browser loads it for the URL range and shows the chart's error state                                                                   |
| `/exchange/<slug>`                                                    | `exchanges/<slug>/metadata.json`, then `exchanges/<slug>/index.json` for a markets profile                    | A metadata 404 is a 404 page; any other metadata or index failure fails the build                                                          |
| `/exchange/<slug>` history                                            | `exchanges/<slug>/series/<range>.json` through `/api/public/exchanges/[exchange]/history`                     | Loaded in the browser for the URL range; a metadata-only profile never requests it                                                         |
| `/exchanges/charts`                                                   | `charts/<part>/<range>.json`, at the cache root                                                               | The build fails without every part's `1y` file; the browser loads each visible chart's range through `/api/public/exchanges/charts/[part]` |
| The country selector and regional details                             | `exchanges/regions.json`, `exchanges/<slug>/metadata/regions.json`, `exchanges/<slug>/metadata/<region>.json` | Loaded in the browser through `/api/public/exchanges/regions` and `/api/public/exchanges/[exchange]/metadata`                              |
| `/mica`                                                               | `exchanges/mica.json`                                                                                         | The build fails                                                                                                                            |
| `/ramp`                                                               | `exchanges/ramps.json`                                                                                        | The page renders its empty state                                                                                                           |
| `/dexs` CEX spot share                                                | `exchanges/series/all.json`, `exchanges/directory.json`                                                       | `/dexs` renders without the share                                                                                                          |
| Token page depth slippage                                             | `exchanges/execution-quality.json` through `/api/public/exchanges/execution-slippage`                         | `Token/TokenMarketsSection.tsx` shows no slippage chart                                                                                    |

Routes and file names use the exact curated lowercase public slug (`slugs.ts`). There are no aliases and no storage-ID routes.

## Frontend derivations

- The venue link is `selectVenueDestination` in `venueLinks.ts`: the `referralUrls.ts` override for the slug first, then the wire referral, then the official site.
- The EU and global related entities come from `parent_entity` and `related_entities` by scope: EEA-regional or global. A related entity shows only when it is also a `directory.json` row, and it links to that row's `links.profile`.
- EEA orderbook ownership (`eeaOrderbookOwnership`) applies to EEA-regional venues: `own` when every present liquidity segment is own, `shared` when every one is shared, `mixed` otherwise, and `null` when no segment reports a relation.
- `directory_visibility` is not a frontend filter. Presence in `directory.json` is the backend's final listing decision.
- `profile_mode` alone picks the profile. A `metadata-only` profile renders authored metadata and promotions and never mounts market, pair, activity or history UI.
- The header open interest sums venue perp segments and skips segments whose `liquidity` relation is `shared`, as the backend's own totals do. Linear and inverse are never combined.
- The URL `country` decides availability and the segments a venue serves there. It never rewrites global market observations.

## MiCA

- `/mica` lists rows with `mica_licensed === true` and `eu_status === 'available'`.
- `mica.json` covers the EU and EEA, so the global country selector never filters it.
- The "Perps" columns read the `linear_perp` class and never merge it with `inverse_perp`.
- MiCA rows link to the canonical `links.profile`, including metadata-only venues with no market observations.

## Metric semantics

- Transport nulls stay null.
- A segment the venue does not run renders `N/A`. A supported metric without an observation renders `–`. An observed zero renders zero.
- A null series column means the metric does not apply to the venue, and its chart tab or line is hidden.
- Perp sums cover only the segments a venue runs and skip missing values instead of inserting zeros.
- A normalized-volume column falls back to reported volume for a segment with no captured order book and marks the value.
- Research chart parts trim their own empty leading period, so day axes can differ between parts. Internal and trailing gaps stay visible.
- The `depth` part's `btc_depth` stays separate from the USD depth series.
