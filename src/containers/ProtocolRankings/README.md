# ProtocolRankings

ProtocolRankings owns the shared protocol ranking table, protocol row types, custom protocol columns, and the `getProtocolsByChain` read model.

This folder is shared by several route families. It is not the single-protocol overview and it is not the recent/airdrops/token-list container.

## Used By

Common consumers:

- `/protocols`
- ChainOverview protocol rows
- DeFi watchlist protocol rows
- fork pages
- compare pages
- some special protocol-list or safe-harbor pages that need the shared protocol row model

Start from the route file in `src/pages`, then follow imports here when the page renders `ChainProtocolsTable` or calls `getProtocolsByChain`.

## Main Files

- `Table.tsx`: shared protocol ranking table and `ChainProtocolsTable` rendering.
- `queries.server.ts`: `getProtocolsByChain` fetch orchestration, parent/child aggregation, and row assembly.
- `readModel.ts`: pure adapter metric row enrichment for protocol fees, revenue, holders revenue, DEX volume, and the
  extended trading/activity metrics used by ChainOverview rankings.
- `types.ts`: shared protocol row, child protocol, and TVL types.
- `utils.ts`: protocol, fork, and `strikeTvl` filtering helpers.
- `customColumnsUtils.ts`: custom protocol table column definitions.
- `CustomColumnModal.tsx`: custom column UI.
- `formula.service.ts`: formula evaluation for custom columns.

## Data Flow

Shared protocol rows:

```text
route/container
  -> getProtocolsByChain(...)
  -> ProtocolRankings row model
  -> ChainProtocolsTable / Table
```

ChainOverview example:

```text
ChainOverview/queries.server.tsx
  -> getProtocolsByChain(...)
  -> ChainOverview page data
  -> ProtocolRankings/ChainProtocolsTable
```

Watchlist example:

```text
DeFiWatchlist
  -> protocol rows
  -> ProtocolRankings/ChainProtocolsTable
```

Keep this shared row model stable. Changes here can affect multiple pages that do not live under `ProtocolRankings`.

## Metric Semantics

`getProtocolsByChain` combines protocol list data with adapter metrics and metadata:

- base protocol rows come from `ProtocolLists/api`.
- fees, revenue, holders revenue, spot DEX volume, perp volume, normalized volume, active liquidity,
  open interest, options volume, and aggregator volume data come from AdapterMetrics fetchers.
- token prices are fetched for protocol and parent protocol market-cap derived fields.
- emissions/incentives are merged from Incentives data.
- TVL sections come from protocol `chainTvls`.

Important rules:

- `toFilterProtocol` controls whether a protocol belongs in a chain-scoped row set.
- `protocolMatchesForkFilter` controls fork-specific row filtering. The lite protocol
  producer does not emit oracle membership, so this public read model has no oracle filter.
- `toStrikeTvl` derives strike presentation from removed categories or the presence of
  upstream `doublecounted`/`liquidstaking` classification sections. Hidden chain-only
  settings do not change it.
- Adapter sources fail independently. Existing fees, revenue, holders revenue, and DEX rows retain their legacy
  nullable-period normalization. Extended activity sources preserve nullable listed periods and leave protocols absent
  from the source blank; whole-source failure leaves that metric unavailable.
- Normalized perp volume follows the `/perps` rule for 24h only: each leaf uses the lower of normalized and reported
  perp volume before parent aggregation. Normalized 7d and 30d remain unchanged from their source.
- Extended activity sources are opt-in because this read model has consumers outside ChainOverview. The homepage and
  `/chain/:chain` enable them; other shared-table consumers keep the smaller request set.
- Primary metric presets are Fees, Revenue, Spot, Perps, and TVL. Metric and period selections are independent; when
  both are selected the visible columns are their intersection. Options and DEX/perp/bridge aggregator metrics stay
  available as individually selected columns but are excluded from metric and period presets by default.
- Routed-volume columns follow their market domain rather than a combined Aggregators group: DEX aggregators live under
  Spot, perp aggregators under Perps, and bridge aggregators under Bridges. Their tooltips warn against adding routed and
  venue volume because the same trade can appear in both.
- Period presets always retain the latest TVL, Open Interest, and Active Liquidity snapshots alongside the selected
  TVL change and flow period. Other columns without a period are not implicitly included.
- The ranking search filters the already-loaded virtualized table by protocol name only. It does not issue another
  server request or build a second protocol dataset.
