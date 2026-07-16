# Dataset Snapshot Boundaries

Dataset-backed pages and APIs follow one flow:

```text
network builder -> unpublished writer -> validated immutable version
  -> atomic current pointer -> server snapshot handle
  -> typed data -> pure transform -> page props or API JSON
```

## Module boundaries

- `contract.ts`, `store.ts`, and domain artifact-name modules are pure contracts.
- `fileStore.server.ts` is the local-disk adapter. It is the only runtime module
  that opens snapshot files.
- `refresh.server.ts` owns max-age decisions, single-flight refresh, retry
  backoff, and last-known-good behavior.
- `registry.server.ts` maps domains to builders and freshness policies.
- `publish.server.ts` is the preparation/scheduled-refresh entry point.
- Domain `*.builder.server.ts` modules own network acquisition and write through
  `DatasetSnapshotWriter`. They do not choose storage paths or publish.
- Domain `dataset*.server.ts` modules turn one snapshot
  handle into typed data and compose pure transforms.
- Pages acquire data only inside `getStaticProps` or `getServerSideProps`. API,
  proxy, and other server entry points acquire inside their handlers.
- React components and shared transforms never import snapshot readers, refresh
  code, builders, Node filesystem modules, or store adapters.

This application uses the Pages Router, where Next.js rejects the App Router's
`server-only` marker in page dependency graphs. Pages therefore dynamically
import snapshot readers only inside `getStaticProps` or `getServerSideProps`;
Next.js excludes those data-function imports from browser bundles. API routes
perform the same imports inside their handlers. Source boundary tests reject
static imports or imports outside those entry points, and builders, publishers,
and storage adapters remain importable by ordinary Bun/Node preparation
commands. Mixed client/server helper modules are prohibited rather than relying
on tree shaking to repair them.

## Failure invariants

1. A current pointer always names one complete, validated domain generation.
2. Artifacts are never modified after publication.
3. Failed candidates never replace or delete the last good snapshot.
4. Related reads use one handle, so a response cannot mix generations.
5. Missing optional indexes may use their documented full-artifact path;
   required artifacts never silently fall back to an upstream API.
6. Missing initial data plus refresh failure is a hard error.
7. Successful maintenance retains the current and immediately previous
   generation. Cleanup failure never rolls back a published pointer.

## Deployment and browser exposure

`outputFileTracingIncludes` assigns each server route only the snapshot domains
it can read. The union is copied into Next's standalone **server** output; it is
not copied into `_next/static` or made publicly addressable. Only selected page
props and API response data are sent to browsers.

`bun run verify:dataset-snapshot-build` is a post-build CI guard. It rejects
snapshot implementation markers in `.next/static`, verifies prepared snapshots
were traced into standalone output, and rejects `public/.cache`.

The source import-boundary and Pages Router compatibility tests run without a
build. The post-build guard closes their main blind spot: bundler behavior and
the actual generated artifact layout.
