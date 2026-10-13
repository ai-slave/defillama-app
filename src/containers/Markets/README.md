# Market data

This directory owns the shared markets-server contracts and snapshot infrastructure used by token, token-watchlist, CEX and exchange surfaces. It owns no page of its own.

## Consumers

- `/token/[token]` and the token watchlist use `api.types.ts`, `segments.ts`, `marketMetrics.tsx`, `utils.ts` and `/api/public/markets/[token]`. The route parameter is a CoinGecko ID; callers with no ID do not request market data, and there is no symbol fallback.
- `/tokens` reads the CoinGecko-ID-keyed token summaries (`token-summaries.json`, built from `exchange-listings.json`). Symbols are never a join key there: CoinGecko repeats symbols such as BTC and ETH across many IDs.
- The token watchlist uses the symbol-keyed `/api/public/markets/tokens`.
- `/exchanges/tokens` uses the single `/api/public/markets/exchange-listings` index for canonical CoinGecko token selection and venue and segment matching.
- CEX redirects and exchange sitemap routes use the exchange-directory snapshot and its derived CEX-slug index.
- `/cexs` reads the REAL rank behind the tier badge, spot and USD perp volume, USD perp OI and the combined 7-day volume from the same CEX-slug index, so the page never loads the full directory. A CEX with no mapped venue shows no market figures; CoinGecko volume is never mixed in.
