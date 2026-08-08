# tablePages

Shared mechanism for server-paginated tables. Product code lives in
`src/containers/<Surface>/`; nothing in this directory may know what a
protocol, pool, or token is. If a product name appears here, the extraction
has failed. There is deliberately no `index.ts` — import each module directly
so a grep for any symbol returns exactly one definition site. Design record
and change policy: `docs/adr/0005-table-delivery-tiers.md`.

## The delivery-tier decision rule

Pick the cheapest tier that satisfies the surface. Promotion is triggered by
measurement, never by consistency with other tables.

1. **local** — the whole dataset fits in page props (< ~300 KB serialized).
   Ship all rows, filter/sort client-side, render virtualized. None of these
   modules are involved. Most tables in this repo are — correctly — here.
2. **offset** — too big to ship; the UI shows discrete prev/next pages.
   Snapshot + `offsetPage`. A dataset version rolling over between requests is
   a cosmetic wobble for a paged UI, so offsets are sufficient.
3. **cursor** — too big to ship AND the UI accumulates pages (infinite
   scroll). A skipped or repeated row corrupts a list the reader believes is
   complete, so pages are answered against a pinned, client-visible version
   with verified cursor boundaries: `cursorPage` + a content-hashed version
   (`contentHashVersion` in `~/server/datasetSnapshots/redisBlobStore.server`).

## The pipeline

```text
build (surface)          expensive aggregation, runs on cache miss only
  -> store               immutable version + freshness pointer
                         disk: ~/server/datasetSnapshots (build-time datasets)
                         redis: ~/server/datasetSnapshots/redisBlobStore.server (runtime datasets)
  -> prepare             filter + sort ONCE per (domain, version, signature)
                         preparedRows.server.ts, memoized via cachedResult
  -> slice               offsetPage.server.ts | cursorPage.server.ts
  -> client              useTablePages (~/hooks) + TablePagesStatus (~/components/Table)
```

## Adding a surface

Everything a surface owns sits in its container — three files:

1. `containers/<S>/tableQuery.ts` (browser-safe): the query schema and limits.

   ```ts
   import { defineTableQuery, enumField, nullableNumberField, textField } from '~/server/tablePages/tableQuery'

   export const MY_TABLE_LIMITS = { initial: 50, page: 75, max: 100 } as const

   export const myTableQuery = defineTableQuery({
   	fields: {
   		search: textField({ maxLength: 200, signatureValue: (value) => value.trim().toLowerCase() }),
   		minTvl: nullableNumberField(),
   		sort: enumField(MY_SORT_KEYS, { nonStringFallback: 'tvl' }),
   		order: enumField(['asc', 'desc'] as const, { fallback: 'desc' })
   	}
   })
   ```

2. `containers/<S>/server/tableData.server.ts`: the build function plus
   snapshot registration — disk domains register in
   `~/server/datasetSnapshots/contract.ts`; runtime datasets create a
   `redisBlobStore` with their prefix, TTLs, and identity accessor, and gate
   publishes behind their validation checks.

3. `containers/<S>/server/api.ts`: ~30 lines composing the pipeline inside
   `defineApiRoute` — parse via the schema, load the snapshot, `prepareTableRows`
   (namespace `table-pages:<surface>:prepared-rows`, plan D4), then
   `offsetTablePage` or `cursorTablePage`. Cursor routes map
   `TableCursorError` to `400 invalid_cursor` and a version mismatch to
   `409` with the current version in the body.

## Invariants

- The prepared row order must be TOTAL and deterministic: nulls last
  (`compareTableSortValues`), ties broken on stable row identity. Cursor
  boundary verification depends on it.
- A query signature must capture EVERYTHING that changes row order. If a
  parameter can reorder rows and is not in the signature, two clients will
  share a cache entry they shouldn't.
- Blob-first, pointer-second writes; `:last-good` is read only on rebuild
  failure. See `redisBlobStore.server.ts`.
- `.server.ts` modules here are server-only; `types.ts` and `tableQuery.ts`
  are browser-safe and are the only modules client code may import.
