# ProtocolRankings

ProtocolRankings owns the shared protocol ranking table, its row model and custom columns, and the `getProtocolsByChain` read model. Recent, airdrop, token and extra-TVL lists belong to `ProtocolLists`.

## Routes

- `/protocols`
- `/api/public/protocol-rankings` and `/api/dynamic/protocol-rankings/*`, the paginated rows and CSV export

Shared with:

| Consumer                                | Uses                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `ChainOverview` (`/`, `/chain/[chain]`) | `getProtocolRankingsSnapshot`, `paginateProtocolRankingRows`, `ChainProtocolsTable` |
| `pages/safe-harbor-agreements.tsx`      | `getProtocolRankingsSnapshot`                                                       |
| `Forks`                                 | `getProtocolsByChain`, `ChainProtocolsTable`                                        |
| `DeFiWatchlist`, `CompareProtocols`     | `ChainProtocolsTable`                                                               |
| `Oracles`                               | `toStrikeTvl`                                                                       |
| `ProtocolLists`                         | `removedCategoriesFromChainTvlSet`, `IProtocol`                                     |

## Where the logic lives

| To change                                                          | Edit                                          | Notes                                                               |
| ------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------- |
| Row assembly, parent and child aggregation, adapter source fetches | `queries.server.ts`                           | `getProtocolsByChain`                                               |
| Adapter metric enrichment of rows                                  | `readModel.ts`                                | Fees, revenue, holders revenue, DEX volume, activity sources        |
| Snapshot storage and the publication gate                          | `server/tableData.server.ts`                  | `snapshot.validation.ts` blocks a degraded snapshot from publishing |
| The paginated ranking API                                          | `server/api.ts`                               |                                                                     |
| Filtering and sort order across the whole snapshot                 | `pagination.server.ts`                        | Cursor mechanics live in `src/server/tablePages/`                   |
| URL params, page sizes and the query signature                     | `tableQuery.ts`                               | Browser-safe; initial rows are `PROTOCOL_RANKINGS_LIMITS.initial`   |
| Sort values for columns, pagination and export                     | `sortAccessors.ts`                            |                                                                     |
| Remote search, sort, CSV and scroll loading in the browser         | `remoteTable.tsx`                             |                                                                     |
| The displayed TVL strike                                           | `tvlStrike.ts`                                |                                                                     |
| Columns, presets and Reset                                         | `Table.tsx`, `settings.ts`                    |                                                                     |
| Custom column formulas                                             | `formula.service.ts`, `customColumnsUtils.ts` |                                                                     |

## Rules

- `getProtocolsByChain` fetches the extended activity sources (perps, options, aggregators, open interest and others) only with `includeExtendedMetrics`. The ranking snapshot opts in; `Forks` keeps the smaller request set.
- The metric presets are Fees, Revenue, Spot, Perps and TVL. A metric preset and a period preset combine as the intersection of their columns, and columns without a preset (options and aggregators) stay out of every preset.
- Reset restores the TVL sort, clears search, expanded rows, preset and column storage and the URL TVL range, and keeps custom columns, because a reset must not delete user-authored formulas.
- A parent row needs at least two eligible children and canonical parent metadata; otherwise its children stay ordinary rows.
- Bridge TVL is suppressed in this table and never contributes to a parent.
- Emissions are all-chain data and stay unavailable on selected-chain rankings.
- Spot means spot token-swap volume only; DEX notional volume is not in this table.
- Fee and revenue values here are app-on-chain rows, not Chain Fees or Chain Revenue. See `docs/metrics.md` → "Terms that mean different things".
- The snapshot's `strikeTvl` marks a protocol that has a `doublecounted` or `liquidstaking` section or a removed category. The displayed strike follows the reader's `doublecounted` and `liquidstaking` toggles, and the snapshot value never changes. See `docs/metrics.md` → "TVL models".
- Parent P/F and P/S use summed `annualized1y` denominators. See `docs/metrics.md` → "Earnings, P/F and P/S".

## Not here

- One protocol's page → `ProtocolOverview`
- `/recent`, `/airdrops`, token metric and extra-TVL lists → `ProtocolLists`
- Route-specific UI state → the consuming container
