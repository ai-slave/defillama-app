# SERP features

Low CTR at a strong average position is mostly a zero-click SERP, not a weak rank. On the top 30 non-brand queries by missed clicks, a US desktop AI Overview was present for 24 of 30, People Also Ask for 17, and a classic featured snippet for none. Official sites take the sitelinks. The sentence Google shows under our URL is often a chain-share FAQ, a token price, or directory boilerplate, so the result does not answer the query the overview just answered.

Missed clicks below use fresh Search Console totals for 15 Sep 2026–12 Oct 2026. Missed@3% = max(0, 0.03 × impressions − clicks). The 30 queries sum to about 3,570 missed clicks. About 600 of those are queries a title change cannot win (person lookups, a three-ticker comparison whose live results are unrelated, position 22). The rest is the title and snippet work below.

## Method

Search Console property `sc-domain:defillama.com`, fetched 14 Oct 2026 via Treg `google-search-console` `webmasters/v3/sites/sc-domain:defillama.com/searchAnalytics/query`. Window is the 28 complete days 15 Sep 2026–12 Oct 2026. 13 Oct was left out: the property had 48,388 impressions that day against roughly 80k–110k on a full day. Each query was requested on its own (`equals`), with `query`, `page`, and `device`. A multi-group OR filter returned zero rows. `dataState` is `all`.

The attached 28-day extract ranks the same queries in the same order. Fresh totals differ slightly (Vest Markets is 17 clicks / 33,605 impressions / position 4.52 here, versus 15 / 30,710 / 4.55 in the extract). Figures in this report are the fresh pull. Bare brand and bare protocol-name queries are excluded. `pons launchpad` stays because of the modifier.

Live SERPs are United States, English, location code 2840, depth 10, `load_async_ai_overview: true`, fetched 14 Oct 2026.

| Call | Endpoint | What it returned | Charged |
| --- | --- | --- | --- |
| 60 | `dataforseo.x.serp-google-organic-live-advanced` | Desktop (`os=windows`) and mobile (`os=android`) for 30 queries. One desktop probe was reused, not fetched twice. | $0.168 |
| 2 | `serper.web.search` | US fallback after DataForSEO returned task 40101 twice: `defi fee structures`, `"ron bodkin" "space and time"` | $0.002 |
| — | `google-search-console` searchAnalytics | Query, page, and device rows. Free. | $0 |

Shared team balance was $10.98 before this work and $9.85 after. Other audits were spending on the same balance. This audit’s own charges sum to **$0.170**. DataForSEO’s catalog price is $0.004 per call; many calls settled at $0.002. Failed 40101 tasks were still billed. No call used search operators that multiply the price, except the quoted Bodkin and River queries, which settled at the normal $0.002–$0.004.

A live US page on one afternoon is not the 28-day average position. Where those disagree, both are reported. DefiLlama was on the parsed first page for 8 of 30 desktop SERPs and 4 of 30 mobile SERPs.

Application code was not changed.

## What the first page actually is

Three patterns cover the queries where we really do rank.

**The overview answers it.** `top defi aggregators` is organic position 1 on desktop and still has 0 clicks on 1,883 impressions (position 1.13, all desktop). The overview lists 1inch, Jupiter, Odos, Velora, and CowSwap and cites eco.com, FoxWallet, and Chainlink. It does not cite DefiLlama. Our snippet is the meta description: “Track DEX aggregator volume and swap routing activity. Compare swap volume across 1inch, CowSwap, OpenOcean, and 100+ DEX aggregators.” That is a dashboard, and it omits Jupiter, the name the overview leads with.

