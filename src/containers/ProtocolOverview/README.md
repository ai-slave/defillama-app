# ProtocolOverview

ProtocolOverview owns the pages about one protocol or one CEX: the overview, the chart page, and the subroutes that share its layout and metric flags. Protocol lists and ranking tables belong to `ProtocolLists` and `ProtocolRankings`.

## Routes

- `/protocol/[protocol]`, `/chart/protocol/[protocol]`
- `/protocol/*/[protocol]` subroutes, except `/protocol/deep-dive` and `/protocol/investor-relations` (`Investors`) and `/protocol/card-details` (`CryptoCards`)
- `/cex/[cex]`, `/cex/assets/[cex]`, `/cex/stablecoins/[cex]`

## Where the logic lives

| To change                                       | Edit                                      | Notes                                               |
| ----------------------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| Which charts and sections a protocol shows      | `getProtocolMetricFlags` in `queries.tsx` | Maps protocol metadata to availability              |
| Adapter chart requests (fees, revenue, volume…) | `chartDescriptors.ts`                     |                                                     |
| TVL chart composition                           | `tvlChart.ts`                             | Extra TVL series, timestamp alignment, denomination |
| Main chart orchestration                        | `useFetchProtocolChartData.ts`            |                                                     |
| TVL toggles on the overview                     | `useFinalTVL` in `helpers.ts`             |                                                     |

## Rules

- A subroute composes `fetchProtocolOverviewMetrics`, `getProtocolMetricFlags` and `ProtocolOverviewLayout`, and its section UI may come from another container, such as `AdapterMetrics`, `Yields` or `TokenRights`.
- Protocol fee and revenue charts use the protocol adapter endpoints, never chain-native fee and revenue semantics. See `docs/metrics.md` → "Terms that mean different things".
- Fee, revenue and holders-revenue cards lead with observed 30-day totals, never annualized values or 30-day run rates.
- `useFinalTVL` reads the shared `tvl` settings namespace, and its toggles come only from the TVL keys present in the protocol's data. See `docs/metrics.md` → "TVL models".
- `dcAndLsOverlap` is chain overlap data, never a protocol toggle.
- A chart request URL change is a behavior change; test the exact URL or descriptor before changing it.

## Not here

- Protocol lists and ranking tables → `ProtocolLists`, `ProtocolRankings`
- Category pages → `ProtocolTaxonomy`
- Adapter ranking pages → `AdapterMetrics`
- `/cex/card-details/[cex]` → `CryptoCards`
