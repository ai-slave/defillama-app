# DefiLlama app

The Next.js frontend for [defillama.com](https://defillama.com), plus the investors and enterprise dashboard sites built from the same code. Its data comes from the backends listed under [Where the data comes from](#where-the-data-comes-from).

## Local setup

#### 1. Clone the repository:

```bash
git clone https://github.com/DefiLlama/defillama-app.git
cd defillama-app
```

#### 2. Install dependencies:

```bash
bun install
```

#### 3. Configure environment variables:

```bash
cp .env.local.example .env.local
```

Fill in `API_KEY` and `CG_KEY` from your team credentials. `API_KEY` routes DefiLlama upstreams through pro-api; without it, most no-key fallbacks in `src/constants/index.ts` are invalid or rate-limited (aside from `api.llama.fi` and `coins.llama.fi`). `CG_KEY` avoids CoinGecko free-tier rate limits on token charts, unlocks, and related pages.

For the **main site**, leave `NEXT_PUBLIC_INVESTORS_SITE` unset. For **investors / enterprise dashboard** work locally, see the view-selection comments in `.env.local.example`. Production deploy variables for all four profiles (main, investors, staging, enterprise) are in `.env.example`.

#### 4. Start the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `bun run dev` starts plain Next.js development.
- `bun run dev:prepared` refreshes local generated data before starting Next.js development.
- `bun run build` refreshes generated metadata, dataset caches, site navigation, `public/llms.txt`, and `public/robots.txt`, then runs the Next.js production build on the Bun runtime. Vercel builds pass `--webpack`; Coolify builds use Turbopack.
- `bun run build:next` runs plain `next build` without refreshing generated data.
- `bun run build:deploy` runs the self-hosted deploy wrapper, including build logs, artifact sync, and notifications.
- `bun run start` starts a standard Next.js production server.
- `bun run start:docker` runs the Docker/self-hosted entrypoint, including the post-start hook.

## Deployment

defillama.com sits behind Cloudflare and the [DefiLlama/defillama-app-lb](https://github.com/DefiLlama/defillama-app-lb) load balancer. Its `nginx.conf` routes each request to the self-hosted Coolify origins first, which build with `bun run build:deploy` (Turbopack). When an origin is slow or fails, the balancer serves a stale cached copy, then falls back to the Vercel deployment (webpack). A page that looks different from another, or a build-only bug, can come from either platform.

### Vercel

Use the Next.js framework preset and leave Build Command, Output Directory, Install Command, and Development Command overrides disabled. Vercel should run the package build script; do not override the Build Command to `next build`, because that skips metadata cache, dataset cache, site navigation, llms.txt, and robots.txt generation.

Set the required Vercel environment variables from `.env.example`. For production indexing, set `ROBOTS_ALLOW_INDEXING=true` only in the Production environment.

`vercel.json` sets `bunVersion` so Vercel Functions run on the Bun runtime; Vercel manages the patch version. Because the app uses ISR, the `build` and `dev` scripts run through `bun run --bun`, as the Bun runtime docs require.

Do not set `NODE_OPTIONS` on Vercel for this project. Static generation memory is bounded in `next.config.ts`, and Node flags are ignored by the Bun runtime.

## Where the data comes from

When a number is wrong, the bug is usually in the repo that serves or produces it. Upstream URLs live in `src/constants/index.ts`. Each one resolves in this order: a server-only direct URL from its env var (`src/utils/directApi.ts`), then `PRO_API_BASE_URL` (`pro-api.llama.fi/<API_KEY>/<section>`) when `API_KEY` is set, then the public host.

Every hosted deploy sets `API_KEY`, so most server-side fetches go through [DefiLlama/pro-proxy](https://github.com/DefiLlama/pro-proxy). It maps each section to a backend and serves some sections from cached files. Some public defaults, such as `etfs.llama.fi` and `markets.llama.fi`, are placeholders: those sections work only through pro-proxy. Check its mapping and cache first, then the repo below. Read backend code at `origin/HEAD`; a local clone can be behind.

| Data                                                                                           | Constant                                 | Serving repo                            | Produced in                                                                                        |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| TVL, protocols, chains, raises, hacks, emissions, `/overview`                                  | `SERVER_URL`, `V2_SERVER_URL`            | `DefiLlama/defillama-server`            | `DefiLlama/DefiLlama-Adapters` (TVL), `DefiLlama/dimension-adapters` (fees, volume, open interest) |
| RWA and RWA perps                                                                              | `RWA_SERVER_URL`, `RWA_PERPS_SERVER_URL` | `DefiLlama/defillama-server`            |                                                                                                    |
| Datasets bucket (token lists, unlocks, search list) and site search                            | `DATASETS_SERVER_URL`, `SEARCH_API_URL`  | written by `defillama-server`           |                                                                                                    |
| Coin prices and price charts                                                                   | `COINS_SERVER_URL`                       | `DefiLlama/defillama-server` (coins)    |                                                                                                    |
| Stablecoins                                                                                    | `STABLECOINS_SERVER_URL`                 | `DefiLlama/peggedassets-server`         |                                                                                                    |
| Bridges                                                                                        | `BRIDGES_SERVER_URL`                     | `DefiLlama/bridges-server`              |                                                                                                    |
| Yields                                                                                         | `YIELDS_V2_SERVER_URL`                   | `DefiLlama/yield-server-v2`             |                                                                                                    |
| Perp funding in Downloads                                                                      | `YIELDS_SERVER_URL`                      | `DefiLlama/yield-server`                |                                                                                                    |
| Vault and protocol risk                                                                        | `VAULT_RISK_SERVER_URL`                  | `DefiLlama/vault-risk-adapters`         |                                                                                                    |
| Lending risk on token pages                                                                    | `RISK_SERVER_URL`                        | `DefiLlama/llamarisks`                  |                                                                                                    |
| Liquidations                                                                                   | `LIQUIDATIONS_SERVER_URL_V2`             | `DefiLlama/liquidations`                |                                                                                                    |
| Equities                                                                                       | `EQUITIES_SERVER_URL`                    | `DefiLlama/pro-proxy` (cached files)    | `DefiLlama/equity-adapters`                                                                        |
| Pre-IPO                                                                                        | `PRE_IPO_SERVER_URL`                     | `DefiLlama/pro-proxy` (cached files)    | `DefiLlama/pre-ipo-adapters`                                                                       |
| Crypto Cards                                                                                   | `CARDS_SERVER_URL`                       | `DefiLlama/pro-proxy` (cached files)    | `DefiLlama/crypto-cards-server`                                                                    |
| Markets and exchanges                                                                          | `MARKETS_SERVER_URL`                     | `DefiLlama/pro-proxy` (cached files)    | `DefiLlama/orderbook-watch`                                                                        |
| ETFs                                                                                           | `ETF_SERVER_URL`                         | `DefiLlama/pro-proxy`                   | `DefiLlama/etf`                                                                                    |
| Digital asset treasuries                                                                       | `TRADFI_API`                             | `DefiLlama/pro-proxy`                   | `DefiLlama/tradfi`                                                                                 |
| Narrative tracker and FDV categories                                                           | `FDV_SERVER_URL`                         | `DefiLlama/fdv-server`                  |                                                                                                    |
| Icons                                                                                          | `ICONS_CDN`                              | `DefiLlama/icons`                       |                                                                                                    |
| Accounts, auth, subscriptions, dashboards, research, banners, watchlist                        | `AUTH_SERVER`, `FEATURES_SERVER`         | `DefiLlama/features-server`             | card payments: Stripe, handled in features-server; crypto payments: `LlamaPay/payments-server`     |
| Investors and enterprise dashboard data (`src/pages/api/public/<project>/*`)                   | `IR_SERVER_URL`                          | `DefiLlama/ir-server`                   |                                                                                                    |
| LlamaAI                                                                                        | `AI_SERVER`                              | `DefiLlama/llama-ai`                    | `DefiLlama/llama-ai-warehouse`; top-ups: `DefiLlama/llama-ai-x402-payment-service`                 |
| Pro Dashboard server-side tables                                                               | `LLAMA_DB_URL` (Postgres)                | `DefiLlama/llama-ai-warehouse` (schema) |                                                                                                    |
| GitHub sign-in (wallet sign-in uses `AUTH_SERVER` `/nonce` and `/eth-auth` in features-server) | `POCKETBASE_URL`                         | `DefiLlama/pocketbase` (hooks)          |                                                                                                    |
| Banner interests                                                                               | `FEATURES_SERVER`, `src/api/users.ts`    | `DefiLlama/features-server`             | `DefiLlama/user-analytics`                                                                         |
| UTR claim copies                                                                               | `USER_ANALYTICS_URL`                     | `DefiLlama/user-analytics`              |                                                                                                    |
| OG images (Pro dashboards render their own in `src/pages/api/og`)                              | `src/components/SEO/index.tsx`           | `DefiLlama/og-cards`                    |                                                                                                    |
| Server telemetry                                                                               | `OPS_TELEMETRY_URL`                      | `DefiLlama/defillama-ops`               |                                                                                                    |

Analytics events go to a self-hosted Umami instance with no repo; see `docs/analytics.md`.

## License

[GPL-3.0](./LICENSE)
