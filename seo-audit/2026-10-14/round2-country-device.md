# SEO audit: country and device

Round 2, angle `country-device`. No application code was changed. Round 1 looked at US desktop and mobile only. This pass asks whether the missed clicks sit in other countries, in other languages, or on mobile, and whether localized titles, hreflang, or a mobile layout change would collect them.

## Method

Search Console property `sc-domain:defillama.com`, `dataState: all`, 14 Sep 2026 through 11 Oct 2026 (28 days, the attached export's window). Fetched 14 Oct 2026 through Treg `google-search-console` `webmasters/v3/sites/sc-domain:defillama.com/searchAnalytics/query`. Search Analytics is free on this account. Rows come back sorted by clicks, so each cut was paginated or filtered until the last page was short of 25,000 rows.

| Cut | Rows | Complete |
| --- | ---: | --- |
| `country` | 237 | yes |
| `device` | 3 | yes |
| `country` × `device` | 634 | yes |
| `device` × `page` | 26,031 | yes |
| `device` × `query` | 71,393 | yes |
| `query` and `page` filtered to one country | 23 countries | yes. US queries are 30,175 (a second page of 5,175). No other country hit 25,000. |

The 23 countries are the largest by impressions plus Jamaica, which is the only non-US country whose country total sits under the 3% floor by a meaningful amount. Together they are 81% of property impressions.

`missed@3%` = `max(0, 0.03 × impressions − clicks)`. A query is left out of opportunity sizing when any of these hold:

- The attached export labels it `brand`, or the text is a DefiLlama spelling (including 디파이, дефи, دیفای).
- The export labels it `bare_name`, or it is one of the protocol names that export left unlabeled: `vest markets`, `vest market`, `stonk fun`, `gmx crypto`, `axiom pro`, `collector crypt`, `rhea finance`, `lighter dex`, `four meme`, `predict fun`, `near intents`, `pons launchpad`, `justbet`.
- It contains a quote, `phone fax`, or `site:` (person lookups and operator queries). Round 1 already set those aside.

Live SERPs are DataForSEO `dataforseo.google.serp.organic` (`POST /serp/google/organic/live/regular`), depth 10, desktop, `os=windows`. Location and language are the Google `gl` / `hl` pair, confirmed on each `check_url` (`gl=GB`, `gl=DE&hl=de`, `gl=FR&hl=fr`, `gl=BR&hl=pt`, `gl=IN`). `se_domain` still reads `google.com`; the `uule` and the local sites in the results (TV Licensing, the German TV-L wage scale, Salvador's zoning office, CoinAcademy) are what shows the country. Two extra calls are mobile (`os=android`) for `tvl` in the UK and India. 48 calls, every task status 20000.

Top 5 countries for those SERPs are the largest non-US opportunity pools: United Kingdom, France, Germany, India, Brazil. Eight English head terms in the UK and India. Germany, France, and Brazil get the English terms people there actually search, plus four local-language translations of the same intents.

## Cost

| Endpoint | Calls | Charged |
| --- | ---: | ---: |
| `google-search-console` searchAnalytics | 54 | $0 |
| `dataforseo.google.serp.organic` | 48 | $0.096 |
| **This pass** | | **$0.096** |

Catalog price is $0.002 per live regular call. The `cost` field on every response was $0.002. Shared balance was $9.85 at the start of this pass and $9.33 after the SERP calls. Other audits were spending on the same balance in that window; the $0.52 drop is not this pass. This pass's own charges are the $0.096 above. Cap for this angle was $1.50.

## Country totals hide a US name-query problem and a worldwide English-page problem

Property total: 175,334 clicks, 2,703,835 impressions. The United States is 22,287 clicks and 1,119,123 impressions (41%), CTR 1.99%, position 6.85. At the country total that is 11,287 missed clicks. Every other large country is over the 3% floor, so the other 236 countries add 281 missed clicks, and 168 of those are Jamaica.

Jamaica is one query. `justbet` is 5,591 impressions, 0 clicks, position 8.4, missed 168. That is a bare protocol name. It is not a market to localize.

The non-US country totals are high because brand queries click. Indonesia is 16.8% CTR, Vietnam 16.5%, Spain 16.1%, Korea 11.1%. After brand, bare names, and the operator queries are removed, the 22 non-US countries still hold 6,399 missed clicks on 244,667 impressions. A similar 6,434 are the name queries excluded above. The 6,399 are not a translation gap. They are the same English hubs, counted below at page level so a query and its URL are not added twice.

| Country | Opportunity impressions | CTR | Missed | Name-query missed, excluded |
| --- | ---: | ---: | ---: | ---: |
| United States | 234,716 | 1.60% | 6,436 | 8,404 |
| United Kingdom | 27,950 | 3.07% | 751 | 549 |
| France | 24,791 | 2.71% | 685 | 413 |
| Germany | 24,034 | 3.04% | 660 | 478 |
| India | 23,102 | 4.64% | 577 | 827 |
| Canada | 17,101 | 3.45% | 467 | 538 |
| Brazil | 16,325 | 2.09% | 462 | 333 |
| Indonesia | 11,964 | 9.71% | 257 | 487 |

Head terms that repeat outside the US are small next to the page totals. `tvl` is 775 impressions and 0 clicks in the UK (position 10.1, missed 23) and 904 impressions and 5 clicks in India (position 4.9, missed 22). `usdt dominance` in Germany is 516 impressions, 0 clicks, position 8.6, missed 16. `stablecoin market cap` in Germany is 79 impressions and 61 clicks.

## Non-English queries are brand searches that already click

The attached 28,340-query export has 737 queries with a non-Latin character: 3,886 impressions, 1,420 clicks, 51 missed. The top rows are the brand in another script, at position 1:

| Query | Clicks | Impressions | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| 디파이라마 | 619 | 720 | 86% | 1.0 |
| дефилама | 210 | 252 | 83% | 1.0 |
| دیفای لاما | 192 | 231 | 83% | 1.0 |
| defillama官网 | 56 | 118 | 47% | 1.2 |

Inside the 22 non-US country pulls, non-Latin queries that are not the brand are 1,796 impressions and 46 missed clicks. Korea's largest are 라마사이트 and 라마 사이트 ("llama site", position 5–7, about 4 missed). Japan's メタマスク is position 95. Russia's ддфьф is a keyboard mash. Vietnam's `tvl là gì` is 15 impressions.

Latin-script local language is the same size. Strings with an accent or a local function word, and at least 5 impressions, are a handful per country. The ones that are real product queries already click: `tvl crypto` is position 3.4 in France (44 impressions, 7 clicks, missed 0), position 1.7 in Germany (36 impressions, 6 clicks), and position 2.3 in Indonesia (124 impressions, 80 clicks). `apa itu tvl crypto` in Indonesia is 18 impressions at position 1.6.

These translated head terms have **zero** rows in the country query export, including where a live SERP now shows us on the first page: `capitalisation stablecoins`, `krypto tvl`, `stablecoin marktkapitalisierung`, `tvl cripto`, `maiores stablecoins`. A query we rank for and that people search shows up in a 28-day export. Absence means the 28-day volume is about zero.

## Mobile already clicks. Desktop is the weak device in every large country.

| Device | Clicks | Impressions | CTR | Position | Share of impressions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop | 93,427 | 1,955,369 | 4.78% | 6.10 | 72% |
| Mobile | 80,465 | 736,222 | 10.93% | 6.24 | 27% |
| Tablet | 1,442 | 12,244 | 11.78% | 5.70 | 0.5% |

After the same brand and name exclusion, query rows are desktop 2.19% CTR at position 8.77 (missed 10,665) and mobile 4.94% CTR at position 7.75 (missed 6,153). On queries with at least 30 impressions on both devices, CTR by each side's own position:

| Position | Desktop CTR | Desktop impressions | Mobile CTR | Mobile impressions |
| --- | ---: | ---: | ---: | ---: |
| ~1 | 38.3% | 4,838 | 75.0% | 6,476 |
| 2–3 | 5.6% | 13,643 | 13.9% | 10,926 |
| 4–5 | 1.56% | 50,942 | 0.69% | 45,283 |
| 6–10 | 0.87% | 82,240 | 0.63% | 78,687 |
| 11–20 | 1.54% | 15,338 | 0.37% | 15,961 |

Mobile CTR is higher at positions 1–3, which is where `/categories`, `/chains`, and `/revenue` sit. The band where mobile CTR is lower (positions 4–10, by 0.2 to 0.9 points) is the long tail and the name queries. 93 non-name queries have a mobile position at least 2 places worse, with 50 impressions on each device. The largest position gaps are `usdt casino`, `best crypto bridges`, and old exchange names, a few impressions each.

Every large country is desktop-heavy on impressions, and every one of them has a higher mobile CTR:

| Country | Desktop share | Desktop CTR | Mobile CTR |
| --- | ---: | ---: | ---: |
| United States | 84% | 1.39% | 5.03% |
| Brazil | 78% | 5.19% | 11.15% |
| Japan | 78% | 8.14% | 15.09% |
| Korea | 76% | 7.48% | 22.54% |
| United Kingdom | 67% | 5.67% | 8.42% |
| Germany | 64% | 6.22% | 8.09% |
| India | 52% | 5.72% | 10.46% |
| Indonesia | 51% | 12.77% | 20.92% |

India, Indonesia, and Turkey are the closest to an even split. Their mobile CTR is still about double desktop. A mobile layout change has no CTR pool to collect. The device that misses clicks is desktop, at positions we already hold.

## The pages that miss clicks miss them in every country, in English

Global, both devices, all countries. This is the full page cut, not the 23-country sample.

| Page | Desktop CTR (pos) | Desktop missed | Mobile CTR (pos) | Mobile missed |
| --- | --- | --- | ---: | ---: |
| `/categories` | 0.10% (1.60) | 1,657 | 0.61% (1.20) | 738 |
| `/chains` | 1.16% (2.27) | 1,449 | 4.95% (2.24) | 0 |
| `/yields` | 0.50% (3.06) | 800 | 0.92% (3.26) | 566 |
| `/revenue` | 1.06% (1.46) | 1,120 | 4.70% (1.26) | 0 |
| `/stablecoins` | 1.72% (4.42) | 378 | 2.42% (3.99) | 106 |
| `/metrics` | 0.06% (2.17) | 196 | 0.31% (1.22) | 106 |

`/chains` and `/revenue` already clear 3% on mobile. Their entire miss is desktop, at position 1–2. That is the zero-click desktop SERP round 1 documented on US queries, and the same titles are what rank in the other countries below.

Split of the same URLs inside the 23 countries (US vs the other 22). Page impressions are not a share of the property total.

| Page | US impressions | US CTR | US missed | Other 22, impressions | Other 22, CTR | Other 22, missed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/categories` | 10,952 | 0.25% | 302 | 50,773 | 0.29% | 1,377 |
| `/yields` | 13,652 | 0.64% | 322 | 31,752 | 0.61% | 759 |
| `/metrics` | 790 | 0.25% | 22 | 6,969 | 0.14% | 199 |
| `/revenue` | 10,800 | 3.12% | 0 | 52,812 | 2.61% | 433 |
| `/chains` | 20,540 | 1.77% | 252 | 68,762 | 2.73% | 487 |
| `/stablecoins` | 13,529 | 1.68% | 179 | 21,687 | 2.40% | 210 |
| `/rwa` | 1,099 | 2.27% | 8 | 7,948 | 1.43% | 150 |

`/categories` is under 1% CTR in the UK (0.5%), France (0.2%), Germany (0.1%), India (0.7%), Brazil (0.2%), Indonesia (0.5%), Spain (0.2%), Korea (0.1%), and Japan (0.0%). The United States is 302 of the 1,679 missed clicks on this URL inside the sample. Shipping the English heading once is what covers the other countries. A French or German title would be a second page for a query set that is already English.

## Local SERPs: English titles already win, and the bare word "tvl" is a different thing

46 desktop SERPs. DefiLlama is in the organic top 8 on 16. CoinGecko's localized path (`/fr/`, `/de/`) is in the top 8 on 4. The other CoinGecko hits are `/en/...` even on a German, French, or Brazilian SERP.

Where the current English title is the result Google shows:

| Query | Locale | Rank | Title Google shows | Who is above us |
| --- | --- | ---: | --- | --- |
| stablecoin market cap | DE, FR, BR, IN `en` | 1 | Stablecoin Market Cap Chart, Supply & Peg Data | — |
| dex volume | FR `en` | 1 | DEX Volume Rankings - Trading Activity | — |
| defi protocols | DE, FR, BR `en` | 3 | Top DeFi Protocols by Chain & Category (`/top-protocols`) | explainers |
| defi protocols | UK `en` | 4 | same | Chainalysis, explainers |
| defi protocols | IN `en` | 6 | same | Investopedia, Wikipedia, ethereum.org |
| token unlocks | UK `en` | 6 | Token Unlocks & Vesting Schedules | Tokenomist |
| tvl crypto | FR `fr` | 2 | Chain Rankings by TVL - DeFi Analytics | CoinAcademy's definition |
| capitalisation stablecoins | FR `fr` | 3 | Stablecoin Market Cap Chart… (English) | CoinGecko `/fr/`, CoinMarketCap in French |

The French pair is the strongest case for a translated title, and it does not survive the impression count. `capitalisation stablecoins` has no France row in 28 days. `tvl crypto` has 44 impressions and already clears 3% with the English title. CoinGecko's French chains page (`/fr/chains`, "Top des Blockchains par Valeur Totale Verrouillée") is third, under our English title.

CoinGecko's German DEX page is the other real localized win: for English `dex volume` with `hl=de`, `coingecko.com/de/börsen/decentralized` ("Die wichtigsten dezentralen Börsen geordnet nach Volumen") is third, behind Token Terminal and DefiPrime. Germany recorded 10 impressions for `dex volume`. `krypto tvl` in German is an English-path CoinGecko URL (`/en/chains`, fourth) under Investopedia, and that query is also absent from Search Console. `stablecoin marktkapitalisierung` is news and explainers (Bitcoin.com, BTC-ECHO, Stripe); CoinGecko's German homepage is fourth; we are absent; the query is absent from Search Console.

`beste stablecoins`, `defi rendite`, `meilleurs stablecoins`, `rendement defi`, `capitalização de stablecoins`, `maiores stablecoins`, and `rendimento defi` are local publishers, brokers, and YouTube (Finanztip, Ramify, Mercado Bitcoin, Ripio). No CoinGecko localized ranking page, and we are absent. Those SERPs are definitions and "which coin to buy," which a translated dashboard title does not enter.

The bare query `tvl` is not the crypto metric in three of the five countries:

| Country | What the first page is | DefiLlama |
| --- | --- | --- |
| United Kingdom, desktop and mobile | TV Licensing, gov.uk, TVL Security, Wikipedia | absent |
| Germany, English UI | TV-L, the public-sector wage scale (beck-online, gesetze-bayern) | absent |
| France, English UI | TV Libertés, a television channel | absent |
| Brazil, English UI | Salvador zoning viability (Termo de Viabilidade Locacional), then a Ledger glossary | absent |
| India, desktop and mobile | "What is TVL" explainers (Binance, Coin360, YouTube) | absent |

UK `tvl` is the 775-impression, 0-click query. A German or Portuguese title on `/chains` does not move a wage-scale or a TV-licence SERP. The query that does rank is `tvl crypto`, and the English chains title is already the one on that page.

`usdt dominance` and `usdt dominance chart` are TradingView and Binance in the UK, Germany, France, and India. Same result round 1 saw in the US. `yield farming` is Bitpanda, Chainlink, and YouTube in the UK, India, and Brazil. `token unlocks` outside the UK is Tokenomist and explainers. `top stablecoins` in the UK is CoinMarketCap, then Kraken, Forbes, CoinGecko `/en/categories/stablecoins`, and our English stablecoins title at sixth (15 UK impressions). India `top stablecoins` is Messari and listicles; we are absent (8 impressions).

## Ranked fixes

Missed clicks are 28-day `missed@3%`. Page figures are the whole property unless the row says "22 non-US countries." A 3% CTR is the floor from the brief, not a forecast: desktop position-1 queries with an AI Overview will not all reach it. Round 1 found that overview on 24 of 30 US head queries. This pass did not buy the advanced SERP (AI Overview) endpoint again.

### 1. One English H1 on `/categories`. About 2,394 missed clicks, and four-fifths of the sampled gap is outside the US.

Global: desktop 1,657 missed at position 1.60 (0.10% CTR) and mobile 738 at position 1.20 (0.61% CTR). Inside the 23-country sample the US is 302 and the other countries are 1,377, at 0.29% CTR on 50,773 impressions. The UK, France, Germany, India, Brazil, Indonesia, Spain, Korea, and Japan are each under 1% CTR on this URL.

The title in `src/pages/categories.tsx` already says what the page is:

```25:26:src/pages/categories.tsx
			title="Protocol Categories - DeFi TVL & Revenue Sectors - DefiLlama"
			description="Explore DeFi protocol categories: DEXs, Lending, Yield, Derivatives, and more. Compare sector TVL, revenue, and growth metrics. Category rankings and market share analytics for DeFi sectors."
```

The H1 does not. `src/containers/ProtocolTaxonomy/CategoriesPage.tsx` renders `TVL by category`. Google rewrites a position-1 title toward the H1, in every country, on both devices.

Replacement H1, same element:

`Protocol categories by TVL and revenue`

Leave the title and description in English. There is no second-language query on this page with a measured impression count.

### 2. One English H1 on `/yields`. About 1,366 missed clicks.

Global: desktop 800 missed at position 3.06 (0.50% CTR), mobile 566 at position 3.26 (0.92%). The other 22 countries are 759 of that kind of gap (31,752 impressions, 0.61% CTR) against 322 in the US. The title is already the query:

```19:20:src/pages/yields.tsx
			title="Yield Farming Rankings - Best DeFi APY Pools - DefiLlama"
			description="Find the best DeFi yield farming opportunities across all chains. Compare APY rates, TVL, and pool metrics for 10,000+ yield pools on Ethereum, Solana, Base, and 500+ networks. Real-time yield analytics."
```

The only H1 is screen-reader text in `src/containers/Yields/YieldsTabs.tsx`:

```33:33:src/containers/Yields/YieldsTabs.tsx
			<h1 className="sr-only">Yields</h1>
```

Replacement: a visible H1, `Yield farming rankings`. The local-language yield SERPs (`defi rendite`, `rendement defi`, `rendimento defi`, English `yield farming` in the UK, India, and Brazil) are explainers and brokers. A translated yields title does not enter them. The pool rows missing from server HTML are the technical report's finding; this pass did not re-fetch that HTML. The CTR here is the same in every country, which is what a single English heading change covers.

### 3. Leave `/chains` and `/revenue` in English. Their miss is desktop CTR at position 1–2, and the chains title is already what ranks abroad.

`/chains` desktop missed 1,449 at position 2.27 (1.16% CTR). Mobile is 4.95% at position 2.24, missed 0. The other 22 countries are 2.73% CTR, missed 487, which is the 3% floor rather than a broken page. `/revenue` desktop missed 1,120 at position 1.46. Mobile is 4.70%, missed 0. The US revenue URL is already 3.12%. The other 22 countries are 2.61%, missed 433.

The chains title is the string on the French `tvl crypto` result at rank 2:

```46:47:src/pages/chains.tsx
			title="Chain Rankings by TVL - DeFi Analytics - DefiLlama"
			description="Compare 500+ blockchains by Total Value Locked (TVL), fees, and DeFi activity. Track chain rankings, protocol counts, and cross-chain analytics. Real-time layer-1 and layer-2 blockchain metrics."
```

Do not lead this title with a translation of "TVL," and do not chase the bare query `tvl`. In the UK that query is a television licence, in Germany it is the TV-L wage scale, in France it is a television channel, and in Brazil it is a zoning permit. India's first page is a definition, on desktop and on mobile, and we are not on it (GSC: 904 impressions, position 4.9, missed 22). Round 1's US finding still stands for that definition SERP: the page needs a one-sentence answer. It does not need a locale.

`/revenue` is `Protocol Revenue Rankings - DeFi Fees Retained - DefiLlama` in `src/pages/revenue/index.tsx`. No title change from this pass.

### 4. `/metrics` is the same English mismatch, a smaller pool. About 302 missed clicks.

Desktop 196 missed at position 2.17 (0.06% CTR), mobile 106 at position 1.22 (0.31%). The other 22 countries are 6,969 impressions at 0.14% CTR, missed 199. The US is 790 impressions.

`src/pages/metrics.tsx` title is `Industry Metrics - DeFi Analytics Dashboard - DefiLlama`. `src/components/Metrics.tsx` has no H1. The visible heading is an H2, `Metrics`, at the line that renders `heading-sm`.

Replacement title:

`DeFi Metrics Index - TVL, Fees, Revenue & Volume - DefiLlama`

Replacement description:

`Index of DefiLlama dashboards: TVL, fees, revenue, volume, yields, and stablecoins.`

Add an H1 in that same heading row: `DeFi metrics`.

### 5. Leave the stablecoins title in English. It is already rank 1 in four of the five countries.

`src/pages/stablecoins.tsx`:

```85:86:src/pages/stablecoins.tsx
			title="Stablecoin Market Cap Chart, Supply & Peg Data - DefiLlama"
			description="Track the total stablecoin market cap, circulating supply, prices, inflows, and peg stability across all stablecoins. Explore stablecoin market charts and analytics with transparent data from DefiLlama."
```

That title is organic rank 1 for `stablecoin market cap` in Germany, France, Brazil, and India. The UK first page is Messari, Yahoo, and stablecoin sites; we are not in the top 8, and the UK query is 34 impressions. Page-level, the other 22 countries are 2.40% CTR, missed 210. The UK `top stablecoins` result that CoinGecko wins is `/en/categories/stablecoins`, not a British locale, and it is 15 impressions.

The only SERP where a translation matches the winner is French `capitalisation stablecoins`: CoinGecko `/fr/categories/stablecoins` ("Principaux stablecoins par capitalisation boursière") first, CoinMarketCap's French title second, our English title third. France has no Search Console row for that query. Moving from third to first on a query with no recorded impressions is not a 28-day click gain.

## Do not add

**Hreflang.** `src/pages/_document.tsx` sets `<Html lang="en">`. `src/components/SEO/index.tsx` emits a canonical and does not emit `hreflang`. There is no localized URL to point at. An `hreflang` cluster of one English URL, or a cluster pointing at URLs that do not exist, is ignored. The alternate links elsewhere in the repo are the research RSS feed, not locales. Non-Latin non-brand demand in the countries pulled here is 46 missed clicks, and the brand in Hangul, Cyrillic, and Arabic already clicks at 80%+.

**Localized titles and descriptions.** The 22-country local-language head terms are either absent from Search Console or already over 3% CTR on the English title (`tvl crypto`). CoinGecko bothers with `/fr/` and `/de/` and still serves `/en/chains` on the German `krypto tvl` SERP and the Brazilian `tvl cripto` SERP. Copying that program would add a set of URLs for queries this property did not get shown for.

**A mobile layout change, for CTR.** Mobile is the higher-CTR device at the positions these hubs occupy, in every large country, including India and Indonesia where mobile is half of impressions. `/chains` and `/revenue` clear 3% on mobile and miss it on desktop. `/categories` misses it on both, at position 1, which is the heading and the snippet, not the layout after the click. Positions 4–10 are where mobile CTR is a fraction of a point lower, on queries that are not these hubs.
