# SEO audit: competitor-keywords

Comparison of non-brand Google keywords where CoinGecko, CoinMarketCap, Token Terminal, Dune, or Artemis rank in the organic top 3 and DefiLlama ranks worse or not at all. Each winnable keyword is mapped to the DefiLlama page that should own it.

Window for our data: Google Search Console, 2026-09-14 through 2026-10-11 (final, attached exports). Outside ranks: DataForSEO Labs domain intersection (US, English) plus live US organic spot checks on 2026-10-14.

## Method

Attached exports, used before any new Search Console call:

- `gsc_query` — 28,340 queries, with `missed_at_3pct` already computed as `max(0, 0.03 * impressions - clicks)`.
- `gsc_page` — 14,730 URLs.
- `top50_nonbrand_missed` — cross-check only. Most of that list is a bare protocol name or a one-off long query, which this pass treats as navigational and does not size.

No fresh Search Console pull. The attached window is the one the brief calls final.

Outside comparison, all US (`location_code` 2840) and English, organic results only:

1. DataForSEO Labs `domain_intersection/live` for each competitor against `defillama.com`.
   - **Absent:** `intersections: false`, so the competitor ranks and DefiLlama has no Labs ranking. Filter: competitor `rank_group <= 3`, monthly volume `> 100`, ordered by volume. CoinGecko and CoinMarketCap were capped at the top 1,000; the others returned their full set.
   - **Worse:** `intersections: true`, competitor `rank_group <= 3`, DefiLlama `rank_group > 3`, volume `> 50`. Full sets, no cap hit except where noted.
2. A second intersection pass with a DeFi-intent regex (`tvl`, `stablecoin`, `fees`, `revenue`, `volume`, `unlock`, `yield`, `perp`, `oracle`, `rwa`, `dominance`, `prediction market`, and the same family) so product queries were not buried under token-price volume.
3. `ranked_keywords/live` for `artemis.xyz`, `www.artemis.xyz`, `app.artemis.xyz`, and `artemisanalytics.com`, because both intersection calls for `artemis.xyz` returned an empty index.
4. Live organic spot checks (`serp/google/organic/live/regular`, depth 10, US English) for the head terms, to see whether the Labs position still matches Google on 2026-10-14.

Excluded from sizing, per the brief: bare brand and protocol-name queries (`defillama`, `coingecko`, `hyperliquid`, `sui`), and token-price queries whose ranking URL is a coin page (`xrp price`, `price of ripple in dollars`). Those are navigational or a price-quote product we do not run.

Missed clicks:

- When the query is in the 28-day export, the number is that export's `missed_at_3pct`.
- When we barely appear, a second figure is `0.03 * Labs US monthly volume * 28/30`. That is the 28-day click count a 3% CTR on US volume would produce. It is an upper bound, not observed impressions.

## Providers, endpoints, cost

Balance before this pass: **$10.98**. Balance after: **$9.95**. This pass's calls sum to **$0.68**. The balance also moved for other agents on the same prepaid pool, so the $1.03 drop is not all this audit.

| Endpoint | Calls | What it returned | Provider cost |
| --- | ---: | --- | ---: |
| `dataforseo.x.dataforseo-labs-google-domain-intersection-live` | 19 | One 2-row probe, absent and worse sets for all five domains, and the intent-regex pass | $0.581 |
| `dataforseo.google.domain.ranked_keywords` | 4 | Artemis domain probe (`artemis.xyz`, `www`, `app.artemis.xyz`, `artemisanalytics.com`) | $0.048 |
| `dataforseo.google.serp.organic` | 24 | Live US top 10 for head terms | $0.048 |
| **Total** | **47** |  | **$0.677** |

Labs bills about $0.012 per task plus $0.00012 per keyword returned, so a 1,000-row call was $0.132, not the catalog's $0.012 headline. Figures are the `cost` field on each response. Spot checks were $0.002 each.

Catalog ids tried and not used for the gap itself: Ahrefs has no organic-keyword endpoint on this account; Semrush domain endpoints are priced in API units rather than a known dollar cost, so they were left unused under the $2 cap.

