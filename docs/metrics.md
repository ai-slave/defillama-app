# Metrics

This document records implementation semantics for metric terminology in the app. Use it before changing metric routes, chart queries, metadata flags, public API validation, adapter data types, or route-cache validation.

`public/pages.json` is the product-facing glossary for page names, routes, descriptions, and total tracked keys. This document is the engineering companion for places where the same words can mean different upstream entities or adapter paths.

## Scope

This is not a full catalog of every number in the app. It is for cross-route or overloaded metric semantics that can cause wrong wiring, wrong validation, or wrong entity assumptions.

Use this document for:

- Metrics where the same word means different entities, for example chain revenue versus app revenue.
- Metrics where the route shape and upstream adapter path do not name the same entity.
- Metrics where metadata flags, adapter type, and data type must be checked together.
- Metric families that are shared across multiple containers or public API endpoints.

Do not use this document as the only source for domain-local metric definitions. Some route families have their own local definition files or container docs.

Current source layout:

- `public/pages.json`: product-facing names, descriptions, route slugs, tabs, and total tracked keys.
- `src/metrics`: typed internal descriptors for migrated cross-container invariants. It is intentionally not a global registry for every metric.
- `src/containers/AdapterMetrics/README.md`: adapter-backed page ownership, data flow, and local gotchas.
- `src/containers/README.md`: route-family to container ownership map.
- RWA definition files listed below: local source of truth for RWA breakdowns.

## Review Checklist

When changing metric code:

- Check the page definition in `public/pages.json`.
- Start from the route file in `src/pages`, then follow imports to the owning container.
- Check the relevant metadata flags on chain or protocol metadata.
- Check whether the metric is chain-level economics, app-on-chain aggregation, protocol-level data, or an RWA-specific breakdown.
- Check whether adapter-backed pages require `adapterType` and `dataType` together.
- Check whether a route parameter name is overloaded before adding route-cache validation. For example, a parameter named `protocol` can still contain a chain-level fee adapter ID.
- Add tests for both the intended entity type and the opposite-edge case that validation might reject.

## Adapter-Backed Metrics

Adapter-backed metric pages live mostly under `src/containers/AdapterMetrics`.

Examples include:

- fees, revenue, holders revenue, earnings, P/F, and P/S
- DEX volume, perp volume, DEX aggregator volume, and perp aggregator volume
- options premium volume and options notional volume
- bridge aggregator volume
- open interest and normalized volume
- protocol liquidation volume and collateral liquidated

For these pages, do not reason from `dataType` alone. Check `adapterType` and `dataType` together.

Important files:

- `src/containers/AdapterMetrics/constants.ts`: adapter types, data types, and chain metadata key disambiguation.
- `src/containers/AdapterMetrics/queries.tsx`: server/page-data builders.
- `src/containers/AdapterMetrics/api.ts`: upstream adapter metrics/chart fetchers.
- `src/containers/AdapterMetrics/README.md`: local route and change guide.
- `src/metrics/feesRevenue.ts`: cross-container fee/revenue semantic descriptors for the migrated fee/revenue slice.
- `src/containers/AdapterMetrics/metricPeriods.ts`: nullable period-field merge and change derivation helpers.

Examples of ambiguous pairings:

- `dailyVolume` is used by DEXs, perps, DEX aggregators, and perp aggregators. The metadata flag depends on `adapterType`.
- `dailyNotionalVolume` is used by DEX notional volume and options notional volume. The metadata flag depends on `adapterType`.

### Activity Availability And Aggregation

Interpret nullable adapter activity periods using source provenance rather than a global fallback:

- A protocol present in a successful authoritative listing is canonical membership even when one or more activity periods are nullable. Preserve those nullable leaf periods as unavailable so inactive integrations render blank rather than as an invented zero.
- When combining canonical siblings or selected chains, a nullable period contributes nothing if another contributor has an available value; if every contributor is nullable, the aggregate period remains unavailable. This keeps inactive children from hiding active siblings without converting an entirely unavailable period to zero.
- A successful empty listing has no members and therefore an aggregate total of zero; this is distinct from a listed protocol whose requested period is nullable.
- A failed whole request remains unavailable (`null`). Do not convert a request failure into a successful zero or present a best-effort multi-source result as complete.
- Selected-chain datasets that retain successful chains after another chain fails must carry explicit partial-coverage metadata through APIs, server-stream cache seeding, and consumers.
- These activity rules do not apply to exact TVL snapshots, ratio denominators, required bridge legs, or chart points. Missing required values for those metrics remain unknown.
- `dailyGasUsed` is measured in the chain's native gas token; `dailyGasUsedUsd` is the separately priced USD cost. Do not currency-format or relabel native gas usage as USD.

