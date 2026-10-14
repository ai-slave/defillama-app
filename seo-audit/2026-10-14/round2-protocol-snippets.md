# Protocol snippets

The `/protocol/{slug}` template is half of the property’s missed clicks, and Google does not quote its meta description. On a US desktop SERP it quotes the FAQ answers that are expanded in the HTML, stitched together, or the protocol-description paragraph when that paragraph is a better match than those answers. “X tvl” already gets the TVL sentence and converts at 55% from position 1. “X volume” often gets that same TVL sentence, and “vest markets” gets the chains sentence. The template fix is one definition sentence in three places (under the H1, the meta description, and the first FAQ), with the chains and token-price answers closed so they stop being the default quote.

Missed@3% = max(0, 0.03 × impressions − clicks). Window is the attached Search Console extract, 14 Sep 2026–11 Oct 2026. Bare brand and bare protocol-name queries are excluded from the upside. Application code was not changed.

## What the template is doing

`/protocol/{slug}` is one overview template. In the extract it is 5,718 URLs, 1,763,185 impressions, 35,801 clicks (2.03% CTR), and 29,093 missed clicks. That is 48% of missed clicks on the property. The tab URLs under `/protocol/{tab}/{slug}` are 119 rows, 5,188 impressions, 33 clicks, and 141 missed clicks. `getProtocolLayoutSeo` in `src/containers/ProtocolOverview/layoutSeo.ts` indexes only information, active loans, unlocks, and forks. The other tabs are `noindex`, which is why they are not the snippet problem.

The overview title, meta description, and FAQ are built for every protocol:

- Title, `src/containers/ProtocolOverview/queries.tsx` around the `seoTitle` assignment: `` `${name} ${titleMetricSegment}` ``. Metrics are appended in a fixed order: TVL, Fees, Revenue, then Volume if a DEX or perp series exists. With none of those, the segment is `Stats & Charts`. The live title has no “ - DefiLlama”. Google shows it as written (`Hyperliquid TVL, Fees, Revenue & Volume`, `Variational Volume Stats & Charts`).
- Meta description, same file: `` `Track ${name} on DefiLlama. Including ${chart list}` ``, then income-statement labels. Live length is often 200–600 characters (`Aave` is 614). It is a chart inventory. `protocolData.description` is loaded and rendered later, and it is not used here.
- FAQ order, `buildProtocolFaq` in `src/containers/ProtocolOverview/faq.ts`: TVL, chains, fees, token price, token performance, comparison, one metric (volume, loans, open interest, or yields), treasury, exploits. There is no “What is {name}?” question.
- The first five `<details>` are rendered `open` (`DEFAULT_OPEN_COUNT = 5` in `src/containers/ProtocolOverview/ProtocolFaq.tsx`). For a protocol with TVL and a token, those five are TVL, chains, fees, price, and performance. The volume answer sits at position 7 and is closed.
- Under the H1, `ProtocolHeader` in `src/containers/ProtocolOverview/index.tsx` renders the hero number (`Total Value Locked $18.58b` on Aave). The description paragraph is in `ProtocolInfo` inside `AdditionalInfo`, after the chart (`Aave is an Open Source and Non-Custodial protocol to earn interest on deposits and borrow assets`).
- No `jsonLd` is passed for a protocol page. `src/components/SEO/index.tsx` supports it. The FAQ is visible HTML only.

## Method

Search Console figures are the attached page, query, and page-query extracts (14 Sep 2026–11 Oct 2026). One fresh country split, for `aave tvl` on `https://defillama.com/protocol/aave`, was pulled from `google-search-console` searchAnalytics for the same window. That call is free.

Live page text for 45 protocol URLs was fetched on 14 Oct 2026 (title, meta description, H1, the block under the H1, the description paragraph, and the FAQ when the extract reached it). The fetch is free.

Live SERPs are United States, English, location code 2840, desktop, depth 10, fetched 14 Oct 2026. DataForSEO organic live is the source for every snippet cited below. A cheaper organic endpoint was used as a cross-check on the same queries; where the two disagreed or the cheap call returned no page, the DataForSEO row is the one reported. `what is rollx in crypto` returned task 40101 and is dropped.