## How the five competitors actually overlap us

| Competitor | Keywords they rank top 3, volume > 100, we have no Labs ranking | Keywords both rank, they are top 3, we are worse than 3 |
| --- | ---: | ---: |
| coinmarketcap.com | 7,071 (top 1,000 by volume pulled) | 423 |
| coingecko.com | 3,661 (top 1,000 pulled) | 255 |
| tokenterminal.com | 34 | 3 |
| dune.com | 20 | 5 |
| artemis.xyz | 0 | 0 |

Artemis is not in the Labs US organic index. `artemis.xyz`, `www.artemis.xyz`, and `app.artemis.xyz` returned no ranked keywords. `artemisanalytics.com` has one: "artemis analytics" at position 3, pointing at a 2025 stablecoin PDF. There is no Artemis keyword gap to take.

Dune's top-3 set is brand queries (`dune analytics`, `dune dashboards`) plus individual dashboards. The three that map to a DefiLlama page are below (Hyperliquid stats, Jupiter volume, prediction-market volume).

Token Terminal's large keywords are "transactions per second" (volume 90,500, Labs position 2) and "what is transactions per second" (14,800). The live US SERP on 2026-10-14 does not show their generic metrics URL in the top 3; position 2 is a Blast-specific TPS page, and the rest are explainers. DefiLlama has no transactions-per-second metric. That keyword is recorded under "Do not chase" rather than sized as a page we can retitle into.

CoinGecko and CoinMarketCap's top 1,000 by volume are token prices, tickers, and single-coin market caps (`price of ripple in dollars` 301,000; `xrpusd` 368,000). The first product-shaped keywords show up much further down. Those price URLs (`/en/coins/…`, `/currencies/…`) are the wrong template for DefiLlama. The gaps worth a change are the list and metric queries in the table.

## Ranked weak spots

Missed clicks are 28-day. "GSC missed" is observed. "Volume est." is the 3% of US monthly volume scaled to 28 days, used when GSC barely shows the query.