**The official site takes the sitelinks.** `vest markets` (position 4.52, 0.05% CTR, 33,605 impressions) shows vestmarkets.com first, with sitelinks Vest Capital, Markets, About Vest Markets, and Getting Started, titled “Vest Markets | 24/7 Zero-Fee Trading for Equities, Crypto & FX”. We are third. The title Google shows is ours, `Vest Markets TVL, Fees, Revenue & Volume`. The snippet is not our meta description. It is the chains FAQ: “Vest Markets operates on 8 chains: Ethereum, Arbitrum, BSC, OP Mainnet, and Base and 3 others. Ethereum holds the largest share at 56.8%.” `gmx crypto` is the same shape one step further: gmx.io is first with a Trade sitelink and a live price, then CoinMarketCap and CoinGecko. We are not on that first page today. `axiom pro` is third on desktop, under axiompro.app with five sitelinks, and People Also Ask is “Is axiom pro free?” and “Is there a difference between axiom and axiom pro?” The name collides with other products.

**Google quotes the wrong sentence.** Protocol FAQ copy is visible HTML from `ProtocolFaq`, not FAQPage JSON-LD, and Google quotes it anyway.

- Chains, for Vest: `src/containers/ProtocolOverview/faq.ts` `buildChainsQuestion`.
- Price, for Rhea Finance at desktop #4: “RHEA is currently trading at $0.072. Its circulating market capitalization is $29.66m…” from `buildTokenValuationQuestion`.
- Fees, for Axiom Pro: “Axiom Pro generated $37.37m in fees…” from `buildFeesQuestion`. That one is a real stat and still only a 0.04% CTR, because the sitelinks and the name collision sit above it.
- Head term `tvl`: the only DefiLlama URL on the US desktop first page is `https://defillama.com/protocol/volta-finance` at organic #6, snippet “What is Volta Finance's TVL? Volta Finance currently has $4,466 in total value locked.” The question template is `What is ${name}'s TVL?` in `buildTvlQuestion`. Above it: an AI Overview defining TVL, a video pack, People Also Ask (including “What is the TVL amount for a credit card?”), and five definition articles. `/chains`, which holds 8,118 of the query’s 8,577 impressions at position 5.67, is not on that first page.

There were no featured snippets in this sample. AI Overviews have taken that slot. Video packs show for `tvl`, `stonk fun`, `lighter dex`, and `collector crypt`. `lighter dex` positions 1 and 2 are YouTube. An images pack shows for `four meme` and `usdt dominance chart`. Mobile adds an app pack for `lighter dex`, `axiom pro`, and `usdt dominance`.

`vest market` (singular) is a separate ambiguity. Desktop’s overview describes the trading venue. Mobile’s overview describes Vests Market, a shop in Bakersfield, with a knowledge panel and Google reviews. Our URL is mobile #4 with the same chains snippet, and the query still converts at 0.02%.

## Ranked weak spots

GSC numbers are query totals. “Live” is the US SERP on 14 Oct 2026. Missed clicks are query-level, so a second URL on the same query is not added again.

