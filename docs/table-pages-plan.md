# Table Pages Plan — shared pagination primitives

Successor to `docs/protocol-rankings-hardening-plan.md`, which deferred exactly this: "Converging the three
tables onto shared pagination primitives. Worth considering once this one has settled; too large to bundle
here."

The app now has three server-paginated tables, built at three different times, that independently converged
on the same five-layer pipeline — build an immutable dataset, store it under a version, prepare a
filtered+sorted row order per query, slice a window, request the next window from the client:

| Surface           | Store                                       | Version name        | Window          | Client             |
| ----------------- | ------------------------------------------- | ------------------- | --------------- | ------------------ |
| Yields            | Disk, `src/server/datasetSnapshots`         | `createdAt-uuid`    | offset          | React Query        |
| Tokens            | Redis, `tokens-market-snapshot:v1:{rev}`    | `floor(now / 5min)` | offset          | React Query        |
| Protocol rankings | Redis, `protocol-rankings:v3:{chain}:{tok}` | sha256 of content   | verified cursor | reducer + sentinel |

Every layer except storage is implemented three times with no shared code. The next large table becomes a
fourth bespoke stack unless the common mechanism is extracted. This plan extracts it — as a small set of
plain-function modules, lifted from the newest and best-tested implementation (ProtocolRankings, #3220)
rather than written fresh — and then migrates consumers one PR at a time.

**Scope:** new `src/server/tablePages/`, one new storage adapter beside `src/server/datasetSnapshots`, one
client hook, and the per-surface cutovers for ProtocolRankings, Yields, and (opportunistically) Tokens.

**Explicit non-goals:** see [Out of scope](#out-of-scope). In particular, RWA, Equities, and the
AdapterMetrics pages never migrate — their datasets are small enough that shipping all rows and filtering
client-side is strictly more performant than any server pagination, and their rich facet filters are the
interaction that benefits most from staying in memory.

---

## The decision rule this plan encodes

Three delivery tiers, chosen by measurable properties of the surface, never by taste:

1. **local** — payload small enough to ship in page props (rule of thumb: < ~300 KB of props). All rows in
   ISR/SSR payload, client-side filter/sort, virtualized rendering. No server modules involved.
   _RWA, Equities, AdapterMetrics, and the four local-mode `ChainProtocolsTable` consumers stay here._
2. **offset** — payload too big to ship, UI is discrete prev/next pages. Snapshot + offset windowing;
   query state in the URL. A dataset rolling over between pages is a cosmetic wobble, so offsets are
   sufficient. _Yields, Tokens._
3. **cursor** — payload too big to ship **and** the UI accumulates (infinite scroll). A skipped or repeated
   row lands in a list the reader believes is complete, so pages must be answered against a pinned,
   client-visible version with verified cursor boundaries. _Protocol rankings; the homepage table was 9 MB
   of a 10 MB page before #3220._

Two real strategy axes underneath tiers 2–3, each chosen mechanically:

- **Backing:** disk (built before serving — build/refresh scripts) vs Redis (rebuilt at runtime, shared
  across runtimes).
- **Version naming:** `generation` (`createdAt-uuid`; identity only needs uniqueness, version never leaves
  the server) vs `contentHash` (required the moment the version round-trips through the browser; dedupes
  identical rebuilds for free). **Deliberately absent: wall-clock `revision`.** Tokens' `floor(now/5min)`
  conflates identity with freshness — a new version every bucket even when nothing changed, and its two
  benefits are separable (runtime agreement comes from the pointer read, already amortized by the
  in-process layer; aligned edge expiry is a `Cache-Control` computation independent of naming). Tokens
  keeps its revision scheme until its migration phase, which folds it into `contentHash` + an aligned
  edge-expiry cache-control policy, leaving the kernel with exactly two naming strategies.

---

## Decisions

Settled here so no phase blocks on a discussion. Each records the choice, the reason, and the consequence.

### D1 — `redisBlobStore` is a sibling of `DatasetSnapshotStore`, not an implementation of it

`docs/dataset-snapshot-boundaries.md` anticipates a Redis implementation of the `DatasetSnapshotStore`
contract, but the two stores answer different shapes of problem:

|                 | `DatasetSnapshotStore` (disk)                  | `redisBlobStore` (new)                       |
| --------------- | ---------------------------------------------- | -------------------------------------------- |
| Unit of storage | multi-file generation with `manifest.json`     | one gzipped JSON blob                        |
| Addressing      | static domain union in `contract.ts`           | dynamic key (e.g. chain slug) under a prefix |
| Lifecycle       | staging dir → atomic rename → pruned retention | TTL expiry                                   |
| Built           | before serving (prepare/refresh scripts)       | at runtime, on demand                        |

Forcing the blob store through the file contract would mean either faking manifests for single-artifact
payloads or breaking the registry's closed-union type safety to admit dynamic per-chain domains. Neither is
worth it. Instead the two stores share **invariants**, not an interface — blob/generation written first,
pointer advanced only on success, versions immutable, last-good never rolled back — and
`docs/server-cache-layers.md` documents them as two rows with the same failure-behavior discipline
(Phase K5). Revisit unification only if a third _partitioned, runtime-built_ dataset appears; until then an
abstraction with two deliberately different implementations is a contract nobody can rely on.

The store's full surface (final — K2 must not need to extend it):

```ts
// src/server/datasetSnapshots/redisBlobStore.server.ts
export function createRedisBlobStore<T extends { key: string; version: string }>(config: {
	prefix: string // e.g. 'protocol-rankings:v3'
	versionTtlSeconds: number // immutable blob   — rankings: 14_400
	pointerTtlSeconds: number // ':latest'        — rankings: 3_300
	lastGoodTtlSeconds: number // ':last-good'     — rankings: 86_400
}): {
	readVersion(key: string, version: string): Promise<T | null>
	readCurrent(key: string): Promise<T | null> // via ':latest'; null = caller rebuilds
	readLastGood(key: string): Promise<T | null> // stale-if-error path ONLY — never freshness
	publish(key: string, payload: T): Promise<boolean>
}
```

Semantics, all lifted from `snapshot.server.ts:61-119` plus hardening Phase 1b:

- Keys are `{prefix}:{key}:latest`, `{prefix}:{key}:last-good` (both small JSON pointers holding
  `{ version }`), and `{prefix}:{key}:{version}` (gzip → base64 blob).
- `publish` writes blob first, then `:latest`, then `:last-good`, each only if the previous write
  succeeded; returns `false` and records a runtime error (hardening Phase 3 step 1) on any failure. The
  pointer can never name a blob that failed to save.
- Every read gunzips, parses, and re-verifies the payload's embedded `key` and `version` against what was
  asked for; a mismatch is a cache miss, never data.
- `readLastGood` exists so that "pointer expired + rebuild failed" degrades to the last published version
  instead of an error — closing the gap where a readable ≤4 h blob sits in Redis with nothing remembering
  its version. Callers use it exclusively in the rebuild-failure branch; using it for ordinary freshness
  would silently extend `:latest` and is forbidden by the module's doc comment and a test.
- The store does **not** own in-process memoization; callers keep wrapping reads in `cachedResult` with
  their own TTLs, exactly as rankings does today. One concern per module.

### D2 — Naming is locked before any code lands

Renames after the first consumer are pure churn, so these are final:

| Thing                     | Name                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Server module tree        | `src/server/tablePages/`                                                                                    |
| Kernel files              | `tableQuery.ts`, `preparedRows.server.ts`, `offsetPage.server.ts`, `cursorPage.server.ts`, `types.ts`       |
| Storage adapter           | `src/server/datasetSnapshots/redisBlobStore.server.ts`                                                      |
| Client hook               | `src/hooks/useTablePages.ts`                                                                                |
| Hook modes                | `'local' \| 'offset' \| 'cursor'`                                                                           |
| Status/sentinel component | `src/components/Table/TablePagesStatus.tsx`                                                                 |
| Per-surface files         | `containers/<S>/tableQuery.ts`, `containers/<S>/server/tableData.server.ts`, `containers/<S>/server/api.ts` |

Rationale: `tablePages` says what it serves without inventing vocabulary ("kernel", "windowing", "strategy"
appear nowhere in code); mode names are the _same words_ as the server modules so navigating from a hook
call to the mechanism is a string match; `.server.ts` suffixes follow the source-boundary idiom in
`docs/dataset-snapshot-boundaries.md`.

### D3 — Yields ships its default first page in ISR props (K3 step 4)

Decided yes, default view only. Yields currently ships zero rows and paints an empty table until
hydration + first fetch — the only tier-2/3 surface with no rows in initial HTML. Under the kernel this
costs one `preparedRows` call for the **default query signature only** inside the existing
`getStaticProps`, slicing page 1 (default `pageSize`, 50 rows ≈ tens of KB — two orders of magnitude under
the tier-1 threshold). The client seeds React Query with `initialData` (+ `initialDataUpdatedAt` from the
generation's `createdAt` so staleness math stays honest) for the default query key only; every non-default
query behaves exactly as today. A generation flipping between ISR render and first client fetch is the same
cosmetic wobble offset mode already tolerates. Non-default URL hits (`?page=3&token=…`) get no seed and
fetch as today — no correctness branch, just a warm start for the canonical view.

### D4 — `cachedResult` namespace convention: legacy strings frozen, new namespaces structured

Rankings' four existing namespace strings (`protocol-rankings-snapshot`, `-snapshot-version`,
`-prepared-rows`, `-page`) survive K2 **unchanged and permanently** — they are telemetry dashboard keys and
warm-cache keys, and renaming them buys nothing but a monitoring gap on deploy day. Every namespace created
from K3 onward uses `table-pages:<surface>:<layer>` with `<layer>` ∈ `prepared-rows | page`, e.g.
`table-pages:yields-earn:prepared-rows`. The kernel's `preparedRows` takes the namespace as an explicit
argument, so the convention is enforced by review, not machinery.

### D5 — Hardening Phase 1b is a prerequisite, resolved affirmatively

The hardening plan left "`is Phase 1b (:last-good pointer) wanted?`" open. This plan requires it: D1's
store contract includes `readLastGood`, and K1's tests assert its semantics. Hardening Phase 1's row-count
floor policy remains that plan's decision — this plan is agnostic to which floor is chosen, and K2 calls
whatever gate Phase 1 landed at the same point in the publish path.

### D6 — Page-size limits are per-surface declared config, never buried constants

Every tier-2/3 surface declares exactly three numbers in its `tableQuery.ts`, exported as one object so
there is a single place to change them:

```ts
export const YIELDS_EARN_LIMITS = { initial: 50, page: 50, max: 500 } as const
//                                  ^ rows in ISR/SSR props
//                                            ^ rows per client fetch
//                                                       ^ API clamp ceiling
```

`getStaticProps`, the API route's clamp, and the client hook all consume the same object — changing the
homepage's initial row count is a one-line edit with no other call sites (this was exercised on 2026-08-07:
`PROTOCOL_RANKINGS_INITIAL_LIMIT` went 20 → 50 with zero collateral edits, which is the property to
preserve). The kernel takes limits as arguments and defines no defaults of its own; a surface that forgets
to pass them is a type error, not a silent fallback. Product tuning of these numbers is expected and needs
no plan amendment; the guardrail is total props weight. Measured 2026-08-07 on the homepage: rankings rows
serialize at ~4.4 KB each (50 rows ≈ 218 KB inside an 828 KB `__NEXT_DATA__`), so each `initial` increment
of 25 rows costs ~110 KB of page data — check the `Warning: data for page … exceeds 128 kB` build output
before and after any bump.

### D7 — A name is exported by exactly one file: its definer

Rules, enforced by review on every phase of this plan:

- **No re-exports, no barrels.** Importers go to the defining module, even when that means two import
  statements instead of one. A re-export layer means every reader (human or agent) must hop one extra file
  to find the truth, and it eventually invites the worse failure below.
- **One name, one meaning.** Two exported symbols must never share a name with different shapes. This was
  live in the codebase: `ProtocolRankingActivityMetricKey` was defined in both `readModel.ts` (including
  `'dexs'`) and `sortAccessors.ts` (excluding it), with `query.ts` re-exporting one of them — three files
  answering "what is this type" two different ways. Fixed 2026-08-07: the re-export deleted, the
  `readModel` variant renamed `ProtocolRankingActivitySourceKey`, every import pointed at its definer.
- **Few files, single-purpose files — not merged files.** The way to avoid navigation sprawl is the small
  fixed per-surface census (`tableQuery.ts`, `server/tableData.server.ts`, `server/api.ts`), where each
  file is the _only_ home of its concept — not fewer files glued together by re-export stubs. If a file's
  top grows an `export { … } from` block, that block is the bug.
- **Kernel included.** `src/server/tablePages/` has no `index.ts`; consumers import
  `~/server/tablePages/cursorPage.server` directly. Grep for a symbol must return exactly one definition
  site, and the import path should tell the reader which mechanism is in play.

---

## Target architecture

```text
src/server/tablePages/               # generic mechanism — NO product names, ever
  README.md                          # the decision rule above + "how to add a surface" walkthrough
  tableQuery.ts                      # browser-safe: defineTableQuery({ fields }) → normalize,
                                     #   canonical signature string          (from ProtocolRankings/query.ts)
  preparedRows.server.ts             # signature hash; sort+filter once per (domain, version, signature),
                                     #   memoized via cachedResult; optional precomputed signature list
                                     #                                       (from ProtocolRankings/server/api.ts:87-99)
  offsetPage.server.ts               # page/pageSize → slice + total         (from Yields/Tokens logic)
  cursorPage.server.ts               # cursor encode/decode/verify-boundary → slice
                                     #                                       (from ProtocolRankings/pagination.server.ts:92-254)
  types.ts

src/server/datasetSnapshots/
  redisBlobStore.server.ts           # NEW adapter per D1

src/hooks/
  useTablePages.ts                   # mode: 'local' | 'offset' | 'cursor'
                                     #   local  = passthrough, zero requests
                                     #   offset = React Query + placeholderData
                                     #   cursor = append reducer, request sequencing, abort
                                     #                                       (from useProtocolRankingPages.ts)

src/components/Table/
  TablePagesStatus.tsx               # sentinel footer + retry               (from remoteTable.tsx:185-229)
```

What a surface supplies — the entire per-surface contract, all inside its own container:

```text
src/containers/<Surface>/
  tableQuery.ts            # its defineTableQuery field list — browser-safe, imported by client AND server
  server/
    tableData.server.ts    # build() + snapshot registration (backing, naming, TTLs, validation gate)
    api.ts                 # ~30 lines composing: parse → load snapshot → preparedRows → offsetPage|cursorPage
```

Rules that keep it navigable:

- **Dependency direction is one-way.** Containers import `tablePages`; `tablePages` imports nothing
  product-shaped. The test for kernel membership: the file could be copied to another repo unchanged.
  If a product name ever appears under `src/server/tablePages/`, the extraction has failed.
- **No route factory, no strategy registry, no classes.** Surfaces import `offsetPage` or `cursorPage`
  directly and compose them by hand inside the existing `defineApiRoute`. Thirty legible lines per surface
  beat a factory with ten options; revisit only if the third consumer proves the lines identical.
- **Every kernel option must have a live consumer.** Precomputed signature lists and the aligned
  edge-expiry policy enter the kernel in the Tokens phase, not before.
- **Browser/server split follows the existing idiom:** `tableQuery.ts` builds signature _strings_ and is
  browser-safe (the client needs identical normalization to build request params); hashing stays in
  `.server.ts` modules (`node:crypto`), satisfying the source-boundary tests described in
  `docs/dataset-snapshot-boundaries.md`.

---

## Relationship to the hardening plan

`docs/protocol-rankings-hardening-plan.md` (branch `plan/protocol-rankings-hardening`, unmerged) is now
largely absorbed by this branch. Disposition of its phases, so the hanging branch confuses nobody:

- **Phase 1 (publication gate): done here** — `snapshot.validation.ts` + wired into the snapshot build.
- **Phase 1b (`:last-good` pointer): done here** — standard `redisBlobStore` behavior (D1/D5), with the
  ratio guard comparator and tested degradation paths.
- **Phase 3 step 1 (log silent write failures): done here** — `redisBlobStore.publish` records every
  failed write via `recordRuntimeError`.
- **Phase 2 (URL-backed sort/search/preset state): declined by the owner (2026-08-07).** Query params on
  the homepage fragment the CDN cache of the highest-traffic URL for a transient interaction, and
  localStorage presets are deliberately sticky per-person rather than per-link. Its open questions 3–4
  die with it. Revisit only if a shareable-views product requirement appears — and then likely on chain
  pages, not `/`.
- **Phase 3 steps 2–4 (measure, then size the four cache namespaces): still open** — the telemetry reads
  remain worth doing post-merge; the namespaces and their limits carried over unchanged.
- **Phase 4 (docs): folds into K5** — one ADR, not two.

---

## Phases

Each phase is one reviewable PR, independently shippable and revertible. K1 ships as dead code by design —
but _tested_ dead code with a README, and its shape is treated as provisional until K2 (the first consumer)
validates it. The dead window should be days, not weeks.

### Phase K1 — Extract the kernel (dead code)

**Goal:** `src/server/tablePages/`, `redisBlobStore.server.ts`, `useTablePages` (cursor mode only), and
`TablePagesStatus` exist with ported tests. Nothing imports them yet.

1. `tableQuery.ts`: generalize `normalizeProtocolRankingQuery` + `protocolRankingQuerySignature`
   (`src/containers/ProtocolRankings/query.ts:68-105`) into `defineTableQuery({ fields })` with per-field
   normalizers — trimmed-lowercase string, bounded nullable number, enum, sorted string set. The rankings
   field list must be expressible with zero custom code; anything it needs that the normalizers don't cover
   means the normalizer set is wrong, not the field list.
2. `preparedRows.server.ts`: lift the signature hash (`pagination.server.ts:88-90`) and the
   `cachedResult`-backed prepare cache (`server/api.ts:87-99`). Caller supplies `prepare(snapshotRows,
query)` plus an explicit namespace (D4); the module owns keying (`domain:version:signatureHash`) and
   memoization options.
3. `cursorPage.server.ts`: lift `encodeCursor`/`decodeCursor`/`paginateProtocolRankingRows`
   (`pagination.server.ts:92-254`) generalized over `rowId` and `getSortValue` callbacks. The cursor
   payload shape (`v`, version, queryHash, offset, lastId, lastValue) and both error classes move here.
4. `offsetPage.server.ts`: `page`/`pageSize` clamping and slicing, written against the same prepared-rows
   input. Keep it dumb — no per-surface knowledge.
5. `redisBlobStore.server.ts`: implement D1's contract exactly, lifting the pointer+blob mechanics from
   `snapshot.server.ts:61-119` and hardening 1b's `:last-good`.
6. `useTablePages.ts` cursor mode + `TablePagesStatus`: lift the reducer, request counter, abort handling,
   and sentinel wiring from `useProtocolRankingPages.ts` and `remoteTable.tsx`, generalized over row
   identity (`getRowKey`) and URL building.
7. Port the relevant tests: `pagination.test.ts` → cursor/offset page tests, `query.test.ts` →
   `tableQuery` tests, the reducer cases from `useProtocolRankingPages.hook.test.tsx`, plus new
   `redisBlobStore` tests — blob-before-pointer ordering, failed publish leaves both pointers untouched,
   `readLastGood` returns the previous version after a failed publish, and a test asserting `readLastGood`
   is not consulted on the ordinary freshness path (D1).
8. `README.md` with the decision rule and a worked "add a surface" example.

**Verification:** `bun run test`, `bun run typecheck`. No runtime behavior change anywhere — nothing
imports the new modules.

**Rollback:** delete the directory; nothing depends on it.

### Phase K2 — ProtocolRankings cuts over (design validation)

**Goal:** rankings' bespoke files shrink to the per-surface contract; every kernel module gains its first
real consumer. Expect to adjust kernel signatures here — nothing else depends on them yet.

1. `query.ts` → a `defineTableQuery` field list (public route params are a contract: `sort`, `order`,
   `search`, `minTvl`, `maxTvl`, `tvlKeys`, `customFormula`, `customFormat`, `snapshot`, `cursor`, `limit`
   must all keep their names and semantics). The three scattered constants
   (`PROTOCOL_RANKINGS_INITIAL_LIMIT` = 50, `_PAGE_LIMIT` = 75, `_MAX_LIMIT` = 100) merge into one D6
   limits object.
2. `snapshot.server.ts` → `server/tableData.server.ts` using `redisBlobStore` + `contentHash` naming.
   The hardening plan's validation gate is called at the same point (between build and publish). Keep the
   Redis key prefix `protocol-rankings:v3` and all four `cachedResult` namespace strings unchanged (D4) —
   telemetry continuity, and no cache invalidation on deploy.
3. `pagination.server.ts` / `server/api.ts` → thin composition over `preparedRows` + `cursorPage`. The
   route's externally observable behavior is pinned by `__tests__/api.server.test.ts` and must not change:
   same status codes (`400 invalid_cursor`, `409 snapshot_mismatch` with current token in body), same
   `Cache-Control`, same response shape.
4. `useProtocolRankingPages.ts` / `remoteTable.tsx` → `useTablePages({ mode: 'cursor' })` +
   `TablePagesStatus`, keeping the rankings-specific pieces (search auto-expand, CSV button wiring) in the
   container.
5. The CSV export route (`src/pages/api/dynamic/protocol-rankings/export.ts`) keeps its own handler but
   reads through the same `preparedRows` call.

**Tests:** the existing rankings suites are the acceptance tests — they should pass with minimal edits
(import paths, not assertions). A diff of API responses (same snapshot, same queries) before/after must be
byte-identical.

**Risk:** highest-traffic surface in the repo (homepage). Mitigations: the response-diff check above; land
early in a week; the PR is a move-and-rewire with no behavioral intent, so any diff in output is a bug.

**Rollback:** `git revert` — Redis keys and cache namespaces are unchanged, so old and new code read the
same stored state in either direction.

### Phase K3 — Yields adopts query + prepared rows (the performance win)

**Goal:** kill the per-request full re-sort. `yieldsTablePagination.server.ts:102` currently runs
`rows.slice().sort(...)` on every page request over the largest dataset in the app (~20k pools); pages 2..N
of the same sort/filter combination should be slices.

1. Express the earn-table query as a `defineTableQuery` field list (replacing the ad-hoc parsing in
   `yieldsTableQuery.ts`); public param names are contracts and keep their meaning, including
   `pageSize=all`.
2. Route the sort through `preparedRows` keyed by the generation id (the existing `createdAt-uuid` — no
   naming change; disk store untouched), namespace `table-pages:yields-earn:prepared-rows` (D4).
3. Windowing moves to `offsetPage`. Client stays React Query; adopting `useTablePages({ mode: 'offset' })`
   is done only if it deletes more code than it adds — measured in the PR, not assumed.
4. Ship the default first page in ISR props per D3.

**Verification:** `result_cache_compute_ms` on the new namespace before/after (the hardening plan's Phase 3
telemetry reads apply here too); API response diff for a fixed generation must be empty; a hydration test
asserting the default view renders rows before any fetch and non-default queries fetch exactly as before.

**Rollback:** `git revert`; the prepared-rows namespace is new (nothing else reads it) and the disk store
is untouched.

### Phase K4 — Tokens folds in (opportunistic; do when Tokens is next touched)

**Goal:** retire the wall-clock revision; Tokens becomes the second `redisBlobStore` + `contentHash`
consumer; the kernel gains its last two options — each entering only now, with a live consumer.

1. `precomputedSignatures`: Tokens' 20 pre-built sort indexes (`src/containers/Tokens/utils.ts:148-156`)
   become "precompute these 20 signatures at publish time" in `preparedRows`.
2. Aligned edge expiry: the `s-maxage = seconds to next 5-min boundary` logic
   (`src/containers/Tokens/cache.server.ts:26-35`) becomes a cache-control helper — a freshness policy,
   decoupled from version identity.
3. `tokens-market-snapshot:v1:{revision}` → `redisBlobStore` pointer + hash under a new prefix
   (`tokens-market:v2`). The `SET NX` publish race (`cache.server.ts:54`) is superseded by blob-first +
   pointer-advance. Cutover is safe without dual-reading: old revision keys expire on their own 10-minute
   TTL, and a reverted deploy recreates them on demand — in both directions the store is rebuilt from
   upstream within one revision window.

**Risk:** low urgency, real regression surface. Do not schedule this standalone; bundle with the next
substantive Tokens change.

**Rollback:** `git revert`; see step 3 — no key migration in either direction.

### Phase K5 — Documentation

1. `docs/server-cache-layers.md`: add the Redis pointer+blob store as a first-class layer (the hardening
   plan's P4 already flags its absence) with the same failure-behavior column as the disk store: "failed
   publish never advances the pointer; `:last-good` serves on rebuild failure". Document D1's
   sibling-by-design relationship in the dataset-snapshots section.
2. ADR `docs/adr/000N-table-delivery-tiers.md`: record the three-tier decision rule and _why_ cursor mode
   exists (accumulating UIs cannot tolerate a moving dataset; discrete pages can) — the reasoning the
   hardening plan notes is currently nowhere in the repo. Subsumes the ADR proposed there; write one ADR,
   not two.
3. `src/containers/ProtocolRankings/README.md` and the Yields docs: trim lifecycle sections that now
   describe kernel behavior; link to `src/server/tablePages/README.md` instead of duplicating it.

---

## End state

This plan terminates. After K5 (K4 folds in whenever Tokens is next touched), the architecture is
**finished** — not "stable for now": the construction phase ends and the kernel becomes boring
infrastructure with the same status as `resultCache` or `datasetSnapshots`. The finished form, exactly:

- `src/server/tablePages/` — six files (`README.md`, `types.ts`, `tableQuery.ts`,
  `preparedRows.server.ts`, `offsetPage.server.ts`, `cursorPage.server.ts`) plus tests. No seventh file
  without a new plan document.
- `src/server/datasetSnapshots/` — two stores (file generations, Redis pointer+blob), two version-naming
  schemes (`generation`, `contentHash`). Complete.
- Client — one hook (`useTablePages`, three modes), one status component. Complete.
- Per-surface census — `tableQuery.ts`, `server/tableData.server.ts`, `server/api.ts`, plus the surface's
  own table component. Identical shape on every surface, forever.
- **The census applies to every table surface, including local (tier-1) ones.** A local surface has a
  `tableQuery.ts` schema and `useTablePages({ mode: 'local' })` (rows from props, zero requests, same
  return contract) and simply omits the two server files. Shape is uniform everywhere; _transport_ is the
  only per-surface difference, so promoting a page across tiers changes its mode and adds files — never
  rewrites the page. Adoption rule: every NEW table page uses the census from day one regardless of tier;
  existing tier-1 pages adopt it opportunistically when next substantively touched — never as a standalone
  migration campaign, which would violate this plan's own end-state principle.

After that, changes fall into exactly three kinds, with different rules:

1. **Product changes** (columns, filters, row fields, presets, strike styling, definitions) — container
   files only. This is the everyday evolution the structure exists to absorb; it never touches shared code.
2. **New table surfaces** — three new container files plugging into the fixed sockets. Additive; no shared
   edits; the kernel README's walkthrough is the complete instruction set.
3. **Kernel changes** — frozen by default. A change to `src/server/tablePages/` or the stores requires a
   plan document stating what new requirement two or more surfaces have that the current contract cannot
   express — the same bar as changing a public API. Drive-by "improvements" are rejected in review by
   pointing at this section.

Permanently rejected, so they are never relitigated: an `index.ts` barrel, a route factory, a strategy
registry, wall-clock `revision` naming, speculative backings (S3/DB), and any kernel option without two
live consumers. K3 is the validation gate for this end state: if Yields (offset, disk store, different row
shape) fits the census without kernel edits, the shape is proven and the freeze takes effect at K5. If K3
reveals a genuine gap, it is fixed _during K3_ — the last window in which kernel churn is cheap — and the
freeze still lands with K5.

---

## Suggested order

Hardening Phases 1 / 1b / 3-step-1 → **K1** → **K2** → **K3** → K5 → K4 (whenever Tokens is next touched).

K1+K2 should be adjacent — the dead-code window exists only to keep PRs reviewable, not to let the kernel's
shape settle unvalidated. K3 is where the effort pays measurable rent. K5 documents what actually landed.

---

## Out of scope

- **Migrating RWA, Equities, AdapterMetrics, or the local-mode `ChainProtocolsTable` consumers.** Tier 1 is
  their correct final state. Promotion is triggered by measurement (props payload approaching ~300 KB —
  watch `__NEXT_DATA__` size or build-output page-data JSON), not by consistency.
- **A route factory or table-page framework.** Explicitly rejected above; reconsider only on evidence from
  a third consumer.
- **New backings (S3/R2/Postgres).** Nothing is near Redis-uncomfortable blob sizes.
- **`src/pages/protocols.tsx` remote mode.** Hardening plan open question 4; becomes a one-container change
  once K2 lands.
- **Yields/Tokens URL-state or UX changes** beyond what the migrations require.
- **Renaming rankings' legacy `cachedResult` namespaces to the D4 convention.** Frozen deliberately;
  a telemetry-key migration is all cost and no capability.
