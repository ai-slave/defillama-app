# Striking distance and indexation — defillama.com — 2026-10-14

Angle: striking-distance. No application code was changed.

## Method

**Search Console.** Attached export for `sc-domain:defillama.com`, 2026-09-14 through 2026-10-11. Page file: 14,729 URLs. Page-query file: 100,000 rows, sorted by impressions, tail at 1 impression, so the high-impression band is complete. `missed@3%` = `max(0, 0.03 × impressions − clicks)`.

A pair is in the striking-distance band when `navigational` is empty and average position is 5 through 20. That is 25,643 pairs, 432,289 impressions, 11,096 missed clicks. Most of that missed-click total sits on protocol overview URLs for name-shaped queries the flag did not catch (`gmx crypto`, `vest market`, `axiom pro`). Those are navigational and are not sized below. Quoted strings, `site:` operators, and phone/fax queries are dropped the same way.

The content set is the remainder: the query does not contain the page's entity token. 9,478 pairs, 98,973 impressions, 2,456 missed clicks. Country and device splits for the head terms were pulled from the Search Analytics API for the same dates.

**Live SERPs.** 15 head queries, Google US desktop, depth 20, DataForSEO organic live, 2026-10-14. A first Crawl4AI pass is not the ranking source. Where the 28-day GSC position and today's snapshot disagree, both numbers are in the table.

**Page comparison.** TinyFish fetched our URL and the pages holding the spots above it. "Words" is the extracted body. "Content links" excludes the shared header (Equities, AI, Metrics, and the same chrome on every page) and counts links into the template: `/protocol/`, `/chain/`, `/yields/pool/`, `/unlocks/`.

**Indexation.** Live sitemap index and `sitemap/static.xml` fetched the same day. `sitemap/protocols.xml` reports 26,232 URLs; the fetch returned the first 5,000 locs, which are overview URLs, so the tab split is the same-day full count from the technical audit. URL Inspection API, 20 URLs, `sc-domain:defillama.com`.

## Where the band sits

Non-entity pairs, position 5–20, by template.

| Template | Pairs | Pages | Impressions | Clicks | Missed@3% |
|---|---:|---:|---:|---:|---:|
| Protocol overview (metric and residual name queries) | 2,671 | 1,287 | 28,693 | 93 | 805 |
| `/stablecoins` and `/stablecoins/{chain}` | 674 | 29 | 13,233 | 77 | 345 |
| `/chains` | 605 | 1 | 14,271 | 175 | 279 |
| `/protocols/{category}` | 385 | 133 | 5,265 | 19 | 150 |
| Homepage | 1,140 | 1 | 5,275 | 36 | 140 |
| `/chain/{chain}` | 625 | 147 | 2,768 | 12 | 79 |
| `/rwa/asset/*` | 233 | 168 | 1,716 | 4 | 50 |
| `/dex-aggregators` | 49 | 1 | 1,359 | 5 | 38 |
| `/stablecoin/{asset}` | 311 | 50 | 1,158 | 5 | 34 |
| `/top-protocols` | 78 | 1 | 1,895 | 35 | 29 |
| `/airdrops` | 56 | 1 | 1,352 | 37 | 20 |
| `/dexs` | 67 | 1 | 1,034 | 14 | 20 |
| `/perps` | 97 | 1 | 680 | 7 | 19 |
| `/yields` hub | 22 | 1 | 887 | 34 | 10 |

Position 5–7 holds 182,282 of the unfiltered band's impressions. Position 16–20 holds 14,698. A move into the top 3 is realistic from 5–8 when the page is the same kind of document as the results above it. It is not realistic when today's first page is a definition, a charting product, or the protocol's own app.

`/yields/pool/*` is almost absent from the page-query file (8 non-brand pairs, 72 impressions) and large in the page file: 703 URLs, 15,768 impressions, 476 clicks, position 7.59, 353 missed clicks. 306 of those URLs already sit at position 5–20. They are an indexation and internal-link problem, handled in the second half.

## Top 15

GSC position is the 28-day page-query average. US position is the query across every URL. Live rank is today's US organic `rank_group`; a dash means DefiLlama was not in the top 20 of that snapshot.

