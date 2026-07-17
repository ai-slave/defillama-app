# Exchanges: canonical contract and data flow

The Exchanges frontend consumes the orderbook-watch exchanges cache served by
the Markets API (`MARKETS_SERVER_URL`). The backend contract update described
here is pending merge and cache refresh; live Pro verification must wait until
that rollout completes. The wire DTOs live in
`src/containers/Exchanges/master.types.ts`; `master.mappers.ts` maps that one
active contract into the backend-neutral read models in `models.ts`.
Components never import wire types.

Backend sources of truth: `docs/exchanges-api.md`, `lib/exchange-contract.ts`,
`lib/cache-builders.ts`, `lib/chart-contract.ts`, and `lib/cache-validate.ts`
in the orderbook-watch repo.

## Endpoints and loading

| Product surface            | Canonical endpoint                                                        | Frontend behavior                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/exchanges`               | `exchanges/directory.json`                                                | Primary static-generation request; fatal on failure. Supplies rows, canonical totals, and per-segment sparklines.           |
| `/exchanges` overview      | `exchanges/series.json`                                                   | Lazy client request via `/api/public/exchanges/series` when the overview approaches the viewport.                           |
| `/exchange/<slug>`         | `exchanges/<slug>/metadata.json`; market profiles also use `index.json`   | Metadata selects the profile mode. A metadata 404 identifies an unknown venue; required market-index failures remain fatal. |
| `/exchange/<slug>` history | `exchanges/<slug>/series.json`                                            | Lazy market-profile request via `/api/public/exchanges/<slug>/history`; metadata-only profiles never request it.            |
| `/exchanges/charts`        | `charts/{volume,oi,depth,nvol}.json` (cache root, not under `exchanges/`) | Static generation validates all four; the browser loads each visible chart lazily via `/api/public/exchanges/charts/…`.     |
| `/mica`                    | `exchanges/mica.json`                                                     | Dedicated MiCA payload used during static generation.                                                                       |

All routes and filenames use exact curated lowercase public slugs; there are no
aliases or storage-ID routes.

## Shared venue core (PublicVenueCore)

`directory.json` venues, `metadata.json`, and `mica.json` rows share one exact
identity/link core:

```ts
type EntityScope = { kind: 'global' } | { kind: 'regional'; regions: string[] }

