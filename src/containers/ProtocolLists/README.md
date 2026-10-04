# ProtocolLists

ProtocolLists owns protocol list pages that are neither one protocol (`ProtocolOverview`) nor the shared ranking table (`ProtocolRankings`).

## Routes

- `/recent`, `/airdrops`
- `/mcaps`, `/fdv`, `/outstanding-fdv`, `/token-prices` and their `/chain/[chain]` pages
- `/active-loans`, `/total-staked`, `/pool2` and their `/chain/[chain]` pages
- `/api/public/protocol-lists`, the paginated rows and CSV for `/recent` and `/airdrops`

Shared with: `fetchProtocols` in `api.ts` is the `/lite/protocols2` source for more than twenty other containers and pages, and `applyProtocolTvlSettings` in `utils.ts` prepares rows for `ProtocolRankings` and `DeFiWatchlist`. A change to either reaches far outside this folder.

## Where the logic lives

| To change                                                      | Edit                         | Notes                                                                                |
| -------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Which protocols are recent or airdrops                         | `queries.ts`                 | `getRecentProtocols`, `getAirdropsProtocols`                                         |
| Filtering, TVL scope, bounds, search and sort for those tables | `pagination.server.ts`       | Initial rows, later pages and CSV all use it                                         |
| URL params, page sizes and the query signature                 | `tableQuery.ts`              | Browser-safe; `PROTOCOL_LIST_LIMITS`                                                 |
| Snapshot storage and initial props                             | `server/tableData.server.ts` |                                                                                      |
| CSV columns                                                    | `export.server.ts`           |                                                                                      |
| Additive TVL toggles on list rows                              | `utils.ts`                   | `applyExtraTvl` for recent and airdrops, `applyProtocolTvlSettings` for ranking rows |

## Rules

- Additive TVL keys follow the `/lite/protocols2` producer: `staking`, `pool2`, `borrowed` and `vesting` (`PROTOCOL_LIST_ADDITIVE_TVL_KEYS`). Never reuse the wider chain toggle set. See `docs/metrics.md` → "TVL models".
- A recent row requires `listedAt`, and zero counts as listed.
- Recent rows stay individual listings and are never grouped under a parent.
- Airdrop membership is `symbol === '-'`, minus the names in `airdrop-exclude.ts`, minus children of a parent that has its own token.
- The airdrops list needs both the protocol listing and the funding rounds; if either fetch fails, the list is unavailable.
- The airdrops funding column sorts and exports the disclosed subtotal (`raiseSummary.totalUsd`). The CSV labels it "Disclosed Money Raised" and adds the undisclosed round count. See `docs/metrics.md` → "Funding amounts".
- Chain and category selections follow the picker rules in `src/components/Select/query.ts`.
- Nullable TVL snapshots stay null until a page deliberately normalizes them. See `docs/metrics.md` → "Null, zero and failure".

## Not here

- One protocol's page → `ProtocolOverview`
- The ranking table on `/`, `/chain/[chain]` and `/protocols` → `ProtocolRankings`
- Chain TVL charts and their toggles → `ChainOverview`