| # | Query | Page | Template | GSC pos | Impr | Clicks | Missed | US pos | Live rank |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|
| 1 | tvl | `/chains` | chains hub | 5.75 | 8,279 | 137 | 111.4 | 5.92 | — |
| 2 | usdt dominance chart | `/stablecoins` | stablecoins hub | 6.69 | 1,962 | 2 | 56.9 | 5.03 | — |
| 3 | defi lending and borrowing protocols explained | `/protocols/lending` | category | 6.86 | 1,491 | 0 | 44.7 | 7.09 | — |
| 4 | defi protocols | `/top-protocols` | rankings | 6.05 | 1,011 | 23 | 7.3 | 8.97 | 4 |
| 5 | list of prediction markets | `/protocols/prediction-market` | category | 7.05 | 820 | 17 | 7.6 | 8.52 | — |
| 6 | airdrops | `/airdrops` | airdrops | 9.54 | 778 | 9 | 14.3 | 10.14 | — |
| 7 | crypto launchpads | `/protocols/launchpad` | category | 12.26 | 604 | 0 | 18.1 | 12.41 | — |
| 8 | perp dex volume | `/perps` and `/perps/chains` | perps | 1.19 and 5.02 | 635 and 607 | 327 and 10 | 0 and 8.2 | 14.36 | 1 and 14 |
| 9 | dex aggregator | `/dex-aggregators` | aggregators | 4.01 | 671 | 20 | 0.1 | 7.95 | — |
| 10 | token unlock | `/unlocks` | unlocks | 7.74 | 514 | 26 | 0 | 8.11 | — |
| 11 | eth liquid staking | `/protocols/liquid-staking/ethereum` | category + chain | 10.19 | 333 | 1 | 9.0 | 12.8 (20 impr) | — |
| 12 | stablecoin yield | `/yields/stablecoins` | yields | 9.65 | 333 | 6 | 4.0 | 14.06 | 9 |
| 13 | top dex | `/dexs` | dexs | 6.47 | 245 | 0 | 7.3 | 5.56 | 2 |
| 14 | hyperliquid stats | `/protocol/hyperliquid` | protocol | 5.33 | 332 | 7 | 3.0 | 7.38 | — |
| 15 | best yield farming crypto | `/yields` | yields hub | 6.52 | 199 | 2 | 4.0 | 5.34 | 2 |

`usdt dominance` on `/stablecoins` is the same template as row 2: position 7.34, 1,620 impressions, 4 clicks, 44.6 missed. `stablecoins list` is position 8.89, 427 impressions, 10.8 missed.

## Depth and internal links

Shared pattern. Hub and category pages render a stats card and the first table window, about 23 entity links. `/top-protocols` is the exception and ships 653 `/protocol/` links. `/yields` and `/yields/stablecoins` ship the header and zero `/yields/pool/` links. Pages that rank above us for a head term open with a sentence that repeats the query, then a list.

