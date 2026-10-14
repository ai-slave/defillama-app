# Citation scorecard

Date: 2026-10-14. No application code was changed.

Our 13 pages score **40.9 / 100**. The 39 pages that AI Overviews, ChatGPT, and Perplexity cite for the same queries score **65.1 / 100**. The gap is the opening sentence. Our hubs already put the ranking table in the server HTML, and the figures are on the page. The cited pages put “X is …” or a dated number in the first sentence. `/yields` is the exception on the table: the server document says “Tracking 0 pools” and “Loading pools…”.

`/protocol/rhea-finance` (60.0) and `/protocol/vest-markets` (58.8) beat the average of the pages cited against them. Both still open with a TVL stat. The sentence an overview quotes sits in Protocol Information, or on the project’s own docs.

Scores for every page are in `seo-audit/2026-10-14/round2-citation-scorecard.csv`.

## Method

Thirteen URLs: the ten hubs named in the task, plus `/protocol/rhea-finance`, `/protocol/pons`, and `/protocol/vest-markets`. Rhea and Pons are the two protocol URLs an overview quoted in the AI Overview report (PR #8). Vest Markets is the protocol page with the largest non-brand miss in the attached 28-day export.

Queries are the top non-brand rows from Search Console for that exact URL, 2026-09-14 through 2026-10-11, property `sc-domain:defillama.com`. Brand typos (`defillama`, `defi lama`, and the same family) are excluded. Where the click-sorted top of the page is a query the page already wins, the citation query from PR #8 and the AEO report (PR #2) is the one the score is judged against. Bare protocol names are navigational for click sizing. They stay in the scorecard because the overview still picks a source for them.

Competitor URLs are the ones those two reports already named, three per page. Live Google, Perplexity, and ChatGPT calls were made only where those reports did not give a URL: categories, RWA, perp DEX definition, yield farming, lending, the unlocks index, and the three protocol pages. Nine queries, United States, English, 14 Oct 2026.

| Call      | What it returned                                                                                         | Charged                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 9         | `dataforseo.x.serp-google-organic-live-advanced`, desktop, location 2840, `load_async_ai_overview: true` | $0.036                                                                                    |
| 9         | `dataforseo.x.ai-optimization-perplexity-llm-responses-live`, Sonar, US                                  | $0.053                                                                                    |
| 9         | `cloro.ai-search.chatgpt.scrape`, US, web search on                                                      | $0.025                                                                                    |
| 9         | `cloro.ai-search.perplexity.answer`                                                                      | $0. The provider returned `MODEL_UNAVAILABLE`. DataForSEO Sonar is the Perplexity source. |
| 1         | `crawl4ai.google.serp.ai_mode` on “what are dex aggregators”                                             | $0.00015. Text only, no source URLs, not used for the URL list.                           |
| 53        | `crawl4ai.web.scrape`, format HTML, to read JSON-LD. Tinyfish strips `<script>`.                         | $0.008                                                                                    |
| 6 batches | `tinyfish.web.fetch`, format HTML, `ttl: 0`, our pages and the cited pages                               | $0                                                                                        |
| 13        | Google Search Console `searchAnalytics/query`, page equals the URL                                       | $0                                                                                        |

Itemized spend on this angle: **$0.12**. Team balance was $9.27 before the first paid call and $9.15 after the last.

Visible text, headings, tables, and lists come from the Tinyfish HTML. JSON-LD types come from the Crawl4AI document. A raw curl of `defillama.com` returns Cloudflare’s “Just a moment…” page, so the no-JS score uses the Tinyfish document, which still shows `/yields` as “Loading pools…” and “Tracking 0 pools”. Crawl4AI’s browser pass of `/yields` was 938KB and contained a `<table>`, so the rows exist after JavaScript.

The shared “Ask LlamaAI” bar is on every hub. It is not counted as the page’s opening. Word counts are the fetched visible text, including some navigation, on both sides.

Investing.com’s category article and both Binance Academy articles were blocked or unreachable. CoinMarketCap’s token-unlocks URL returned navigation chrome and no table, so it is not scored. The substitutes are other URLs from the same overview or the same answer.

## Rubric

Each criterion is 0 to 5. The weighted total is `score / 5 × weight`. Weights sum to 100. Answer-first, the list or table in the server HTML, and the number in a sentence weigh 16 each. The other eight weigh 6, except H1/title and the definition, which weigh 8.

| Criterion            | Weight | 0                                                                   | 1                                                         | 2                                                                               | 3                                                                            | 4                                                                                       | 5                                                                |
| -------------------- | -----: | ------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Answer-first         |     16 | First block is a table, a loading state, or chrome with no sentence | A sentence exists only after the table or in a later card | First block is a heading plus a figure, not a sentence                          | A sentence is in the first screen and does not answer the query              | First sentence answers part of the query                                                | First sentence answers the query before any table                |
| H1 and title         |      8 | Neither contains the query’s words                                  | A related word only                                       | One of title or H1 has the head term; the other is missing or a different label | Both name the topic as a dashboard or a ranking                              | H1 or title is the question or the exact head term                                      | H1 and title both use the query’s words                          |
| Date                 |      6 | No date in the text or the metadata                                 | Older than 18 months                                      | Within 18 months, not beside the figure                                         | Within 12 months, not in the same block as the figure                        | Within 90 days, or “today”                                                              | A calendar date within 14 days in the same block as the number   |
| Number in text       |     16 | No figure                                                           | Figures only in table cells                               | A figure in a stat label or an H1, not in a sentence                            | A sentence contains a figure that is not the query’s figure                  | The query’s figure is in a sentence, without a date or without saying what the ratio is | The figure is in a sentence with its unit and what it measures   |
| SSR list or table    |     16 | No list or table                                                    | The list exists only after JavaScript                     | Names without figures, or a placeholder count                                   | A real list or a short table, missing the column the query asks for          | A table or named list with figures is in the HTML                                       | That list is also introduced by a sentence that names rows       |
| Definition           |      8 | The term is not defined                                             | The term is used and never defined                        | Definition only in a tooltip or a title attribute                               | A one-line definition in a table cell or a later card                        | A definition is visible and is not the opening sentence                                 | “X is …” or “X measures …” is in the opening block               |
| FAQ                  |      6 | No question and answer                                              | Questions are buttons that open another tool              | A question heading without an answer on the page                                | One visible answer that matches a head query                                 | Two or more visible answers in the query family                                         | Those answers repeat the lead sentence and the key number        |
| JSON-LD              |      6 | None                                                                | Only WebSite, Organization, or BreadcrumbList             | WebPage that does not describe the metric                                       | Article, BlogPosting, or Product whose headline matches                      | Article or FinancialProduct that matches the visible page                               | FAQPage, Dataset, or ItemList whose text matches what is visible |
| Depth                |      6 | Under 100 words                                                     | 100–249                                                   | 250–499                                                                         | 500–999                                                                      | 1,000–1,799                                                                             | 1,800 or more                                                    |
| E-E-A-T              |      6 | No author, source, methodology, or in-body link                     | Site chrome only                                          | In-body links, no methodology                                                   | A methodology note or source links                                           | Named author or organization, plus methodology or a source list                         | Named author, a date, and a methodology a reader can check       |
| Crawlable without JS |      6 | Loading shell                                                       | Title and H1 only                                         | Some figures in the HTML; the primary table needs JavaScript                    | Primary table is in the HTML; a chart or a secondary module needs JavaScript | Lead, figure, and table or FAQ are in the HTML                                          | Those, plus JSON-LD, are in the HTML                             |

Token Terminal’s TVL page is 333 words and is still cited. Depth is weighted 6 because length is not what the overview quotes. A page can score 2 on depth and win the citation when the first sentence is the definition.

## Queries and the pages cited for them

| Our page                 | Queries the score is judged against                                                                                                                                                                                      | Cited pages scored                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/chains`                | `tvl` (8,279 impr, pos 5.7, 137 clicks), `tvl crypto` (713, pos 1.7, 183), `crypto tvl` (374, pos 1.5, 224). The last two already convert. `tvl` does not.                                                               | [CMC Academy](https://coinmarketcap.com/academy/glossary/total-value-locked-tvl), [Investopedia](https://www.investopedia.com/total-value-locked-7486821), [Token Terminal](https://tokenterminal.com/explorer/metrics/tvl). PR #8 and PR #2.                                                                                                                                  |
| `/stablecoins`           | `stablecoin market cap` already converts (753 impr, pos 1.3, 256 clicks on this URL). The citation miss is `usdt dominance`, `usdt dominance chart`, and `top stablecoins`.                                              | [TradingView USDT.D](https://www.tradingview.com/symbols/USDT.D/), [CoinGecko stablecoins](https://www.coingecko.com/en/categories/stablecoins), [CMC stablecoins](https://coinmarketcap.com/view/stablecoin/). PR #8 and PR #2.                                                                                                                                               |
| `/categories`            | Search Console demand on this URL is brand typos. The citation query is “What are the main DeFi protocol categories by TVL?” ChatGPT cites this URL as the dashboard. The overview’s sentence comes from explainers.     | [1inch, types of DeFi platforms](https://1inch.com/blog/post/what-are-the-main-types-of-defi-platforms), [Coinmonks](https://medium.com/coinmonks/defi-protocol-categories-you-never-knew-existed-d0d2c0b08e7c), [CoinTracker, what’s TVL](https://www.cointracker.com/blog/tvl-in-crypto). Live overview, 14 Oct. Investing.com’s “top 8 categories” article was unreachable. |
| `/dex-aggregators`       | `dex aggregator` (671 impr, pos 4.0, 20 clicks). The zero-click queries in PR #2 are `top defi aggregators`, `what are dex aggregators`, `what are defi aggregators`.                                                    | [Eco](https://eco.com/support/en/articles/15284400-what-is-a-dex-aggregator), [1inch Learn](https://1inch.com/learn/dex-aggregator), [Chainlink](https://chain.link/article/what-is-dex-aggregator). All three engines in PR #8.                                                                                                                                               |
| `/yields`                | `defi yield farming` converts on this URL (264 impr, 14 clicks). `yield farming` does not (412 impr, pos 11.1, 0 clicks in the attached export).                                                                         | [CoinGecko](https://www.coingecko.com/learn/what-is-yield-farming), [Kraken](https://www.kraken.com/learn/what-is-yield-farming), [Investopedia](https://www.investopedia.com/what-is-yield-farming-7098519). PR #2 named CoinGecko, Investopedia, Coinbase, and Binance. Binance Academy was blocked. Kraken is the overview’s first source on the live refetch.              |
| `/protocols/lending`     | `defi lending` (299 impr, pos 6.5, 6 clicks). `defi lending and borrowing protocols explained` is the PR #2 query, about 1,360 impr and 0 clicks.                                                                        | [Chainlink](https://chain.link/article/decentralized-lending-protocol), [Stellar](https://stellar.org/learn/lending-and-borrowing-markets), [Aave intro](https://aave.com/help/aave-101/introduction-to-aave). Overview plus Perplexity and ChatGPT.                                                                                                                           |
| `/data-definitions`      | Almost no non-brand query in the top 40. The citation queries are “what is TVL” and “fees vs revenue”. Sonar cites `docs.llama.fi` for the first.                                                                        | [docs.llama.fi](https://docs.llama.fi/analysts/data-definitions), [Chainnarrative](https://chainnarrative.com/analysis/protocol-revenue-vs-total-fees-in-defi-explained), [CMC Academy](https://coinmarketcap.com/academy/glossary/total-value-locked-tvl). PR #2.                                                                                                             |
| `/rwa`                   | `rwa crypto` (139 impr, pos 9.7), `rwa league table` (157, pos 4.7), `rwa tvl` (73, pos 1.1, 45 clicks). The export’s head term `rwa` is 453 impr and 2 clicks.                                                          | [CoinGecko RWA category](https://www.coingecko.com/en/categories/real-world-assets-rwa), [CoinGecko RWA guide](https://www.coingecko.com/learn/what-are-real-world-assets-exploring-rwa-protocols), [RWA.xyz](https://app.rwa.xyz/). Live overview and Perplexity.                                                                                                             |
| `/perps`                 | `perp dex volume` already converts (635 impr, pos 1.2, 327 clicks). `perp dex` is 643 impr and 83 clicks. The citation miss is “what is a perp DEX”.                                                                     | [CoinGecko perpetuals](https://www.coingecko.com/learn/what-are-crypto-perpetuals-perp-dexs), [CoinGecko perp DEX growth](https://www.coingecko.com/learn/decentralized-derivatives-perpetual-future-dexs), [crypto.news](https://crypto.news/what-is-a-perp-dex/). The growth URL is the one in the live overview. Binance Academy was blocked.                               |
| `/unlocks`               | `token unlocks` (1,347 impr, pos 7.3, 39 clicks), `token unlock` (514, pos 7.7, 26), `token unlock schedule` (228, pos 6.6, 5). The live overview had no AI Overview. Organic #1 is Tokenomist. This URL was organic #8. | [Tokenomist](https://tokenomist.ai/), [CoinGecko incoming unlocks](https://www.coingecko.com/en/highlights/incoming-token-unlocks), [Streamflow](https://streamflow.finance/blog/what-is-token-unlock).                                                                                                                                                                        |
| `/protocol/rhea-finance` | `rhea finance` (3,134 impr, pos 7.2, 12 clicks), `rhea finance crypto`, `rhea token`. The name query is navigational for sizing. The overview still answers it from the docs.                                            | [White paper](https://guide.rhea.finance/docs/rhea-finance-white-paper), [Rhea docs](https://guide.rhea.finance/), [CMC](https://coinmarketcap.com/currencies/rhea-finance/).                                                                                                                                                                                                  |
| `/protocol/pons`         | `pons` is a bare name (184,652 impr) and is not sized. Non-name: `pons launchpad` (3,851 impr, pos 6.4, 50 clicks), `pons revenue` (converts), `pons robinhood`.                                                         | [Messari](https://messari.io/project/pons-launchpad/profile), [Datawallet](https://www.datawallet.com/crypto/pons-explained), [CoinGecko](https://www.coingecko.com/en/coins/pons). The overview’s sentence matches Messari: a non-custodial launchpad for Robinhood Chain.                                                                                                    |
| `/protocol/vest-markets` | `vest markets` (30,710 impr, pos 4.5, 15 clicks), `vest market`, `vest exchange`. Navigational for sizing. The overview answers with a product description.                                                              | [Vest docs, about](https://docs.vestmarkets.com/welcome/about-vest-markets), [docs home](https://docs.vestmarkets.com/), [vestmarkets.com](https://www.vestmarkets.com/).                                                                                                                                                                                                      |

## Where the points go

Averages across the 13 pages and the 39 cited pages. “Best” is the average of each page’s highest competitor on that criterion. Points are the 0–5 score scaled by the weight.

| Criterion            |  Weight | Our avg | Cited avg | Best avg | Our points | Cited points | Best points |
| -------------------- | ------: | ------: | --------: | -------: | ---------: | -----------: | ----------: |
| Answer-first         |      16 |    1.77 |      4.26 |     4.92 |        5.7 |         13.6 |        15.8 |
| Number in text       |      16 |    2.15 |      1.97 |     2.62 |        6.9 |          6.3 |         8.4 |
| SSR list or table    |      16 |    3.38 |      3.23 |     3.77 |       10.8 |         10.3 |        12.1 |
| H1 and title         |       8 |    2.46 |      4.08 |     4.77 |        3.9 |          6.5 |         7.6 |
| Definition           |       8 |    1.62 |      4.33 |     5.00 |        2.6 |          6.9 |         8.0 |
| Date                 |       6 |    1.00 |      2.03 |     3.31 |        1.2 |          2.4 |         4.0 |
| FAQ                  |       6 |    1.54 |      2.08 |     2.85 |        1.8 |          2.5 |         3.4 |
| JSON-LD              |       6 |    0.00 |      2.23 |     3.69 |        0.0 |          2.7 |         4.4 |
| Depth                |       6 |    1.46 |      3.77 |     4.46 |        1.8 |          4.5 |         5.4 |
| E-E-A-T              |       6 |    2.00 |      3.59 |     4.15 |        2.4 |          4.3 |         5.0 |
| Crawlable without JS |       6 |    3.15 |      4.15 |     4.46 |        3.8 |          5.0 |         5.4 |
| **Total**            | **100** |         |           |          |   **40.9** |     **65.1** |             |

Two of the three heavy criteria are not where the points are lost. The server HTML of the hubs already contains the ranking table (our SSR average 3.38, cited pages 3.23). The figures are on the page (2.15 vs 1.97). CMC’s TVL glossary, Investopedia, and Chainlink’s DEX article do not state today’s number at all. They still get cited, because the first sentence defines the term.

The heavy criterion we lose is answer-first: 1.77 against 4.26. That is about 8 of the 24 points between the two averages. The definition is the next: every comparison set has at least one page at 5, and our average is 1.62. JSON-LD is a zero on all 13 of our pages. Crawl4AI’s full HTML of those URLs has no `application/ld+json`. `src/components/SEO/index.tsx` emits it only when a page passes `jsonLd`, and these pages do not.

`/yields` is the SSR miss. Score 1: the pool table is not in the server document. The other hubs score 4, the same as Token Terminal’s top-10 table and CoinGecko’s category tables. They do not score 5, because no sentence names the rows.

## Page vs cited pages

“Comp avg” is the mean of the three cited pages. “Best” on a criterion is the highest of the three. The Total on the Best row is the highest weighted total among the three pages. It is not the sum of the best cells.

| Page                     |          | Answer-first | H1 and title | Date | Number in text | SSR list/table | Definition | FAQ | JSON-LD | Depth | E-E-A-T | No JS | Total |
| ------------------------ | -------- | -----------: | -----------: | ---: | -------------: | -------------: | ---------: | --: | ------: | ----: | ------: | ----: | ----: |
| `/chains`                | Ours     |            0 |            2 |    0 |              1 |              4 |          0 |   1 |       0 |     0 |       1 |     3 |  25.2 |
| `/chains`                | Comp avg |          5.0 |          4.3 |  0.7 |            1.0 |            3.3 |        5.0 | 2.0 |     2.0 |   3.0 |     4.3 |   4.3 |  64.4 |
| `/chains`                | Best     |            5 |            5 |    1 |              1 |              4 |          5 |   3 |       4 |     4 |       5 |     5 |  68.8 |
| `/stablecoins`           | Ours     |            2 |            3 |    0 |              2 |              4 |          0 |   1 |       0 |     1 |       1 |     3 |  37.6 |
| `/stablecoins`           | Comp avg |          4.3 |          4.3 |  3.0 |            4.7 |            4.0 |        4.3 | 4.0 |     3.7 |   4.0 |     3.0 |   4.7 |  82.3 |
| `/stablecoins`           | Best     |            5 |            5 |    5 |              5 |              5 |          5 |   4 |       5 |     5 |       3 |     5 |  87.6 |
| `/categories`            | Ours     |            1 |            3 |    0 |              1 |              4 |          3 |   1 |       0 |     3 |       2 |     3 |  39.6 |
| `/categories`            | Comp avg |          3.0 |          4.3 |  2.0 |            1.3 |            2.7 |        4.0 | 0.7 |     3.3 |   4.0 |     4.0 |   4.0 |  57.3 |
| `/categories`            | Best     |            4 |            5 |    3 |              2 |              3 |          5 |   2 |       4 |     4 |       5 |     4 |  62.0 |
| `/dex-aggregators`       | Ours     |            2 |            2 |    0 |              2 |              4 |          0 |   1 |       0 |     0 |       1 |     3 |  34.8 |
| `/dex-aggregators`       | Comp avg |          5.0 |          4.7 |  2.7 |            1.7 |            3.3 |        5.0 | 3.0 |     2.3 |   4.3 |     4.0 |   4.3 |  72.3 |
| `/dex-aggregators`       | Best     |            5 |            5 |    4 |              2 |              4 |          5 |   4 |       4 |     5 |       5 |     5 |  82.4 |
| `/yields`                | Ours     |            0 |            2 |    0 |              2 |              1 |          0 |   1 |       0 |     0 |       1 |     1 |  16.4 |
| `/yields`                | Comp avg |          5.0 |          4.7 |  1.7 |            1.7 |            3.0 |        5.0 | 3.0 |     2.7 |   4.7 |     4.7 |   4.0 |  71.2 |
| `/yields`                | Best     |            5 |            5 |    2 |              2 |              3 |          5 |   3 |       4 |     5 |       5 |     4 |  72.4 |
| `/protocols/lending`     | Ours     |            2 |            3 |    0 |              2 |              4 |          1 |   1 |       0 |     1 |       1 |     3 |  39.2 |
| `/protocols/lending`     | Comp avg |          4.3 |          3.7 |  0.0 |            1.0 |            2.3 |        4.3 | 2.0 |     0.0 |   4.0 |     3.0 |   4.0 |  52.9 |
| `/protocols/lending`     | Best     |            5 |            4 |    0 |              1 |              3 |          5 |   2 |       0 |     5 |       3 |     4 |  56.8 |
| `/data-definitions`      | Ours     |            4 |            2 |    0 |              0 |              2 |          5 |   0 |       0 |     4 |       3 |     4 |  43.6 |
| `/data-definitions`      | Comp avg |          4.7 |          4.0 |  1.7 |            1.0 |            3.0 |        5.0 | 1.7 |     2.7 |   4.0 |     3.3 |   4.7 |  63.7 |
| `/data-definitions`      | Best     |            5 |            5 |    4 |              2 |              3 |          5 |   3 |       4 |     5 |       4 |     5 |  69.6 |
| `/rwa`                   | Ours     |            2 |            2 |    3 |              2 |              4 |          1 |   1 |       0 |     1 |       2 |     3 |  42.4 |
| `/rwa`                   | Comp avg |          4.0 |          4.3 |  4.0 |            3.7 |            4.0 |        4.3 | 2.0 |     2.3 |   4.7 |     3.3 |   4.0 |  75.6 |
| `/rwa`                   | Best     |            5 |            5 |    4 |              5 |              5 |          5 |   3 |       4 |     5 |       4 |     4 |  88.0 |
| `/perps`                 | Ours     |            2 |            3 |    0 |              2 |              4 |          0 |   1 |       0 |     0 |       1 |     3 |  36.4 |
| `/perps`                 | Comp avg |          4.3 |          4.3 |  2.7 |            1.3 |            3.3 |        5.0 | 2.7 |     3.3 |   5.0 |     5.0 |   4.0 |  70.9 |
| `/perps`                 | Best     |            5 |            5 |    4 |              2 |              4 |          5 |   3 |       4 |     5 |       5 |     4 |  80.0 |
| `/unlocks`               | Ours     |            2 |            3 |    0 |              2 |              4 |          0 |   1 |       0 |     2 |       2 |     3 |  40.0 |
| `/unlocks`               | Comp avg |          4.3 |          4.0 |  1.3 |            3.0 |            4.0 |        3.7 | 1.3 |     2.0 |   3.3 |     2.7 |   4.3 |  66.5 |
| `/unlocks`               | Best     |            5 |            5 |    3 |              5 |              4 |          5 |   2 |       5 |     4 |       3 |     5 |  76.8 |
| `/protocol/rhea-finance` | Ours     |            2 |            3 |    3 |              4 |              3 |          3 |   4 |       0 |     3 |       4 |     4 |  60.0 |
| `/protocol/rhea-finance` | Comp avg |          3.7 |          3.3 |  2.3 |            1.0 |            3.0 |        3.3 | 1.3 |     0.3 |   2.3 |     2.7 |   3.3 |  50.0 |
| `/protocol/rhea-finance` | Best     |            5 |            4 |    4 |              2 |              4 |          5 |   2 |       1 |     4 |       3 |     4 |  62.4 |
| `/protocol/pons`         | Ours     |            2 |            2 |    3 |              4 |              3 |          4 |   4 |       0 |     2 |       3 |     4 |  57.6 |
| `/protocol/pons`         | Comp avg |          3.7 |          4.0 |  1.3 |            2.3 |            3.7 |        3.7 | 2.3 |     2.7 |   3.7 |     3.3 |   4.0 |  64.0 |
| `/protocol/pons`         | Best     |            5 |            5 |    4 |              3 |              4 |          5 |   3 |       4 |     5 |       5 |     4 |  79.6 |
| `/protocol/vest-markets` | Ours     |            2 |            2 |    4 |              4 |              3 |          4 |   3 |       0 |     2 |       4 |     4 |  58.8 |
| `/protocol/vest-markets` | Comp avg |          4.0 |          3.0 |  3.0 |            2.0 |            2.3 |        3.7 | 1.0 |     1.7 |   2.0 |     3.3 |   4.3 |  55.7 |
| `/protocol/vest-markets` | Best     |            5 |            4 |    5 |              2 |              3 |          5 |   3 |       5 |     2 |       4 |     5 |  62.0 |

Reading the matrix:

- `/chains` ties Token Terminal on the table (both 4) and loses the definition 0 to 5. CMC’s glossary is from 2021 and still scores 68.8, because the `tvl` query is a definition.
- `/stablecoins` is the only hub whose cited set beats it on the number (2 vs a best of 5). CoinGecko writes “the market cap today is $300 billion” and then “a stablecoin is”. TradingView writes “USDT.D: ~6.52%” on 7 Oct 2026. Our 60.12% is a different ratio, and it is a label.
- `/dex-aggregators` matches Eco on the table (both 4) and scores 0 on the definition Eco, 1inch, and Chainlink all score 5. None of those three put today’s volume in a sentence. The sentence is the whole gap.
- `/categories` already has one-line definitions in the table (definition 3). It still opens with “Loading chart…”. The cited explainers are weaker than the DEX set: the best total is 62.0, and ChatGPT already lists this URL.
- `/data-definitions` is the one hub with a real definition in the opening (5) and 1,129 words. It loses the question-shaped H1, a date, and any current figure. `docs.llama.fi` is the same copy with a September 2026 date and a Markdown view.
- `/protocols/lending` beats its cited set on the number (2 vs 1) and the table (4 vs a best of 3). Chainlink’s article has no table and no date. The missing piece is the sentence the categories table already stores.
- Protocol pages score 57–60. Rhea and Vest beat the competitor average because the FAQ states the TVL in a sentence and the methodology block is real. They lose answer-first: the docs open with “Rhea is …” and “Vest Markets is …”. Our pages open with the TVL stat. The description is lower, in Protocol Information.

## Ranked gaps

Ordered by our weighted total against the best cited page. The point gap is that difference. The fix is the change that moves the criteria where that page scores below the best cited page. Figures below are the ones in the HTML on 14 Oct 2026. Render them from the same props as the table. Do not paste the literals.

| #   | Page                     | Ours |          Best cited |  Gap | What to ship                                                                                    |
| --- | ------------------------ | ---: | ------------------: | ---: | ----------------------------------------------------------------------------------------------- |
| 1   | `/yields`                | 16.4 |      72.4 CoinGecko | 56.0 | Put the pool rows in the server HTML, then one definition sentence.                             |
| 2   | `/stablecoins`           | 37.6 |      87.6 CoinGecko | 50.0 | One sentence: 60.12% is stablecoin-market share, dated, and it is not USDT.D.                   |
| 3   | `/dex-aggregators`       | 34.8 |            82.4 Eco | 47.6 | One “a DEX aggregator is” sentence under the H1, naming Jupiter, DFlow, and 0x.                 |
| 4   | `/rwa`                   | 42.4 |      88.0 CoinGecko | 45.6 | One sentence with Active AUM and what an RWA is. Change the dashboard H1.                       |
| 5   | `/chains`                | 25.2 |    68.8 CMC Academy | 43.6 | One “TVL is” sentence and an H1. The table can stay first after that sentence.                  |
| 6   | `/perps`                 | 36.4 |      80.0 CoinGecko | 43.6 | One sentence that says what a perp DEX is and names the top row.                                |
| 7   | `/unlocks`               | 40.0 |     76.8 Tokenomist | 36.8 | One sentence: what a token unlock is, plus the next large unlock already in the table.          |
| 8   | `/data-definitions`      | 43.6 | 69.6 Chainnarrative | 26.0 | Phrase the TVL heading as the question and add the date. The definition is already the opening. |
| 9   | `/categories`            | 39.6 |    62.0 CoinTracker | 22.4 | One ranking sentence above the table. The description column can stay.                          |
| 10  | `/protocol/pons`         | 57.6 |     79.6 Datawallet | 22.0 | Move “Pons is a token launchpad…” to the first sentence and the first FAQ.                      |
| 11  | `/protocols/lending`     | 39.2 |      56.8 Chainlink | 17.6 | Render the lending sentence that already exists, under the H1.                                  |
| 12  | `/protocol/vest-markets` | 58.8 |      62.0 Vest docs |  3.2 | The stored description is already the right sentence. It has to be the first thing on the page. |
| 13  | `/protocol/rhea-finance` | 60.0 |    62.4 White paper |  2.4 | Same as Vest. The white paper’s “What is RHEA Finance” is the sentence we bury.                 |

Pons’s 22-point gap is against a 4,000-word Datawallet explainer. The mechanism is the same move as Vest: put the stored sentence first. The five that change a citation are 1 through 5.

### 1. `/yields` — server rows, then the sentence

`src/containers/Yields/YieldsTabs.tsx` renders `<h1 className="sr-only">Yields</h1>`. The title in `src/pages/yields.tsx` is already “Yield Farming Rankings - Best DeFi APY Pools - DefiLlama”. `src/containers/Yields/views/EarnView.tsx` passes `enabled: normalized` into the table (around line 119). `src/containers/Yields/useYieldsServerTable.ts` sets `data` to `undefined` when `enabled` is false (line 70), so the seeded rows never become HTML. Line 252 renders `Loading pools`. The tracking line around line 183 prints 0 when `serverTotal` is 0.

Ship the seeded rows in the server HTML. Then, next to that tracking line:

> Yield farming is depositing crypto into a pool to earn rewards. DefiLlama tracks {serverTotal} pools across {protocols} protocols on {chains} chains.

Do not name a pool until that pool is in the same HTML. The CoinGecko, Kraken, and Investopedia pages score 5 on answer-first with no live APY. The sentence is enough for the definition query. The table is what makes the ranking quotable. Both are missing today, which is why this page is 16.4.

### 2. `/stablecoins` — say what 60.12% is

`src/pages/stablecoins.tsx` title: `Stablecoin Market Cap Chart, Supply & Peg Data - DefiLlama`. `src/containers/Stablecoins/StablecoinsByChain.tsx` prints `Total {title}` as the H1 stat (around line 510) and `{topTokenSymbol} Dominance` as a `StatItem` (line 517). A date is rendered only when the series is flagged stale.

Under that stat:

> USDT is 60.12% of the stablecoin market on Oct 14, 2026: $184.0b of a $306.0b total, ahead of USDC at $73.1b. This is each coin’s share of stablecoin market cap. It is not TradingView’s USDT.D index, which measures USDT against the whole crypto market and was about 6.5% the same week.

`getStablecoinDominance` in `src/containers/Stablecoins/utils.ts` is already the first ratio. Keep the H1’s market-cap figure: `stablecoin market cap` on this URL is position 1.3 with a 34% CTR. Pass `Dataset` JSON-LD through the `jsonLd` prop on `Layout` (`src/layout/index.tsx` forwards it to `src/components/SEO/index.tsx`). CoinGecko’s category page is the best total in the set and its schema is only a breadcrumb, so the sentence is the change. TradingView’s `Dataset` plus `FinancialProduct` is what a metric page can add once the sentence exists.

### 3. `/dex-aggregators` — the definition the table does not say

`src/pages/dex-aggregators/index.tsx` title: `DEX Aggregator Rankings - Swap Routing Analytics - DefiLlama`. The description names 1inch, CowSwap, and OpenOcean and skips Jupiter. The all-chains H1 is the 24h `StatItem` in `src/containers/AdapterMetrics/AdapterByChain.tsx` (around line 233, `labelAs="h1"`). `public/definitions.ts` `dexAggregators.common` is “Volume of all spot token swaps routed through the DEX aggregator”. That is a column tooltip. It is not the sentence Eco, 1inch, and Chainlink get quoted for.

Title: `What Is a DEX Aggregator? Volume Rankings`

Under the H1:

> A DEX aggregator is a protocol that pulls prices from many decentralized exchanges and routes one swap across them. On Oct 14, 2026, tracked DEX aggregator volume was $2.46b in 24 hours. Jupiter led at $539m, then DFlow at $349m and 0x at $207m.

`Article` JSON-LD whose description is that first sentence. Chainlink is cited with no JSON-LD, so schema without the sentence does not close the gap. The same `StatItem` is the H1 for `/perps`. One paragraph there, from `src/pages/perps/index.tsx` through `AdapterByChain`, covers row 6:

> A perpetual DEX lists perpetual futures markets that do not expire. On Oct 14, 2026, tracked perp volume was $22.5b in 24 hours. Hyperliquid led at $7.6b.

### 4. `/rwa` — the metric H1 against a list sentence

`src/containers/RWA/layout/pageCopy.ts` sets the overview title to `Real World Assets (RWA) Dashboard & Analytics - DefiLlama` and the H1 to `definitions.totalActiveMcap.label`, which renders as `Total RWA Active AUM`. The comment at the top of that file says the overview heads with its metric on purpose. CoinGecko’s category page, the best score in this set, heads with the list and writes “the Real World Assets (RWA) market cap today is $76 billion”, then defines an RWA. RWA.xyz is a dashboard like ours and scores 2 on answer-first, the same as we do. The overview did not quote RWA.xyz’s heading. It quoted the definition pages and named RWA.xyz as a tracker.

Title: `Top Real World Assets (RWA) by Onchain Value - DefiLlama`

H1: `Top real world assets by onchain value`

Under it, in `src/pages/rwa/index.tsx`, which already renders `getRwaPageHeadline`:

> Real-world assets (RWAs) are traditional assets represented by tokens on a blockchain. On Oct 14, 2026, tracked active AUM was $32.1b.

Keep Active AUM as the stat under that sentence.

### 5. `/chains` — define TVL in the first sentence

`src/pages/chains.tsx` title: `Chain Rankings by TVL - DeFi Analytics - DefiLlama`. `src/containers/ChainsByCategory/index.tsx` has no H1. The fetched text starts at the Ethereum row, $51.11b. `crypto tvl` and `tvl crypto` already convert. `tvl` does not, and the pages cited for it are glossaries whose first sentence is the definition. They do not have a fresher number than we do. CMC’s date is 2021.

Title: `Total Value Locked (TVL) by Chain - DefiLlama`

H1 and lead, above `RowLinksWithDropdown`:

> Total value locked (TVL) is the dollar value of crypto deposited in DeFi protocols. On Oct 14, 2026 Ethereum led with $51.1b, ahead of Base at $6.2b and Solana at $6.0b.

Link the first sentence to `/data-definitions#tvl`. On `src/pages/data-definitions.tsx`, change the TVL heading from `TVL` to `What is TVL?`. The two paragraphs under it can stay. That is row 8: the definition already scores 5, and the heading is why Sonar cites `docs.llama.fi` instead.

### Protocol pages — the sentence is already stored

`src/containers/ProtocolOverview/queries.tsx` builds the meta description at line 829 as `Track ${name} on DefiLlama. Including …`. Line 908 stores `protocolData.description` separately. The visible copy is in Protocol Information.

Fetched descriptions:

- Rhea: “Rhea Finance merges Ref Finance and Burrow Finance to create NEAR’s most powerful DeFi hub…”
- Pons: “Pons is a token launchpad for creating and trading fixed-supply tokens that progress toward liquidity graduation on Robinhood Chain.”
- Vest: “Vest Exchange is a next generation Perps DEX that ensures the most capital efficient liquidity, and fairest pricing for traders and LPs.”

The white paper, Messari, and the Vest docs open with that kind of sentence. Our pages open with the TVL or the fees stat. `buildTvlQuestion` in `src/containers/ProtocolOverview/faq.ts` (around line 285) asks `What is ${possessive(name)} TVL?` and answers with the dollar figure. That FAQ is why Rhea and Vest score 4 on the number and beat the competitor average. It is also why the overview can quote a metric and still take the answer sentence from someone else.

Put `protocolData.description` in the meta description, cut at 155 characters, and render it as the first paragraph under the H1. When the description is non-empty, the first FAQ question is `What is ${name}?` and the answer is that paragraph. Keep the TVL question. `FAQPage` JSON-LD only if its text is that visible FAQ. The protocol pages already score 3 or 4 on FAQ with no schema. Schema that does not match the visible text does not close a citation.

### Lending and categories — the sentence is one component away

`protocolCategoryConfig.Lending.description` in `src/containers/ProtocolTaxonomy/constants.tsx` is `Protocols that allow users to borrow and lend assets`. The categories table prints it. `/protocols/lending` does not. The H1 is `headingLabel` in `src/containers/ProtocolTaxonomy/index.tsx`, which for Lending is `Lending`. Under that H1:

> DeFi lending protocols let people borrow and lend crypto without a bank. On Oct 14, 2026 the lending category held $52.9b.

`src/containers/ProtocolTaxonomy/CategoriesPage.tsx` line 190 is `<h1>TVL by category</h1>`, then “Loading chart…”. The description column is already in the HTML, which is why this page scores 3 on definition and 4 on the table. Above the table:

> DeFi categories are groups of protocols that do the same job. On Oct 14, 2026 bridges led with $58.5b, then liquid staking at $56.6b.

### Unlocks — one sentence on the index

`src/pages/unlocks/index.tsx` line 327 is `<h1>Unlock statistics</h1>`. The title already says “Token Unlocks & Vesting Schedules”. The 7-day total, $228.87m, is a label. Tokenomist, organic #1, opens with a named unlock and an amount. Under the H1:

> A token unlock releases coins that were locked under a vesting schedule. In the next 7 days, tracked unlocks total $229m.

Name the largest row only if that row is already in the server table. The protocol unlock template is a separate page. PR #8’s ARB, Celestia, and Quai queries cite tokenomics.com, and the first sentence those pages need is “The next {symbol} unlock is {date}, releasing {amount}.” That edit is `src/pages/unlocks/[protocol].tsx`. It is not one of the 13 URLs scored here. The index sentence is.

### JSON-LD, once the sentence exists

None of the 13 pages emit JSON-LD. Cited pages that also emit none and still get quoted: Chainlink’s DEX article, Chainlink’s lending article, Token Terminal, Stellar, Aave’s intro, and the Rhea docs. Schema is not sufficient and it is not the first fix. When the sentence is in the HTML, pass it through `jsonLd` on `Layout`:

- Definition hubs (`/dex-aggregators`, `/protocols/lending`, `/data-definitions`, `/perps`): `Article`, headline the H1, description the first sentence.
- Metric and ranking hubs (`/stablecoins`, `/chains`, `/categories`, `/rwa`, `/unlocks`, `/yields`): `Dataset` for the series, or `ItemList` for the table. TradingView is the pattern that scored 5.
- Protocol pages: `FAQPage` only where the visible FAQ is the same text.

`EntityQuestionsStrip` stays the LlamaAI entry. It scored 1 on FAQ because the button does not answer the query.

## Limits

Positions in Search Console are 28 days and all countries. The SERPs and the answer-engine calls are one US snapshot on 14 Oct 2026. A query can average position 4 in Search Console and be absent from this first page.

Word counts include navigation that the fetcher kept. They are comparable across the two sides and they are an upper bound on the article body.

Tinyfish’s HTML is the document used for text, tables, and the no-JS score. Crawl4AI’s HTML is the document used for JSON-LD. Where those two disagree, the report says so. The only disagreement that changes a score is `/yields`: Tinyfish has no pool table, Crawl4AI’s browser pass does.

The “Best” total is one competitor’s weighted total. A row of 5s across criteria would score higher than any single cited page. No cited page scored 5 on every criterion. Chainlink is cited for DEX aggregators with no date and no JSON-LD. CMC’s TVL glossary is cited five years after its date.

`/categories` has no non-brand query in the top Search Console rows. The 22-point gap against CoinTracker is a citation gap, not a click estimate. Brand-typo impressions on that URL are not demand.

Checks: these two files are the only change. `bun run typecheck`, `bun run test:typecheck`, and `bun run check` were not run. No browser check. No UI was edited.