| # | Query | Page Google shows in GSC | GSC | Live US evidence | Missed | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | vest markets; vest market | `/protocol/vest-markets` | 17 clicks, 33,605 impr, 0.05% CTR, pos 4.52. Singular query: 1 / 6,213 / pos 5.23. Both devices. | Desktop #3. Sitelinks on vestmarkets.com. AI Overview does not cite us. Snippet is the chains FAQ. Singular mobile overview is a Bakersfield shop. | 1,176 | Pass the protocol description into the meta description and lead the FAQ with “What is Vest Markets?”. File pair below. Do not hardcode the protocol name. |
| 2 | stonk fun | `/protocol/stonkfun` | 38 / 7,555 / 0.50% / pos 4.89. Mobile-heavy. | Not on the first page. AI Overview, a video pack, People Also Ask (“What is the current price of stonk coin?”). #1 is an X article, “What Is StonkFun?”. | 189 | Same protocol description + what-is FAQ. A metric title will not outrank a video pack; the snippet has to say what StonkFun is when we are on the page. |
| 3 | gmx crypto | `/protocol/gmx` | 0 / 6,151 / pos 7.94. Almost all desktop (5,978). | Not on the first page. AI Overview defines GMX and cites gmx.io. #1 has sitelinks, including a live price. Then CoinMarketCap and CoinGecko. People Also Ask: “What is GMX crypto?”. | 185 | Same template. The click we can win is the data click under the official site, and only when the snippet is volume or fees rather than a chain split. |
| 4 | axiom pro | `/protocol/axiom-pro` | 2 / 5,581 / 0.04% / pos 8.53. | Desktop #3, title “Axiom Pro Fees, Revenue & Volume”, snippet is the fees FAQ ($37.37m). #1 axiompro.app has five sitelinks. Mobile has an AI Overview (it does cite us) plus an app pack. People Also Ask treats “Axiom” and “Axiom Pro” as possibly different products. | 165 | Keep the metric title. The description has to say it is the Solana trading terminal, or the fees sentence keeps losing to the product site. |
| 5 | collector crypt | `/protocol/collector-crypt` | 10 / 5,364 / 0.19% / pos 6.25. | Not on the first page. AI Overview defines the Pokémon-card RWA and links collectorcrypt.com. People Also Ask, video, and on mobile a popular-products pack. | 151 | Same what-is description. |
| 6 | tvl | `/chains` (8,118 impr, pos 5.67, 142 clicks). Homepage: 423 impr, pos 1.85, 0 clicks. | 148 / 8,577 / 1.73% / pos 5.56. Mobile-heavy. | AI Overview + video + People Also Ask, then definition posts. Our only first-page URL is Volta Finance’s TVL FAQ. `/chains` is absent. | 109 | Retitle `/chains` and the homepage so the head term matches a definition. Stop letting every protocol FAQ bid on the bare word TVL with a tiny number. |
| 7 | lighter dex | `/protocol/lighter` | 14 / 3,532 / 0.40% / pos 5.52. | Not on the first page. AI Overview cites lighter.xyz. YouTube holds #1 and #2. Then Token Terminal, a Backpack guide, and a Coinbase price. People Also Ask: “Does Lighter have a token?”. | 92 | Same template. Tutorial and airdrop intent will stay on YouTube. |
| 8 | rhea finance | `/protocol/rhea-finance` | 12 / 3,130 / 0.38% / pos 7.20. | Desktop #4. Snippet is the token-price FAQ, so we look like another price site under rhea.finance, CoinMarketCap, and X. Mobile first page is the app and the docs, not us. AI Overview cites us and still answers without a click. | 82 | Quote the product sentence, not the price. Price seekers already have CoinMarketCap at #2. |
| 9 | celestia tia circulating supply growth and unlock schedule 2023 2024 | `/unlocks/celestia` | 0 / 2,593 / pos 5.59. Desktop only (2,590 of 2,593). | Desktop #5, title “Celestia Token Unlocks & Vesting Schedule”. Snippet is body copy about the 1 billion genesis supply, not our meta description. AI Overview states the 31 Oct 2023 launch and the schedule and does not cite us. Mobile first page is Binance, CoinDesk, and price pages; we are absent. No People Also Ask beyond a price prediction. | 78 | Unlock title template below. The overview already states the schedule, so the title has to offer the chart: ticker, circulating supply, next unlock. |
| 10 | quai token allocation supply unlock schedule; quai network tokenomics vesting schedule distribution | `/unlocks/quai-network` | 0 / 2,410 / pos 4.12 and 0 / 2,338 / pos 6.72. Both desktop only. | Not on the first page. AI Overview answers the allocation. One of the two overviews cites us without showing the organic link. Surrounding organics are unrelated unlock explainers (XAI, io.net, generic vesting posts). | 142 | Same unlock template. Citing us inside the overview without a visible link is why clicks stay at zero even at a position-4 average. |
| 11 | top defi aggregators; what are defi aggregators; what are dex aggregators | `/dex-aggregators`. `top defi aggregators` also shows `swap.defillama.com` (1,590 impr, pos 5.8, 0 clicks) on the same query. | 0 / 1,883 / pos 1.13; 0 / 1,429 / pos 3.63; 0 / 1,450 / pos 3.82. All three are desktop. | `top defi aggregators`: desktop organic #1, our title and meta shown verbatim, AI Overview above, no sitelinks. Mobile (negligible impressions) shows “Ethereum DEX Aggregator Volume” at #3 instead of the main rankings URL. `what are defi aggregators`: desktop #3 with the volume snippet; the overview defines a DeFi aggregator and does cite us. `what are dex aggregators`: overview plus People Also Ask, and we are not on the first page today despite the position-3.8 average. | 143 | Replace the rankings title and description. Exact strings below. `swap.defillama.com` (“DeFi Meta-DEX Aggregator: Best Swap Rates”) is a second URL on the list query and is not titled in this repo. |
| 12 | usdt dominance chart; usdt dominance | `/stablecoins` | 2 / 1,976 / 0.10% / pos 6.67 (mobile 1,714) and 4 / 1,617 / 0.25% / pos 7.31 (mobile 1,509). | Not on the first page. AI Overview sends “USDT dominance chart” to TradingView’s USDT.D and quotes ~6.64% of total crypto market cap. People Also Ask asks for the USDT.D vs BTC chart. Mobile adds an app pack. Our page’s dominance mode is share of the stablecoin market, which is a different series. | 102 | Retitle only to the chart we actually have. Do not claim USDT.D. Most of these clicks belong to TradingView. |
| 13 | near intents; four meme; optimism foundation; predict fun; pons launchpad | `/protocol/near-intents`, `/protocol/four.meme`, `/protocol/optimism-foundation`, `/protocol/predict-fun`, `/protocol/pons` | Positions 5.4–8.6. Predict Fun is the best snippet in the set (“Predict is a BNB-based prediction market…”) and still 0.35% CTR. Pons is 1.12% CTR (40 clicks), the least bad brand-like query. Optimism Foundation is 0 clicks, desktop only, and not on the live first page. | Each live page has an AI Overview that defines the project and cites the official site. Predict Fun is desktop and mobile #3. The others are absent from the first page today. Four.meme has an images pack. Optimism’s overview defines the Cayman foundation; our URL is a protocol stats page. | 301 combined | One description template, not five hardcoded titles. Predict Fun shows the ceiling: a definition snippet under an overview still converts well under 1%. |
| 14 | defi lending and borrowing protocols explained | `/protocols/lending` | 0 / 1,365 / pos 6.93. Desktop only. | Desktop #3. Title “DeFi Lending Protocols - TVL, Fees, & Revenue”. Snippet is the meta description: “Compare 591 Lending protocols across all chains. Rank DefiLlama's directory by TVL, fees, revenue, volume, chains, and more.” AI Overview defines lending via Chainlink. #1 and #2 are explainers. People Also Ask: “What is DeFi lending and how does it work?”. | 41 | The category definition already exists and is thrown away because the rankings sentence fills the 155-character cap. Put the definition first. |
| 15 | defi fee structures | `/fees` (889 impr, pos 4.1). `/fees/chains` is position 9.7. | 0 / 1,126 / pos 5.21. Desktop only. | DataForSEO returned 40101 on both devices, twice for desktop. Serper US results have no answer box. #3 is a DL News explainer whose snippet mentions DefiLlama. #9 is “DeFi Fee Structures Explained: Protocol, LP, and Gas Fees”. `/fees` is not on that first page. People Also Ask drifts to bitcoin transaction fees and hedge-fund “2 and 20”. | 34 | The rankings title does not contain “fee structure” or say what a fee is. Exact strings below. Ambiguous non-DeFi readings will remain. |