| # | Query | Who is top 3 | Our rank | GSC evidence (28d) | Outside evidence | Est. missed clicks | Page that should win it | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | stablecoins list, stablecoin list, top stablecoins, largest / biggest stablecoins, list of stablecoins | CoinMarketCap #3 live for "top stablecoins" (`/view/usd-stablecoin/`, title "Top USD Stablecoin Tokens by Market Capitalization"). Labs: CMC #2 for "stablecoins list" (vol 1,000), CoinGecko #2 for "top stablecoins" (vol 480, title "Top Stablecoins by Market Cap") | Live #8, and the URL is `/stablecoins/chains`, not `/stablecoins`. Labs positions 6–11. GSC average positions 9.5–10.9 | 52 queries, 2,249 impressions, 8 clicks, positions mostly 9–13. Head rows: "stablecoins list" 448 impr / 2 clicks / pos 10.9; "top stablecoins" 319 / 0 / 9.5; "stablecoin list" 279 / 0 / 10.4 | Labs volumes above. Live top 3 for "top stablecoins" is Messari, YouTube, CoinMarketCap. CoinGecko's category page is the Labs #2 and is the same document type | **62** GSC missed@3% | `/stablecoins` | Title, description, and H1. See finding 1 |
| 2 | perp dex list; decentralized perpetual exchange | CoinGecko #1 live for "decentralized perpetual exchange": "Top Perpetual DEXs by Open Interest & Trade Volume" (`/en/exchanges/derivatives/decentralized`). Labs: CoinGecko #1, volume 140, we have no Labs ranking. "perp dex list" live top 3 is Binance, not these five | Not in the live top 8 for the CoinGecko query. GSC "decentralized perpetual exchange" pos 11.8 (10 impr). "perp dex list" pos 4.5 | "perp dex list" 578 impr / 9 clicks / pos 4.5 / missed 8.3. "decentralized perpetual exchange" missed 0.3 on 10 impr. We already win the short forms: "perp dex" pos 2.4, 84 clicks, missed 0; "perp dex volume" pos 2.6, 328 clicks, missed 0 | CoinGecko's title is a list of perp DEXs by open interest. Our `/perps` title is volume rankings, which is why the volume query already converts | **12** (8.3 observed on "perp dex list" + ~4 volume-est. on the query we barely show) | `/perps` | Title in `src/pages/perps/index.tsx`. See finding 2 |
| 3 | token unlocks | Live: Tokenomist #1, CoinMarketCap #2 (`/token-unlocks/`, "Token Unlocks and Vesting Schedules"), CryptoRank #3, CoinGecko #4 ("Token Unlocks & Vesting Schedules"). Labs: CMC #2, volume 260, our Labs position 7 | Live #6, URL `defillama.com/unlocks`, title already "Token Unlocks & Vesting Schedules". GSC pos 7.2 | "token unlocks" 1,361 impr / 41 clicks / pos 7.2 / missed **0** (CTR is already 3.0%). "token unlock" 522 / 26 / 7.7 / missed 0. "unlocks" 158 / 2 / 7.7 / missed 2.7. Page `/unlocks`: 17,916 impr, pos 7.21, CTR 2.55%, page-level missed 81.5 across every query on the URL | CMC and CoinGecko both use the same title words we use and rank above us | **4** on the head queries that miss the 3% bar. The page-level 81.5 is the long tail sitting on this URL, not the head query | `/unlocks` | On-page H1, not the title tag. See finding 3 |
| 4 | rwa crypto list | Live: rwa.xyz #1, CoinGecko #2 ("Top Real World Assets (RWA) Coins by Market Cap"), CoinMarketCap #3. Labs: CoinGecko #1 and CMC #3, volume 210, our Labs position 16 on `/rwa` | GSC pos 9.4 on 7 impressions. Not in the live top 8 | "rwa crypto list" missed 0.2. Related head term "rwa" is 453 impr / 2 clicks / pos 11.3 / missed 11.6 (this exact string was not re-checked live, so it is supporting, not the competitor claim). Page `/rwa`: 19,471 impr, pos 3.68, missed 188 across all queries on the URL | CoinGecko and CMC rank a coin-by-market-cap category. Our overview title is "Real World Assets (RWA) Dashboard & Analytics" | **12** if the "rwa" head term is counted (11.6) plus the list query's observed 0.2. Volume-est. on the list query alone is ~6, and GSC only recorded 7 impressions, so the list query itself is a small click pool | `/rwa` | Overview title in `src/containers/RWA/layout/pageCopy.ts`. See finding 4 |
| 5 | hyperliquid stats; jupiter volume; polymarket volume | Labs: Dune #3 for "hyperliquid stats" (vol 110, dashboard `dune.com/x3research/hyperliquid`), Dune #2 for "jupiter volume" (vol 320), Token Terminal #1 for "polymarket volume" (vol 260, `/explorer/projects/polymarket/metrics/trading-volume`). Live "polymarket volume" top 3 is Yahoo and news; Dune is #4 | Labs: our protocol pages at 6, 4, and 19. GSC: hyperliquid stats pos 6.5, jupiter volume pos 7.0, polymarket volume pos 12.5 | hyperliquid stats 351 impr / 7 clicks / missed 3.5. jupiter volume 27 / 0 / missed 0.8. polymarket volume 57 / 1 / missed 0.7 | Dune dashboard titles are "{Name} Stats" or "{Name} Volume". Our titles are "{Name} TVL, Fees, Revenue & Volume" | **5** combined GSC missed@3% | `/protocol/hyperliquid`, `/protocol/jupiter`, `/protocol/polymarket` | Title order in `src/containers/ProtocolOverview/queries.tsx`. See finding 5 |
| 6 | digital asset treasury companies | Labs: CoinGecko #3, volume 210, title "Crypto Treasury Companies" (`/en/treasuries/companies`), our Labs position 22 on `/digital-asset-treasuries`. Live top 3 is editorial (Bitwave, Forbes, Webopedia); CoinGecko's companies report is #5 | GSC pos 10.9 (39 impr, 2 clicks, missed 0) and "digital asset treasury" pos 13.1 (101 impr, missed 2.0) | Family of "digital asset treasury" queries: about 3 missed clicks. Page `/digital-asset-treasuries`: 1,270 impr, pos 20.2, 81 clicks, CTR 6.4%, page-level missed 0 | CoinGecko has a companies table. Our title is "Digital Asset Treasuries" with no "companies" or "list" | **3** GSC missed. Volume-est. ~6 if the US volume were fully available to a top-3 result | `/digital-asset-treasuries` | Title in `src/pages/digital-asset-treasuries/index.tsx`. See finding 6 |
| 7 | top oracle coins | Live: CoinGecko #1 ("Top Oracle Coins by Market Cap", `/en/categories/oracle`), CoinMarketCap #2 (`/view/oracles/`). Labs nearby: "oracle crypto" vol 170 CoinGecko category #3, we absent; "oracle coins" vol 70 CoinGecko #2, we absent | Not in GSC. Not in the live top 8 | No impressions to miss | The SERP is a token market-cap category (LINK, PYTH, and the rest), not a TVS ranking | **~5** volume-est. on the Labs "oracle crypto" / "oracle coins" volumes. No observed GSC miss | No current page is that document. `/oracles` is Total Value Secured | Do not retitle `/oracles` to chase coin market cap. See finding 7 |