- The second-row Reset action restores the compact overview columns and TVL sort, clears name search, expanded rows,
  metric/period preset storage, legacy preset storage, column visibility storage, and the URL-backed TVL range. It
  preserves custom-column definitions because resetting filters must not delete user-authored formulas.
- DEX notional volume is not part of this general ranking table; Spot refers only to spot token-swap volume.
- Parent/child protocol aggregation affects names, chains, TVL, and adapter metric fields.
- A parent row requires at least two eligible children and canonical parent metadata;
  otherwise children remain ordinary public rows and internal grouping IDs are omitted.
- Exact chain-name prefixes are removed by prefix length, so hyphenated display names remain intact.
- Parent DEX `change_7dover7d` is derived from aggregated current and previous totals rather than summing child percentages.
- Fee/revenue values here are protocol/app rows on a chain, not Chain Fees or Chain Revenue ranking semantics.
- Parent P/F and P/S aggregation uses summed `annualized1y` fee/revenue denominators and preserves null when a contributing child is missing the annualized value.
- Explicit zero TVL participates in parent current and comparison math regardless of
  deprecation; unavailable producer snapshots remain null and are never inferred.
- Bridge TVL is intentionally suppressed in this table and does not contribute to a mixed
  parent. A nullable non-Bridge child remains required and keeps the parent TVL unavailable.
- A selected-chain protocol without an exact `chainTvls` entry is unavailable because the
  response has no coverage marker proving that omission means zero.
- Market-cap-to-TVL, P/F, and P/S ratios require positive denominators. A zero numerator
  over a positive denominator remains a valid zero ratio.
- A successful emissions lookup with no protocol row means zero incentives; a failed or
  unavailable emissions source keeps emissions and derived earnings unavailable.
- A nullable period on a matched emissions row remains unavailable and makes the matching
  parent emissions and earnings period unavailable; it is never skipped as a partial sum.
- Emissions are all-chain data and remain unavailable on selected-chain rankings.
- TVL display behavior here is table/read-model behavior. Previous TVL fields may stay null after table toggles; do not assume this matches ChainOverview chart TVL behavior.

## TVL Notes

Be careful with:

- `default` TVL versus keyed extra TVL sections
- upstream `doublecounted` and `liquidstaking` classification sections (strike only)
- additive protocol sections (`staking`, `pool2`, `borrowed`, `vesting`) versus the
  impossible protocol-level `govtokens` key
- categories removed from chain TVL
- `strikeTvl` for parent and child rows
- min/max TVL filtering in consumers

Before changing TVL behavior here, check `docs/metrics.md` and add characterization tests in the consumer or this folder.

## Tests

This shared area has high blast radius. Add focused tests before refactoring `queries.server.ts`, `toFilterProtocol`, `toStrikeTvl`, or parent/child aggregation.

Current local tests:

- `__tests__/queries.server.test.ts`: parent/child aggregation and fallback, chain dedupe,
  hyphenated chain filtering, independent adapter-source availability, successful inactive
  zeros, all-chain emissions availability, strict annualized null behavior, finite TVL
  extras, exact zero/null parent changes, and parent DEX change derivation.
- `__tests__/readModel.test.ts`: nullable activity-period normalization,
  fee/revenue/holders revenue/DEX enrichment, and strict earnings availability.
- `__tests__/utils.test.ts`: direct `toFilterProtocol`, fork filtering, and `toStrikeTvl` behavior.
- `__tests__/formula.service.test.ts`: aliases, zero/boolean preservation, typed scalar
  errors, strict sort values, formatting, and narrowed saved custom-column/visibility parsing.

Still useful if touched:

- Add consumer coverage for any new route-specific ranking table behavior that cannot be pinned through these pure helpers.

Focused command:

```bash
bun run test src/containers/ProtocolRankings/__tests__/queries.server.test.ts src/containers/ProtocolRankings/__tests__/readModel.test.ts src/containers/ProtocolRankings/__tests__/utils.test.ts src/containers/ProtocolRankings/__tests__/formula.service.test.ts
```

For source changes, follow the repo root verification instructions.

## Change Rules

- Treat this as shared infrastructure for protocol rows.
- Preserve public page numbers and table behavior unless explicitly requested.
- Trust upstream API payloads and aggregates.
- Add characterization tests before extracting or changing aggregation rules.
- Do not move route-specific UI state into this folder.
- Avoid re-export shims and barrel files. Update imports directly.