The 45 pages cover the impression tiers of the overview template: the head (Aave, Morpho, Hyperliquid, Uniswap, Lighter, pump.fun, Vest Markets, GMX, Ondo, Raydium, Aster, Chainlink, fomo, StonkFun, Axiom Pro, Pons), the middle (Polymarket, Centrifuge, Sanctum, NEAR, CoWSwap, Rhea, NEAR Intents, Variational, and others around 500–2,000 impressions), and the tail (1inch, Injective, Canton, Spark Liquidity Layer, marginfi, Flux, VVS, Indigo, Kaspa Finance, Bitflow, RollX, Satori, Thetanuts, Momentum, IBC, the Cytonic airdrop page, plus Aave V3, Morpho Blue, Collector Crypt, GMGN, and Axiom as contrast URLs). For each, the non-brand query in GSC was one or more of “what is X”, “X tvl”, “X volume”, “X fees”, and “X airdrop”, preferring the query with the most impressions. Airdrop queries in the extract are 43 rows and 171 impressions, so that pattern was checked and then dropped from the upside.

A live US rank and the 28-day average position are different measurements. Both are reported. A snippet is classified by matching its text to the page fetched the same day: meta (starts “Track {name} on DefiLlama”), TVL FAQ (“currently has … in total value locked”), chains FAQ (“operates on … chain”), fees FAQ (“generated … in fees”), or the description paragraph.

| Call | Endpoint | What it returned | Charged |
| --- | --- | --- | --- |
| 53 | `dataforseo.google.serp.organic` | US desktop, depth 10. 52 queries in the sample plus one Aave probe. One task 40101, still billed. Response `cost` is $0.002 each. | $0.106 |
| 77 | `crawl4ai.google.serp.organic` | Same queries, used only to cross-check. Failed calls were not billed. | $0.010 |
| 6 | `tinyfish.web.fetch` | HTML text for 45 protocol URLs, batches of 8. | $0 |
| 2 | `google-search-console` searchAnalytics | Country and date splits for `aave tvl`. | $0 |

Shared balance was $9.85 before this work and $9.29 after. Other audits were spending on the same balance. This audit’s own charges sum to **$0.116**.

## Which sentence Google quotes

Across the DataForSEO rows where a `/protocol/{slug}` URL was on the first page, the meta description was the snippet **zero** times. The bridge URL `defillama.com/bridge/lighter` did use its own meta (“Track bridge volume…”). The overview meta never did.

Google quotes the expanded FAQ, and it concatenates consecutive open answers:

- `polymarket tvl`, live #1. Snippet is the TVL FAQ: “Polymarket currently has $342.02m in total value locked. TVL has decreased 5% over the past 30 days.” GSC: 52 clicks, 77 impressions, 67.5% CTR, position 1.00.
- `chainlink tvl`, live #1. Snippet starts with the question itself: “What is Chainlink's TVL? Chainlink currently has $1.965b in total value locked.” GSC: 18 / 53 / 34.0% / position 1.02. The title is `Chainlink Fees & Revenue`, which does not say TVL. The open FAQ still answers the query.
- `vest markets tvl`, live #1. TVL FAQ, including the 30-day drop. The plain query `vest markets` does not use this sentence.
- `lighter fees`, live #2, under docs.lighter.xyz. Fees FAQ: “Over the past 30 days, Lighter generated $5.72m in fees. Of that, $4.74m was protocol revenue.” GSC: 6 / 159 / 3.8% / position 2.62.
- `uniswap fees`, live #2. Fees FAQ (“Uniswap generated $128.08m in fees…”). GSC: 4 / 316 / 1.3% / position 5.31.
- `aave fees`, live #2. Fees FAQ, then the price answer stitched on: “…$89.66m in revenue. AAVE is currently trading at $160.11.” GSC: 3 / 14 / 21% / position 2.57.
- `aster fees`, live #2. Same stitch: fees sentence, then “ASTER is currently trading at $0.70.” GSC: 6 / 100 / 6.0% / position 4.46.
- `near intents fees`, live #2. Fees FAQ only. GSC: 4 / 31 / 12.9% / position 3.16.
- `axiom fees`, live #4. Fees FAQ, then the comparison and a volume fragment. GSC: 4 / 281 / 1.4% / position 8.21.