## Exact replacements

Google is already showing the title tag, with ` - DefiLlama` stripped when the site name is shown separately. Proposed titles keep each file’s current habit of including or omitting that suffix. Lengths below are the full string that goes in the file.

### `/dex-aggregators` — `src/pages/dex-aggregators/index.tsx`

Current title: `DEX Aggregator Rankings - Swap Routing Analytics - DefiLlama`

Current description: `Track DEX aggregator volume and swap routing activity. Compare swap volume across 1inch, CowSwap, OpenOcean, and 100+ DEX aggregators. Real-time swap routing analytics with best price execution data.`

Replacement title (57 characters):

`Top DEX Aggregators: 1inch, Jupiter & CowSwap - DefiLlama`

Replacement description (116):

`A DEX aggregator routes swaps across exchanges for a better price. Rank 1inch, Jupiter, CowSwap, and 100+ by volume.`

The first sentence is the definition `what are dex aggregators` is asking for. The names are the list `top defi aggregators` is asking for, including Jupiter, which the current sentence skips. The chain route `src/pages/dex-aggregators/chain/[chain].tsx` titles itself `${chain} DEX Aggregator Volume - DefiLlama`, which is the mobile #3 result “Ethereum DEX Aggregator Volume”. Impressions for these three queries are desktop, so that file is secondary. If it is edited, use `${chain} Top DEX Aggregators by Volume - DefiLlama`.