| Query | Our page | Words | Content links | Opening | Page above us | Words | Content links | Opening |
|---|---|---:|---:|---|---|---:|---:|---|
| tvl | `/chains` | 510 | 23 `/chain/` | Table. First row Ethereum, $51.176b. No h1 in the body. | whitebit.com "What is TVL" | 1,784 | 59 posts | "Have you ever wondered how the success of a DeFi project is determined… The answer lies in TVL" |
| usdt dominance chart | `/stablecoins` | 378 | 23 `/stablecoin/` | H1 `Total Stablecoins Market Cap`, then `$306.019b`, then `USDT Dominance60.12%` | tradingview.com/symbols/USDT.D | 1,491 | chart tools | A USDT.D chart |
| lending explained | `/protocols/lending` | 548 | 23 `/protocol/` | H1 `Lending`, then TVL `$52.949b`. Title is `DeFi Lending Protocols - TVL, Fees, & Revenue` | alchemy.com lending dapp list | 138 | 9 dapp links | H1 `Decentralized lending apps`, "Discover 239…" |
| defi protocols | `/top-protocols` | 1,480 | 653 `/protocol/` | H1 `Protocols with highest TVL by chain on each category` | icon.partners explainer, then Investopedia (2,252 words) | 1,161 | 21 posts | "DeFi Protocols are decentralised financial services…" |
| top dex | `/dexs` | 243 | 23 `/protocol/` | H1 `DEX Volume (24h)`, `$7.662b`. Uniswap, PancakeSwap, Aerodrome are linked | coingecko.com decentralized exchanges | 1,373 | ~100 table rows | H1 `Top Decentralized Exchanges Ranked by 24H Trading Volume` |
| best yield farming crypto | `/yields` | 89 | 0 pools | Disclaimer, then the API note. H1 in the source is screen-reader `Yields` | de.fi/explore | 1,730 | 77 `/explore` | H1 `Explore Yields` |
| stablecoin yield | `/yields/stablecoins` | 130 | 0 pools | Same shell. H1 `Yields` | spark.money stablecoin yield comparison (live rank 8; our page is 9) | 2,311 | 17 tool links | Eight platforms, APY filled from the row |
| dex aggregator | `/dex-aggregators` | 219 | 23 `/protocol/` | H1 `DEX Aggregator Volume (24h)`, `$2.464b` | coinsutra "7 Best Crypto DEX Aggregator" | 1,659 | 21 on-page | A numbered list of products |
| token unlock | `/unlocks` | 473 | 33 `/unlocks/` | H1 `Unlock statistics`. Upcoming unlocks (7d) `$228.87m` | coinlaunch.space/token-unlocks | 1,634 | 72 project links | H1 `Token Unlock & Token Vesting` |
| perp dex volume | `/perps` | 293 | 23 `/protocol/` | H1 `Perp Volume (24h)`, `$22.548b`. Hyperliquid is first | coingecko perp DEXs, live rank 2 | 1,200 | perp table | H1 `Perpetual DEXs`, "$27.9 Billion" |
| crypto launchpads | `/protocols/launchpad` | 376 | 23 `/protocol/` | H1 `Launchpads`, TVL `$246.12m` | dailycoin editorial | 2,711 | news links | H1 `Best Crypto Launchpads to Watch` |
| list of prediction markets | `/protocols/prediction-market` | 494 | 23 `/protocol/` | H1 `Prediction Markets`. Kalshi and Polymarket are row 1 and 2 | Yahoo Finance, Action Network, RotoWire | — | — | Sportsbook and politics apps |
| airdrops | `/airdrops` | 224 | 23 `/protocol/` | No h1. First row is a tokenless lending protocol | airdrops.io, Investopedia, airdropalert.com | — | — | Current airdrop lists and a definition |
| eth liquid staking | `/protocols/liquid-staking/ethereum` | 379 | 23 `/protocol/` | H1 `Liquid Staking on Ethereum`, TVL `$42.631b` | CoinGecko liquid-staking *tokens* | 5,794 | token category | H1 `Top Liquid Staking Tokens Coins by Market Cap` |
| hyperliquid stats | `/protocol/hyperliquid` | 692 | 15 `/protocol/` | H1 `Hyperliquid(HYPE)`, TVL `$7.039b`. Description is a metric list several hundred characters long | app.hyperliquid.xyz, then the docs | — | — | The product |

`/perps/chains` (live rank 14 for the same query `/perps` wins) has 220 words, no h1, and a chain table starting at Hyperliquid L1. It is a second URL for a query the hub already answers.

The lending result is the cleanest content comparison. Alchemy ranks 2nd for the explainer query with 138 words and a list. Our page has the list, the TVL, and the fees, and the h1 says `Lending`. The query's words are in the title only.

`/chains` for `tvl` is the largest click gap and the least like the live first page. The 28-day US position is 5.92 (1,601 impressions, 9 clicks). Today's snapshot is definition posts. The page already links the top chains. What it does not do is say what TVL is before the table.

## What is already won, and what top 3 is not

`perp dex volume` on `/perps` is position 1.19 with 327 clicks. US query position 14.36 is 69 impressions; Turkey, India, and Iran are position 1 and produce the clicks. Today's US snapshot also has `/perps` at rank 1 and `/perps/chains` at rank 14. The chains URL should stop competing for the head term.