The volume answer is not in that open set, so a volume query is answered with TVL:

- `hyperliquid volume`, live #1. Snippet is the TVL FAQ and then the chains question: “Hyperliquid currently has $7.057b in total value locked. TVL has increased 5.3% over the past 30 days. What chains does Hyperliquid operate on?” The page’s first five FAQs are TVL, chains, fees, HYPE price, and HYPE performance. “How much trading volume…” is later and closed. GSC: 37 / 301 / 12.3% / position 1.39. Same page, `hyperliquid tvl` is 44 / 78 / 56.4% / position 1.10. The volume number exists; it is not the passage Google is quoting.
- `uniswap v4 volume`, live #1 on `/protocol/uniswap-v4`. Snippet is again the TVL FAQ. GSC: 98 / 106 / 92.5% / position 1.30. The title contains “Volume”, and this query has little else to click. A TVL snippet does not always suppress the click. It does on Hyperliquid, where Yahoo, TradingView, and the Hyper Foundation also show a volume number.

When the open FAQ is a bad match, Google will quote the description paragraph instead, including from where it sits today (the Protocol Information card):

- `variational volume`, live #1. Title `Variational Volume Stats & Charts`. No TVL FAQ (the page has no TVL). Snippet is the description: “Variational is a protocol that provides infrastructure for peer-to-peer trading, clearing, and settlement of perpetuals…” GSC: 47 / 57 / 82.5% / position 1.00.
- `lighter dex`, live #3. Snippet is the description: “Lighter is a decentralized trading platform that is designed to deliver unmatched security and scale.” GSC: 13 / 3,555 / 0.37% / position 5.46.
- `near intents tvl`, live #1. Snippet is the description (“NEAR Intents are a new type of transaction…”), not the TVL number. GSC: 42 / 62 / 67.7% / position 1.02. At position 1 the description still gets the click.

Name queries quote chains even when a TVL answer is open above it:

- `vest markets`, live #4, under vestmarkets.com. Snippet is the chains FAQ: “Vest Markets operates on 8 chains: Ethereum, Arbitrum, BSC, OP Mainnet, and Base and 3 others. Ethereum holds the largest share at 56.8%.” The TVL FAQ is first and open, and the description (“Vest Exchange is a next generation Perps DEX…”) is on the page. Google used neither. GSC: 15 / 30,710 / 0.05% / position 4.55. This matches the round-1 SERP.
- `collector crypt`, live #3. Snippet opens on chains, then fees, then the token price. The description is “A protocol to sell RWA Pokemon cards on Solana.” GSC: 10 / 5,422 / 0.18% / position 6.21.

Pages with no TVL open on chains, because `buildTvlQuestion` returns null and chains is next:

- pump.fun’s first FAQ is “What chains does pump.fun operate on?”
- Axiom Pro’s first FAQ is “What chains does Axiom Pro operate on?” Round 1 saw the fees sentence for `axiom pro` because that query contains “pro” and the fees answer is also open. The chains answer is still first in the DOM.

Airdrop queries have nothing to quote. `marginfi airdrop` is live #4 with the TVL, chains, and fees answers stitched (“marginfi currently has $47.41m in total value locked…”). GSC: 0 / 15 / position 17.13. `cytonic airdrop` is live #2 and quotes the campaign description plus a TVL. GSC: 1 / 18 / 5.6% / position 5.33. The whole airdrop pattern is 1 click on 171 impressions. An airdrop FAQ would be a false sentence for almost every protocol.

Several “X tvl” queries that GSC records at position 1.0 are not on the US desktop first page today (`aave tvl`, `morpho tvl`, `gmx tvl`, `lighter tvl`, `raydium tvl`, `hyperliquid tvl`). `aave tvl` was position 1.0 in the US on every day of the window that had an impression, including 12 Oct, with 34 US clicks on 62 US impressions (54.8% CTR). The 14 Oct SERP’s first organic result is app.aave.com, and the only DefiLlama URL is a Pro dashboard. A snippet change does not explain a URL that is no longer shown. Those queries stay in the CTR table as what happened while the URL was shown. They are not counted as snippet upside.

