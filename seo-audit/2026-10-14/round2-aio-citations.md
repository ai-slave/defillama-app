# AI Overview citations

Date: 2026-10-14. No application code was changed.

Google’s AI Overview cites DefiLlama on 3 of 40 overviews in the top non-brand queries, and never for the sentence that answers the question. The three citations are a price FAQ, a market-cap strip, and an Ethereum aggregator table. The pages that do get quoted open with “X is …” or a dated number, then a short list. Our hubs open with a table, a loading state, or both, and ship no JSON-LD.

## Method

Sample is the attached top 50 non-brand queries by missed clicks, 28 days ending 2026-10-11 (`uploads/top50_nonbrand_missed.csv`). Missed@3% = max(0, 0.03 × impressions − clicks). Bare brand queries are already out of that file. Bare protocol-name queries stay in the citation count, because the overview still picks a source, and they are kept out of the hub sizing below.

Live SERPs are United States, English, location code 2840, desktop, Windows, depth 10, fetched 14 Oct 2026.

| Call | Endpoint | What it returned | Charged |
| --- | --- | --- | --- |
| 54 | `dataforseo.x.serp-google-organic-live-advanced` | 50 queries with `load_async_ai_overview: true`, plus 4 retries after task 40101. 47 queries returned a SERP. | $0.154 |
| 15 | `dataforseo.x.ai-optimization-perplexity-llm-responses-live` | Sonar, `web_search_country_iso_code: US`, the 15 hub queries below | $0.090 |
| 14 | `cloro.ai-search.chatgpt.scrape` | ChatGPT, country US, web search on, same 15 queries. `tvl` timed out; a retry returned HTTP 500 and was released | $0.050 |
| 3 | `serper.web.search` | US fallback for the three DataForSEO 40101 queries. No AI Overview field in the payload | $0.003 |
| 3 | `anyapi.google.serp.ai_overview` | Same three queries. One `found: false`, two provider failures, all billed | $0.013 |
| 3 | `tinyfish.web.fetch` | HTML body plus page metadata for 20 cited and DefiLlama URLs. Free | $0 |

JSON-LD was read from a direct fetch of the page `<head>` where the host allowed it. Tinyfish returns the body, so schema is from that head fetch, not from the body extract.

Itemized spend on this angle: **$0.31**. Shared team balance was $9.85 before the first call and $9.27 after the last. Other audits were spending on the same balance in that window. The $0.58 drop is not this angle’s bill.

The 15 queries sent to ChatGPT and Perplexity are the definition, ranking, and metric queries inside the 50: `tvl`, `top defi aggregators`, `what are defi aggregators`, `what are dex aggregators`, `usdt dominance`, `usdt dominance chart`, `usdt usdc dai`, `defi lending and borrowing protocols explained`, `defi fee structures`, `jupiter aggregator`, `top defi protocols volume increase feb 27 2026`, `celestia tia circulating supply growth and unlock schedule 2023 2024`, `quai network tokenomics vesting schedule distribution`, `arb token unlock schedule supply 2026`, `uniswap v4`.

## How often DefiLlama is cited

AI Overview present on **40 of 47** parsed SERPs. No overview on `vest market`, `vest exchange`, `collector crypt`, both Ron Bodkin queries, `"sailor capital" site:…`, and `uniswap -uniswap.org`. Three queries never returned a DataForSEO SERP (`inj vs arb vs tia…`, `quai token allocation…`, `"river" sparta cryptocurrency`).

DefiLlama.com is inside the overview’s reference list on **3 of 40** overviews. None of those references is a hub home URL.

| Query | URL Google quoted | Passage it quoted |
| --- | --- | --- |
| rhea finance | `defillama.com/protocol/rhea-finance` | “RHEA is currently trading at $0.072. Its circulating market capitalization is $29.66m…” |
| pons launchpad | `defillama.com/protocol/pons` | “Market Cap $205.47m. $PONS Price $0.30…” |
| top defi aggregators | `defillama.com/dex-aggregators/chain/ethereum` | The Ethereum aggregator table (CoW Swap’s 24h volume), not a definition |