Earnings additionally combines two authoritative sources:

- Revenue minus emissions is unavailable when either whole source fails.
- Within successful listings, nullable revenue activity and a missing protocol emissions row each contribute zero.
- A matched emissions row with a nullable period is unavailable for that period; it must not become zero or a partial parent sum.
- Earnings comparison fields remain unavailable when the emissions producer has no matching comparison periods. Selected-chain earnings must not relabel all-chain periods as chain-specific values.
- The emissions producer has no chain allocation. Chain Earnings therefore estimates each protocol's chain emissions in proportion to that chain's share of the protocol's revenue for the same period. Chain-scoped table headers must say `Est.`; global protocol Earnings remain the exact revenue-minus-emissions calculation.
- Adapter protocol breakdowns currently support batched chain totals only for 24h and 30d. All-chain Pro tables keep unsupported 7d, 1y, comparison, and change cells blank. Explicit selected-chain requests may expose more periods when their chain endpoint supplies them.

### Pro Protocol Table Shares

Pro protocol tables expose three distinct percentage denominators:

- DEX, perpetuals, DEX aggregator, and options volume dominance divide protocol activity by the global Lens metric total. A selected-chain filter changes the rows and their activity values, but these columns remain global shares.
- Bridge Aggregator volume share uses the current selected-chain scope. An all-chain table uses the global canonical total; a chain-filtered table uses the canonical total for those selected chains.
- Filtered-row shares divide each positive top-level row by the positive total after source filters and search. They are computed separately from producer dominance and are labeled `% of Filtered Rows`.

Grouped rows sum the available leaf shares because each leaf uses the same denominator for that source and scope. An unavailable leaf remains blank without erasing measured siblings; a group with no measured shares remains unavailable. Canonical parent supplements that require complete filtered membership, including Bridge Aggregator share, remain strict.

Global, current-scope, and filtered-row shares must remain visibly distinct in column labels and descriptions. Changing one denominator is a product-semantic change, not a presentation refactor.

### Protocol Liquidations

Protocol liquidation metrics are adapter-backed metrics exposed through the `liquidations` adapter namespace. They are distinct from the Liquidations product page, which tracks collateral at risk of liquidation.

- Metadata flags: `liquidationVolume` and `collateralLiquidated`
- Adapter type: `liquidations`
- Data types: `dailyLiquidationVolume` and `dailyCollateralLiquidated`
- Aggregate metrics: `/v2/metrics/liquidations?dataType=dailyLiquidationVolume` and `/v2/metrics/liquidations?dataType=dailyCollateralLiquidated`
- Protocol metrics: `/v2/metrics/liquidations/protocol/:protocol?dataType=dailyLiquidationVolume` and `/v2/metrics/liquidations/protocol/:protocol?dataType=dailyCollateralLiquidated`
- Protocol charts: `/v2/chart/liquidations/protocol/:protocol?dataType=...`

These responses use the same period totals and chart tuple contracts as other adapter-backed protocol metrics. On `/protocol/:protocol`, gate them through protocol metadata flags before fetching.

Keep route flow visible from the page file. If repeated adapter metadata rules need centralization, prefer a small AdapterMetrics-local descriptor unless another container or public API endpoint consumes the same invariant.

## Fees And Revenue

Fees and revenue have two different chain concepts:

- Chain-level economics: what users pay to use the chain, and what the chain collects for itself.
- App-on-chain aggregation: what apps/protocols on that chain collect, excluding chain-native gas economics.

Do not replace chain-level fees/revenue with app aggregation unless the product definition explicitly says `App Fees` or `App Revenue`.

### P/F And P/S

P/F and P/S ratios use annualized fee/revenue values, not 30-day fallback totals.

- P/F is market cap divided by `annualized1y` fees.
- P/S is market cap divided by `annualized1y` revenue.
- Public definitions describe annualized values as trailing 12-month totals when enough history exists, otherwise all available tracked history scaled to a 12-month run rate.
- Parent and multi-chain aggregation must preserve null when any fee- or revenue-contributing child/chain is missing the relevant annualized denominator.

### Chain Fees

Chain Fees are chain-level economics.

- Product route: `/fees/chains`
- Chain overview label: `Chain Fees`
- Product definition: total fees paid by users when using the chain.
- Total tracked key: `chainFees.chains`
- Metadata flag: `chainFees`
- Adapter behavior: fees adapter, protocol-style chain IDs, for example `/chart/fees/protocol/base`.

Implementation notes:

- Chain-only fee IDs such as `Base`, `Polygon`, `Sui`, and `Hyperliquid L1` may be valid for upstream fees adapter protocol endpoints even when they are not protocol metadata entries.
- Client chart requests should pass `entity=chain` for Chain Fees so the API validates the value against chain metadata and requires the `chainFees` flag.
- Public API validation for this path must not require protocol metadata only. If supporting legacy requests without `entity=chain`, validate a chain fallback and require the `chainFees` flag before fetching.

### Chain Revenue

Chain Revenue is chain-level economics.

- Product route: `/revenue/chains`
- Chain overview label: `Chain Revenue`
- Product definition: subset of fees that the chain collects for itself.
- Total tracked key: `chainRevenue.chains`
- Metadata flag: `chainRevenue`
- Adapter behavior: fees adapter, protocol-style chain IDs with `dataType=dailyRevenue`, for example `/chart/fees/protocol/base?dataType=dailyRevenue`.

Implementation notes:

- This may represent different forms of chain-retained economics depending on the adapter methodology.
- Do not redirect Chain Revenue to app revenue aggregation.
- Client chart requests should pass `entity=chain` for Chain Revenue so the API validates the value against chain metadata and requires the `chainRevenue` flag.

### App Fees

App Fees are app-on-chain aggregation.

- Product route: `/app-fees/chains`
- Chain overview label: `App Fees`
- Product definition: sum of fees paid by users when using apps on the chain, excluding stablecoins, liquid staking apps, and gas fees.
- Total tracked key: `fees.chains`
- Data type: `dailyAppFees`
- Adapter behavior: fees adapter chain endpoint, for example `/chart/fees/chain/base?dataType=dailyAppFees`.

### App Revenue

App Revenue is app-on-chain aggregation.

- Product route: `/app-revenue/chains`
- Chain overview label: `App Revenue`
- Product definition: sum of revenue earned by apps on the chain, excluding stablecoins, liquid staking apps, and gas fees.
- Total tracked key: `revenue.chains`
- Data type: `dailyAppRevenue`
- Adapter behavior: fees adapter chain endpoint, for example `/chart/fees/chain/base?dataType=dailyAppRevenue`.

### Chain Pages Versus Chain Rankings

The chain ranking pages and dynamic chain pages are not always the same concept.

- `/fees/chains` and `/revenue/chains` rank chains by chain-level economics.
- `/app-fees/chains` and `/app-revenue/chains` rank chains by apps-on-chain aggregation.
- `/fees/chain/[chain]` and `/revenue/chain/[chain]` show protocol/app rankings on a selected chain.

Review route names and page definitions before assuming that `/fees/chain/[chain]` is the detail page for the chain-level `/fees/chains` metric.

## REV

REV is chain-level economics.

- Product route: `/rev/chains`
- Product definition: sum of chain fees and MEV tips.
- Total tracked key: `chainFees.chains`

REV is related to Chain Fees, but it is not the same display metric. Check the route implementation and page definition before reusing Chain Fees assumptions.

## TVL

TVL is not currently a single global metric implementation. The app has multiple route-specific TVL inclusion models.

Common terms:

- base TVL
- protocol-list additive keys: staking, borrowed, pool2, and vesting
- chain-only setting keys: govtokens, doublecounted, and liquidstaking
- `dcAndLsOverlap`: not a setting key; this is overlap adjustment data for the shared portion of double counted and liquid staking TVL

Important files:

- `src/utils/tvl.ts`: shared TVL transforms used by some adjusted TVL paths.
- `src/containers/ChainsByCategory/tvl.ts`: chain/category TVL normalization and stale extra-TVL cleanup.
- `src/containers/ProtocolOverview/useFetchProtocolChartData.ts`: protocol overview TVL chart composition.
- `src/containers/ProtocolLists/utils.ts`: protocol list/table TVL toggle behavior.
- `src/containers/ProtocolRankings/`: shared protocol ranking rows and TVL display behavior.
- `src/utils/tvlOverlap.ts`: shared Oracle/Fork extra-TVL overlap helpers.
- `src/containers/Forks/tvl.ts`: fork-specific TVL/original percentage helper.
- `src/contexts/LocalStorage.tsx`: TVL setting keys.

Do not assume two routes use the same TVL model just because they share the same toggle names. Some pages start from an adjusted base TVL, while others start from raw TVL and add selected extras. On protocol-list and protocol-taxonomy pages, only staking, borrowed, pool2, and vesting are selectable/additive. Upstream protocol `doublecounted` and `liquidstaking` sections can classify a ranking row for strike presentation, but persisted chain-only toggle state must not change protocol values, strike state, or tooltip copy. `govtokens` is absent/no-op on protocol rows.

The `/protocol/active-loans/[protocol]` route is page-owned borrowed data. It always requests the borrowed breakdown and does not expose or consume protocol TVL toggles.

