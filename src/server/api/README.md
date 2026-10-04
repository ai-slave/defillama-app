# Framework-neutral API layer

Shared API route host utilities live here. Domain JSON route definitions use the neutral `ApiRequest`/`ApiResult` model in `types.ts`, live with their owning container under `containers/*/server`, and keep **no Next.js imports**. Files under `src/pages/api/**` are thin adapters:

```ts
import { toNextHandler } from '~/server/api/nextAdapter'
import { rwaAssetBreakdown } from '~/containers/RWA/server/api'

export default toNextHandler(rwaAssetBreakdown)
```

`nextAdapter.ts` is the only Next.js-aware file. Porting to another host (standalone service, TanStack Start) means rewriting it and the thin files, nothing else.

Snapshot stores, the result cache and how they differ: `docs/server-data.md`.

## Conventions

- **Method guard**: declare `methods` (default `['GET']`); the adapter answers 405 otherwise.
- **Cache-Control**: set `cacheControl` on the definition for 2xx responses. The adapter jitters any `s-maxage` per URL to spread CDN expiry (the window is capped at 40% of the value, see `jitterCacheSeconds` in `src/utils/maxAgeForNext.ts`) and sends `no-store` on every non-2xx so transient failures are never cached. A handler can override per-response via `headers`.
- **Errors**: invalid params → `badRequest` (400); upstream failure → `upstreamError` (502, after `recordRouteRuntimeError`); uncaught exceptions become a recorded 500 in the adapter. A public route whose tested contract answers 500 keeps it; comment the exception at the handler.
- **Heavy work**: anything that fans out to several upstream calls or runs multi-second JS aggregation must go through `cachedResult` so concurrent identical requests share one computation and the event loop is protected from repeat work. Key by the full param set, never by a subset. Do not use `cachedResult` for dataset-backed routes that only read artifacts and do light filtering; those reads already use the immutable snapshot handle from `src/server/datasetSnapshots`.
- **Telemetry**: the `route` string is the route's file path under `src/pages` (`/api/...`) so dashboards stay continuous.
- **Streams stay native**: SSE and binary routes (`pro-dashboard/[dashboardId]/stream`, `sonic/burn-stream`, icon proxies) cannot return a single `ApiResult`; they stay plain Next handlers.