`what is vest markets`, `what is stonkfun`, `what is pons crypto`, `what is axiom pro`, and `what is flux finance` did not place a protocol URL on the first page. `what is` queries in the extract are 428 rows, 1,928 impressions, 6 clicks, position about 9.

## Snippet and CTR

Non-brand queries on `/protocol/{slug}` in the page-query extract, split by the words in the query. This is the relationship the live snippets explain: the intent whose sentence is open and first converts, and the intent whose sentence is closed or missing does not.

| Query | Position 1–1.5 | Position 1.5–3 | Position 3–5 | Position 5–8 |
| --- | --- | --- | --- | --- |
| X tvl | 55.0% (2,462 / 4,473, 224 queries) | 2.6% | 1.6% | 1.3% |
| X volume | 33.1% (271 / 818, 50 queries) | 13.8% | 13.7% | 4.6% |
| X fees | 24.8% (29 / 117, 31 queries) | 6.9% | 2.9% | 1.0% |
| what is X | 5.6% (5 / 90, 76 queries) | 1.4% | 0% | 0% |
| X airdrop | no position-1 rows with clicks | — | 0% on 25 impressions | 2.8% on 36 |

Reading the columns against the SERPs:

- Position 1–1.5 and the TVL sentence is what Google shows for “X tvl”. That cell is the ceiling this template already earns. It is not a target for “what is” or for a name query at position 5.
- “X volume” at the same position is 22 points lower. The head query in that cell with a confirmed mismatch is `hyperliquid volume` at 12.3% with a TVL snippet. The head query whose page leads with volume, `variational volume`, is 82.5% with the description. `uniswap v4 volume` is 92.5% even with a TVL snippet, so the gap is not automatic. The pattern is: when the volume sentence is closed and a competitor shows a volume number, the TVL quote costs the click.
- “X fees” already gets the fees sentence, including at position 2 (`lighter fees`, `uniswap fees`, `aave fees`). The CTR stays far below TVL because the sentence is dollars the protocol collected (“generated $5.72m in fees”) and the result above it is the fee schedule (0% maker, 0.025% taker). Rewriting the meta description will not outrank docs.lighter.xyz. The stitch that adds “currently trading at $160.11” is the part the template can stop.
- “what is X” has almost no clicks at any position. The pages do not contain the question, and on this sample they were not on the first page.
- At position 3–6, a description snippet (`lighter dex`, 0.37%) beats a chains snippet (`vest markets`, 0.05%; `collector crypt`, 0.18%) by a few tenths of a point, not by the position-1 gap. Rank, the official site’s sitelinks, and the AI Overview cap this band. Round 1 found an AI Overview on 24 of the top 30 non-brand queries. A better sentence changes the click when the URL is already on screen. It does not create the rank.

`aave tvl` on `/protocol/aave` is 179 / 272 / 65.8% / position 1.00. The same query on `/protocol/aave-v3` is 2 / 232 / 0.9% / position 4.41. `morpho tvl` is 119 / 182 / 65.4% on `/protocol/morpho` and 0 / 176 on `/protocol/morpho-blue`. The child URL ranks a few places lower and the click goes to the parent. That is a canonical choice, not a second snippet to optimize.

## Click upside

Page-level, the overview template has 29,093 missed clicks at the 3% floor. Query-level, the same URLs split into bare protocol names (14,012 missed, excluded), brand queries (1,962 missed, excluded), and everything else (10,448 missed on 414,141 impressions). Near-names that the extract did not flag, because of a space or “protocol” (`vest markets`, `stonkfun`), are another 4,331 missed clicks. They are kept out of the total below and shown as a sensitivity.

The 3% floor is the wrong yardstick for a snippet that already earns 55% at position 1. The upside is only the impressions whose quoted sentence does not answer the query.