Potential-airdrop lists require the protocol listing and funding rounds. If either fetch fails, the list is unavailable.
Candidate filtering excludes protocols with tokens, entries in the local exclusion list, and children of parents with tokens.
A protocol with no matched funding round has an empty raised-total cell. All-undisclosed rounds display “Undisclosed”.
Otherwise, the total sums disclosed amounts, including explicit zero, with a tooltip when undisclosed rounds are excluded.

Exact protocol-list TVL snapshots preserve producer availability:

- An explicit zero remains zero.
- Within a measured contribution, a present null value makes the required aggregate unavailable.
- A missing selected-chain entry is unavailable unless the producer supplies explicit coverage metadata proving that the omission means zero.
- Numeric TVL bounds exclude unavailable rows, and market-cap-to-TVL ratios require a strictly positive TVL denominator.
- Parent summaries decide contribution from the raw producer measurement before any product-specific display coercion.
  Metadata-only children whose canonical all-chain TVL is null remain visible but do not erase measured siblings or
  their changes. A product may display a known member as current zero without admitting it to default history. A
  measured child with a missing required period, or a present-null required `excludeParent` subtraction, still makes
  only that parent period unavailable.

Category and tag directory totals are a successful-listing summary rather than an exact individual snapshot. A
metadata-only protocol whose current or comparison TVL is null contributes zero to that aggregate and remains counted
as a protocol; it must not hide measured siblings. The individual protocol row remains nullable. A failure of the
whole protocol listing still makes the page unavailable.

Compare Protocols fetches one base TVL chart and only the enabled protocol-list additive sections for each selected
protocol. A failed base source retains the selected series as unavailable, and a failed enabled section makes the
composed points null. A successful empty base chart may still produce additive-only history, while a successful empty
extra-section chart means that section contributes zero. URL selections are trimmed and deduplicated by canonical
request slug in first-selected order before requests or series construction. Comparison rows use explicit null gaps so
JSON, chart rendering, and CSV export preserve the same selected-series order.

Category and tag chart responses expose a finite set of TVL sections. All-chain responses may aggregate unqualified
protocol sections, but a selected-chain response may emit an additive section only from a matching chain-qualified key
such as `Ethereum-staking`. It must not attribute an unqualified `staking` value or another chain's value to Ethereum.
Within a successful selected-chain response, an omitted additive section means that no matching contribution exists;
an explicit zero remains zero.

Additive breakdown charts may group a homogeneous tail into `Others`, but the grouped value is unavailable if any
required tail member is unavailable; explicit zero is retained. Protocol Categories opts into complete tooltip totals,
so its total is hidden if any displayed same-unit contributor is unavailable. Other shared chart consumers retain their
existing sparse-total behavior unless they explicitly require completeness. Comparison selections do not show a tooltip
total because parent and child protocols can overlap and are not guaranteed to be additive.

Percentage and dominance rows require an explicit coverage policy. Exact selected denominators make every share unavailable
when one selected member is unmeasured; measured peers must not be renormalized to an apparent 100%. Historical Oracle,
Fork, LST, and chain-category dominance instead normalize over the measurements available on each date because members have
different launch, shutdown, and measurement ranges. Missing shares remain gaps rather than becoming zero. A complete
all-zero row remains explicit zero.

The LST directory builds one population for headline totals, charts, the table, and exports. Its core protocol histories
are required, while the LST-rate and Yields APY sources are independent optional enrichments. A failed enrichment hides
only its owned table columns; a successful empty response keeps those columns with empty cells. APY uses the pool whose
symbol exactly matches the LST-rate symbol, then the largest eligible TVL pool when no exact match exists. The canonical
LST member slug supplies the cross-source project identity; display-name reconstruction must not drop mixed-case names.
Historical raw token balances continue to sum every uppercase `ETH` key, while current balances use the largest such key
until the producer supplies one normalized ETH series.

For grouped bar series, leading nulls before that dimension's first numeric point are pre-coverage gaps and do not
poison its first measured bucket. A missing point at or after coverage begins makes that grouped bucket unavailable;
cumulative output remains unavailable from that internal gap onward. Explicit zero starts coverage and remains zero.

On a selected-chain taxonomy page, canonical `/lite/protocols2` `protocol.chains` owns TVL membership; adapter-only
fallback rows use their adapter-owned source chains. Adapter metric chains may enrich display metadata but cannot admit a
canonical off-chain TVL child. Membership is filtered before parent grouping, so a single remaining child is shown as
that child. Multiple remaining children form a parent; a declared member missing its exact chain snapshot makes that
parent TVL unavailable. The independent `Active Loans` chart remains the producer's borrowed series when additive TVL
settings change the composite TVL series.

