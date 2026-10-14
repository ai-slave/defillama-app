# SEO audit 2026-10-14

The nine reports below are the heads of PRs #1–#9, unchanged. This file is the index. Click figures are missed clicks per 28 days at a 3% floor, `max(0, 0.03 × impressions − clicks)`, after brand queries and bare protocol-name queries are removed. Where the reports disagree, [SYNTHESIS.md](SYNTHESIS.md) is the resolution. A page-level total that the synthesis marks as brand is not used.

`{date}`, `{leader}`, and the other braces render from the same props as the table. The 14 Oct 2026 numbers are the fetch the reports measured. They show the shape of the sentence. They are not strings to paste into source.

The yields definition (12) sits inside the server-render estimate (~940). The protocol name-query ceiling (~170) sits outside the 300–500 template estimate. Neither pair is added together.

## Reports

1. [competitor-keywords.md](competitor-keywords.md) (PR #1) — Gap versus CoinGecko, CoinMarketCap, Token Terminal, Dune, and Artemis; the addressable misses are the stablecoin list (62), the perp DEX list (8), the unlocks heading (4), and the RWA list (12).
2. [aeo-visibility.md](aeo-visibility.md) (PR #2) — Sonar cites defillama.com on 3 of 25 questions, Gemini on 8, and ChatGPT on 15, because the hubs open on a table and the definition lives in a tooltip.
3. [serp-features.md](serp-features.md) (PR #3) — On the top non-brand queries Google shows the title and an FAQ snippet; the largest swaps are the aggregator list, TVL on `/chains`, and the protocol description.
4. [technical.md](technical.md) (PR #4) — The 12 Oct crawl finds no pool rows in the `/yields` HTML, headings on `/categories` and `/metrics` that do not match their titles, and noindex protocol tabs inside the sitemap.
5. [round2-country-device.md](round2-country-device.md) (PR #5) — The same English hubs miss the 3% floor on desktop in every large country, and a translated title or hreflang would not collect those clicks.
6. [round2-protocol-snippets.md](round2-protocol-snippets.md) (PR #6) — Google quoted the protocol meta description zero times in this sample and quotes the open FAQ, so the definition has to lead the heading, the meta description, and the FAQ.
7. [SYNTHESIS.md](SYNTHESIS.md) (PR #7) — Cross-read of the first four reports: one copy string and one click total wherever they disagreed.
8. [round2-aio-citations.md](round2-aio-citations.md) (PR #8) — AI Overviews cite DefiLlama on 3 of 40 queries and never for the answer sentence; the pages they quote open with “X is …” or a dated number.
9. [round2-striking-distance.md](round2-striking-distance.md) (PR #9) — Queries at positions 5–20 need one sentence that repeats the query, and yield pools and active-loans are indexable URLs the sitemap does not list.

## A. Hub copy

Answer-first dated one-liners, plus the title and H1, on the hubs below.

### `/chains`

- **Copy.** Title: `Total Value Locked (TVL) by Chain - DefiLlama`. Description: `TVL is the dollar value locked in DeFi. Compare total value locked on Ethereum, Solana, and 500+ chains.` H1: `Total value locked (TVL) by chain`. One-liner: `Total value locked (TVL) is the dollar value of crypto deposited in DeFi protocols. On {date} {leader} led with {tvl}, ahead of {second} at {tvl2} and {third} at {tvl3}.` On 14 Oct 2026 that was Ethereum at $51.2b, Base at $6.2b, and Solana at $6.0b.
- **File.** `src/pages/chains.tsx` (title and description). `src/containers/ChainsByCategory/index.tsx` (H1 and one-liner).
- **Missed clicks.** 102, the non-brand query `tvl` on this URL. The live-window query total is 109. The attached-window page row is 111.
- **Sources.** PR #1, PR #2, PR #3, PR #8, PR #9. PR #7 picks 102 for the page. PR #4 recorded the missing H1 and left the page unranked. PR #5 keeps the sentence for the US definition result and leaves the title in English.

### `/stablecoins`

- **Copy.** Title: `Top Stablecoins by Market Cap - List, Chart & Peg - DefiLlama`. Description: `Top stablecoins by market cap, with supply, peg, and USDT, USDC, and DAI share of that market.` H1: `Top stablecoins by market cap`. The market-cap total stays a stat under that heading. One-liner: `USDT is {share} of the stablecoin market on {date}: {usdt} of a {total} total, ahead of USDC at {usdc} and DAI at {dai}. This is each coin's share of stablecoin market cap. It is not TradingView's USDT.D index, which measures USDT against the whole crypto market.` On 14 Oct 2026 that share was 60.12% ($184.0b of $306.0b), with USDC at $73.1b and DAI at $4.7b, against a USDT.D reading of about 6.6%. FAQ: “What are stablecoins?” and “What is USDT dominance?”, and the dominance answer states the same share.
- **File.** `src/pages/stablecoins.tsx`. `src/containers/Stablecoins/StablecoinsByChain.tsx`.
- **Missed clicks.** 62, the list family (`stablecoins list`, `top stablecoins`, `stablecoin list`, and the same family). The 102 dominance clicks are a different chart and stay out. The 1,383 page-level figure is mostly brand and stays out.
- **Sources.** PR #1, PR #2, PR #4, PR #8, PR #9. PR #7 keeps the list title. PR #3’s dominance title is the one that lost.

### `/dex-aggregators`

- **Copy.** Title: `Top DEX Aggregators: 1inch, Jupiter & CowSwap - DefiLlama`. Description: `A DEX aggregator routes swaps across exchanges for a better price. Rank 1inch, Jupiter, CowSwap, and 100+ by volume.` H1: `Top DEX aggregators`, with the 24h volume stat beside it. One-liner: `A DEX aggregator routes swaps across exchanges for a better price. On {date}, tracked DEX aggregator volume was {total} in 24 hours. {leader} led at {a}, then {second} at {b} and {third} at {c}.` On 14 Oct 2026 the total was $2.46b, and the first three rows were Jupiter ($539m), DFlow ($349m), and 0x ($207m). FAQ: “What is a DEX aggregator?” with the first sentence, and “Which aggregators have the most 24h volume?” naming that top row.
- **File.** `src/pages/dex-aggregators/index.tsx` (title and description). `src/containers/AdapterMetrics/AdapterByChain.tsx` (H1 and one-liner, all-chains branch).
- **Missed clicks.** 143, the three query totals on the live window (`top defi aggregators`, `what are defi aggregators`, `what are dex aggregators`). The page rows sum to 142.
- **Sources.** PR #2, PR #3, PR #8. PR #7 picks 143 and the list title that includes Jupiter.

### `/yields`

- **Copy.** Title stays `Yield Farming Rankings - Best DeFi APY Pools - DefiLlama`. H1: `Yield farming rankings`, replacing the screen-reader text `Yields`. One-liner, once the pool rows are in the HTML: `Yield farming is depositing crypto to earn rewards. On {date}, the highest verified stablecoin APY in this table is {apy} on {pool}.` `{apy}` and `{pool}` come from the first verified stablecoin row already loaded for the table.
- **File.** `src/pages/yields.tsx` (title, unchanged). `src/containers/Yields/YieldsTabs.tsx` (H1). `src/containers/Yields/views/EarnView.tsx` (one-liner, next to “Tracking N pools”).
- **Missed clicks.** 12, the query `yield farming`. Those 12 are inside the ~940 server-render figure in workstream C and are not added again. `best yield farming crypto` is another 4 on this URL and is part of the same HTML gap.
- **Sources.** PR #2, PR #4, PR #5, PR #8, PR #9. PR #7 keeps the current title and the H1 `Yield farming rankings`.

### `/protocols/lending`

- **Copy.** Title: `DeFi Lending & Borrowing Protocols - TVL, Fees, & Revenue`. Description: `Lending protocols let users borrow and lend assets. Compare ${protocolCount} of them by TVL, borrows, and fees.` H1: `DeFi lending and borrowing protocols`. H2: `What are DeFi lending protocols?` One-liner: `Lending protocols let users borrow and lend assets. On {date} the lending category held {tvl} across {count} protocols.` On 14 Oct 2026 that was $53.1b across 655 protocols. The eight-word category description stays the table cell on `/categories`.
- **File.** `src/containers/ProtocolTaxonomy/constants.tsx` (`Lending.seoBaseTitle`, `headingLabel`, and `getProtocolCategoryPresentation` so the definition comes before the rankings clause and survives the 155-character cap). `src/containers/ProtocolTaxonomy/index.tsx` (H1, H2, and one-liner).
- **Missed clicks.** 41, the query `defi lending and borrowing protocols explained`. The attached-window row is 45.
- **Sources.** PR #2, PR #3, PR #8, PR #9. PR #7 keeps TVL and fees in the title and puts the definition first in the description.

### `/metrics`

- **Copy.** Title: `DeFi Metrics Index - Dashboards by Topic - DefiLlama`. Description, which is also the one-liner: `A directory of DefiLlama dashboards for TVL, fees, revenue, volume, yields, and stablecoins.` H1: `DeFi metrics`, replacing the H2 `Metrics`. This page is a link index, so the sentence does not carry a dated statistic.
- **File.** `src/pages/metrics.tsx` (title and description). `src/components/Metrics.tsx` (H1, the page heading, not the dialog header).
- **Missed clicks.** Unestimated. One day (12 Oct) was 25, and the 28-day page total is 302. The query mix was never split, and the position-and-CTR shape matches the brand-typo page, so neither number is a non-brand estimate.
- **Sources.** PR #4, PR #5. PR #7 leaves the figure unestimated.

### `/categories`

- **Copy.** Title stays `Protocol Categories - DeFi TVL & Revenue Sectors - DefiLlama`. H1: `Protocol categories by TVL and revenue`, replacing `TVL by category`. One-liner: `DeFi categories are groups of protocols that do the same job. On {date} {leader} led with {tvl}, then {second} at {tvl2} and {third} at {tvl3}.` On 14 Oct 2026 that was bridges at $58.7b, liquid staking at $56.8b, and lending at $53.1b.
- **File.** `src/pages/categories.tsx` (title, unchanged). `src/containers/ProtocolTaxonomy/CategoriesPage.tsx` (H1 and one-liner).
- **Missed clicks.** 0. The attached page-row figure of 2,973, the 90 on 12 Oct, and the 2,394 desktop-plus-mobile total are brand typos (`defillama`, `defilama`, `defilamma`) at position about 1 while the click goes to the homepage.
- **Sources.** PR #2, PR #4, PR #5, PR #8. PR #7 changes the H1 and counts 0.

### `/rwa`

- **Copy.** Title: `Top Real World Assets (RWA) by Onchain Value - DefiLlama`. H1: `Top real world assets by onchain value`. Active AUM stays the stat. One-liner: `Real world assets ranked by onchain value. On {date} total active AUM is {aum}.`
- **File.** `src/containers/RWA/layout/pageCopy.ts` (`getRwaPageMeta` overview, `getRwaPageHeadline` overview). `src/pages/rwa/index.tsx` already renders both.
- **Missed clicks.** 12. `rwa` is 11.6 and `rwa crypto list` is 0.2. The 188 page-level figure mixes every query on the URL.
- **Sources.** PR #1, PR #4. PR #7 changes the title and the H1 together and sizes the fix at the head terms.

### `/perps`

- **Copy.** Title: `Top Perpetual DEXs by Volume - DefiLlama`. H1 stays `Perp Volume (24h)`, the stat label that already ranks for `perp dex volume`. One-liner: `A perpetual DEX lists perpetual futures markets. On {date} {leader} led 24h volume at {amount}.` On 14 Oct 2026 Hyperliquid was the first row and the 24h total was $22.5b. On `/perps/chains`, add the H1 `Perp volume by chain`. The title there is already `Perp DEX Volume by Chain - DefiLlama`.
- **File.** `src/pages/perps/index.tsx`. The shared lead, if the all-chains summary grows one sentence: `src/containers/AdapterMetrics/AdapterByChain.tsx`. The chains H1: `src/containers/AdapterMetrics/ChainsByAdapter.tsx`, title in `src/pages/perps/chains.tsx`.
- **Missed clicks.** 8, the query `perp dex list` (8.3). `perp dex volume` is already 0. The chains URL adds 8 on that same volume query, where it ranks beside the hub.
- **Sources.** PR #1, PR #2, PR #9. PR #7 adds the list phrase to the title and leaves the volume wording in place.

### `/unlocks`

- **Copy.** Index title stays `Token Unlocks & Vesting Schedules - DefiLlama`. Index H1: `Token unlocks`, replacing `Unlock statistics`. One-liner: `Token unlocks are the scheduled release of vested tokens. On {date} upcoming unlocks over the next 7 days total {amount}.` On 14 Oct 2026 that 7-day figure was $228.87m. Protocol pages, title: `` `${displayName}${symbol ? ` (${symbol})` : ''} Unlock Schedule & Circulating Supply` ``. Celestia renders as `Celestia (TIA) Unlock Schedule & Circulating Supply`. Description: `` `See ${displayName}${symbol ? ` (${symbol})` : ''} unlock cliffs, circulating supply, and the next unlock date on one vesting chart.` ``. One-liner on the protocol page: `The next {symbol} unlock is {date}, releasing {amount} {symbol}.`
- **File.** `src/pages/unlocks/index.tsx` (H1). `src/pages/unlocks/[protocol].tsx` (title, description, and one-liner).
- **Missed clicks.** 4 on the index, the head rows that miss the 3% bar. `token unlocks` itself is already 0. The protocol-page title is about 70: missed@3% on Celestia and the two Quai queries is 220, and the figure used is 1% of those impressions because the overview already states the schedule. The page-level 81.5 on `/unlocks` mixes protocol-specific queries and is not the index H1.
- **Sources.** PR #1 and PR #9 for the index H1. PR #3 and PR #8 for the protocol-page title and the next-unlock sentence. PR #7 sizes the protocol pages at about 70 and the index at 4.

### `/dexs`

- **Copy.** Title stays `DEX Volume Rankings - Trading Activity - DefiLlama`. H1: `Top DEX volume (24h)`, with the 24h total beside it. One-liner: `On {date} {leader} led DEX volume at {amount}, ahead of {second} and {third}.` On 14 Oct 2026 the total was $7.662b and the first window linked Uniswap, PancakeSwap, and Aerodrome.
- **File.** `src/containers/AdapterMetrics/AdapterByChain.tsx`, the `labelAs="h1"` stat when `props.type === 'DEX Volume'` and the chain is All. Title in `src/pages/dexs/index.tsx`, unchanged.
- **Missed clicks.** 7, the query `top dex` (245 impressions, 0 clicks, position 6.47).
- **Sources.** PR #9.

## B. Protocol template

One definition sentence in three places on `/protocol/{slug}`. The metric title stays, with TVL first. Do not hardcode a Vest or Axiom sentence in `queries.tsx`. The stored description is the sentence, and this repo already renders it in Protocol Information.

- **Copy.** Under the H1, one paragraph: `protocolData.description`, only when it is non-empty. Empty renders nothing, and the hero number stays. Stored examples, forwarded as they are: `Aave is an Open Source and Non-Custodial protocol to earn interest on deposits and borrow assets.` and `Vest Exchange is a next generation Perps DEX that ensures the most capital efficient liquidity, and fairest pricing for traders and LPs.` Meta description, capped at 155 characters: the first sentence of that description, whitespace collapsed, cut at the last word that fits inside 120 characters when the sentence is longer, then one metric clause when it fits (` TVL is {compact}.`, or ` 30-day volume is {compact}.`, or ` Fees were {compact} in the last 30 days.`). Aave renders as `Aave is an Open Source and Non-Custodial protocol to earn interest on deposits and borrow assets. TVL is $18.6b.` When the description is empty, keep `Track ${name} on DefiLlama…`. FAQ order, with the first five left open: (1) `What is {name}?` answered with that description, (2) TVL, (3) fees and revenue, (4) the single metric question (DEX volume, perp volume, active loans, open interest, or yields), (5) comparison, (6) chains, (7) token valuation, (8) token performance, (9) treasury, (10) security. Title stays `` `${name} ${titleMetricSegment}` ``.
- **File.** `src/containers/ProtocolOverview/index.tsx` (`ProtocolHeader`, the paragraph between the title row and `HeroMetric`). `src/containers/ProtocolOverview/queries.tsx` (meta description; the title assignment stays). `src/containers/ProtocolOverview/faq.ts` (`buildProtocolFaq`, which needs the description on its context). `src/containers/ProtocolOverview/ProtocolFaq.tsx` renders that list.
- **Missed clicks.** 300–500 on non-brand, non-name queries, the part the snippet controls. The 3% name-query pool is a different set: the raw missed@3% on the eight named queries is 2,040, and the synthesis caps that pool at about 170 because the official site keeps the click. That 170 is not added to the 300–500. The template’s 29,093 page-level missed clicks are mostly bare names.
- **Sources.** PR #6 for the sentence, the meta formula, the FAQ order, and the 300–500. PR #3 for the description and the first FAQ. PR #1 and PR #4 exclude bare names. PR #7 caps the name-query math at about 170 and keeps the metric title. PR #8 confirms the first visible sentence is the product description.

## C. Yields HTML and the sitemap

### Render the pool table on the server

- **Copy.** No second sentence. The H1 and the yield-farming line are the `/yields` entry in workstream A. `/yields/stablecoins` uses the same empty body; its H1 is `Best stablecoin yields`, matching the title `Best Stablecoin Yields - USDC, USDT & DAI APY Rankings - DefiLlama`.
- **File.** `src/containers/Yields/useYieldsServerTable.ts` (the `enabled` gate that drops the seed). `src/containers/Yields/useStickyQueryReplace.ts` (it returns false for the whole server render). `src/containers/Yields/views/EarnView.tsx` (passes that flag as `enabled`). `src/pages/yields/stablecoins.tsx` (H1).
- **Missed clicks.** About 940 on the yields hub, extrapolated from a 7-day template missed of 288. High confidence that the rows are missing from the server HTML. Low confidence on the 28-day stretch. The 12 yield-farming clicks are inside this 940. `/yields/stablecoins` adds 4 on `stablecoin yield`.
- **Sources.** PR #4, PR #2, PR #8, PR #9. PR #7 computes the 940.

### Sitemap

- **Copy.** No user-facing copy. Emit the indexable canonical only. Drop noindex protocol tabs (`protocol/tvl`, `protocol/fees`, `protocol/dexs`, `protocol/perps`, `protocol/yields`, and the other tabs `getProtocolLayoutSeo` marks `noIndex`). Keep `/unlocks/{slug}` and `/forks/{slug}` in place of the tab aliases. Add `/protocol/active-loans/{slug}` where `metadata.borrowed` is set. Add `/yields/pool/{id}` for ids `getEarnPage` already loads, and leave out ids that 404. `790dea85-6c21-55d6-89f8-810be03209b0` is a 404 with 2,463 impressions and stays out. The noindex rule on the tab pages stays.
- **File.** `src/containers/ProtocolOverview/server/routes.ts` (`getProtocolSitemapRoutes`). `src/containers/ProtocolOverview/layoutSeo.ts`. `src/server/routeRegistry/sitemap.ts` (`SITEMAP_SECTION_IDS` has no yields section). `src/server/routeRegistry/__tests__/sitemap.test.ts` (it expects `protocol/fees/aave`). `src/containers/Yields/data/earn.server.ts` (`getEarnPage`).
- **Missed clicks.** 0 for removing the noindex tabs. The protocol template’s 1,363 missed clicks on 12 Oct are navigational names and are not counted again. Yield-pool URLs are 353 (703 URLs, position 7.59); the largest of those is the navigational 404 above and is not a page to submit. Active-loans URLs are 81 (91 pages, 3,083 impressions).
- **Sources.** PR #4, PR #9. PR #7 sizes the noindex-tab removal at 0.
