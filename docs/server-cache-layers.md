# Server Cache Layers

The app has four independent server-side cache layers. Their names describe
what they retain; none is a generic `cache` fallback.

| Layer                      | Owner                                                | Lifetime                                          | Freshness                                                                       | Failure behavior                                                                         |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Dataset snapshots          | `src/server/datasetSnapshots`                        | Durable across requests and restarts              | Hourly policy in the domain registry; build, ISR, or server traffic may refresh | A failed candidate never changes `current.json`; the last good version remains available |
| Parsed snapshot artifacts  | One immutable snapshot handle                        | Current Node.js process and snapshot ID           | A new snapshot ID creates a new handle and new parsed references                | A malformed current artifact is an integrity error                                       |
| Derived domain memoization | Domain transform modules, such as Yields row indexes | Current Node.js process and input object identity | New artifact references invalidate naturally                                    | Always recomputable from snapshot artifacts                                              |
| Serialized result cache    | `src/server/api/resultCache.ts`                      | Bounded current Node.js process                   | Route-specific TTL                                                              | Failed computations are not cached; this is never authoritative storage                  |
| HTTP/CDN cache             | Route `Cache-Control` headers                        | CDN-defined                                       | `s-maxage` and `stale-while-revalidate`                                         | Independent of durable snapshot freshness                                                |

## Dataset snapshots

The local store uses this layout:

```text
.cache/dataset-snapshots/
  <domain>/
    current.json
    versions/
      <snapshot-id>/
        manifest.json
        <opaque domain artifacts>
```

Versions are immutable. The store builds and validates a candidate, renames it
under `versions/`, then atomically replaces only `current.json`. A builder or
validation failure leaves the pointer untouched. Previous versions are retained
so active readers and operational rollback are safe; garbage collection is a
separate maintenance concern.

A deliberate format or domain-schema bump makes the old generation ineligible
for reads and triggers publication of a replacement. After the replacement is
current, cleanup removes incompatible versions so output tracing does not ship
obsolete artifacts. Malformed data is still a hard integrity error.

`DatasetSnapshotStore`, `DatasetSnapshotWriter`, and `DatasetSnapshotHandle`
are the adapter boundary. Domain builders write opaque JSON artifacts through a
writer and have no filesystem dependency. A future shared store can implement
the same contract with Redis, R2, Durable Objects, or another object store.

## Runtime refresh

The refresh coordinator checks the current manifest timestamp and coalesces
concurrent stale requests by domain.

- ISR and other blocking server-data paths wait for a refresh. Success returns
  the new generation; failure returns the exact previous generation.
- Public APIs normally return stale data immediately and refresh in the
  background.
- If no snapshot exists, refresh failure throws. There is no empty or network
  fallback pretending to be a valid snapshot.
- A short process-local retry backoff prevents a broken upstream from being
  hammered on every request.

`bun run snapshots:refresh` exposes the same atomic publisher for a scheduler or
protected operational job. It is optional for correctness: an ISR request with
blocking acquisition refreshes stale data before publishing the new page, while
the previous page and previous snapshot remain available on failure.
Preparation and scheduled publication reuse domain snapshots that are still
within their registry max age instead of refetching them.

All artifacts used for one logical response must come from one snapshot handle.
Never reacquire between related reads.

## Yields artifacts and derived data

The Yields generation contains the eight upstream v2 datasets: earn, trends,
borrow markets, borrow routes, loops, token keys, metadata, and depegs. They are
published together; a response never combines an updated artifact with an older
one. Filtering and joins run from the parsed artifacts rather than being stored
as route-specific cache files.

Derived joins and indexes may memoize by artifact object identity. Stable
references within a snapshot avoid repeated work; a new snapshot ID produces new
references and forces recomputation.

## Result and HTTP caches

Use `cachedJsonResult` only for expensive final computations or large direct
upstream proxies. If a result is derived from a snapshot, its key must include
the snapshot ID. Light filtering over parsed snapshot data does not need another
origin cache unless profiling proves otherwise.

CDN caching is the final-response layer. It does not refresh durable snapshots
and does not guarantee that a restarted server has source data.