Canonical parent protocol TVL totals subtract each contributing child's exact `chainTvls.excludeParent` snapshot. This
applies to current and comparison-period totals, including synthetic parents recalculated within the same complete
population. A filtered product population such as one exact Fork or Oracle must not subtract overlap attributed to a
child or metric outside that population. A present-null required exclusion makes only that canonical parent snapshot
unavailable; a child without an `excludeParent` section remains additive.

Selected-chain Earnings derives membership from an own chain key in either the 24h or 30d revenue breakdown. Each period
is evaluated independently: a usable breakdown without the selected chain is zero, while a nonzero aggregate without a
breakdown is unavailable. Nonzero emissions cannot be allocated over a nonpositive revenue basis. Explicit zero revenue
with zero emissions remains zero.

Oracle membership and TVS measurement are separate contracts. `/v2/metrics/oracle` `oracles` owns global membership and
order, while `protocolsByOracleChain` owns exact chain membership and secured-protocol counts. `oraclesTVS` supplies
measurements only. Inside a successful current snapshot, an omitted known member contributes zero without erasing
measured peers; explicit zero remains zero, and a known provider with no current measurements totals zero. Whole-source
failure remains unavailable. Historical dominance divides each available provider measurement by the available total
for that timestamp while preserving providers absent from every successful selected section as gaps. When any successful
selected base or extra section has a point, omitted successful sections contribute zero at that admitted timestamp. A
failed selected extra section is excluded and disclosed rather than treated as successful zero. `chainsByOracle` may
order chain links but cannot add or remove membership. Oracle identity is independent of measurement availability, so a
metrics outage must not relabel ordinary protocol TVL as TVS. A chain-qualified recognized extra-TVL key contributes its
exact extra value; when it is the member's only selected-chain measurement, its base contribution is zero.
`/lite/protocols2` only enriches exact Oracle member names with protocol metadata.

Oracle and Fork chart API `key` query params are not the same contract as local TVL setting keys. For valid keys, the chart response shape is stable across keys, but the backend v2 chart routes only accept the protocol/treasury TVL chart keys such as `tvl`, `staking`, `borrowed`, `pool2`, `vesting`, `all`, and `OwnTokens`. Do not send local overlap setting names such as `doublecounted`, `liquidstaking`, or `dcAndLsOverlap` directly as Fork/Oracle chart `key` values.

Before refactoring TVL:

- Inventory the route families involved.
- Pin current behavior with characterization tests.
- Preserve displayed numbers unless a product/API migration explicitly asks for a change.
- Prefer local container modules for route-specific behavior. Use `src/metrics` only if a stable cross-container semantic invariant is proven.

## Stablecoins

Stablecoin aggregate supply, dominance, and inflow totals exclude producer-marked double-counted assets. Historical
breakdown selectors keep all aggregate-eligible peers checked by default, while double-counted peers remain available for
explicit selection. The bounded chart renders only the top named peers plus their exact `Others` remainder; a double-counted
peer must never leak into `Others`. Table rows keep their measured value but mute and identify double-counted values as
excluded from aggregate market cap. Historical and snapshot series use a stable per-asset label generated from the full
unfiltered asset universe, so duplicate symbols remain separate after chain or URL filtering. `Others` is reserved for the
renderer's homogeneous remainder and cannot be assigned to a real asset. The same inclusion rule applies to Pro pie charts:
a double-counted peer is available for explicit selection, but an all-double-counted scope has an empty default and no
headline total.

Stablecoin history preserves the producer's sparse-zero contract:

- No time-series point means unavailable.
- A top-level supply metric omitted from a present historical point means the producer pruned a zero and is restored as zero. The supply-chart producer does not emit that top-level metric as null.
- Nullable detail measurements, such as chain issuance or unreleased supply, remain unavailable when null.
- An explicit zero remains zero.

The producer owns active/dead lifecycle extension. Frontend chart construction must use only the points it receives and
must not carry a series forward after its last producer point. When multiple supply snapshots fall in one UTC-day bucket,
daily normalization keeps the last snapshot; it must not add stock values together. Additive flow metrics use sum mode.

Filtered Stablecoin pages derive headline totals from the same filtered rows as the chart and table. Asset supply charts
use token units and the asset symbol; USD is used only by explicitly USD-valued metrics. Enabling unreleased supply does
not turn an unavailable unreleased measurement into zero or publish a partial value labeled as complete. Likewise, a
bridge row is inferred to represent the full supply only when both compared measurements are present.

The Stablecoins chain list does not supply DeFi TVL. Its `chains[].totalCirculatingUSD` value is Stablecoin market cap,
so it cannot be reused as the denominator for a “Stables Mcap / DeFi TVL” ratio. Do not restore that column without an
actual canonical DeFi-TVL source.

