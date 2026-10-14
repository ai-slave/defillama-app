# AEO visibility: answer-engine citations vs DefiLlama

Date: 2026-10-14. No application code was changed.

## Method

Turned the top non-brand topic queries (TVL, stablecoins, yields, fees and revenue, chains, categories) into 25 natural questions and asked three answer engines, each with web search and source URLs:

| Engine | Endpoint | What it is | Calls | Charged |
| --- | --- | --- | --- | --- |
| Perplexity Sonar | `dataforseo.x.ai-optimization-perplexity-llm-responses-live` | `model_name: sonar`, `web_search: true`, US | 26 (25 + 1 probe) | $0.154 |
| Gemini | `cloro.ai-search.gemini.scrape` | Live Gemini answer, country US, `sources` | 25 | $0.060 |
| ChatGPT | `cloro.ai-search.chatgpt.scrape` | Live ChatGPT answer, country US, `sources` | 25 | $0.070 |

A citation is a `defillama.com` URL in Sonar `annotations` or in Gemini/ChatGPT `sources`. Subdomains (`investors.`, `enterprise.`, `docs.llama.fi`) are counted separately. Brand and bare protocol-name queries are excluded from missed-click sizing. Missed@3% = max(0, 0.03 × impressions − clicks).

Search Console window checked live: 2026-09-15 to 2026-10-12, `dataState: all`, property `sc-domain:defillama.com`, endpoint `google-search-console` `webmasters/v3/.../searchAnalytics/query` (free). Site total: 169,606 clicks, 2,570,246 impressions. The attached 28-day export matches that window: homepage 78,536 clicks / 232,339 impressions versus a live homepage pull of 78,467 / 228,010. Query-to-page rows below are the live pull. Page HTML was read with free `tinyfish.web.fetch` (Cloudflare blocked a plain curl). `https://defillama.com/robots.txt` and `/llms.txt` were fetched directly.

Spend on this angle: **$0.284** (Sonar $0.154, Gemini $0.060, ChatGPT $0.070). Balance before the calls was $10.98; after, $9.85. The gap is other agents spending on the same team balance in the same window.

## Citation rate

Share of the 25 questions where the engine's sources include that host:

| Source | Sonar | Gemini | ChatGPT |
| --- | ---: | ---: | ---: |
| defillama.com | 3/25 | 8/25 | 15/25 |
| CoinGecko | 7/25 | 3/25 | 5/25 |
| CoinMarketCap | 7/25 | 0/25 | 4/25 |
| Token Terminal | 0/25 | 2/25 | 0/25 |
| docs.llama.fi | 1/25 | 2/25 | 2/25 |
| investors.defillama.com | 0/25 | 0/25 | 10/25 |
| enterprise.defillama.com | 0/25 | 0/25 | 8/25 |

DefiLlama.com is cited on 15 of 25 questions by at least one engine. Sonar, the engine that cites the most, cites us on current-number questions (`What is DeFi TVL right now?`, `What is DEX volume?`, `What is Solana TVL?`) and cites a glossary for definition questions. ChatGPT mentions the name in 16/25 answers; Sonar mentions it in 3/25. No engine cited `/llms.txt` or `/llms-full.txt`.

Seven questions were answered with CoinGecko, CoinMarketCap, or Token Terminal and with no defillama.com URL: top stablecoins, yield farming, DeFi fee structures, perp DEX volume, what are DeFi aggregators, what are DEX aggregators, and DeFi lending protocols. USDT dominance, best stablecoin yields, and top DeFi aggregators also came back with no defillama.com URL (those answers cited Spark, stablecoin.com, and explainer blogs).

## What cited pages have

Fetched the pages engines actually cited. The pattern is the same on every loss:

| Cited page | Opens with | Also has |
| --- | --- | --- |
| [CMC Academy: Total Value Locked](https://coinmarketcap.com/academy/glossary/total-value-locked-tvl) | H1 is the term. First sentence defines it. `og:type` glossary. Published 2021-08-21. | Short glossary body |
| [Token Terminal: TVL](https://tokenterminal.com/explorer/metrics/tvl) | "Total value locked (TVL) measures the total value of a project's on-chain deposits…" then a top-10 table | Methodology link |
| [CoinGecko: Stablecoins](https://www.coingecko.com/en/categories/stablecoins) | "The Stablecoins market cap today is $300 Billion" plus "A stablecoin is a type of cryptocurrency…" | Table, and a Frequently Asked Questions block ("What are stablecoins") |
| [CMC: Stablecoin](https://coinmarketcap.com/view/stablecoin/) | Market-cap figure, then "This page lists the most valuable stablecoins." | Table and an FAQ ("How do stablecoins work?") |
| [Eco: What Is a DEX Aggregator?](https://eco.com/support/en/articles/15284400-what-is-a-dex-aggregator) | Title is the question. First sentence answers it. Updated 2026-10-05. | Table of contents, named protocols |
| [CoinGecko Learn: yield farming](https://www.coingecko.com/learn/what-is-yield-farming) | "What is Yield Farming" and a definition in the first paragraph. Updated 2024-11-12. | Steps, table |
| [docs.llama.fi data definitions](https://docs.llama.fi/analysts/data-definitions) | Same TVL / fees / revenue copy as the app glossary. Updated 2026-09-02. Offers a Markdown view. | This docs URL is what Sonar cites for "what is TVL", ahead of defillama.com |
| [Chainnarrative: fees vs revenue](https://chainnarrative.com/analysis/protocol-revenue-vs-total-fees-in-defi-explained) | Title is the comparison. First paragraph states the difference. | Examples |

Our hubs already have the numbers and the tables. Live text on 2026-10-14:

- `/` — h1 "Total Value Locked in DeFi" and $91.3b, plus a daily brief ("DeFi TVL is $91.6B… Updated 2h ago"). No definition sentence, no FAQ, no JSON-LD.
- `/chains` — a rankings table (Ethereum $51.2b, Base $6.2b, Solana $6.0b) and an "Ask about Chains" strip. No lead sentence. Sonar printed almost this exact ranking and cited CoinMarketCap and CryptoTicker.
- `/stablecoins` — h1 $306.0b, a "USDT Dominance 60.12%" stat, and a table (USDT $184.0b, USDC $73.1b, DAI $4.7b). No sentence, no FAQ.
- `/dex-aggregators` — h1 "DEX Aggregator Volume (24h) $2.46b" and a volume table. No sentence that says what an aggregator is.
- `/fees` and `/revenue` — 24h totals ($74.5m fees, $43.0m revenue) and a per-protocol methodology column. The metric definition is a tooltip.
- `/yields` — "Tracking 15,060 pools…" and a verified-APY note. No "yield farming is…".
- `/protocols/lending` — h1 "Lending", TVL $52.9b, a table. The one-line category description is not on this page.
- `/data-definitions` — real definitions (TVL, fees, revenue). No FAQ schema, no question-shaped headings. Cited for "fees vs revenue", not for "what is TVL".
- `/categories` — the index table does include a Description cell per sector. Its Search Console impressions are mostly brand typos (see below).

`src/components/SEO/index.tsx` emits JSON-LD only when a page passes `jsonLd`. None of these hubs pass it. `EntityQuestionsStrip` (`src/components/EntityQuestionsStrip/index.tsx`) renders the question as a button that opens LlamaAI. It is not an answer and it is not `FAQPage` schema.

Definitions already exist and are only attached as tooltips. `public/definitions.ts` (`fees.common`, `revenue.common`, `dexAggregators.common`, `perps.common`, …) is passed as `tooltip` on the summary stat in `src/containers/AdapterMetrics/AdapterByChain.tsx` (the `pageTypeByDefinition` map near the top of the file, used around the 24h stat). A fetch of `/dex-aggregators` did not surface that sentence in the page text.

`investors.defillama.com/chain/solana` is the same chain screen and its canonical is `https://defillama.com/chain/solana`. ChatGPT still lists the investor and enterprise hosts as sources. That splits credit; it does not add a definition.

## robots.txt and llms.txt

Production `https://defillama.com/robots.txt` is:

```
User-agent: *
Allow: /

Sitemap: https://defillama.com/sitemap.xml
Sitemap: https://defillama.com/research/sitemap.xml
```

GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, and CCBot are covered by `User-agent: *`. Nothing disallows them. `/llms.txt` and `/llms-full.txt` return 200, `text/plain`, last-modified 2026-10-13. The generator is `scripts/command/robots.ts` (allow-all when `ROBOTS_ALLOW_INDEXING=true`, which production is) and `scripts/command/llms.ts`.

Crawlers can read the site. They cite glossary articles because the ranking URLs do not answer the question in the first paragraph. Adding a Disallow, or treating `llms.txt` as the answer surface, would not change these citations: none of the 75 answers cited `llms.txt`.

## Ranked weak spots

Missed clicks are non-brand, live Search Console, 2026-09-15 to 2026-10-12.

| # | Page / query | GSC | Answer engines | Missed@3% | Fix |
| --- | --- | --- | --- | ---: | --- |
| 1 | `/dex-aggregators` — "top defi aggregators", "what are dex aggregators", "what are defi aggregators" | 1,865 impr, pos 1.1, 0 clicks; 1,450 impr, pos 3.8, 0 clicks; 1,424 impr, pos 3.6, 0 clicks | 0/3 cite defillama.com. Cited: Eco and 1inch "What is a DEX aggregator?", CoinGecko Learn | 142 | Put `dexAggregators.common` from `public/definitions.ts` in the page text under the h1 in `src/containers/AdapterMetrics/AdapterByChain.tsx` (today it is only the tooltip). Title/description in `src/pages/dex-aggregators/index.tsx`. Add a visible FAQ ("What is a DEX aggregator?", "Which aggregators have the most 24h volume?") and pass `FAQPage` JSON-LD through `Layout` (`src/layout/index.tsx` already forwards `jsonLd` to `src/components/SEO/index.tsx`). Name Jupiter, DFlow, and 0x with the 24h figure in that sentence. |
| 2 | `/chains` for the query "tvl" | 8,118 impr, pos 5.7, 142 clicks, CTR 1.7%. "crypto tvl" on the same page is pos 1.5 with a 61% CTR | Sonar does not cite us. It cites the CMC Academy glossary, Investopedia, and `docs.llama.fi` FAQ, and prints a chain table that matches our rows | 102 | On `src/containers/ChainsByCategory/index.tsx`, above the table, one sentence from the TVL block in `src/pages/data-definitions.tsx` plus the dated ranking already in the table ("Ethereum leads at …"). Same definition next to the h1 on the homepage (`src/pages/index.tsx`, `src/containers/ChainOverview`). The daily brief already states the number; it does not define TVL. |
| 3 | `/stablecoins` — "usdt dominance", "usdt dominance chart" | 1,617 impr, pos 7.3, 4 clicks; 1,975 impr, pos 6.7, 2 clicks. "stablecoin market cap" on this URL is pos 1.3, CTR 34% | 0/3 cite us for dominance or for "top stablecoins". CoinGecko and CMC category pages are cited; both open with today's market cap and an FAQ | 102 | In `src/containers/Stablecoins/StablecoinsByChain.tsx` (page `src/pages/stablecoins.tsx`), turn the existing "USDT Dominance" stat into a sentence: USDT's share of stablecoin market cap, with the top three rows. Add the FAQ CoinGecko and CMC already have ("What are stablecoins?", "What is USDT dominance?"). Dominance math is `getStablecoinDominance` in `src/containers/Stablecoins/utils.ts`. |
| 4 | `/protocols/lending` — "defi lending and borrowing protocols explained" | 1,362 impr, pos 6.8, 0 clicks. Related "defi lending" on the same URL: 298 impr, pos 6.5 | 0/3 cite us. Cited: Aave docs, Crypto.com Learn, Binance, Stellar | 41 | Render the existing description under the h1. The string is `protocolCategoryConfig.Lending.description` in `src/containers/ProtocolTaxonomy/constants.tsx` ("Protocols that allow users to borrow and lend assets"). The h1 is `categoryPresentation.headingLabel` in `src/containers/ProtocolTaxonomy/index.tsx`. The categories index already shows that description in a column (`src/containers/ProtocolTaxonomy/CategoriesPage.tsx`); the category page does not. Add an H2 "What are DeFi lending protocols?" and `FAQPage` JSON-LD from `src/pages/protocols/[category].tsx`. |
| 5 | `/fees` — "defi fee structures" | 889 impr, pos 4.1, 0 clicks | 0/3 cite `/fees`. The explicit question "difference between fees and protocol revenue" does cite `/data-definitions` (Gemini and ChatGPT) and `docs.llama.fi` | 27 | Print `definitions.fees.common` and `definitions.revenue.common` (`public/definitions.ts`) as paragraphs on `src/pages/fees/index.tsx` and `src/pages/revenue/index.tsx`, via the shared summary in `AdapterByChain.tsx`, with a link to `/data-definitions#fees` and `#revenue`. FAQ: "What is a DeFi fee?" and "How is protocol revenue different from fees?". On `src/pages/data-definitions.tsx`, add `FAQPage` JSON-LD for the headings that are already there, and phrase the TVL heading as "What is TVL?" so it matches the glossary pages Sonar cites. |
| 6 | `/yields` — "yield farming" | 400 impr, pos 11.0, 0 clicks. "defi yield farming" on the same URL: 261 impr, pos 4.7, 14 clicks | 0/3 cite defillama.com. Cited: Investopedia, CoinGecko Learn, Coinbase Learn, Binance Academy. Stablecoin-yield answers cite StakingRewards, Datawallet, and Spark | 12 | In `src/containers/Yields/views/EarnView.tsx` next to "Tracking N pools" (`src/pages/yields.tsx`), add "Yield farming is depositing crypto to earn rewards" and one dated line for the top stablecoin pool. FAQ on the page. Leave `EntityQuestionsStrip` as the LlamaAI entry; it does not answer the query. |
| 7 | `/perps` — "perp dex volume" | 621 impr, pos 1.2, 316 clicks, CTR 51%. Google is fine | 0/3 cite us. Sonar cites CoinGecko's decentralized derivatives list and a comparison wiki | 0 | Same `AdapterByChain` lead, using `definitions.perps` in `public/definitions.ts`, from `src/pages/perps/index.tsx`. A sentence that defines a perp DEX and names the top row by volume. Low click loss, high citation loss. |
| 8 | `/categories` brand-typo impressions | Live page filter: ~79k brand-typo impressions at pos 1.0 and CTR under 1% ("defillama", "defilama", "defilamma"). Non-brand impressions in the top 250 queries are a few thousand, mostly more typos | Not an answer-engine gap | 0 for this audit | Do not treat the attached page-row missed@3% of 2,973 as demand. Those impressions are the brand query landing on `/categories` while the click goes to the homepage. The index table already has sector descriptions. |

`/chains` (222,885 impressions in the attached export, CTR 2.2%, missed@3% 1,841) and `/stablecoins` (missed@3% 1,383) look larger because the page total includes brand queries with a low CTR. The non-brand remainder is the "tvl" and "usdt dominance" rows above.

## Template changes, in one pass

One visible answer block per template, server-rendered, using copy the repo already has. Each block is a definition sentence, the current figure with a date (follow `docs/date-formatting.md`), and two or three FAQs whose visible text matches `FAQPage` JSON-LD.

| Template | Files |
| --- | --- |
| Fees, revenue, DEX volume, perp volume, DEX aggregators | `src/containers/AdapterMetrics/AdapterByChain.tsx`, `public/definitions.ts`, `src/pages/fees/index.tsx`, `src/pages/revenue/index.tsx`, `src/pages/dexs/index.tsx`, `src/pages/perps/index.tsx`, `src/pages/dex-aggregators/index.tsx` |
| TVL and chains | `src/pages/chains.tsx`, `src/containers/ChainsByCategory/index.tsx`, `src/pages/index.tsx`, `src/containers/ChainOverview`, `src/pages/data-definitions.tsx` |
| Stablecoins | `src/pages/stablecoins.tsx`, `src/containers/Stablecoins/StablecoinsByChain.tsx`, `src/containers/Stablecoins/utils.ts` |
| Yields | `src/pages/yields.tsx`, `src/containers/Yields/views/EarnView.tsx` |
| Category pages (lending and the other sectors) | `src/containers/ProtocolTaxonomy/index.tsx`, `src/containers/ProtocolTaxonomy/constants.tsx`, `src/pages/protocols/[category].tsx` |
| Glossary | `src/pages/data-definitions.tsx` |
| JSON-LD slot | `src/components/SEO/index.tsx`, `src/layout/index.tsx` |
| Crawlers | `scripts/command/robots.ts`, `scripts/command/llms.ts`, `public/llms.txt` — leave allow-all and the llms files in place |

## Questions asked

1. What is TVL in crypto and DeFi?
2. What is the current total value locked in DeFi?
3. What is Solana's current DeFi TVL?
4. Which blockchains have the highest DeFi TVL?
5. What is the current stablecoin market cap?
6. What is USDT dominance in the stablecoin market?
7. What are the top stablecoins by market cap?
8. How do USDT, USDC, and DAI compare by market cap?
9. What is yield farming in DeFi?
10. What are the best stablecoin yields right now?
11. Which DeFi pools have the highest APY right now?
12. What are DeFi fee structures?
13. Which DeFi protocols generate the most fees?
14. What is the difference between DeFi fees and protocol revenue?
15. Which DeFi protocols make the most revenue?
16. How do blockchains compare on DeFi TVL, fees, and volume?
17. What is the best Solana DEX by trading volume?
18. What is a perp DEX and which perpetual DEXs have the highest volume?
19. What is current DEX trading volume across DeFi?
20. What are DeFi aggregators?
21. What are DEX aggregators?
22. What are the top DeFi aggregators?
23. What are DeFi lending and borrowing protocols?
24. What are the main DeFi protocol categories by TVL?
25. Which blockchains hold the most stablecoin supply?

Current-number questions 2, 15, 19, and 24 are the ones where two or three engines already cite defillama.com. Definition questions 1, 6, 7, 9, 12, 18, 20, 21, and 23 are where they cite someone else's glossary.
