# ProtocolLists

ProtocolLists owns protocol list/read-model pages that are not the single-protocol overview and not the shared protocol ranking table.

This folder is used by recent protocols, airdrops, token metric lists, and extra-TVL list pages. It also provides protocol-list API helpers used by other containers.

## Route Families

Common routes:

- `/recent`
- `/airdrops`
- `/airdrop-directory`
- `/mcaps` and `/mcaps/chain/[chain]`
- `/fdv` and related token metric list pages
- `/outstanding-fdv`
- `/token-prices` and `/token-prices/chain/[chain]`
- `/active-loans` and `/active-loans/chain/[chain]`
- `/total-staked` and `/total-staked/chain/[chain]`
- `/pool2` and `/pool2/chain/[chain]`

The `/protocol/[protocol]` entity page belongs to `ProtocolOverview`. The `/protocols` ranking table and chain overview protocol rows are shared through `ProtocolRankings`.

## Main Files

- `api.ts` and `api.types.ts`: protocol list API fetchers and DTO types.
- `queries.ts`: page-data/read-model builders for recent, airdrops, token metrics, and extra-TVL pages.
- `RecentProtocols.tsx`: recent and airdrop page container.
- `RecentProtocolsTable.tsx`: recent/airdrop table rendering.
- `ProtocolsWithTokens.tsx`: protocol token metric list UI.
- `ExtraTvlByChain.tsx`: active loans, total staked, and pool2 chain views.
- `utils.ts`: TVL toggle transforms and list filtering helpers.
- `types.ts`: protocol-list read-model types.
- `airdrop-exclude.ts`, `airdrops.ts`, `data.json`: airdrop-specific local data.

## Data Flows

Recent protocols:

```text
src/pages/recent.tsx
  -> getRecentProtocols()
  -> RecentProtocols
  -> RecentProtocolsTable
```

Airdrops:

```text
src/pages/airdrops.tsx
  -> getAirdropsProtocols()
  -> RecentProtocols
  -> RecentProtocolsTable
```

Token metric lists:

```text
src/pages/mcaps*.tsx
src/pages/fdv*.tsx
src/pages/outstanding-fdv*.tsx
src/pages/token-prices*.tsx
  -> getProtocolsMarketCapsByChain(...)
  -> getProtocolsFDVsByChain(...)
  -> getProtocolsAdjustedFDVsByChain(...)
  -> getProtocolsTokenPricesByChain(...)
  -> ProtocolsWithTokens
```

Extra-TVL pages:

```text
src/pages/active-loans*.tsx
src/pages/total-staked*.tsx
src/pages/pool2*.tsx
  -> getExtraTvlByChain(...)
  -> ExtraTvlByChain
```

## Metric Semantics

ProtocolLists consumes protocol list data and reshapes it for list pages. It should not become a generic metric registry.

Important rules:

- `fetchProtocols()` is a shared protocol list source used by many containers.
- `/lite/protocols2` returns `protocolCategories` and emits nullable top-level and section
  TVL snapshots. Every child protocol has `category`; tagged protocols also retain `tags`,
  so the fields are not mutually exclusive. List DTOs preserve nullable snapshots until a
  page deliberately normalizes them.
- Protocol-list TVL sections are finite. `staking`, `pool2`, `borrowed`, and `vesting`
  are the only selectable/additive keys. `doublecounted` and `liquidstaking` are upstream
  classification markers only, and `govtokens` is not a protocol-list section.
- Recent/airdrop TVL toggle behavior is not the same as chain TVL normalization.
- Hidden chain-only doublecounted/liquidstaking/govtokens settings do not change protocol
  list values, strike state, or tooltip copy.
- Selected-chain recent/airdrop snapshots use exact chain-name prefixes (including
  hyphenated names). Present null current/previous snapshots keep the aggregate period
  null; every selected chain declared by the protocol requires a base snapshot. A missing
  selected-chain base is unavailable because the response has no coverage marker proving
  that omission means zero. Explicit zero remains zero, and selected undeclared chains are
  irrelevant.
- `applyProtocolTvlSettings` applies additive table toggles, min/max TVL filtering, and
  child protocol behavior without changing producer-derived `strikeTvl`.
- Min/max TVL bounds exclude unavailable rows. Market-cap-to-TVL ratios require a strictly
  positive TVL denominator; zero market cap over positive TVL remains a valid zero ratio.
- Extra-TVL and token-metric pages group only canonical parents with multiple visible
  children; missing parents and sole children remain public rows.

Read `docs/metrics.md` before changing TVL terminology or trying to share behavior with chain TVL pages.

## Tests

Local TVL/list helper coverage now exists, but the surface area is still broad. Add or update focused tests before refactoring TVL/list behavior.

Current covered helper targets:

- `applyExtraTvl`:
  - adds only the four producer-backed additive protocol extras
  - ignores chain-only doublecounted/liquidstaking/govtokens state
  - preserves unknown previous snapshots as null
  - clamps negative values to zero
  - recalculates percent changes and market-cap-to-TVL
- `scopeRecentProtocolToChains`:
  - aggregates selected base-chain snapshots exactly
  - handles hyphenated chain-name prefixes
  - distinguishes known, null, explicit zero, and missing selected-chain current values
- `applyProtocolTvlSettings`:
  - filters by min/max after selected extras are applied
  - handles child protocols
  - leaves producer-derived strike presentation unchanged by hidden chain-only settings
  - preserves null previous TVL fields for parent and child table rows
- `getExtraTvlByChain` and token metrics:
  - preserve explicit zero and null metric rows
  - retain zero-valued chain navigation entries by section presence
  - preserve missing-parent and sole-child rows

Focused command:

```bash
bun run test src/containers/ProtocolLists/__tests__/utils.test.ts src/containers/ProtocolLists/__tests__/queries.test.ts src/containers/ProtocolLists/utils.old.test.ts
```

For source changes, follow the repo root verification instructions.

## Change Rules

- Trust upstream API payloads and aggregates.
- Keep protocol-list extra-key admission aligned with the `/lite/protocols2` producer;
  do not reuse broader chain-level toggle key sets.
- Preserve public routes, query params, payload shapes, page copy, and displayed numbers unless explicitly requested.
- Do not dedupe TVL behavior with ChainOverview or ChainsByCategory until characterization tests prove it is the same behavior.
- Keep protocol entity behavior in `ProtocolOverview`.
- Keep shared protocol ranking table behavior in `ProtocolRankings`.
- Avoid re-export shims and barrel files. Update imports directly.