The overview’s own first sentence on those three queries comes from someone else. Rhea’s sentence is the product description from the project docs and CoinMarketCap’s “what is” page. Pons’s sentence is “a non-custodial token launchpad built exclusively for the Robinhood Chain,” from airdropalert and CoinMarketCap. “Top DeFi aggregators” opens by splitting DEX aggregators from yield aggregators, then cites Mudrex, CoinGecko’s category, and Spark’s FAQ. Our URL is one row source.

On the 15 hub queries, every one had an overview, and DefiLlama is cited on 1 of 15 (the Ethereum table above). Organic page-1 for defillama.com on those 15 is three URLs: `/protocol/volta-finance` at #3 for `tvl` (the Volta TVL FAQ, $4,466), `/dex-aggregators` at #3 for `top defi aggregators`, and `/unlocks/arbitrum-foundation` at #5 for the ARB unlock query. The definition queries (`what are dex aggregators`, `what are defi aggregators`, lending, fees, USDT dominance) do not show a defillama.com result on the US desktop first page.

Across all 40 overviews the most cited hosts are YouTube (31 reference slots), Binance (15), CoinMarketCap (14), and CoinGecko (10). On the 15 hub queries the leader is still YouTube (13 of 114 slots, present on 8 of 15 queries), then Binance, CoinMarketCap, tokenomics.com, and TradingView. Glossary and docs URLs, not videos, supply the sentence the overview prints for “what is” queries.

## What the cited pages share

Fetched 14 pages the overviews actually referenced, plus the five hubs and `/data-definitions`, on 14 Oct 2026.

Definition pages the overview quotes:

| Page | First sentence a reader hits | Date on the page | Words | Lists / H2s | Schema in `<head>` |
| --- | --- | --- | --- | --- | --- |
| [CMC Academy: TVL](https://coinmarketcap.com/academy/glossary/total-value-locked-tvl) | “Total value locked represents the number of assets that are currently being staked in a specific protocol.” H1 is the term. | Published 2021-08-21 | 873 | 8 items, 7 H2s | `Article` + `WebPage`. `og:type` glossary |
| [Investopedia: TVL](https://www.investopedia.com/total-value-locked-7486821) | “What Is Total Value Locked (TVL)?” then “TVL is a crucial metric… reflecting the total U.S. dollar value of assets staked…” | 2023-10-31 | 1,528 | 12 items, 9 H2s, “Key Takeaways” | Head fetch blocked. `og:type` article |
| [Sei: What is TVL](https://blog.sei.io/defi/defi-basics/what-is-tvl-in-crypto-and-how-does-it-work/) | H1 is the question. Next sentence defines TVL and gives a $10 million example. | 2026-03-03 | 1,880 | 16 items, 7 H2s, one table | `og:type` article |
| [Coinbase: DEX aggregator](https://www.coinbase.com/learn/crypto-glossary/what-is-a-dex-aggregator) | H1 “What is a DEX aggregator?” Next sentence: “A DEX aggregator is a service that brings together liquidity…” | None in metadata | 468 | 6 H2s | `Article` |
| [Chainlink: DEX aggregator](https://chain.link/article/what-is-dex-aggregator) | Labeled “DEFINITION”, then “A DEX aggregator is a decentralized finance protocol that pools liquidity…” | None | 1,248 | 18 items, 8 H2s | No JSON-LD |
| [Eco: What Is a DEX Aggregator?](https://eco.com/support/en/articles/15284400-what-is-a-dex-aggregator) | H1 is the question. Body answers it and names 1inch, Jupiter, Velora, LI.FI, and Matcha. | Updated 2026-10-05 | 1,837 | Table of contents, one table | `Article` + `BreadcrumbList` |
| [1inch Learn](https://1inch.com/learn/dex-aggregator) | “A DEX aggregator is a protocol that compares swap prices across many decentralized exchanges at once…” | “Updated July 2026”, “7 min read” | 1,306 | 8 H2s, a visible FAQ, no `FAQPage` | `Article` + `WebPage` |
| [HashKey: fee structure](https://www.hashkey.com/en-US/blog/crypto-knowledge-hub/defi-protocol-fee-structure-decoding-the-economic-engine-of-decentralized-finance) | Date, then “the fee structure, as a key element…” | 2025-08-30 in the body | 687 | 3 H2s | Head not re-fetched |
| [DL News: fees and revenue](https://www.dlnews.com/articles/llama-u/how-to-track-defi-protocol-fees-and-revenues-with-defillama/) | “Understanding a protocol’s fee structures and revenue models is essential…” The article is about DefiLlama. The overview cites the article, not defillama.com. | 2023-12-18 | 1,015 | 2 H2s | `og:type` article |

Metric and ranking pages the overview quotes:

| Page | What leads | Date | Words | Schema |
| --- | --- | --- | --- | --- |
| [TradingView USDT.D](https://www.tradingview.com/symbols/USDT.D/) | “USDT.D: ~6.52%” on 7 Oct 2026, share of the whole crypto market | 2026-10-08 | 1,470 | `FinancialProduct` + `Dataset` |
| [tokenomics.com Celestia](https://app.tokenomics.com/tokenomics/celestia) | “Full Celestia tokenomics breakdown: TIA token allocation, vesting schedule, supply distribution, unlock dates…” | 2026-06-06 | 410 | `FinancialProduct` |
| [Token Terminal TVL](https://tokenterminal.com/explorer/metrics/tvl) | “Total value locked (TVL) measures the total value of a project's on-chain deposits…” then the table | None | 332 | No JSON-LD |
| [CoinGecko Jupiter](https://www.coingecko.com/en/coins/jupiter) | Price page. “What is Jupiter?” sits under the price chrome. | None in metadata | 1,191 | `Product` |

The pattern that separates these pages from a dashboard:

- The first sentence defines the term or states the number. Nine of the nine definition pages do this. Token Terminal does it in 332 words, so length is not the bar.
- A date sits next to any current figure. Eco (5 Oct 2026), 1inch (July 2026), Sei (3 Mar 2026), TradingView (8 Oct 2026), and the unlock pages all do. CMC’s TVL glossary is from 2021 and still gets cited because the query `tvl` is a definition, and the current ranking is assembled by the overview from several sources.
- A number or a named list is in that same screen. Eco names five aggregators. Sei uses a $10 million example. TradingView prints 6.52%.
- H2s and bullets. The definition pages have 3 to 9 H2s, and most have a real list.
- Schema is usual and not sufficient. `Article` is on CMC, Eco, Coinbase, and 1inch. `FinancialProduct` and `Dataset` are on TradingView and tokenomics.com. Chainlink and Token Terminal are cited with no JSON-LD. None of the heads that parsed contained `FAQPage`. 1inch has a visible FAQ and still no `FAQPage` node.

Our hubs on the same day:

| URL | Visible text | Opens with | H2s, lists, date, JSON-LD |
| --- | --- | --- | --- |
| `/chains` | 287 words, almost all table cells | Ethereum $51.176b, Base $6.204b, Solana $6.039b. No sentence. | None |
| `/stablecoins` | 258 words | H1 “Total Stablecoins Market Cap $306.019b”, then “USDT Dominance 60.12%”, then Tether $183.975b, USDC $73.135b, DAI $4.741b. No sentence. | None. Dominance is `getStablecoinDominance` in `src/containers/Stablecoins/utils.ts`: top stablecoin market cap divided by total stablecoin market cap. |
| `/categories` | 525 words | “TVL by category. Loading chart…” Then the table, which does include the one-line description (“Lending… Protocols that allow users to borrow and lend assets”). | None |
| `/dex-aggregators` | 147 words | H1 “DEX Aggregator Volume (24h) $2.464b”. Jupiter $539.42m, DFlow $348.52m, 0x $207.47m. No sentence about what an aggregator is. | None |
| `/yields` | 90 words | Disclaimer, then “Tracking 0 pools across 498 protocols on 104 chains” and “Loading pools…” | None. Pool rows are not in the fetched text. |
| `/data-definitions` | 1,127 words, 22 H2s | “TVL. For protocols: Value of all coins held in smart contracts of the protocol.” Real definitions, no question H1, no date, no current ranking. Not cited for `tvl`. | None |

`public/definitions.ts` `dexAggregators.common` (“Volume of all spot token swaps routed through the DEX aggregator”) is a column tooltip, not the sentence Coinbase, Chainlink, Eco, and 1inch get quoted for. Putting that tooltip on the page would still not answer “what is a DEX aggregator?”.

The USDT split is the metric version of the same miss. The overview for `usdt dominance` says “USDT Dominance (USDT.D) is roughly 6.64% as of October 2026, measuring Tether's share of the total cryptocurrency market capitalization,” and both it and the chart query cite TradingView. Our 60.12% is a different ratio. A sentence that calls 60% “USDT dominance” without the qualifier will disagree with the overview.

## ChatGPT and Perplexity, same 15 queries

The same URLs win. An exact URL from the Google overview also appears in Perplexity’s annotations or ChatGPT’s sources on 11 of 15 Perplexity answers and 10 of 14 ChatGPT answers.

| Query | Google overview cites | Also cited by |
| --- | --- | --- |
| what are dex aggregators | Eco, 1inch Learn, Chainlink, 0x | Perplexity: all four. ChatGPT: Eco and 1inch |
| usdt dominance, usdt dominance chart | tradingview.com/symbols/USDT.D/ | Perplexity and ChatGPT |
| tvl | Investopedia, CMC Academy | Perplexity cites both. ChatGPT did not return |
| celestia unlock schedule | docs.celestia.org, app.tokenomics.com, Dropstab | Perplexity and ChatGPT cite the docs and tokenomics.com |
| quai tokenomics | app.tokenomics.com/tokenomics/quai-network | Perplexity and ChatGPT |
| arb unlock schedule 2026 | tokenomics.com, Tokenomist, Yahoo | Perplexity and ChatGPT. ChatGPT also cites `defillama.com/unlocks/arbitrum-foundation` for circulating supply |
| uniswap v4 | v4.uniswap.org, blog.uniswap.org, support.uniswap.org | Perplexity and ChatGPT |
| jupiter aggregator | Gemini, QuickNode, jup.ag | Perplexity: Gemini and QuickNode. ChatGPT: jup.ag |

DefiLlama.com shows up in Perplexity on 1 of 15 (`top defi protocols volume increase feb 27 2026`, the homepage, beside a Plisio write-up). ChatGPT shows it on 3 of 14: that volume query (plus `investors.defillama.com` and `enterprise.defillama.com`), the Arbitrum unlocks page, and `swap.defillama.com` on `top defi aggregators`. The rankings hubs are not the source. Perplexity’s `tvl` answer also cites tvl.be, the Belgian broadcaster, because the bare word is ambiguous and `/chains` never says “TVL means…”.

## Content specs

One server-rendered block above the table, on every hub. About 80 to 150 words. The block is the definition or the ranking sentence, the figure with a calendar date from `formatDate` in `src/utils/dateFormat.ts` (`Oct 14, 2026`), and two or three named rows. Two visible questions follow, using the same words as the query. Pass `Article` JSON-LD for a definition hub and `Dataset` JSON-LD for a metric hub through the existing `jsonLd` prop on `Layout` (`src/layout/index.tsx` forwards it to `src/components/SEO/index.tsx`). Do not add `FAQPage` to match the winners: the cited pages do not use it. `EntityQuestionsStrip` stays the LlamaAI entry. It is not the answer.

Numbers below are the figures in the HTML on 14 Oct 2026. Render them from the same props as the table. Do not paste these literals into the source.

### Definition hub

Job: win “what is / what are”. H1 is the question or the term. The next sentence is “{Term} is …” or “{Term} measures …”. Name three examples with the figure. A date only if the sentence contains a figure that moves.

`/dex-aggregators` is this type. So is `/protocols/lending`, which is where “defi lending and borrowing protocols explained” has to be answered. `public/definitions.ts` stays the tooltip for the column. It is the wrong sentence for the H1.

Title in `src/pages/dex-aggregators/index.tsx` (58 characters before the brand suffix the layout adds, so keep the visible title inside the current pattern):

`What Is a DEX Aggregator? Volume Rankings`

Description (148 characters):

`A DEX aggregator routes one swap across many exchanges for a better price. Compare 24h volume for Jupiter, DFlow, 0x, and 100+ routers.`

Lead, rendered under the H1 in `src/containers/AdapterMetrics/AdapterByChain.tsx` (the all-chains branch that today prints only the 24h `StatItem`, around the `labelAs="h1"` block):

> A DEX aggregator is a protocol that pulls prices from many decentralized exchanges and routes one swap across them, splitting the order when that gets a better price. On Oct 14, 2026, tracked DEX aggregator volume was $2.46b in 24 hours. Jupiter led at $539m, then DFlow at $349m and 0x at $207m.

Questions under that paragraph:

- What is a DEX aggregator? Same sentence as the lead.
- Which DEX aggregator has the highest 24h volume? “Jupiter, at $539m on Oct 14, 2026, ahead of DFlow ($349m) and 0x ($207m).”

Lending, same type, in `src/containers/ProtocolTaxonomy/index.tsx` under the H1 that `categoryPresentation.headingLabel` already sets. The eight-word string in `protocolCategoryConfig.Lending.description` (`src/containers/ProtocolTaxonomy/constants.tsx`) stays as the table cell on `/categories`. The category page needs the full sentence:

> DeFi lending protocols let people borrow and lend crypto without a bank or a credit check. Lenders deposit into a pool, borrowers post collateral, and a smart contract sets the rate. On Oct 14, 2026 the lending category held $53.1b across 655 protocols.

### Ranking hub

Job: win “top / which / compare”. The first sentence names the leader, the metric, and the date, then two runners-up. The table stays. The overview will quote the sentence and use the table as the source list.

`/chains`, `/categories`, and `/yields` are this type.

`/chains`. Files: `src/pages/chains.tsx` (title and description) and `src/containers/ChainsByCategory/index.tsx` (insert the paragraph above `RowLinksWithDropdown`, before the chart). Today the fetched text starts at the Ethereum row.

Title:

`DeFi TVL by Chain: Ethereum, Base, Solana`

Description (132 characters):

`Total value locked (TVL) is the dollar value of assets deposited in DeFi. Ethereum leads, then Base and Solana.`

Lead:

> Total value locked (TVL) is the dollar value of crypto deposited in DeFi protocols. On Oct 14, 2026 Ethereum led with $51.2b, ahead of Base at $6.2b and Solana at $6.0b.

Questions:

- What is TVL? The first sentence above. Link `/data-definitions#tvl`.
- Which blockchain has the highest DeFi TVL? “Ethereum, at $51.2b on Oct 14, 2026.”

`/categories`. Files: `src/pages/categories.tsx` and `src/containers/ProtocolTaxonomy/CategoriesPage.tsx`. The description column is already in the HTML. The page still opens with “TVL by category” and “Loading chart…”.

Title:

`DeFi Categories by TVL: Bridges, Staking, Lending`

Description (139 characters):

`DeFi categories ranked by total value locked. Bridges, liquid staking, and lending are the three largest sectors.`

Lead:

> DeFi categories are groups of protocols that do the same job. On Oct 14, 2026 bridges led with $58.7b, then liquid staking at $56.8b and lending at $53.1b. Lending protocols let users borrow and lend assets.

Questions:

- What are the largest DeFi categories by TVL? The ranking sentence.
- What are DeFi lending protocols? “Protocols that let users borrow and lend assets. The category held $53.1b on Oct 14, 2026.”

`/yields`. Files: `src/pages/yields.tsx` and `src/containers/Yields/views/EarnView.tsx`. Two changes, and the sentence is useless without the first.

The fetched page says “Tracking 0 pools across 498 protocols on 104 chains” and “Loading pools…”. `serverTotal` of 0 adds the `invisible` class on the tracking line (around line 179) and `isLoading` renders `PanelLoadingStatus` instead of `PaginatedYieldsPoolTable`. Pool name, APY, and TVL have to be in the server HTML. Until they are, there is nothing for an overview to quote.

Title:

`Yield Farming APY Rankings`

Description (126 characters):

`Yield farming is depositing crypto into a pool to earn rewards. Compare verified APY across thousands of DeFi pools.`

Lead, once `serverRows` is non-empty in the HTML:

> Yield farming is depositing crypto into a pool to earn rewards. DefiLlama tracks {serverTotal} pools across {protocols} protocols on {chains} chains. On {date}, the highest verified stablecoin APY in this table is {apy} on {pool}.

Fill `{apy}` and `{pool}` from the first verified stablecoin row already loaded for the table. Do not invent a pool. Questions: “What is yield farming?” (the first sentence) and “Which pool has the highest verified stablecoin APY?” (the second).

### Metric hub

Job: win a named statistic. The first sentence gives the number, says what ratio it is, and dates it. A second sentence points at the chart. `Dataset` JSON-LD describes the series.

`/stablecoins` is this type. The same shape belongs on `/fees` and on `/unlocks/[protocol]`.

`/stablecoins`. Files: `src/pages/stablecoins.tsx` and `src/containers/Stablecoins/StablecoinsByChain.tsx`, directly under the `StatItem` that already prints `{topTokenSymbol} Dominance` (around line 517).

Title:

`Stablecoin Market Cap and USDT Share`

Description (155 characters):

`USDT is 60% of the stablecoin market. That share is not TradingView's USDT.D index, which measures USDT against all crypto. Market cap, supply, and pegs.`

Lead:

> USDT is 60.12% of the stablecoin market on Oct 14, 2026: $184.0b of a $306.0b total, ahead of USDC at $73.1b and DAI at $4.7b. This is each coin’s share of stablecoin market cap. It is not TradingView’s USDT.D index, which measures USDT against the whole crypto market and was about 6.6% in the same week.

Questions:

- What is USDT’s share of the stablecoin market? The first sentence.
- How do USDT, USDC, and DAI compare? “On Oct 14, 2026 USDT was $184.0b, USDC $73.1b, and DAI $4.7b, all pegged near $1.”

`Dataset` JSON-LD: name “Stablecoin market cap”, description the lead’s first sentence, `temporalCoverage` ending on the data date, `url` `https://defillama.com/stablecoins`.

Fees, same type, in the `AdapterByChain` summary used by `src/pages/fees/index.tsx`. The overview’s sentence for `defi fee structures` was “pre-set by smart contracts… dividing costs between network validators, liquidity providers, and protocol treasuries,” and it cited HashKey, Crypto.com, and a DL News article about us. `definitions.fees.common` in `public/definitions.ts` (“Total fees paid by users when using the protocol”) can be the second sentence. The first has to be:

> DeFi fees are what users pay to swap, borrow, or lend. A protocol’s fee structure splits that payment between liquidity providers, the protocol, and the network. On {date}, tracked protocol fees were {24h total}.

Unlocks, same type, in `src/pages/unlocks/[protocol].tsx`. The ARB overview’s sentence was “The next Arbitrum (ARB) token unlock is scheduled for October 16, 2026, releasing 92.65 million ARB.” We were organic #5 and not cited. The first sentence on an unlock page should be that shape, from the page’s own next event: “The next {symbol} unlock is {date}, releasing {amount} {symbol}.” Tokenomics.com wins the long-tail queries with an allocation sentence of that length (410 words total).

## Ranked fixes

Missed clicks are from the attached top-50 file, query level, not page level. Page-level missed clicks on `/chains` and `/stablecoins` include brand traffic and are not used here.

Ordered by missed clicks on queries where a DefiLlama URL is already in the Search Console window and the missing piece is the sentence. Celestia and Quai unlock queries add another 169.5 missed clicks, and neither URL was on the US first page, so the sentence does not create that rank.

| # | Queries | Missed@3% | What to ship |
| --- | --- | ---: | --- |
| 1 | what are dex aggregators; what are defi aggregators; top defi aggregators | 158.5 | Definition-hub lead on `/dex-aggregators`. The only DefiLlama URL in that overview is the Ethereum chain table. |
| 2 | usdt dominance; usdt dominance chart; usdt usdc dai | 125.6 | Metric-hub lead on `/stablecoins` that states 60.12% is stablecoin-market share and names USDT.D as a different index. TradingView is who Google, ChatGPT, and Perplexity cite today. |
| 3 | tvl | 117.8 | Ranking-hub lead on `/chains`. The US first page’s only DefiLlama URL is the Volta Finance TVL FAQ. Perplexity cites the same CMC and Investopedia glossaries as the overview. |
| 4 | defi lending and borrowing protocols explained | 44.8 | Definition-hub lead on `/protocols/lending`, and the ranking sentence on `/categories`. The eight-word description is already in the categories table and is not what the overview quotes. |
| 5 | defi fee structures | 40.4 | Definition-hub lead on `/fees` via `AdapterByChain`. The overview cited a DL News tutorial about DefiLlama rather than `/fees`. |
| 6 | arb token unlock schedule supply 2026 | 30.8 | Metric-hub sentence on `src/pages/unlocks/[protocol].tsx`: next unlock date, amount, and share of supply. We were organic #5 and not cited. tokenomics.com is the URL Google, ChatGPT, and Perplexity share. The same sentence covers Celestia (88.6) and Quai (80.9) once those URLs rank. |
| 7 | yield farming (412 impressions, position 11.1, 0 clicks in the attached query export; not inside the top 50) | 12.4 | Put pool rows in the server HTML of `/yields`, then the ranking-hub sentence. The fetch currently says “Loading pools…” and “Tracking 0 pools”. |

Protocol pages are a separate quote problem, already specified in the round-1 SERP report. This sample confirms it: the two protocol citations we did earn are the price sentence on Rhea and the market-cap strip on Pons, while the overview’s answer sentence comes from a “what is” page. The first visible sentence on a protocol page still has to be the product description.

## Limits

Positions in the attached export are 28-day, all countries. These SERPs are one US desktop snapshot. A query can average position 4 in Search Console and still be absent from this first page.

DataForSEO returned task 40101 twice for three queries. Serper’s US result has no AI Overview object, so those three are missing from the 40/47 rate rather than counted as “no overview”. AnyAPI did not return an overview for them either.

ChatGPT is 14 of 15 queries. `tvl` has a Perplexity answer and a Google overview, and no ChatGPT source list. Cloro is the ChatGPT source because the DataForSEO ChatGPT scraper has no successful calls in the catalog’s recent window.

Schema checks failed with HTTP 403 for Investopedia and Tokenomist. Their dates and first sentences come from the body fetch. Word counts are the fetched body with tags stripped, including some navigation, so they are an upper bound.

Checks: this file is the only change. `bun run typecheck`, `bun run test:typecheck`, and `bun run check` were not run. No browser check. No UI was edited.