Grouped chain rows calculate current and comparison totals from the same current-contributing rows. A chain with
unavailable current market cap does not erase measured siblings and does not contribute to a prior-period total. If a
current-contributing row lacks one comparison period, only that grouped period and its percentage change are unavailable.

Active stablecoin histories may be extended only by the producer, which owns lifecycle metadata such as `deadFrom`.
Frontend blanket carry-forward is invalid because it cannot distinguish a delayed active asset from an intentionally
ended one. Assets marked `deadFrom` or `delisted` retain their historical charts, but current table values and snapshot
contributions are unavailable rather than zero. `deprecated` alone does not imply that current measurements are
unavailable.

## Bridged TVL

Bridged TVL is the value of tokens held on a chain, sourced from chain-assets data. Do not treat it as DeFi protocol TVL.

Current data surfaces:

- Current bridged asset totals come from `/chain-assets/chains`.
- ChainOverview uses those current totals for the Bridged TVL key metric card when chain asset data exists.
- Historical Bridged TVL charts come from the precomputed backend `/chain-assets/chart/:chain-asset-id` route.
- ChainOverview exposes the historical Bridged TVL chart from chain metadata `chainAssets`; a missing or failed current totals fetch must not hide the chart.
- Public chain chart API requests for `kind=bridged-tvl` must validate the chain through chain metadata, require the `chainAssets` flag, and query the backend with the exact metadata `id` used by the chain-assets producer.
- Direct frontend callers, including Pro Dashboard chain charts, must resolve that metadata `id`; display names and URL slugs are not producer identifiers for chains such as Hyperliquid L1, OP Mainnet, Avalanche, Gnosis, and zkSync Era.

Historical chart semantics:

- `govtokens=false`: emit one millisecond timestamp point per day with `total`.
- `govtokens=true`: emit one millisecond timestamp point per day with `total + ownTokens`.
- Non-USD denomination must divide the combined value using the millisecond timestamp price lookup.
- The Bridged TVL key metric card and chart should agree on `govtokens` semantics.

## Hacks

Hack loss and returned-funds values are whole USD amounts in both API payloads:

- `/hacks` returns raw fields named `amount` and `returnedFunds` in whole USD.
- `/v2/metrics/tvl/protocol/:protocol` embeds the same whole-USD hack fields.
- This differs from Raises payloads, whose amount and valuation fields are expressed in millions of USD.

Normalize both hack sources at their fetch boundaries with `normalizeHack`. App consumers should only use the explicit
`amountUsd` and `returnedFundsUsd` fields and pass them directly to `formatUsd`; never multiply hack amounts by `1e6`.
The Downloads hacks dataset exposes the same normalized USD fields.

## Raises

Raise amounts and valuations use USD millions in both API payloads:

- `/raises` returns `amount` as a nullable number and `valuation` as nullable freeform Airtable text in USD millions.
- `/v2/metrics/tvl/protocol/:protocol` embeds the same fields and units.

Normalize both API shapes at their fetch boundaries with `normalizeRaisesApiItem`. App consumers, snapshot reads, tables, charts,
filters, and CSV exports should only use `amountUsd` and `valuationUsd`. Raw snapshot publication remains transport-shaped
so existing artifacts can be read and normalized consistently. The Downloads Raises dataset also exposes normalized USD
fields. Funding summaries show the sum of disclosed amounts. When some rounds have undisclosed amounts, keep the dollar
subtotal visible with a dotted underline and a tooltip stating how many rounds are excluded. A nonempty population with
no disclosed amount shows `Undisclosed`, not `$0`; a measured zero remains `$0`, including alongside undisclosed rounds.
Successful empty aggregate populations remain zero, and pages that omit empty funding sections keep doing so. Whole-source
failure retains its existing unavailable/hidden behavior; it is not an undisclosed round.
Token detail SSR contains ordinary optional Raises/Treasury acquisition failures at each source, keeping Overview
and required current metrics available. Snapshot-integrity errors still propagate from these acquisitions, as do
required current-snapshot errors. Chain-token pages never request a protocol Treasury.

This presentation applies to Raises, protocol, token, Token Rights, chain and exchange funding summaries and the
Potential Airdrops funding column. It replaces the earlier sticky-null display rule for mixed protocol funding totals.
Potential Airdrops sorts and exports the same disclosed subtotal, with an explicitly labeled disclosed-money CSV column
and an export-only count of undisclosed rounds. Individual round values and their CSV exports remain unchanged.

Blank or nonnumeric valuation text stays unavailable; do not invent a parser for freeform entries such as `3,000` or
`<7000`. Numeric amount data needs no runtime validation. The producer trims surrounding whitespace before publishing
labels and preserves casing. Investor directory rows retain exact producer labels; route slugs keep their existing
case-insensitive behavior. Required `source` may be an empty string.