`top dex` is live rank 2, one place behind CoinGecko, with the first DEX rows already linked. `best yield farming crypto` is live rank 2 behind de.fi, with the pool table missing from the HTML. `defi protocols` is live rank 4, and the page already has the deepest internal link block we ship.

These four are not top-3 projects:

- `list of prediction markets` and `best prediction markets` (711 impressions, position 7.99, same page). The US first page is sports and politics apps. The page can rank for crypto prediction markets. Kalshi and Polymarket are already the first rows.
- `airdrops`. The page is a list of tokenless protocols (`src/pages/airdrops.tsx` titles it that way and the body has no h1). airdrops.io is a live airdrop board.
- `eth liquid staking`. US demand is 20 impressions. The first page is explainers and a CoinGecko token-category page. Ours is a protocol ranking.
- `hyperliquid stats`. The first results are `app.hyperliquid.xyz`. The protocol page's description in `src/containers/ProtocolOverview/queries.tsx` opens with a metric inventory. That loses a definition snippet. It does not outrank the app for the word "stats".

`crypto launchpads` at US position 12.41 can move onto page 1 with a sentence that names the top launchpads. The first page is 2,000-word roundups, so top 3 is a stretch. `token unlock` already clears the 3% floor (26 clicks on 514 impressions). The h1 `Unlock statistics` is the gap against CoinLaunch's `Token Unlock & Token Vesting`. `dex aggregator` is global position 4.01 on `/dex-aggregators` (671 impressions, 20 clicks, missed 0.1) and US position 7.95. `swap.defillama.com` also ranks, at 7.32 with 506 impressions. One host should own the query.

## Indexation

Live sitemap index, 18 sections: static, chains, protocols, protocols-by-category, stablecoins, exchanges, cexs, bridges, rwa, dat, pre-ipo, oracles, liquidations, unlocks, forks, raises, narratives, pro-dashboards. There is no yields section.

`sitemap/static.xml` is 114 URLs. Yield URLs in it: `/yields`, `/yields/stablecoins`, `/yields/loop`, `/yields/borrow`, `/yields/rates`, `/yields/watchlist`. No `/yields/pool/` URL.

`sitemap/protocols.xml` reports 26,232 URLs. `getProtocolSitemapRoutes` in `src/containers/ProtocolOverview/server/routes.ts` pushes every `protocol/{slug}` and then every `protocolTabRoutes` prefix. `getProtocolLayoutSeo` in `src/containers/ProtocolOverview/layoutSeo.ts` leaves four tabs indexable: information (`/protocol/{slug}`), borrowed (`/protocol/active-loans/{slug}`), unlocks (canonical `/unlocks/{slug}`), forks (canonical `/forks/{slug}`). Every other tab is `noindex` with a null canonical. The sitemap test expects `protocol/fees/aave` and `protocol/tvl/aave` inside the protocols section (`src/server/routeRegistry/__tests__/sitemap.test.ts`).

URL Inspection, 2026-10-14:

| URL | Verdict | Coverage | In a sitemap Google reports |
|---|---|---|---|
| `/yields/pool/aa70268e-4b52-42bf-a116-608b370f9501` | PASS | Submitted and indexed | no |
| `/yields/pool/66985a81-9c51-46ca-9977-42b4fe7bc6df` | PASS | Submitted and indexed | no |
| `/yields/pool/665dc8bc-c79d-4800-97f7-304bf368e547` | PASS | Submitted and indexed | no |
| `/yields/pool/e737d721-f45c-40f0-9793-9f56261862b9` | PASS | Submitted and indexed | no |
| `/yields/pool/747c1d2a-c668-4682-b9f9-296708a3dd90` | PASS | Submitted and indexed | no |
| `/yields/pool/d0ad30f3-4630-431a-aa8b-4311c6a7cd6c` | PASS | Submitted and indexed | no |
| `/yields/pool/46bd2bdf-6d92-4066-b482-e885ee172264` | PASS | Submitted and indexed | no |
| `/yields/pool/790dea85-6c21-55d6-89f8-810be03209b0` | NEUTRAL | Not found (404) | no |
| `/protocol/fees/aave` | NEUTRAL | Excluded by ‘noindex’ tag | `sitemap.xml` |
| `/protocol/tvl/aave` | NEUTRAL | Excluded by ‘noindex’ tag | no |
| `/protocol/dexs/uniswap` | NEUTRAL | Excluded by ‘noindex’ tag | `sitemap.xml` |
| `/protocol/yields/aave` | NEUTRAL | Excluded by ‘noindex’ tag | no |
| `/protocol/perps/hyperliquid` | NEUTRAL | Excluded by ‘noindex’ tag | `sitemap.xml` |
| `/protocol/treasury/aave` | NEUTRAL | Excluded by ‘noindex’ tag | no |
| `/protocol/aave` | PASS | Submitted and indexed | no |
| `/unlocks/aave` | PASS | Submitted and indexed | no |
| `/protocol/unlocks/aave` | NEUTRAL | Alternate page with proper canonical (`/unlocks/aave`) | `sitemap.xml` |
| `/protocol/active-loans/aave` | PASS | Submitted and indexed | no |
| `/forks/aave` | NEUTRAL | URL is unknown to Google | no |
| `/yields` | PASS | Submitted and indexed | no |

Google's sitemap field is empty for some URLs that are in the file, so "no" is not proof of absence. "sitemap.xml" is proof of presence. Three noindex tabs and the unlocks alias are submitted and then dropped. The technical audit's full download of this file counted 16,162 noindex tab URLs (`protocol/tvl` 7,965, `protocol/fees` 3,641, `protocol/dexs` 2,030, and the rest of that split).

The page export includes 1,199 URLs with a single impression. It contains zero `/protocol/tvl/`, `/protocol/fees/`, `/protocol/dexs/`, `/protocol/perps/`, `/protocol/yields/`, or `/protocol/treasury/` rows. The noindex is holding. The page-query file has one hit on those patterns, a branded `lighter defillama` URL with a `ref` parameter. Listing the tabs in the sitemap spends crawl on URLs Google then excludes.

`/protocol/active-loans/*` is the opposite hole. `layoutSeo.ts` indexes it. `protocolTabRoutes` does not emit it. GSC has 91 of these pages, 3,083 impressions, 26 clicks, position 5.23, 81 missed clicks. Aave's URL is indexed and carries no sitemap association.

`/yields/pool/*` is indexable: `src/pages/yields/pool/[pool].tsx` sets `canonicalUrl` to `/yields/pool/${poolId}` and does not pass `noIndex`. Seven of eight inspected pool URLs are indexed with that canonical and with no sitemap. The eighth, the pool with the most impressions in the export (2,463 impressions, position 8.61, 10 clicks), is a 404. Its query is the bare name `grokvoxus` (2,152 impressions, position 8.94). A dead id is still collecting a navigational query.

The indexed pool that was fetched (`aa70268e…`, aEthUSDC on Aave V3) does render the answer: supply APY 3.83%, $2.385b supplied, 29.7k holders. Its links are the site header. There is no link to `/yields` or to a sibling pool. `/yields` links to seven yield tabs and to no pool. `useStickyQueryReplace` returns false until `isClient` (`src/containers/Yields/useStickyQueryReplace.ts`, the return at the end of the hook). `useLegacyYieldsUrlNormalizer` passes that boolean through. `EarnView` sets `enabled: normalized`. `useYieldsServerTable` then sets `data` only when `enabled` is true, so the `initialEarnPage` seed never becomes HTML. The live `/yields` body is 89 words.

`/yields/pool/[pool]/risk` is also indexable (canonical set, no `noIndex` in `src/pages/yields/pool/[pool]/risk.tsx`). GSC has 37 of those URLs and 187 impressions. Same sitemap hole, much smaller.

## Ranked fixes