`Yield Aggregator` in `src/containers/ProtocolTaxonomy/constants.tsx` already has `seoBaseTitle: 'Top DeFi Yield Aggregators - TVL, Fees, & Revenue'`. Leave it. The query split is DEX versus yield, and the volume page is the one at position 1.

### `/chains` and the homepage — the word TVL

`src/pages/chains.tsx`

Current title: `Chain Rankings by TVL - DeFi Analytics - DefiLlama`

Current description: `Compare 500+ blockchains by Total Value Locked (TVL), fees, and DeFi activity. Track chain rankings, protocol counts, and cross-chain analytics. Real-time layer-1 and layer-2 blockchain metrics.`

Replacement title (45):

`Total Value Locked (TVL) by Chain - DefiLlama`

Replacement description (104):

`TVL is the dollar value locked in DeFi. Compare total value locked on Ethereum, Solana, and 500+ chains.`

`src/pages/index.tsx`

Current title: `DefiLlama - DeFi Dashboard & Crypto Analytics`

The homepage description already starts with “Track Total Value Locked (TVL)…”. Keep it. The title is what shows when this URL sits at position ~1.8 and collects 423 impressions and 0 clicks. Brand stays first so `defillama` still matches.

Replacement title (45):

`DefiLlama - DeFi TVL, Fees & Volume Dashboard`

`src/containers/ProtocolOverview/faq.ts`, `buildTvlQuestion`: the question `What is ${name}'s TVL?` is why Volta Finance occupies the `tvl` result. Keep the question on protocol pages. Do not add a second page that answers the bare head term with a $4,466 balance. The `/chains` title above is what should match that query.

### Lending — `src/containers/ProtocolTaxonomy/constants.tsx` and `src/pages/protocols/[category].tsx`

`[category].tsx` sets the title from `getProtocolCategoryPresentation`. Lending’s `seoBaseTitle` is `DeFi Lending Protocols - TVL, Fees, & Revenue`. Lending’s `description` is `Protocols that allow users to borrow and lend assets`. The presenter only appends that sentence when the whole meta description is still ≤155 characters. The rankings sentence already uses the budget, so the definition never ships. The live snippet is the rankings sentence alone.

Replacement `seoBaseTitle` (44):

`DeFi Lending & Borrowing Protocols Explained`

Replacement description, with the live protocol count filled in by the presenter (98 characters at 591 protocols):

`Lending protocols let users borrow and lend assets. Compare ${protocolCount} of them by TVL, borrows, and fees.`

Put `config.description` first in `getProtocolCategoryPresentation` when it exists, and keep the rankings clause short enough that the definition survives the 155-character cap. That one change covers the next “explained” query, not only lending.

### Fees — `src/pages/fees/index.tsx`

Current title: `Protocol Fees Rankings - Fees Generated - DefiLlama`

Current description: `Track total fees generated by DeFi protocols from users. Compare trading fees, swap fees, and lending fees across Uniswap, Lido, Aave, and 1000+ protocols. Real-time fee generation analytics across all chains.`