Broad Raises overview and monthly funding totals sum disclosed amounts; undisclosed rounds still count as rounds.
Numeric amount filters exclude undisclosed amounts only while a bound is active. A measured zero remains eligible,
including for a maximum of zero. Investor median uses measured amounts only: no measurements means null, not zero.
Both Raises tables export raw whole-USD money, Unix-second `Timestamp`, and ISO `Date` through the same CSV preparation.
Preserve the existing EOS 13-month funding split and ascending chart order.

The warehouse has a different contract: `fact.raise_event.amount` and `fact.hack_event.amount` are already whole USD.
Do not pass warehouse rows through the Raises API normalizer or silently combine warehouse and API records; the sources
also differ in coverage and may differ in returned-funds data.

## Unlocks

Unlock totals combine one-time cliffs with tokens released by active linear schedules. They do not add a weekly rate
directly to a cliff amount.

For every half-open interval `[start, end)`:

- A cliff contributes its one-time token amount when its timestamp is at or after `start` and before `end`.
- A linear schedule contributes its new weekly rate prorated over the overlap between the interval and the schedule's
  declared duration. This includes schedules that start before the requested interval and remain active inside it.
- Signed burn events remain in the source schedule but contribute zero to an unlock total. Burns can reduce unlocked
  supply; consumers must not clamp a cumulative supply series to its earlier maximum.
- All Unlocks equals Cliff Unlocks plus Linear Unlocks.
- Events without a known amount are excluded from unlock totals; null must not become zero. Producers retain an
  `unknownEventCount` for coverage monitoring without changing the displayed metric label.
- A missing events array, a missing tuple member, an unknown event type, or a non-finite duration violates the producer
  contract. The producer must reject the artifact update and preserve the last known good artifact.

Exact rolling summaries and charts use the same interval. Daily chart buckets split that interval at UTC-day boundaries,
including partial first and last days, so their sum equals the summary. USD totals include only events with a known amount
and protocols with a valid historical price requested at the artifact timestamp; producers retain coverage counts for
excluded inputs. Price and market-cap enrichments retain their own source timestamps rather than claiming a shared
fetch-completion timestamp. Current unlocked supply uses the last schedule sample at or before the artifact timestamp,
never a future sample.

The homepage unlock summary version 2 exposes cliff, linear, total, and coverage counts. The app accepts version 1
temporarily for a backend-first rollout, but version 1 cannot provide a truthful cliff/linear breakdown. Unlocks table
semantics are:

- `Unlocked Supply`: supply measured at the artifact timestamp.
- `Next 24h Unlocks`: exact rolling cliff plus linear releases; value and percentage filters use this same metric.
- `Next Event`: event information only. A cliff shows its one-time amount; a linear event shows its new weekly rate.
  Signed negative values are labeled as cliff or weekly burns and never presented as negative unlocks.
- `Next Event Types`: filters the categories shown for the next event. It does not change the all-category Next 24h metric.
- `7d Price Change After Unlock`: observed post-event price movement. It does not claim that the unlock caused the change.

The Tokens directory uses two rolling unlock metrics: `Past 30D Unlocks` covers `[now - 30 days, now)`,
and `Next 30D Unlocks` covers `[now, now + 30 days)`. Both include cliff and linear releases and value known
amounts using the current price enrichment. Full schedules must be retained so earlier-starting linear releases
contribute. These windows differ from the homepage's next 14 days and the Unlocks page's next 7/30 days.
A supported, priced schedule with no releases produces zero; an unsupported token or missing price remains
unavailable. Unknown event amounts are excluded; an all-unknown
row window remains unavailable. Headline totals sum the ranked directory universe even when the table is filtered.

Headline MCap and its 24-hour change exclude CoinGecko receipt assets: `market_cap_rank` is absent while
`market_cap_rank_with_rehypothecated` is present. Both ranks absent does not establish a receipt asset.
These exclusions apply only to the MCap headline; individual rows, charts, filters and other totals retain those assets.
The change compares eligible current market caps with `marketCap / (1 + priceChange24h / 100)`, using the same
tokens on both sides. It estimates price-driven movement at current circulating supplies, not measured historical
market-cap growth. Missing changes and changes at or below -100% cannot supply a prior value and are excluded
from both sides of the percentage calculation, but their current market caps remain in the headline total.