| Slice | Impressions | Clicks now | What would have to change | Extra clicks / 28 days |
| --- | --- | --- | --- | --- |
| “X volume”, position under 3, CTR under 25%. Head rows: `hyperliquid volume` (301 impr, 12.3%, TVL snippet), `aster volume`, `hyperliquid daily volume`, `lighter volume`, and the smaller twins. | ~550 in the head | ~70 | Quote the volume sentence the way fees queries already quote the fees sentence. Lift those rows toward 40%, the middle of the volume position-1 cell (33%) and the pages that already lead with volume (Variational 82%, Uniswap V4 92%). `hyperliquid volume` alone is about +80. | ~150 |
| Other non-name queries at position 3–8 (modifier words: dex, crypto, exchange, launchpad). 129,626 impressions, 0.72% CTR. | use half, ~65,000 | — | Chains or price is the open quote, and the description is on the page but loses. Observed gap versus a description that is already the snippet (`lighter dex` 0.37% vs `collector crypt` 0.18%) is about 0.25 points. Do not apply the 55% TVL rate here. | ~160 |
| “what is X”, all positions. 1,928 impressions, 6 clicks. | 1,928 | 6 | A “What is {name}?” answer can be quoted when the URL is shown. Most of these queries were not on the first page on 14 Oct. | ~30 |
| “X fees” | 8,631 | 219 | The fees sentence is already the snippet. The result above it is the fee rate. | ~0 |
| “X airdrop” | 171 | 1 | No true sentence to add. | 0 |
| “X tvl” at position 1–1.5 | 4,473 | 2,462 | Already the TVL sentence. | 0 |

**About 300–500 extra clicks per 28 days** on the non-name, non-brand query set. That is roughly 1% of the template’s 35,801 clicks, and it is the part the snippet actually controls. The rest of the 29,093 missed clicks are bare names, near-names at position 4–8 under an official site, and URLs that the US SERP is no longer showing.

Sensitivity, not in the total: `vest markets` plus `vest market` are 36,403 impressions and 16 clicks (0.04% CTR) with a chains snippet at live position 4. Moving that pair from 0.05% to the description-snippet rate of `lighter dex` (0.37%) is about 110 clicks. A definition can win some of those. It will not turn a position-4 result under vestmarkets.com into a 55% CTR.

Tab URLs add about 141 missed clicks. Their titles are below. They are not in the 300–500, because the indexed click is the overview URL.

The page-query file is the top 100,000 pairs, not every impression. It covers 94% of Pons impressions and 33% of Hyperliquid impressions. The volume head and the name-modifier head are in it. The missing pairs are smaller pages, where “X tvl” at position 1 is already the 55% cell.

## Ranked fixes

### 1. Open the definition and the dollar answers, and close chains and price

`buildProtocolFaq` in `src/containers/ProtocolOverview/faq.ts`. The candidate order today is TVL, chains, fees, token price, token performance, comparison, one metric, treasury, security.

New order:

1. `What is {name}?` Answer: the protocol description, one sentence, only when `description` is non-empty. `ProtocolFaqContext` does not carry the description today; pass `protocolData.description` from `queries.tsx` where `buildProtocolFaq` is called.
2. TVL, unchanged (`What is {name}'s TVL?`).
3. Fees and revenue, unchanged.
4. The single metric question that is currently last among the useful ones (DEX volume, perp volume, active loans, open interest, or yields). This is the sentence `hyperliquid volume` could not quote.
5. Comparison.
6. Chains.
7. Token valuation.
8. Token performance.
9. Treasury.
10. Security.

`DEFAULT_OPEN_COUNT` stays 5. After the reorder the open five are the definition, TVL, fees, the volume-or-loans sentence, and the comparison. Chains and the token price stay in the HTML for the queries that ask for them, and they stop being part of the default quote. That is what removes the price tail on `aave fees` and the chains sentence on `vest markets`.

Do not add an airdrop question. The template has no airdrop fact, and the pattern is 171 impressions.

### 2. One sentence under the H1