1. **Say what TVL is on `/chains`.** 8,279 impressions, position 5.75, 111 missed clicks, US position 5.92. The body opens on the Ethereum row. Add an h1 and one sentence in `src/containers/ChainsByCategory/index.tsx` (the component currently has no h1; the title lives in `src/pages/chains.tsx`). Copy: `Total value locked (TVL) by chain` and `TVL is the dollar value of crypto deposited in DeFi protocols. This page ranks chains by TVL.` Keep the table. The 23 `/chain/` links in the first window are enough for this query. Today's US snapshot is definition articles, so this is the change that makes position 6 able to match them.

2. **Put yield pools in the HTML and in a sitemap.** 703 pool URLs, 15,768 impressions, 353 missed clicks, average position 7.59, and the hub query `best yield farming crypto` is live rank 2 with an empty table. `stablecoin yield` is live rank 9 on `/yields/stablecoins`, which has the same empty body.
   - Render the seed on the server. `useStickyQueryReplace` in `src/containers/Yields/useStickyQueryReplace.ts` should not gate the first paint: return true for the server render when the URL is already canonical, and keep the client replace for legacy params. `src/containers/Yields/views/EarnView.tsx` passes that flag as `enabled`. `src/containers/Yields/useYieldsServerTable.ts` drops `initialSeed` when `enabled` is false (the `data` line). The seed comment in that file says the HTML contains it.
   - Visible h1 in `src/containers/Yields/YieldsTabs.tsx`, which is screen-reader text `Yields` today. Copy: `Best DeFi yield farming pools by APY`. On `src/pages/yields/stablecoins.tsx` the h1 should be `Best stablecoin yields`, matching the title `Best Stablecoin Yields - USDC, USDT & DAI APY Rankings - DefiLlama`.
   - Add a `yields` section in `src/server/routeRegistry/sitemap.ts` (`SITEMAP_SECTION_IDS` has none). Emit `/yields/pool/{id}` for ids in the snapshot `getEarnPage` already loads (`src/containers/Yields/data/earn.server.ts`). Do not emit ids that 404. `790dea85-6c21-55d6-89f8-810be03209b0` is a 404 with 2,463 impressions and must stay out. Pool pages should link back to `/yields` and to the protocol: the fetched Aave pool links only the header. The pool link already exists in `src/containers/Yields/Tables/Pools.tsx` (`href={`/yields/pool/${row.original.configID}`}`). It will be in the HTML once the seed renders.
   - Leave `ButtonLink` in `src/components/Link.tsx` as the control for noindex protocol tabs. Those tabs should not become crawlable links.

3. **One sentence on `/protocols/lending`.** 1,491 impressions, 0 clicks, 44.7 missed, US position 7.09 on 1,393 impressions. Alchemy ranks second with a thin list. Lending sets `seoBaseTitle` and no `headingLabel`, so `hasCustomPresentation` makes the h1 the raw label `Lending` (`getProtocolCategoryPresentation` in `src/containers/ProtocolTaxonomy/constants.tsx`, rendered in `src/containers/ProtocolTaxonomy/index.tsx`). Set `headingLabel` to `DeFi lending and borrowing protocols` and render the existing description under the h1: `Protocols that allow users to borrow and lend assets`. The TVL and 7-day fees already sit in that card. The first 23 protocol links include Aave and Morpho.

4. **Stop submitting noindex tabs. Submit the indexable loan URLs.**
   - In `getProtocolSitemapRoutes` (`src/containers/ProtocolOverview/server/routes.ts`), emit a URL only when `getProtocolLayoutSeo` returns `noIndex: false`, and emit `canonicalUrl`. That drops `protocol/tvl`, `protocol/fees`, `protocol/dexs`, `protocol/perps`, `protocol/yields`, `protocol/treasury`, `protocol/options`, `protocol/bridges`, `protocol/rwa`, `protocol/stablecoins`, `protocol/dex-aggregators`, `protocol/perps-aggregators`, `protocol/bridge-aggregators`, and `protocol/token-rights`. It also drops `protocol/unlocks/{slug}` and `protocol/forks/{slug}`, which canonicalize to `/unlocks/{slug}` and `/forks/{slug}` and are already emitted by `getStandaloneProtocolSitemapRoutes`. Inspection: `/protocol/unlocks/aave` is an alternate canonical and is in `sitemap.xml`.
   - Add `protocol/active-loans/{slug}` where `metadata.borrowed` is set. That flag is already read in `src/containers/ProtocolOverview/queries.tsx`. Aave's active-loans URL is indexed and absent from the sitemap association. The template has 3,083 impressions and 81 missed clicks.
   - Update `src/server/routeRegistry/__tests__/sitemap.test.ts`, which expects `protocol/fees/aave` and `protocol/tvl/aave` in the protocols section. Expect `protocol/active-loans/aave`, `unlocks/aave`, and `forks/{slug}`, and expect the fees and TVL tab URLs to be absent.
   - Do not change the noindex rule. It is doing the job: those tab templates have no rows in a page export that includes 1-impression URLs.

