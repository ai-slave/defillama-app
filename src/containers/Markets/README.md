# Market data

This directory owns the shared markets-server contracts and snapshot infrastructure used by token, token-watchlist, CEX and exchange surfaces. It owns no page of its own.

## Consumers

- `/token/[token]` and the token watchlist use `api.types.ts`, `segments.ts`, `marketMetrics.tsx`, `utils.ts` and `/api/public/markets/[token]`. The route parameter is a CoinGecko ID; callers with no ID do not request market data, and there is no symbol fallback.
- `/tokens` and the token watchlist use the token-list snapshot and `/api/public/markets/tokens`.
- `/exchanges/tokens` uses the single `/api/public/markets/exchange-listings` index for canonical CoinGecko token selection and venue and segment matching.
- CEX redirects and exchange sitemap routes use the exchange-directory snapshot and its derived CEX-slug index.