`ProtocolHeader` in `src/containers/ProtocolOverview/index.tsx`. Today the next text after the name is the hero number. Put the same one-sentence description between the title row and `HeroMetric`, as a single paragraph. It is the sentence `lighter dex` and `variational volume` already prove Google will quote, moved to the first body text instead of the card below the chart.

Use the stored description. Do not write a new one per protocol in this repo. Vest’s stored sentence is “Vest Exchange is a next generation Perps DEX that ensures the most capital efficient liquidity, and fairest pricing for traders and LPs.” Aave’s is “Aave is an Open Source and Non-Custodial protocol to earn interest on deposits and borrow assets.” If the description is empty, render nothing there. The hero number stays.

### 3. Meta description formula

`seoDescription` in `src/containers/ProtocolOverview/queries.tsx` (the `` `Track ${name} on DefiLlama. Including …` `` assignment). Google did not quote that string once in this sample. Replace it so the meta matches the sentence under the H1, or the next template will keep shipping a chart inventory.

Formula, capped at 155 characters:

1. First sentence of `protocolData.description`, whitespace collapsed. If that sentence is longer than 120 characters, cut at the last word that fits.
2. If there is room, add one metric clause and nothing else: ` TVL is {compact}.` when TVL is the hero, otherwise ` 30-day volume is {compact}.` or ` Fees were {compact} in the last 30 days.`
3. If the description is empty: `{name} {lead metric} on DefiLlama.` Do not append the chart list, the income-statement labels, or “Including”.

Aave, using the stored sentence, 111 characters: `Aave is an Open Source and Non-Custodial protocol to earn interest on deposits and borrow assets. TVL is $18.6b.`

Vest’s stored sentence is 136 characters, so the metric clause does not fit. The meta is that sentence cut at the last word inside 155, which is the whole sentence: `Vest Exchange is a next generation Perps DEX that ensures the most capital efficient liquidity, and fairest pricing for traders and LPs.`

The second sentence is the same fact as the TVL or fees FAQ, so the meta and the open FAQ no longer disagree. Keep the current chart-list sentence only as the empty-description fallback, and shorten it to the one clause above.

### 4. Title patterns

Overview title, same `seoTitle` assignment. Keep the metric list Google already shows. Two changes:

- Delete the filler `Stats & Charts`. A page with only volume already ranks as `Variational Volume Stats & Charts`; the query word is “volume”, and “Stats & Charts” is not. Use `{name} Volume`, `{name} Fees & Revenue`, or `{name} TVL` when only one of those exists.
- When both TVL and volume exist, keep TVL first (`{name} TVL, Fees & Volume`). Demoting TVL would give up the 55% cell. The volume query is fixed by opening the volume FAQ (fix 1), not by hiding TVL in the title. Drop “Revenue” from the title when it would push the visible title past about 60 characters; it is still on the page.

`getProtocolLayoutSeo` falls back to `{name} Protocol Overview - DefiLlama` only when `seoTitle` is empty. Leave that fallback. The overview path always passes `seoTitle`, and the live titles have no brand suffix. Do not add one.

Tab titles. Only active loans, unlocks, and forks are indexed besides the overview. The others are `noindex` in `layoutSeo.ts`, so a new tab title does not move the 300–500 until that changes. The pattern, for the day it does, is `{Name} {the noun in the query} - DefiLlama`. Current string, then replacement:

| Tab | File | Current | Replacement |
| --- | --- | --- | --- |
| Active loans | `src/pages/protocol/active-loans/[protocol].tsx` | `{name} Active Loans & Lending - DefiLlama` | `{name} Active Loans - DefiLlama` |
| Unlocks | `src/pages/unlocks/[protocol].tsx` and `src/pages/protocol/unlocks/[protocol].tsx` | `{name} Token Unlocks & Vesting Schedule` and `{name} Token Unlocks & Vesting - DefiLlama` | Keep the round-1 string: `{name} ({symbol}) Unlock Schedule & Circulating Supply` |
| Forks | `src/pages/protocol/forks/[protocol].tsx` | `{name} Protocol Forks & Derivatives - DefiLlama` | `{name} Forks - DefiLlama` |
| Fees | `src/pages/protocol/fees/[protocol].tsx` | `{name} {chart names} - DefiLlama` | `{name} Fees & Revenue - DefiLlama` |
| DEX volume | `src/pages/protocol/dexs/[protocol].tsx` | `{name} DEX Trading Volume & Stats - DefiLlama` | `{name} DEX Volume - DefiLlama` |
| Perp volume | `src/pages/protocol/perps/[protocol].tsx` | `{name} Perpetual Futures Volume - DefiLlama` | `{name} Perp Volume - DefiLlama` |
| TVL | `src/pages/protocol/tvl/[protocol].tsx` | `{name} Total Value Locked (TVL) - DefiLlama` | keep |
| Yields | `src/pages/protocol/yields/[protocol].tsx` | `{name} Yield Pools & APY Rankings - DefiLlama` | `{name} Yields & APY - DefiLlama` |
| Treasury | `src/pages/protocol/treasury/[protocol].tsx` | `{name} Treasury Holdings & Assets - DefiLlama` | `{name} Treasury - DefiLlama` |
| Bridges | `src/pages/protocol/bridges/[protocol].tsx` | `{name} Bridge Volume & Activity - DefiLlama` | `{name} Bridge Volume - DefiLlama` |
| Stablecoins | `src/pages/protocol/stablecoins/[protocol].tsx` | `{name} Stablecoin Data & Reserves - DefiLlama` | `{name} Stablecoins - DefiLlama` |
| Options | `src/pages/protocol/options/[protocol].tsx` | `{name} Options Trading Volume - DefiLlama` | `{name} Options Volume - DefiLlama` |
| DEX aggregators | `src/pages/protocol/dex-aggregators/[protocol].tsx` | `{name} DEX Aggregator Volume - DefiLlama` | keep |
| Perp aggregators | `src/pages/protocol/perps-aggregators/[protocol].tsx` | `{name} Perp Aggregator Volume - DefiLlama` | keep |
| Bridge aggregators | `src/pages/protocol/bridge-aggregators/[protocol].tsx` | `{name} Bridge Aggregator Volume - DefiLlama` | keep |
| RWA | `src/pages/protocol/rwa/[protocol].tsx` | `{name} Real World Assets (RWA) - DefiLlama` | `{name} RWA - DefiLlama` |
| Token rights | `src/pages/protocol/token-rights/[protocol].tsx` | `{name} ({symbol}) Token Rights & Governance` | keep |

Tab meta descriptions repeat “daily, weekly, monthly, and cumulative charts”. Use the same one-clause metric sentence as the overview FAQ for that tab (`{name} generated {fees30d} in fees over the last 30 days.`). The overview URL is the one Google is quoting for those queries today.

### 5. Structured data that matches the open FAQ

Pass `jsonLd` from `ProtocolOverview` through `ProtocolOverviewLayout` into `Layout`, which already forwards it to `SEO`. One `FAQPage` node built from the same `faqItems` array, in the new order, so the structured question text is the visible question text. `acceptedAnswer.text` is the answer with the links flattened to text.

Also set a `WebPage` node whose `description` is the new 155-character meta, and whose `name` is the overview title. Do not add `AggregateRating`, a price as the main entity, or a `SoftwareApplication` offer. The price FAQ is how `aave fees` and `collector crypt` pick up “currently trading at”.

Schema is not what creates the snippet today. Google quotes the expanded HTML with no `FAQPage` on the page. The JSON-LD is there so the structured order cannot drift from the five answers left open. If the visible order and the JSON-LD order differ, Google keeps quoting the HTML, which is the bug this change is closing.

## Limits

Positions in the CTR table are 28-day, all-country averages. The snippets are one US desktop snapshot on 14 Oct 2026. Several queries at average position 1 were absent from that snapshot, so their historical CTR is not paired with today’s snippet.

`vest markets` is treated as a near-name and left out of the 300–500. The official site’s sitelinks are the click on that query. The chains sentence is still the wrong quote, and fix 1 is what changes it.

Checks: this change is the report only. `bun run typecheck`, `bun run test:typecheck`, and `bun run check` were not run. No browser check; no UI was edited.