Replacement title (62):

`DeFi Fee Structures: Swap, Lending & Protocol Fees - DefiLlama`

Replacement description (135):

`DeFi fees are what users pay to swap, borrow, or bridge. Compare swap fees, lending fees, and protocol revenue across 1,000+ protocols.`

The visible title, once the brand suffix is stripped, is 50 characters and contains the query.

### Unlocks — `src/pages/unlocks/[protocol].tsx`

Current title: `` `${displayName} Token Unlocks & Vesting Schedule` ``

Current description: `` `View ${displayName}${symbol} token unlock schedule, vesting charts, and cliff events. Track upcoming emissions on DefiLlama.` ``

Google’s Celestia snippet is page body (“1 billion TIA supply at genesis…”), not this meta description. The title omits the ticker and “circulating supply”, which is what the query repeats.

Replacement title:

`` `${displayName}${resolvedTokenSymbol ? ` (${resolvedTokenSymbol})` : ''} Unlock Schedule & Circulating Supply` ``

Replacement description:

`` `See ${displayName}${resolvedTokenSymbol ? ` (${resolvedTokenSymbol})` : ''} unlock cliffs, circulating supply, and the next unlock date on one vesting chart.` ``

Celestia renders as `Celestia (TIA) Unlock Schedule & Circulating Supply` (51) and a 100-character description. Quai renders as `Quai Network (QUAI) Unlock Schedule & Circulating Supply` when the symbol is present (56).

### Stablecoins — `src/pages/stablecoins.tsx`

Current title: `Stablecoin Market Cap Chart, Supply & Peg Data - DefiLlama`

The page has a dominance series. It is each stablecoin’s share of stablecoin market cap (`src/containers/Stablecoins/chartSeries.ts`), not TradingView’s USDT.D. A title that says “USDT dominance chart” without that distinction will win a click and bounce.

Replacement title (56):

`Stablecoin Dominance Chart: USDT, USDC & DAI - DefiLlama`

Replacement description (92):

`USDT, USDC, and DAI share of the stablecoin market, plus market cap, supply, and peg charts.`

### Protocol pages — one template, not one title per protocol

`src/containers/ProtocolOverview/queries.tsx` builds both strings. The title at line 871 is `` `${name} ${titleMetricSegment}` ``, which is the title Google shows (`Vest Markets TVL, Fees, Revenue & Volume`, `Axiom Pro Fees, Revenue & Volume`). Keep it. It tells a data seeker what the page is, and replacing it with more keywords does not move the official site’s sitelinks.

The meta description at line 829 ignores `protocolData.description` (already loaded, and stored on the page as `description`) and ships `Track ${name} on DefiLlama. Including ${chart list}`. Google ignores that boilerplate and quotes a FAQ answer that happens to start with the protocol name.

Replacement description: `protocolData.description`, whitespace-collapsed, cut at 155 characters when it is non-empty. Keep the current sentence only as the fallback when the protocol has no description.

Replacement FAQ, first item in `buildProtocolFaq` in `src/containers/ProtocolOverview/faq.ts`, only when that description is non-empty:

- Question: `What is ${name}?`
- Answer: the same description string.

`ProtocolFaqContext` does not carry the description today, so the builder needs it. The rendered FAQ stays in `src/containers/ProtocolOverview/ProtocolFaq.tsx`. No new FAQPage schema is required. Google is already quoting the visible answer.

The description has to be the product sentence, not a chain list and not a price. For the two queries where the snippet is the whole problem, the sentence Google should be able to quote is:

- Vest Markets: `Vest Markets is a perpetual exchange for equities, crypto, and FX.`
- Axiom Pro: `Axiom Pro is a Solana trading terminal.`

Those sentences belong in the protocol’s description, which this frontend should pass through. They should not be hardcoded in `queries.tsx`. If the stored description is empty or is itself the chains sentence, the what-is FAQ will not fix the snippet until the description is edited at its source.