## Findings

### 1. Stablecoin list queries hit the chains page, at position 8–11

The page that should win "top stablecoins" and "stablecoins list" is `/stablecoins`. It already wins the chart query: "stablecoin market cap" is position 4.1, 828 impressions, 256 clicks, 31% CTR. The list phrasing is a different SERP, and we are on page two of it.

Live US result for "top stablecoins" (2026-10-14): Messari #1 ("Top Stablecoins by Market Cap"), YouTube #2, CoinMarketCap #3 ("Top USD Stablecoin Tokens by Market Capitalization"). DefiLlama is #8, and the URL Google chose is `https://defillama.com/stablecoins/chains` ("Stablecoins by Chain - Market Cap & Supply"), not the hub. Labs had the hub at positions 6–11 for the same family, with CoinGecko's stablecoin category and CoinMarketCap's `/view/stablecoin/` in the top 3.

GSC for the list family (yield and price variants removed): 2,249 impressions, 8 clicks, **62 missed clicks** at the 3% bar. `/stablecoins` as a URL is a much larger CTR problem (109,276 impressions, position 4.27, 1.73% CTR, 1,383 missed), and `/stablecoins/chains` adds another 218 missed (14,441 impressions, position 6.04). Those page totals mix every query on the URL. The 62 is the part this competitor gap can see directly.

The hub title does not say "top" or "list":

```85:88:src/pages/stablecoins.tsx
			title="Stablecoin Market Cap Chart, Supply & Peg Data - DefiLlama"
			description="Track the total stablecoin market cap, circulating supply, prices, inflows, and peg stability across all stablecoins. Explore stablecoin market charts and analytics with transparent data from DefiLlama."
			canonicalUrl="/stablecoins"
			pageName={pageName}
```

The only H1 is the market-cap statistic. `StablecoinsByChain` sets `title` to `Stablecoins Market Cap` (around line 253) and `StablecoinChangeStats` renders that label as `h1` (`labelAs="h1"` in `src/containers/Stablecoins/StablecoinChangeStats.tsx`).

Concrete fix, keeping the chart query that already converts:

- In `src/pages/stablecoins.tsx`, lead the title with the list phrase and keep the chart clause. A title in the shape of "Top Stablecoins by Market Cap - List, Chart & Peg - DefiLlama" matches CoinMarketCap and Messari without dropping "market cap", which is the query we already win.
- Put a real H1 on the hub ("Top stablecoins by market cap") and leave the total as a stat. The stat H1 never names the list.
- Leave `src/pages/stablecoins/chains.tsx` scoped to chains (it already says "by Chain"). Google is currently preferring it for the global list query; a hub title that says "top stablecoins" is what gives Google a better document to substitute.

### 2. Perp DEX volume already wins. The "list of perp DEXs" query does not

`/perps` is healthy on the queries it is titled for. "perp dex volume" is position 2.6 with 328 clicks; "perp dex" is position 2.4 with 84 clicks. Page-level CTR on `/perps` is 13% (3,206 clicks, 24,559 impressions, missed 0).

