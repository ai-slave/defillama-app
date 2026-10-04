# AdapterMetrics

AdapterMetrics owns the pages that rank or chart adapter data (fees, revenue, volume, open interest, P/F, P/S) by protocol or chain. One protocol's page belongs to `ProtocolOverview`, which reuses these fetchers.

## Builder responsibilities

Use the smallest builder that matches the route, all in `queries.tsx`. Never substitute one ranking builder for another because the route labels look alike.

| Builder                                    | Builds                                                                           | Used by                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `getAdapterByChainPageData`                | Protocol rows for one chain or all chains                                        | `/<metric>`, `/<metric>/chain/[chain]`                                                   |
| `getChainsByAdapterPageData`               | Chain rows for every other chain ranking, app-on-chain fees and revenue included | `/<metric>/chains`, `/app-fees/chains`, `/app-revenue/chains`, `/holders-revenue/chains` |
| `getChainsByChainNativeFeeRevenuePageData` | Chain-native Chain Fees and Chain Revenue                                        | `/fees/chains`, `/revenue/chains`                                                        |
| `getChainsByREVPageData`                   | REV: chain fees plus MEV tips                                                    | `/rev/chains`                                                                            |
| `getAdapterChainOverview`                  | Adapter metrics and chart data for one chain                                     | `ProtocolRankings` row assembly                                                          |
| `getAdapterProtocolOverview`               | Adapter metrics and chart data for one protocol                                  | `/protocol/<metric>/[protocol]` sections                                                 |
| `getChainsByAdapterChartData`              | The chain-breakdown dataset behind ranking charts                                | `/api/public/page-data/dimension-adapters/chains-chart`                                  |

## Routes

- `/fees`, `/revenue`, `/holders-revenue`, `/earnings`, `/pf`, `/ps` and their `/chain/[chain]` pages
- `/fees/chains`, `/revenue/chains`, `/holders-revenue/chains`, `/app-fees/chains`, `/app-revenue/chains`, `/rev/chains`
- `/dexs`, `/perps`, `/dex-aggregators`, `/perps-aggregators`, `/bridge-aggregators`, `/normalized-volume`, `/open-interest` and their `/chain/[chain]` and `/chains` pages (`/open-interest` has no `/chains`)
- `/options` and `/options/chain/[chain]`
- `/options/premium-volume`, `/options/notional-volume` and their `/chain/[chain]` and `/chains` pages

## Rules

- Keep each page's builder call visible in its `src/pages/` file. Never add a generic page dispatcher that hides which builder a route calls.
- Reason about `adapterType` and `dataType` together: `dailyVolume` is shared by DEXs, perps and both aggregator types, and `dailyNotionalVolume` by DEX and options notional.
- `getChainMetadataKey(adapterType, dataType)` in `constants.ts` is the one place that maps a pair to its chain metadata flag.
- Chain-native fees and revenue, app-on-chain aggregation and REV are different concepts with different builders. See `docs/metrics.md` → "Terms that mean different things".
- P/F and P/S use `annualized1y` denominators. See `docs/metrics.md` → "Earnings, P/F and P/S".
- Chart query params are user-facing state; changing one is a behavior change.
- A rule moves to `src/metrics` only when another container or a public API endpoint consumes the same invariant.

## Not here

- Chart-builder breakdowns by protocol or chain → `src/containers/ProDashboard/server/chartBuilder/adapterMetrics/`
- One protocol's page and its layout → `ProtocolOverview`
- `/chains`, the chain directory → `ChainsByCategory`