5. **Lead `/stablecoins` with the dominance figure it already prints.** `usdt dominance chart` is 1,962 impressions, position 6.69, 2 clicks, US position 5.03. `usdt dominance` adds 1,620 impressions and 44.6 missed clicks. The live body shows `USDT Dominance60.12%` under the h1 `Total Stablecoins Market Cap` (`src/containers/Stablecoins/StablecoinsByChain.tsx` via `src/pages/stablecoins.tsx`). Put the figure in the heading: `Stablecoin market cap $306b, USDT dominance 60%`, using the values the page already renders, and give the dominance stat a label a crawler can read as a sentence. TradingView's USDT.D chart will keep the widget query. The position-5 traffic is the number.

6. **Match `top dex` in the DEX h1.** Live rank 2, GSC position 6.47, 245 impressions, 0 clicks. US position 5.56. Desktop position 3.85. CoinGecko's h1 is `Top Decentralized Exchanges Ranked by 24H Trading Volume`. Ours is the stat label `DEX Volume (24h)` from `labelAs="h1"` in `src/containers/AdapterMetrics/AdapterByChain.tsx`. For `props.type === 'DEX Volume'` and chain `All`, set that h1 to `Top DEX volume (24h)` and keep the `$7.662b` stat beside it. The first window already links Uniswap, PancakeSwap, and Aerodrome, so this query does not need a deeper table. The same stat-label h1 is `Perp Volume (24h)` on `/perps`, which is already rank 1 for `perp dex volume`; leave it. `/perps/chains` is live rank 14 for that head term. `src/containers/AdapterMetrics/ChainsByAdapter.tsx` renders the chain table with no h1, and the title in `src/pages/perps/chains.tsx` is already `Perp DEX Volume by Chain - DefiLlama`. Add an h1 there: `Perp volume by chain`.

7. **One sentence on `/top-protocols`.** Live rank 4 for `defi protocols`, GSC position 6.05, 1,011 impressions, 23 clicks. The h1 in `src/pages/top-protocols.tsx` is `Protocols with highest TVL by chain on each category`. Change it to `DeFi protocols with the highest TVL by chain and category` and add the sentence under it: `DeFi protocols are onchain programs for lending, trading, and yield.` The page already links 653 protocol URLs, which is the strongest internal-link block in this set. Investopedia and icon.partners rank above it on the definition.

8. **Rename the unlocks h1.** `token unlock` is position 7.74, 514 impressions, 26 clicks, so the 3% floor is met. `token unlock schedule` is position 6.58, 228 impressions. The h1 in `src/pages/unlocks/index.tsx` is `Unlock statistics`. Change it to `Token unlocks and vesting schedules`. The title in the same file already says that. The card can keep the `$228.87m` upcoming-unlocks figure. CoinLaunch's h1 repeats `Token Unlock`.

## Cost

| Call | Count | Charge |
|---|---:|---:|
| DataForSEO Google organic, depth 20 | 15 | $0.060 |
| Crawl4AI Google organic (not used for ranks) | 15 | $0.002 |
| Litescrape organic, HTTP 503 | 1 | $0 |
| URL Inspection | 20 | $0 |
| Search Analytics, country and device | 2 | $0 |
| TinyFish fetches (pages, sitemap index, protocols and static sitemaps) | 5 | $0 |
| **This pass** |  | **$0.062** |

Balance before the first call was $9.85. Other agents were spending from the same balance during this pass.
