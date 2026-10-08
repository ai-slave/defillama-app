# Metrics

`public/pages.json` is the product glossary: page names, routes, descriptions and total tracked keys.

`src/metrics/feesRevenue.ts` holds the typed fee and revenue descriptors (labels, ranking routes, metadata flags, adapter paths), and `src/metrics/routeSemantics.ts` maps them to chart API parameters; read those files instead of restating a fee or revenue route here.

## Where the rule lives

| When you touch                                                               | Read                                                                                                                                                                                   |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chain Fees, Chain Revenue, Chain Holders Revenue, App Fees, App Revenue, REV | `src/metrics/feesRevenue.ts`, `src/metrics/routeSemantics.ts`                                                                                                                          |
| Adapter-backed rankings and charts                                           | `src/containers/AdapterMetrics/README.md`                                                                                                                                              |
| `/recent`, `/airdrops`, token metric lists, extra-TVL lists                  | `src/containers/ProtocolLists/README.md`                                                                                                                                               |
| The `/protocols` table and chain overview protocol rows                      | `src/containers/ProtocolRankings/README.md`                                                                                                                                            |
| One protocol's page                                                          | `src/containers/ProtocolOverview/README.md`                                                                                                                                            |
| Exchanges, `/mica`, `/ramp`                                                  | `src/containers/Exchanges/README.md`                                                                                                                                                   |
| RWA routes and charts                                                        | `public/rwa-definitions.json`, `public/rwa-perps-definitions.json`, `public/equities-definitions.json`, `src/containers/RWA/definitions.ts`, `src/containers/RWA/Perps/definitions.ts` |
| Stablecoins                                                                  | Headers of `Stablecoins/utils.ts` (totals, history, chain rows) and `Stablecoins/chartSeries.ts` (charts)                                                                              |
| The `/tokens` directory                                                      | Header of `Tokens/queries.server.ts`                                                                                                                                                   |
| The token page                                                               | Headers of `Token/tokenOverview.ts` (links, categories, optional sources), `Token/TokenYieldsSection.tsx` and `Token/TokenBorrowSection.tsx`                                           |
| Oracles                                                                      | Header of `Oracles/queries.tsx`                                                                                                                                                        |
| The LST directory                                                            | Header of `LST/queries.tsx`                                                                                                                                                            |
| Protocol categories and tags                                                 | Header of `ProtocolTaxonomy/queries.tsx`                                                                                                                                               |
| Compare Protocols chart                                                      | Headers of `CompareProtocols/requestPlan.ts` and `CompareProtocols/chartData.ts`                                                                                                       |
| Narrative Tracker                                                            | Header of `NarrativeTracker/chartData.ts`                                                                                                                                              |
| Pro protocol table share columns                                             | Header of `ProDashboard/unifiedTable/config/columnDictionary.ts`                                                                                                                       |
| Picker share views                                                           | `docs/charts.md` → "Share views"                                                                                                                                                       |

Container paths are under `src/containers/`. Start from the route file in `src/pages` and follow its imports to the owning container. Check whether the metric is chain-level economics, app-on-chain aggregation, protocol-level data or an RWA breakdown before reusing an assumption from a page with a similar name.

## Terms that mean different things