CoinGecko's derivatives list is position 1 for "decentralized perpetual exchange" (Labs volume 140; GSC shows us at position 11.8 on 10 impressions). "perp dex list" is the query we do get impressions for: 578 impressions, 9 clicks, position 4.5, **8.3 missed**. Its live top 3 is Binance, so that row is a GSC miss sitting next to the CoinGecko gap rather than a CoinGecko ranking on that exact string.

The title in `src/pages/perps/index.tsx` is "Perp DEX Volume Rankings - DeFi Futures Trading - DefiLlama". CoinGecko's winning title is "Top Perpetual DEXs by Open Interest & Trade Volume". Adding the list phrase ("Top Perpetual DEXs") to that title is the change that lines the page up with the query we lose, without touching the volume wording that already ranks.

### 3. Token unlocks: same title as CoinMarketCap and CoinGecko, one position behind a pack, H1 says something else

Live US order for "token unlocks": Tokenomist, CoinMarketCap, CryptoRank, CoinGecko, Dropstab, then `defillama.com/unlocks` at #6. Labs had CoinMarketCap at #2 and us at #7 (volume 260).

The title tag is already the competitor's title. `src/pages/unlocks/index.tsx` sets "Token Unlocks & Vesting Schedules - DefiLlama". The visible H1 on that page is "Unlock statistics":

```325:327:src/pages/unlocks/index.tsx
			<SummaryCardGrid>
				<SummaryStatsCard>
					<h1 className="heading-sm">Unlock statistics</h1>
```

GSC "token unlocks" is 1,361 impressions, 41 clicks, position 7.2. CTR is 3.0%, so missed@3% is 0. "token unlock" is the same story (26 clicks on 522 impressions). The rank gap is real and the 3% formula does not charge it, because position 7 already clears 3% CTR on the head query. The page URL still sits at position 7.21 across 17,916 impressions (456 clicks, page-level missed 81.5). That 81.5 is every query on `/unlocks`, including long protocol-specific unlock queries, so it is context for the URL and not an extra 81 clicks on "token unlocks".

The on-page change that matches the query the title already targets: make the H1 "Token unlocks", not "Unlock statistics". Title-tag edits will not move a page whose title already matches the two competitors above it.

### 4. RWA list queries rank a coin category; our overview is titled as a dashboard

Live "rwa crypto list": rwa.xyz, then CoinGecko's "Top Real World Assets (RWA) Coins by Market Cap", then CoinMarketCap. Labs volume 210, our Labs position 16, ranking URL `/rwa`. GSC has the query at position 9.4 on only 7 impressions (missed 0.2). The related head term "rwa" is position 11.3, 453 impressions, 2 clicks, missed 11.6.

Overview copy is explicit that this title is the indexed one:

```26:31:src/containers/RWA/layout/pageCopy.ts
		case 'overview':
			return {
				title: `Real World Assets (RWA)${DASHBOARD}`,
				description:
					'Track Real World Assets (RWA) tokenization on-chain. View tokenized treasuries, private credit, real estate, and commodities. RWA AUM, yields, and adoption analytics across all blockchains.',
				canonicalUrl: '/rwa'
```

`DASHBOARD` expands to " Dashboard & Analytics - DefiLlama". CoinGecko wins with "Top … by Market Cap". The overview should say it is a list of tokenized assets ranked by onchain value. A title in the shape of "Top Real World Assets (RWA) by Onchain Value - DefiLlama" is the match, in `getRwaPageMeta` for `overview`, which `src/pages/rwa/index.tsx` already renders. The file's own note says this string is what search has indexed, so the change is intentional or it waits.

`/protocols/rwa` is a protocol ranking ("Real World Assets on Chain (RWA) Rankings" via `getProtocolCategoryPresentation` in `src/containers/ProtocolTaxonomy/constants.tsx`). That is the protocol directory, not the asset list. The asset list query belongs on `/rwa`.

### 5. "{protocol} stats" and "{protocol} volume" lose to a Dune dashboard or a Token Terminal metric page