interface PublicVenueCore {
	slug: string
	display_name: string
	type: 'cex' | 'dex'
	directory_visibility: 'listed' | 'mica-only'
	profile_mode: 'markets' | 'metadata-only'
	scope: EntityScope
	parent_entity: { slug; name; scope; profile_url } | null
	related_entities: Array<{ slug; name; scope; profile_url }>
	liquidity: Record<
		'spot' | 'linear_perp' | 'inverse_perp',
		{ mode: 'own' } | { mode: 'shared'; coverage: 'full' | 'subset'; source: { slug; name; profile_url } } | null
	>
	links: {
		profile: `/exchange/${slug}`
		website: { url: string; kind: 'referral' | 'official' } | null
		defillama: { slug: string; type: 'cex' | 'protocol'; url: string } | null
	}
}
```

Frontend derivations from the core (mapper-owned, models unchanged where
possible):

- `links.website` is the single backend-resolved destination. The mapper splits
  it into model `referralUrl` / `websiteUrl`; `venueLinks.selectVenueDestination`
  still applies the frontend `referralUrls.ts` override (keyed by public slug)
  first, then the wire referral, then the official site.
- `related.euEntity` / `related.globalEntity` are derived from
  `parent_entity` + `related_entities` by scope (regional-with-`eea` vs global).
  A related entity is exposed only when it is also a `directory.json` row; its
  canonical `links.profile` is used regardless of activity tracking status.
- `compliance.ownEuOrderbook` is derived: for EEA-regional entities it is true
  when every present `liquidity` segment is `mode: 'own'`, false when any is
  shared, null otherwise.
- `directory_visibility` is not a frontend filter. Presence in
  `directory.json` is the final backend listing decision.
- `profile_mode` alone selects the markets profile or the metadata-only
  profile. Metadata-only profiles render authored metadata and promotions but
  never mount market, pair, activity-KPI, or history UI.

## Transport contract

`exchanges/directory.json`:

- `totals` (and `totals.cex`/`totals.dex`): `venues`, `tracked`,
  `spot_volume_24h`, `linear_perp_volume_24h`, `inverse_perp_volume_24h`,
  `total_trading_volume_24h`, `reserves_usd`. There is no aggregate OI total;
  the header OI stat is summed in the mapper from venue perp segments,
  excluding segments whose `liquidity` relation is `shared` (mirroring the
  backend's own shared-book exclusion).
- venue rows extend the core with `tracked`, `secondary`, per-segment
  `segments` (markets/coins, nullable volumes, perp-only OI, ±2% depth sides,
  `depth_partial`, freshness, optional `doublecount: {volume?, oi?, depth?}`
  reason strings), `capabilities` per segment, `totals`
  (per-segment volumes + `total_trading_volume_24h` + `coins`), `sparks`,
  nullable `reserves`/`fees`/`compliance`/`profile`/`funding` blocks,
  `warnings`, and `nvol: Record<Segment, {reported, normalized, discount_pct,
unverified_pct, flag} | null>`.
- `fees` is per settlement class: `{ spot, linear_perp, inverse_perp,
fee_token }`.

`exchanges/<slug>/index.json`: `{ slug, type, liquidity, segments,
capabilities, freshness, depth_bands, last_updated }`. Segments carry
`doublecount` and `pairs`; pair rows keep `market_id` as opaque identity and no
longer carry `exchange`/`exchange_type`. There is no per-pair history endpoint.

`exchanges/<slug>/metadata.json`: the venue core plus `available_regions`,
`restricted_regions`, `native_token`, `promotions`, `kpis`, `groups`,
`last_updated`. The profile page resolves names, website, and DefiLlama links
from this file alone.

`exchanges/mica.json`: rows extend the core with per-segment
`fees`/`metrics`/`depth_summary` records (`Record<Segment, … | null>`),
`total_trading_volume_24h`, and nullable compliance facts (`kyc_required`,
`mica_licensed`, `eu_status`, …). `/mica` shows rows with
`mica_licensed === true && eu_status === 'available'`. Presentation labels
`linear_perp` as "Perps" (fees and depth columns read the linear class) without
merging it with `inverse_perp`. MiCA rows always use the canonical
`links.profile`, including metadata-only venues without market observations.

Aggregate and venue history use one columnar shape:

```ts
interface ColumnarSeries {
	days: number[]
	key: string[]
	series: Array<Array<number | null> | null> // null column = unsupported metric
	freshness?: { first_day; last_day; expected_last_day; stale; metrics }
	last_updated: string
}
```

- `exchanges/series.json` keys (exact, ordered): `cex/dex/total` ×
  `{spot,linear_perp,inverse_perp}_volume` + `{linear,inverse}_perp_oi`, plus
  `total_trading_volume`.
- `exchanges/<slug>/series.json` keys (19, exact order): per-segment volume,
  perp OI + OI delta, ±2% depth, normalized volume, reported volume, and
  market count.

Research files (`charts/<part>.json`) use the compact
`[exchange][metric][day]` form with exact per-part key sets:

```ts
volume: ['spot', 'linear_perp', 'inverse_perp', 'spot_mkts', 'linear_perp_mkts', 'inverse_perp_mkts']
oi: ['linear_perp', 'inverse_perp']
depth: ['spot', 'linear_perp', 'inverse_perp']
nvol: ['spot', 'linear_perp', 'inverse_perp', 'reported_spot', 'reported_linear_perp', 'reported_inverse_perp']
```

`exchanges[]` values and `names` keys are public slugs; `names` is a full
record covering every listed exchange. All four parts share identical
exchanges/types/names/day axes. The depth part may carry `btc_depth` keyed by
all three segments; the frontend renders BTC spot vs a summed perp line.

## Metric semantics

Transport nulls remain null. The UI distinguishes unsupported (capability
false → `N/A`), supported-but-missing (`–`), and observed zero. A null series
column means the metric does not apply to the venue and its chart tab/line is
hidden. Presentation-only perp sums skip absent segments instead of inserting
zeros; the aggregate perp normalized-volume figure is only shown when every
present perp segment has normalized data.

## Remaining backend contract gaps

- No cross-venue open-interest total in `DirectoryTotals`; the frontend sums
  venue perp segments (excluding shared liquidity) for the header stat.
- No per-pair history endpoint; pair charts are not shown.
- Related-entity profile links on the profile page still require the
  directory; `metadata.json` relations carry `profile_url` but not tracked
  status.