| Term                                                          | Means                                                                                                                                       | Not                                                                                                | Code source                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Chain Fees, Chain Revenue                                     | Chain-level economics: what users pay to use the chain, and the part the chain keeps                                                        | The sum of apps on the chain                                                                       | `feeRevenueMetrics.chainFees`, `.chainRevenue`                            |
| Chain Holders Revenue                                         | The part of chain revenue paid to token holders, usually by burning fees; gated on `chainHoldersRevenue`, never on `chainRevenue`           | Holders revenue of apps on the chain                                                               | `feeRevenueMetrics.chainHoldersRevenue`                                   |
| App Fees, App Revenue                                         | The sum of apps on the chain, excluding stablecoins, liquid staking apps and gas                                                            | Chain Fees or Chain Revenue; use them only where the product says `App Fees` or `App Revenue`      | `feeRevenueMetrics.appFees`, `.appRevenue`                                |
| Holders revenue by chain (`/holders-revenue/chains`)          | Chains ranked by the holders revenue of their apps, gated on the `revenue` flag                                                             | Chain Holders Revenue, which has no ranking page and opens from a chain row on `/holders-revenue`  | `getChainsByAdapterPageData` in `AdapterMetrics/queries.tsx`              |
| REV                                                           | Chain fees plus MEV tips                                                                                                                    | Chain Fees, although both use the `chainFees.chains` tracked key                                   | `feeRevenueMetrics.rev`, `REV_PROTOCOLS` in `AdapterMetrics/constants.ts` |
| `/fees/chain/[chain]`, `/revenue/chain/[chain]`               | Protocols ranked on one chain                                                                                                               | The detail page of `/fees/chains` or `/revenue/chains`, which rank chains by chain-level economics | `src/pages/fees/chain`, `src/pages/revenue/chain`                         |
| `dailyVolume`, `dailyNotionalVolume`                          | Data types shared by several adapter types; the metadata flag depends on `adapterType`                                                      | A metric you can identify from `dataType` alone                                                    | `getChainMetadataKey` in `AdapterMetrics/constants.ts`                    |
| Perp and options open interest                                | Two series from the `open-interest` adapter, told apart by protocol category; flags `openInterest` and `optionsOpenInterest`                | Values to sum; a request without a category returns only `Derivatives`                             | `OPTIONS_OPEN_INTEREST_CATEGORY`, `ProtocolOverview/openInterestSplit.ts` |
| `openInterest24h` (Tokens)                                    | Current open interest                                                                                                                       | A 24-hour flow                                                                                     | `Tokens/queries.server.ts`                                                |
| Protocol liquidations                                         | `liquidations` adapter data: `dailyLiquidationVolume` and `dailyCollateralLiquidated`, flags `liquidationVolume` and `collateralLiquidated` | The Liquidations page, which tracks collateral at risk                                             | `AdapterMetrics/constants.ts`                                             |
| Bridged TVL                                                   | Value of tokens held on a chain from chain-assets data; with `govtokens` it is `total + ownTokens`                                          | DeFi protocol TVL                                                                                  | `ChainOverview/server/charts.ts`                                          |
| Active addresses (`active-users`)                             | Distinct senders in one UTC day; grouped charts show the daily average and offer no cumulative mode                                         | Additive across days                                                                               | `AdapterMetrics/constants.ts`                                             |
| New addresses (`new-users`)                                   | Each address at its first interaction; adds up across days and grouped periods                                                              | Active addresses                                                                                   | `AdapterMetrics/constants.ts`                                             |
| `dailyGasUsed`, `dailyGasUsedUsd`                             | Gas in the chain's native token, and its separately priced USD cost                                                                         | Interchangeable; never currency-format native gas                                                  | `ADAPTER_DATA_TYPES` in `AdapterMetrics/constants.ts`                     |
| Stablecoins chain list `chains[].totalCirculatingUSD`         | Stablecoin market cap on the chain                                                                                                          | DeFi TVL; never the denominator of a "Stables Mcap / DeFi TVL" ratio                               | `Stablecoins/api.types.ts`                                                |
| Hack `amount`, `returnedFunds`                                | Whole USD in `/hacks` and in the protocol TVL payload; read `amountUsd` and `returnedFundsUsd`                                              | USD millions; never multiply by `1e6`                                                              | `normalizeHack` in `Hacks/model.ts`                                       |
| Raise `amount`, `valuation`                                   | USD millions in `/raises` and in the protocol TVL payload; read `amountUsd` and `valuationUsd`                                              | Whole USD                                                                                          | `normalizeRaisesApiItem` in `Raises/model.ts`                             |
| Warehouse `fact.raise_event.amount`, `fact.hack_event.amount` | Whole USD                                                                                                                                   | API records; never pass them through the Raises normalizer or merge them with API rows             | Outside this repo                                                         |

## Null, zero and failure