Three queries where a named competitor's single-protocol page outranks ours:

| Query | Competitor URL | Their position | Our URL | Our position | GSC missed |
| --- | --- | --- | --- | --- | ---: |
| hyperliquid stats | `dune.com/x3research/hyperliquid` "Hyperliquid Stats" | Labs #3, volume 110 | `/protocol/hyperliquid` | Labs #6, GSC 6.5 | 3.5 |
| jupiter volume | `dune.com/arthurlotuz/jup-volume-2025` | Labs #2, volume 320 | `/protocol/jupiter` | Labs #4, GSC 7.0 | 0.8 |
| polymarket volume | Token Terminal polymarket trading-volume | Labs #1, volume 260 | `/protocol/polymarket` | Labs #19, GSC 12.5 | 0.7 |

The title is built in `src/containers/ProtocolOverview/queries.tsx` as `{name} {TVL, Fees, Revenue & Volume} Stats & Charts`, with TVL first whenever TVL exists:

```865:871:src/containers/ProtocolOverview/queries.tsx
	const titleMetricSegment =
		titleMetrics.length === 0
			? 'Stats & Charts'
			: titleMetrics.length === 1
				? `${titleMetrics[0]} Stats & Charts`
				: `${titleMetrics.slice(0, -1).join(', ')} & ${titleMetrics.at(-1)}`
	const seoTitle = `${name} ${titleMetricSegment}`
```

For a perp, a DEX aggregator, or a prediction market, the query Google sees is "{name} volume" or "{name} stats". Leading with TVL puts the word those queries use at the end of the title. The small change is to lead `titleMetrics` with Volume when volume is the protocol's primary public metric (perps, DEX volume, prediction-market volume). Combined missed clicks are about 5, so this is a template fix, not a traffic project. "aave tvl" is already position 3.1 with 180 clicks, which is the same template working when the query word is TVL.

### 6. Digital-asset treasury companies: CoinGecko has the companies table, we rank around 11–22

Labs: "digital asset treasury companies", volume 210, CoinGecko #3 on `/en/treasuries/companies` ("Crypto Treasury Companies"), DefiLlama #22 on `/digital-asset-treasuries`. Live top 3 on 2026-10-14 is articles; CoinGecko is #5. GSC missed clicks on the family are about 3, and the page itself has a 6.4% CTR at position 20 (81 clicks, 1,270 impressions), so the people who find it click. The indexed title is "Digital Asset Treasuries" in `src/pages/digital-asset-treasuries/index.tsx`. Adding "companies" ("Digital Asset Treasury Companies - Holdings List - DefiLlama") is the match to the query and to CoinGecko's wording.

`/treasuries` is protocol treasuries, a different document. Labs ranks that URL at position 40 for "treasury companies" against CoinMarketCap's Bitcoin treasuries chart. It should not be retitled to pick up the corporate-holdings query.

### 7. "Top oracle coins" is a market-cap category we do not publish

Live: CoinGecko #1 and CoinMarketCap #2, both "oracle coins by market cap". Labs "oracle crypto" (volume 170) and "oracle coins" (volume 70) land on those category URLs; we have no ranking and no GSC impressions. `/oracles` is "DeFi Oracle Rankings - Total Value Secured" (`src/pages/oracles/index.tsx`), a TVS table. Retitling it to "top oracle coins" would point a TVS page at a token market-cap query. The page that would win it is a market-cap ranking of oracle tokens, which is not a route we have. Leave `/oracles` on TVS.

Prediction markets, checked so they are not listed as a gap: "top prediction markets" is already live #3 on `/protocols/prediction-market` ("Top Crypto Prediction Markets - TVL, Volume, & Revenue", from `seoBaseTitle` in `src/containers/ProtocolTaxonomy/constants.tsx`). GSC has that query at position 5.6 with 17 clicks and missed 0. "list of prediction markets" and bare "prediction markets" are sportsbooks and explainers. Labs "prediction market volume" has Token Terminal #1 and us #4 (volume 90); the live SERP for that string did not put either of us in the top 5. Not a title gap.