Rhea Finance should not lead with “RHEA is currently trading at $0.072.” That answer can stay as a later FAQ. It should not be the passage that starts with the name.

## Not a title fix

These sit in the top 30 by the formula and should not be rewritten.

| Query | GSC | Why a new title does not get the click | Missed |
| --- | --- | --- | --- |
| `"ron bodkin" "space and time"` and the `phone fax` variant | 0 clicks, 7,469 and 5,237 impressions, positions 6.17 and 6.94, desktop only. Page: `/research/interview/theoriq-ceo-on-the-agentic-economy-and-the-future-of-autonomous-defi` | Serper US (DataForSEO failed twice) shows X, The Org, Mentibus, and Space and Time. We are #7. The snippet quotes the interview mentioning both names. The `phone fax` variant is the same page. Searchers want a person, not a Theoriq interview. The title is `article.seoTitle` or `article.title`, rendered by `src/containers/Articles/ArticleSeo.tsx` and edited in `src/containers/Articles/editor/ArticleMetaDialog.tsx`. It is not a string in a page file. | 381 |
| `inj vs arb vs tia float elasticity and unlock schedule comparison` | 0 / 2,537 / pos 4.02, desktop only, almost all on `/unlocks/celestia` | The overview compares the three unlock schedules and cites Tokenomist. The organic results under it are unrelated tickers and papers (ATIC, AIT, INV, a medical trial). A Celestia unlock title cannot honestly claim a three-token comparison. | 76 |
| `polymarket dragonfly founders fund general catalyst investors` | 0 / 1,973 / pos 9.20, desktop only, page `/raises/dragonfly-capital` | The overview lists the three funds. The ranking URL is the investor page, titled in `src/pages/raises/[investorName].tsx` as `Crypto Investments by ${investorName} - DefiLlama`. Retitling Dragonfly’s portfolio around one company would be the wrong page. | 59 |
| `uniswap v4` | 0 / 1,354 / pos 22.39, page `/protocol/uniswap-v4` | Not on the first page. The overview cites v4.uniswap.org. Position 22 is a ranking gap, not a snippet gap. | 41 |
| `"river" sparta cryptocurrency` | 0 / 1,270 / pos 10.08, desktop only, page `/protocol/river` | Not on the desktop first page. The overview talks about a different River stablecoin product. The quotes and the Spartan modifier do not match our protocol page. | 38 |

## Desktop and mobile

Impressions for the definition queries (`top defi aggregators`, both “what are” queries, lending, fees, the unlock long-tails, Optimism Foundation, the Bodkin queries) are desktop. Mobile is where `tvl`, `vest markets`, `stonk fun`, `usdt dominance`, and `four meme` actually get seen.

Where both devices returned a page, mobile is harsher: Vest’s plural query is desktop #3 and missing on mobile; Rhea is desktop #4 and missing on mobile; Celestia is desktop #5 and missing on mobile. `top defi aggregators` flips the URL, not just the rank: desktop shows `/dex-aggregators` at #1, mobile shows the Ethereum chain rankings. That query has no mobile impressions in this window, so the desktop title is the one that matters.

`vest market` is the one query where mobile and desktop disagree about the entity. Any description that says “perpetual exchange” gives the mobile shop-query nothing to click, which is the right outcome.

## Limits

Positions are 28-day property averages, all countries. The SERPs are one US snapshot. Several queries with a position-4 to position-8 average were not on the US first page on 14 Oct 2026, so a title change does not create that rank. It changes the click when the URL is shown, and it gives the overview a sentence it can cite.

`defi fee structures` and the Bodkin desktop SERP are Serper, not DataForSEO, because the advanced endpoint returned task 40101. Serper’s payload has no device switch; those two calls are the default US web result. Featured snippets were absent in the DataForSEO items. People Also Ask, sitelinks, video, images, and AI Overviews were not.

Checks: `bun` and `node_modules` are not in this environment. `bun run typecheck`, `bun run test:typecheck`, and `bun run check` were not run. The only change is this report. No browser check; no UI was edited.