| Situation                                                                                   | Result                                                                                                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A protocol in a successful listing has a nullable activity period                           | Unavailable (blank), never zero                                                                                           |
| Siblings or selected chains combine and some periods are nullable                           | Nullable members contribute nothing; the aggregate is unavailable only when every member is nullable                      |
| A listing succeeds with no members                                                          | Zero                                                                                                                      |
| A whole request fails                                                                       | `null`; never zero, and never a best-effort multi-source result presented as complete                                     |
| A selected-chain dataset keeps the chains that succeeded after another failed               | Carry explicit partial-coverage metadata through APIs, stream cache seeding and consumers                                 |
| Exact TVL snapshots, ratio denominators, required bridge legs, chart points                 | The activity rules above do not apply; a missing required value is unknown                                                |
| Protocol-list TVL with an explicit zero                                                     | Zero                                                                                                                      |
| A measured contribution holds a present `null`                                              | The required aggregate is unavailable                                                                                     |
| A selected-chain entry is missing                                                           | Unavailable, unless producer coverage metadata proves the omission means zero                                             |
| Numeric TVL bounds, market cap to TVL                                                       | Bounds exclude unavailable rows; the ratio needs a TVL above zero                                                         |
| A parent summary has a metadata-only child with null all-chain TVL                          | The child stays visible and does not erase measured siblings or their changes                                             |
| A measured child lacks a required period, or its required `excludeParent` is a present null | Only that parent period is unavailable                                                                                    |
| A grouped bar series starts with nulls                                                      | Pre-coverage gaps; a missing point after coverage starts makes that bucket, and cumulative output from there, unavailable |
| An additive breakdown folds its tail into `Others`                                          | `Others` is unavailable when any required tail member is; explicit zero stays                                             |
| A tooltip total over same-unit series                                                       | Sparse by default; a chart that passes `requireCompleteTooltipTotal` hides it when a contributor is missing               |
| A comparison of parents and children                                                        | No tooltip total, because the members can overlap                                                                         |
| An all-chain Pro table shows adapter metrics split by chain                                 | Only 24h and 30d have chain splits (`breakdown24h`, `breakdown30d`); 7d, 1y, comparisons and changes stay blank           |

## Share denominators

| View                                                      | Denominator                                                                                               | When a member is unmeasured                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Exact selected shares                                     | The selected members                                                                                      | Every share is unavailable; never renormalize measured peers to an apparent 100% |
| Historical Oracle, Fork, LST and chain-category dominance | The measurements available on each date, because members launch, stop and get measured at different times | The member is a gap, never zero; a complete all-zero row stays zero              |
| Picker share views (dominance, pies, share %)             | The whole population the page's URL filters select                                                        | See `docs/charts.md` → "Share views"                                             |
| Pro protocol table share columns                          | Global, selected-chain or filtered-row totals, by column                                                  | See the header of `ProDashboard/unifiedTable/config/columnDictionary.ts`         |

Changing a denominator changes what the product claims; it is never a presentation refactor.

## TVL models

Shared toggle names do not mean shared models. Each route family composes TVL its own way:

| Route family                                                                              | Base                                                                                      | Additive keys                                                                                  | Overlap                                                                                                                                                                                      | Owner file                                                                                                            |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/chains`, `/chains/[category]`                                                           | Chain TVL net of double counting: `base − doublecounted − liquidstaking + dcAndLsOverlap` | Every enabled setting key the chain reports; extras that stopped updating are dropped          | Subtract `dcAndLsOverlap` when `doublecounted` and `liquidstaking` are both on                                                                                                               | `src/containers/ChainsByCategory/tvl.ts`                                                                              |
| `/`, `/chain/[chain]`, `/chart/chain/[chain]`, `/compare-chains`                          | The net chain TVL chart                                                                   | Every enabled setting key, added per timestamp                                                 | Same as `/chains`                                                                                                                                                                            | `src/containers/ChainOverview/tvlChart.ts`; CompareChains reuses `applyChainTvlChartSettings`                         |
| `/protocol/[protocol]`, `/chart/protocol/[protocol]`                                      | The protocol TVL chart                                                                    | `staking`, `borrowed`, `pool2`, `vesting`, fetched only when the protocol reports the key      | None                                                                                                                                                                                         | `src/containers/ProtocolOverview/tvlChart.ts`                                                                         |
| `/protocols`, chain overview protocol rows, `/watchlist`, the `/compare-protocols` table  | Row `tvl.default`; a parent subtracts its children's `excludeParent`                      | `PROTOCOL_LIST_ADDITIVE_TVL_KEYS`                                                              | None. Rows keep the snapshot `strikeTvl`; the displayed strike follows the `doublecounted` and `liquidstaking` toggles, and the row value never changes. Deprecated children are only marked | `applyProtocolTvlSettings` in `src/containers/ProtocolLists/utils.ts`, `src/containers/ProtocolRankings/tvlStrike.ts` |
| `/recent`, `/airdrops`                                                                    | `chainTvls` scoped to the selected chains                                                 | `PROTOCOL_LIST_ADDITIVE_TVL_KEYS` from chain-qualified sections; negative totals clamp to zero | None                                                                                                                                                                                         | `src/containers/ProtocolLists/pagination.server.ts`                                                                   |
| `/protocols/[category]`, `/protocols/[category]/[chain]`, `/categories`, `/top-protocols` | Protocol TVL                                                                              | Only `PROTOCOL_LIST_ADDITIVE_TVL_KEYS`                                                         | None                                                                                                                                                                                         | `src/containers/ProtocolTaxonomy/tvl.ts`, `src/containers/ProtocolTaxonomy/queries.tsx`                               |
| `/oracles*`, `/forks*`                                                                    | Raw TVS or TVL                                                                            | Every enabled setting key                                                                      | Request and subtract `dcAndLsOverlap` when both are on                                                                                                                                       | `src/utils/tvlOverlap.ts`, shared with ChainOverview and ChainsByCategory                                             |

- Setting keys are `TVL_SETTINGS` in `src/contexts/LocalStorage.tsx`: `staking`, `pool2`, `borrowed`, `doublecounted`, `liquidstaking`, `vesting` and `govtokens`.
- `dcAndLsOverlap` is not a setting key. It is overlap data for the TVL that is both double counted and liquid staking, applied only when both toggles are on.
- `govtokens` has no effect on protocol rows.
- The Oracle and Fork chart API `key` parameter is not a setting key. It accepts only `tvl`, `staking`, `borrowed`, `pool2`, `vesting`, `all` and `OwnTokens` (`getEnabledForkOracleExtraTvlChartApiKeys`).
- A canonical parent subtracts each contributing child's exact `chainTvls.excludeParent` from current and comparison totals. A child without `excludeParent` stays additive.
- A filtered population, such as one Fork or one Oracle, never subtracts overlap attributed to a child or metric outside it.
- A selected-chain response adds an additive section only from its own chain-qualified key, such as `Ethereum-staking`. An unqualified `staking` or another chain's key never counts toward Ethereum.
- In a successful selected-chain response, an omitted additive section contributes nothing and an explicit zero stays zero.
- `/protocol/active-loans/[protocol]` always requests the borrowed breakdown and ignores TVL toggles.
- Keep TVL behavior in the owning route family, and share a helper only for an invariant proven identical across its consumers.

## Earnings, P/F and P/S

- Earnings is revenue minus emissions. It is unavailable when either whole source fails.
- Within successful listings, nullable revenue activity and a missing emissions row each contribute zero.
- A matched emissions row with a nullable period makes that period unavailable, never zero or a partial parent sum.
- Comparison fields stay unavailable when the emissions producer has no matching comparison periods.
- Emissions have no chain split. Chain Earnings estimates a protocol's chain emissions from that chain's share of its revenue for the same period, and chain-scoped headers say `Est.`. Global Earnings stays exact.
- A selected chain includes a protocol when the chain is an own key in its 24h or 30d revenue breakdown.
- Each period is decided on its own: a usable breakdown without the chain is zero, and a nonzero aggregate without a breakdown is unavailable.
- Nonzero emissions over a revenue basis of zero or less cannot be allocated. Zero revenue with zero emissions stays zero.
- Selected-chain Earnings never relabels all-chain periods as chain values.
- P/F is market cap divided by `annualized1y` fees, and P/S is market cap divided by `annualized1y` revenue; never a 30-day fallback.
- `annualized1y` is the trailing 12 months when enough history exists, otherwise all tracked history scaled to a 12-month run rate.
- A parent or multi-chain ratio is `null` when any fee- or revenue-contributing child or chain lacks its annualized denominator.

## Unlocks

- Unlock totals add one-time cliffs to the tokens released by active linear schedules. Never add a weekly rate directly to a cliff amount.
- Over a half-open interval `[start, end)`, a cliff counts when its timestamp is at or after `start` and before `end`.
- A linear schedule contributes its weekly rate prorated over the overlap between the interval and the schedule's duration, including schedules that started before the interval.
- Signed burns stay in the schedule but contribute zero to unlock totals. Burns can reduce unlocked supply, so never clamp a cumulative supply series to its earlier maximum.
- All Unlocks equals Cliff Unlocks plus Linear Unlocks.
- An event without a known amount is excluded from totals, never counted as zero; producers keep an `unknownEventCount`.
- A missing events array, a missing tuple member, an unknown event type or a non-finite duration breaks the producer contract: the producer rejects the update and keeps the last good artifact.
- Rolling summaries and charts use the same interval. Daily buckets split it at UTC-day boundaries, partial first and last days included, so they sum to the summary.
- USD totals include only events with a known amount and protocols with a valid price at the artifact timestamp; producers keep coverage counts for the rest.
- Price and market-cap enrichments keep their own source timestamps.
- Current unlocked supply uses the last schedule sample at or before the artifact timestamp, never a future sample.
- The homepage summary carries cliff, linear and total. A `null` cliff or linear value means no breakdown, and the total stands alone.
- Windows differ by page: the homepage covers the next 14 days, the Unlocks page the next 7 and 30 days, and `/tokens` the past and next 30 days.

| Unlocks table column           | Means                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `Unlocked Supply`              | Supply at the artifact timestamp                                                                                                |
| `Next 24h Unlocks`             | The exact rolling cliff plus linear release; its value and percentage filters use the same metric                               |
| `Next Event`                   | Event information: a cliff's amount or a linear event's new weekly rate; signed negatives read as burns, never negative unlocks |
| `Next Event Types`             | Filters the categories shown for the next event; never changes the all-category Next 24h metric                                 |
| `7d Price Change After Unlock` | Observed movement; it does not claim the unlock caused it                                                                       |

## Funding amounts

- Funding summaries show the sum of disclosed amounts. This applies to Raises, protocol, token, Token Rights, chain and exchange funding summaries and the Potential Airdrops funding column.
- When some rounds are undisclosed, keep the subtotal visible with a dotted underline and a tooltip that counts the excluded rounds.
- A population with rounds but no disclosed amount shows `Undisclosed`, not `$0`. A measured zero stays `$0`, including next to undisclosed rounds.
- A successful empty population is zero, and pages that hide empty funding sections keep hiding them.
- A whole-source failure stays unavailable or hidden; it is never an undisclosed round.
- Raises overview and monthly totals sum disclosed amounts, and undisclosed rounds still count as rounds.
- Numeric amount filters exclude undisclosed amounts only while a bound is active. A measured zero stays eligible, including for a maximum of zero.
- Investor median uses measured amounts only; no measurements means `null`.
- Both Raises tables export whole-USD money, a Unix-second `Timestamp` and an ISO `Date` through the same CSV preparation.
- Blank or non-numeric valuation text stays unavailable; never parse freeform entries such as `3,000` or `<7000`.
- Investor directory rows keep the producer's exact labels; investor route slugs match case-insensitively.
- A raise's required `source` can be an empty string.
- Raw snapshot publication keeps the transport shape; every reader normalizes through `normalizeRaisesApiItem`.

## Chain chart denominations

- Chain and protocol chart denominations use `chainMetadata.gasTokenGeckoId` and `gasTokenSymbol` together (`src/utils/metadata/chainDenominations.ts`).
- Without gas metadata, USD is the only chain denomination. Never infer a gas asset from the official token or default to ETH.
- Chain token price, market cap, volume and token links use the official `gecko_id` and `tokenSymbol`. Arbitrum converts TVL with ETH prices while its token series describe ARB.
- Token valuation and other intrinsically USD series stay in USD.
- Bridged TVL in another denomination divides the combined daily value by the price at that millisecond timestamp.

## Public API validation

- Confirm the entity type the adapter path expects before adding route-cache validation. A parameter named `protocol` can hold a chain-level fee adapter ID.
- `adapter-chain` routes validate their chain parameter through chain metadata, and protocol routes validate through protocol metadata.
- Chain Fees, Chain Revenue and Chain Holders Revenue use the protocol-style adapter path with chain IDs such as `Base` or `Hyperliquid L1`. Clients send `entity=chain`, and the API validates the chain and its metadata flag before fetching (`resolveCanonicalAdapterProtocolParam` in `src/containers/ChainOverview/server/charts.ts`).
- A request without `entity` falls back to the chain only for those three metrics, so app metrics and unknown values still fail validation before reaching upstream.
- Chain activity adapters (`active-users`, `new-users`) sent with `entity=chain` validate the chain through chain metadata.
- `kind=bridged-tvl` validates the chain through chain metadata, requires the `chainAssets` flag, and queries the backend with the metadata `id`. Display names and URL slugs are not producer IDs.
- Direct callers of chain-assets data, Pro Dashboard chain charts included, resolve the same metadata `id`.
- Gate protocol liquidation metrics on the protocol's `liquidationVolume` and `collateralLiquidated` flags before fetching.
- RWA routes keep route-cache validation aligned with each route's slug semantics in the RWA definition files.