## Do not chase

These are real top-3 competitor keywords. They are not DefiLlama pages.

| Keyword | Volume (US, monthly) | Who ranks | Why it is not a fix |
| --- | --- | --- | --- |
| Token prices and tickers (`price of ripple in dollars`, `xrpusd`, bare tickers) | The bulk of the 7,071 CMC and 3,661 CoinGecko absent keywords. Head terms 50,000–368,000 | CoinGecko `/en/coins/…`, CoinMarketCap `/currencies/…` | Price-quote pages. Bare names are navigational. `/stablecoin/[peggedasset]` is the exception and only for stablecoin supply and peg, titled in `src/pages/stablecoin/[peggedasset].tsx` |
| crypto market cap / cryptocurrency market cap | 22,200, KD 74–82 | CoinMarketCap homepage, Labs #1. We have no GSC impressions | `/mcaps` is "Market Cap Rankings - DeFi Protocols" (`src/pages/mcaps/index.tsx`). That is protocol tokens, not the all-crypto chart. GSC "crypto total market cap" is 2 impressions |
| transactions per second | 90,500, plus 14,800 for "what is transactions per second" | Labs: Token Terminal metrics page #2. Live: a Blast TPS page and explainers. No GSC impressions | No TPS metric in the product. A chain page titled around TPS would be a new dataset, and the live SERP is a definition |
| notional volume | 8,100, KD 2, intent informational | Labs mapped Token Terminal's notional-trading-volume metric at #3. Live top results are generic finance definitions ("what is notional value"); #5 is Token Terminal's page for the Notional Finance project, a different URL | `/options/notional-volume` is DeFi options notional. It will not rank for a dictionary query. GSC has no impressions for "notional volume" |
| usdt dominance / usdt dominance chart | GSC: 1,962 impr / pos 6.7 / missed 56.9, and 1,620 impr / pos 7.3 / missed 44.6 | Live top 3 is TradingView, not any of the five competitors | Real missed clicks on a metric the stablecoin hub already computes (`USDT Dominance` is a stat on `/stablecoins`). Outside this competitor set. Recorded so it is not mistaken for a CoinGecko gap |
| tvl | GSC: 8,660 impr / 142 clicks / pos 5.64 / missed 117.8 | Live US top 3 is WhiteBIT's glossary, CrowdSwap, and a Binance post. None of the five competitors | The DefiLlama URL in that top 10 is `defillama.com/protocol/volta-finance` ("Volta Finance TVL Stats & Charts"), from the protocol title template in `queries.tsx`, not the homepage. Homepage title is "DefiLlama - DeFi Dashboard & Crypto Analytics" (`src/pages/index.tsx`) and the description is the sentence that contains "Total Value Locked (TVL)". Worth a separate look at which URL represents "tvl"; it is not a competitor-keyword win |

Yield-bearing stablecoins: Labs has CoinGecko's category at #1 (volume 110) and `/yields/stablecoins` at #30–34. The live SERP is explainers (Transak, Crypto.com, OKX), and GSC has 15 impressions at positions 46–63. `/yields/stablecoins` is titled "Best Stablecoin Yields - USDC, USDT & DAI APY Rankings" (`src/pages/yields/stablecoins.tsx`), which is the APY table, a different query from CoinGecko's market-cap category of yield-bearing stablecoin assets. No title change on the yields page until the SERP is a ranking table again.

## Coverage notes

- Labs positions and the 2026-10-14 live SERPs disagree on several head terms (Token Terminal's generic TPS URL, CoinGecko's rank on "stablecoins list", the exact DefiLlama position for unlocks). Where they disagree, the live SERP is what Google returned that day and GSC is what we were shown over the 28 days. Both are cited above.
- Intersection "absent" means absent from the Labs index, which is a top-100 style keyword database. GSC can still show a low impression count for the same query. The table prefers GSC when both exist.
- Keyword difficulty on the winnable rows is moderate (stablecoin list KD 58, token unlocks KD 50, rwa crypto list KD 35, digital asset treasury companies KD 22). The price and "crypto market cap" rows are the high-KD ones, and those are the rows not to chase.