Tokens source failures remain distinct from successful empty responses. Only the failed source's measurements
are unavailable; successful measured zero and the established nullable activity aggregation rules are preserved.
`OI` is current open interest, despite the legacy internal `openInterest24h` field name. Spot and perpetual
volume are trailing 24-hour flows. Tokens CSV pagination pins complete derived rows, filter metadata and source
availability to one immutable export snapshot. Its identity is computed once per cached complete dataset.
The export fails if its snapshot cannot be saved or retrieved, rather than continuing on a new version.
An unavailable snapshot returns HTTP 503: storage cannot distinguish expiry from an outage or unreadable data.
Tokens page and chart clients check response schema versions and version their request URLs for deployment compatibility.
Browsing and exports share one compressed blob per derived content hash. Source pointers are scoped to five-minute
windows; browsing retains blobs for ten minutes. Export retention extends the same blob to 31 minutes, covering the
one-minute export publication cache. Shorter browsing retention must never shorten an existing export lease.

### Token Classification And Narrative Tracker

Token filters consume backend `filters.json` schema 2, with schema 1 compatibility during rollout.
Deployment `chains` and singular `primaryChain` describe different facts. Category membership uses exact
CoinGecko IDs and can overlap. RWA includes tokenized assets and tokens issued by RWA-focused protocols.
Governance classification requires token-holder rights evidence; it is independent of governance pages.

FDV consumes the separate `classifications.json` schema 2 artifact. Its explicit
`narrativeExcludedTokenIds` removes stablecoins from every Narrative sector basket while preserving their
RWA and Stablecoins filter memberships. Bitcoin, Ethereum and Solana remain standalone benchmark series.
Current constituents apply across stored history; this is not historical membership reconstruction.

When a selected token denomination lacks a usable benchmark, relative returns remain unavailable.
Keep the selected denomination and show its availability message rather than substituting USD returns.
USD returns do not require a token benchmark. A benchmark return of -100% also makes division undefined.

## RWA

RWA metrics have their own definitions and breakdown files:

- `public/rwa-definitions.json`
- `public/rwa-perps-definitions.json`
- `public/equities-definitions.json`
- `src/containers/RWA/definitions.ts`
- `src/containers/RWA/Perps/definitions.ts`

When changing RWA routes or charts, use those files as the local metric definitions and keep route-cache validation aligned with the route's slug semantics.

## Public API Validation

Route-cache validation is useful, but only after confirming the entity type expected by the adapter path.

Examples:

- `adapter-chain` routes should validate chain parameters through chain metadata.
- Normal protocol routes should validate protocol parameters through protocol metadata.
- Chain Fees and Chain Revenue use protocol-style upstream paths with chain-level IDs, so protocol metadata can miss for valid chains. Prefer explicit `entity=chain` from the client, then validate against chain metadata and the relevant `chainFees` or `chainRevenue` flag before fetching.

## Token detail links

Token pages resolve website, Twitter, Telegram and Discord links independently. A token directory
URL takes precedence over the corresponding cached CoinGecko coin-detail value. CoinGecko social
handles become full URLs; Discord uses a Discord invite from its chat links. Missing links are null
in page props and are not rendered. Coin details remain available when chart history is missing;
this does not change the sources or precedence of current market metrics.

Category links use the same `tokenFilterMetadata` as `/tokens`, joined by exact CoinGecko ID.
Show every assigned category label and link it to `/tokens?categories=<id>`. Tokens without
category membership have no category row; protocol categories are not substituted.
Token page categories use the same aggregate market-cap ordering and alphabetical tie-breaks as the
Tokens dropdown, computed from the shared market snapshot and cached by market version and filter generation.

## Token detail Yields

Token detail Yields uses the same population for SSR hydration and browser full-data requests: exact resolved asset
keys, `tokenOn=both` (reference asset or pool-held token), and `includeMemeTokens=true`. A token-specific page includes
its own meme-token pools. Browser pagination, sorting and filtering must not silently switch to the general Yields
API defaults (`tokenOn=reference`, meme pools excluded). SSR earn and borrow construction share one immutable Yields
handle; later browser refreshes acquire current data and are not pinned to the SSR generation.

Token Borrow requests include meme pools on both collateral and debt legs, with net APY descending.
Browser request settings and cache identities share the token-page policy used by SSR. Both Borrow responses
must succeed before either list replaces hydration. Failed Earn/Borrow full-data loads retain existing rows
and offer Retry beside the section error (or in the error placeholder when empty). Retry shows loading,
prevents duplicate requests, and preserves the requested page and sorting.

### Chain chart denominations

Chain and protocol chart denominations use `chainMetadata.gasTokenGeckoId` and `gasTokenSymbol` together. Missing gas metadata leaves USD as the only chain denomination; never infer a gas asset from the official token or default to ETH. Chain token price, market cap, volume, and token links continue to use the official `gecko_id` / `tokenSymbol`. For example, Arbitrum converts TVL using ETH prices while its token valuation series describe ARB. Token valuation and other intrinsically USD series retain their existing USD units.
