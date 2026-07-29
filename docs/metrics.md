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

- In a successful authoritative protocol or chain listing, an omitted row or nullable period means zero activity for that period. A successful empty listing therefore totals zero, and an inactive or deprecated child must not hide active siblings.
- A failed whole request remains unavailable (`null`). Do not convert a request failure into a successful zero or present a best-effort multi-source result as complete.
- Selected-chain datasets that retain successful chains after another chain fails must carry explicit partial-coverage metadata through APIs, server-stream cache seeding, and consumers.
- These activity rules do not apply to exact TVL snapshots, ratio denominators, required bridge legs, or chart points. Missing required values for those metrics remain unknown.

Earnings additionally combines two authoritative sources:

- Revenue minus emissions is unavailable when either whole source fails.
- Within successful listings, nullable revenue activity and a missing protocol emissions row each contribute zero.
- Earnings comparison fields remain unavailable when the emissions producer has no matching comparison periods. Selected-chain earnings must not relabel all-chain periods as chain-specific values.

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
- extra TVL setting keys: staking, borrowed, pool2, vesting, govtokens, doublecounted, and liquidstaking
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

Do not assume two routes use the same TVL model just because they share the same toggle names. Some pages start from an adjusted base TVL, while others start from raw TVL and add selected extras. Some table paths use double counted or liquid staking toggles for display/strike behavior rather than normal extra addition.

Oracle and Fork chart API `key` query params are not the same contract as local TVL setting keys. For valid keys, the chart response shape is stable across keys, but the backend v2 chart routes only accept the protocol/treasury TVL chart keys such as `tvl`, `staking`, `borrowed`, `pool2`, `vesting`, `all`, and `OwnTokens`. Do not send local overlap setting names such as `doublecounted`, `liquidstaking`, or `dcAndLsOverlap` directly as Fork/Oracle chart `key` values.

Before refactoring TVL:

- Inventory the route families involved.
- Pin current behavior with characterization tests.
- Preserve displayed numbers unless a product/API migration explicitly asks for a change.
- Prefer local container modules for route-specific behavior. Use `src/metrics` only if a stable cross-container semantic invariant is proven.

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

- `/raises` returns `amount` as a number and `valuation` primarily as a numeric string, both in USD millions.
- `/v2/metrics/tvl/protocol/:protocol` embeds the same fields and units.

Normalize both API shapes at their fetch boundaries with `normalizeRaisesApiItem`. App consumers, snapshot reads, tables, charts,
filters, and CSV exports should only use `amountUsd` and `valuationUsd`. Raw snapshot publication remains transport-shaped
so existing artifacts can be read and normalized consistently. The Downloads Raises dataset also exposes normalized USD
fields.

The warehouse has a different contract: `fact.raise_event.amount` and `fact.hack_event.amount` are already whole USD.
Do not pass warehouse rows through the Raises API normalizer or silently combine warehouse and API records; the sources
also differ in coverage and may differ in returned-funds data.

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
