# Market data

This directory owns the shared markets-server contracts and snapshot infrastructure used by token,
token-watchlist, CEX, and exchange surfaces. It no longer owns a standalone `/markets` page.

## Retained consumers

- `/token/[token]` and the token watchlist use `api.types.ts`, `segments.ts`, `marketMetrics.tsx`,
  `utils.ts`, and `/api/public/markets/[token]`.
- `/tokens` and the token watchlist use the token-list snapshot and `/api/public/markets/tokens`.
- CEX redirects and exchange sitemap routes use the exchange-directory snapshot and its derived
  CEX-slug index.

The category and exchange APIs that existed only for the retired `/markets` page are intentionally
not part of this retained contract.
