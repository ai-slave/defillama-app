# Server data

Dataset snapshots (files on disk, or Redis blobs for datasets built at runtime) are the only durable server data: a failed upstream never replaces the last good version. Every other layer (parsed artifacts, derived memos, the result cache, in-memory metadata, the CDN) can be recomputed from a snapshot or upstream.

Store internals live in the headers of `src/server/datasetSnapshots/fileStore.server.ts`, `refresh.server.ts` and `redisBlobStore.server.ts`. This page covers where each kind of server data goes.

## Where the data goes

| To do this                                    | Use                                                                                                                                                                                                                      | Example                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Serve a large upstream dataset with a max age | A snapshot domain: its files in `contract.ts`, a builder and `maxAgeMs` in `registry.server.ts`, its routes in `traceIncludes.ts`, and `dataset.builder.server.ts` plus `dataset.server.ts` in the container's `server/` | `src/containers/Raises/server/`                                             |
| Read several artifacts for one response       | One handle from `acquireDatasetSnapshot`, passed through every transform                                                                                                                                                 | `acquireYieldsSnapshot` in `src/containers/Yields/server/dataset.server.ts` |
| Serve page data                               | `'blocking'`: a snapshot past its max age refreshes before the page renders                                                                                                                                              | `src/pages/yields/borrow.tsx`                                               |
| Answer an API without waiting for a refresh   | `'background'`: answer from the stale snapshot while it refreshes                                                                                                                                                        | `src/containers/Yields/server/api.ts`                                       |
| Filter or join snapshot data                  | A pure transform memoized on artifact identity (`WeakMap`), with no result cache                                                                                                                                         | `src/containers/Yields/data/snapshot.ts`                                    |
| Build a dataset at runtime per key            | `createRedisBlobStore` with `contentHashVersion`                                                                                                                                                                         | `src/containers/ProtocolRankings/server/tableData.server.ts`                |
| Cache an expensive fan-out computation        | `cachedResult` or `cachedJsonResult` from `src/server/api/resultCache.ts`, keyed by every param and the snapshot version                                                                                                 | `src/server/tablePages/preparedRows.server.ts`                              |
| Serve a table too big for page props          | `src/server/tablePages/README.md`                                                                                                                                                                                        | `src/containers/ProtocolRankings/server/api.ts`                             |
| Read app-wide lookup metadata                 | `src/utils/metadata`: boot artifacts in `.cache/app-metadata` (`manifest.json` status `ready` or `stub`), refreshed in memory at runtime                                                                                 | `metadataCache.chainMetadata` in `src/containers/Forks/queries.tsx`         |
| Set CDN freshness for an API                  | `cacheControl` on `defineApiRoute`                                                                                                                                                                                       | `src/server/api/README.md`                                                  |

## Checks

- Read every artifact for one response from one handle. Each export in a container's `server/dataset*.server.ts` acquires once and reads every artifact it needs; a response that needs several artifacts calls one export that reads them all, never two exports that each acquire.
- The refresh mode is a required argument to `acquireDatasetSnapshot`.
- A failed refresh serves the last good snapshot. A missing first snapshot plus a failed refresh throws.
- Required artifacts never fall back to an upstream API.
- Each publish keeps the current and previous version and prunes the rest.
- A result cache key for snapshot-derived data includes the snapshot version.
- The CDN caches final responses only. It never refreshes a snapshot.
- Local disk is per replica: each server refreshes its own `.cache/dataset-snapshots`.
- A failed metadata pull writes empty stubs only when `NODE_ENV` is `development` (`src/utils/metadata/policy.ts`). Everywhere else, CI included, it fails the preparation step.
- A failed runtime metadata refresh keeps the current in-memory cache.
- `.oxlintrc.json` rejects imports of `.cache/app-metadata`; read metadata through `~/utils/metadata`.
- Client code never imports snapshot readers, builders, refresh code or stores. `importBoundary.test.ts` allows snapshot imports outside `server/` only as dynamic imports inside page data functions and API handlers. `routeBoundary.test.ts` allows snapshot acquisition only in a container's `server/dataset*.server.ts`. `traceIncludes.test.ts` fails when a route reads a domain it does not trace.
- `scripts/verifyDatasetSnapshotBoundaries.ts` runs at the end of `bun run build`. It fails when snapshot code reaches `.next/static`, when snapshots miss the standalone server output, or when they land under `public/`. `bun run build:deploy` and CI do not run it.
