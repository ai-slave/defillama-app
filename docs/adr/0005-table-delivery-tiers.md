# ADR 0005: Table Delivery Tiers And Shared Pagination Primitives

## Status

Accepted

## Context

The app accumulated three server-paginated tables built at different times — Yields (disk generations, offset pages), Tokens (Redis wall-clock revisions, offset pages), and protocol rankings (Redis content-hashed snapshots, cursor pages) — each with its own query parsing, row-preparation, windowing, and client fetching code. Meanwhile most tables (RWA, Equities, adapter metrics, oracles, categories) ship all rows in page props and filter client-side.

The homepage protocol table exposed the failure mode of choosing wrong: ~9 MB of a 10 MB page payload before pagination, and — on the other side — pagination machinery is pure overhead for a 300-row table whose readers expect instant facet filtering.

## Decision

Every table surface is assigned one of three delivery tiers, chosen by measurable properties, never by consistency with other tables:

1. **local** — the dataset fits in page props (rule of thumb: under ~300 KB serialized). Ship all rows, filter and sort client-side, render virtualized. No server pagination modules are involved. Most tables are — correctly — here.
2. **offset** — too big to ship; the UI shows discrete prev/next pages. A dataset version rolling over between requests shifts rows across page boundaries, which a paged UI tolerates as a cosmetic wobble.
3. **cursor** — too big to ship AND the UI accumulates pages (infinite scroll). A skipped or repeated row corrupts a list the reader believes is complete, so pages are answered against a pinned, client-visible, content-hashed version with verified cursor boundaries. Consistency stops being a timing question and becomes string equality.

The mechanism behind tiers 2 and 3 is shared, product-agnostic code:

- `src/server/tablePages/` — query schemas and canonical signatures, prepared-row memoization per (domain, version, signature), offset and verified-cursor windowing
- `src/server/datasetSnapshots/` — two stores (disk generations for build-time datasets, Redis pointer+blob for runtime datasets) and two version-naming schemes (`generation` ids when the version never leaves the server, content hashes otherwise). Blob-store pointers are monotonic: a publish never moves readers back to an older build, and `:last-good` outlives `:latest` so a failed rebuild degrades to the last healthy version instead of an error
- `~/hooks/useTablePages` + `TablePagesStatus` — the cursor-mode client state machine

A surface supplies only policy: its query field list and limits (`tableQuery.ts`), its dataset build and validation gate (`server/tableData.server.ts`), and a ~30-line route composing the pipeline (`server/api.ts`). Row shapes, columns, and display rules never enter shared code.

Data sourcing follows the same one-owner principle: `lite/protocols2` (via `fetchProtocols`) is the base protocol universe for light pages that join their own domain data; `getProtocolsByChain` — the expensive multi-adapter aggregation — has exactly one caller, the rankings snapshot builder (plus a documented forks exception whose fork filter must run before parent aggregation). Pages needing enriched cross-metric rows read the cached snapshot; they do not re-aggregate.

## Consequences

- Tier promotion is triggered by measurement (page-data size approaching the threshold), and promoting a page means adding the two server files and flipping the client mode — not rewriting the page. Demotion pressure is structural: the kernel refuses product knowledge, so per-surface variation cannot leak into it.
- Cursor mode's guarantees cost a pinned-version lifecycle (content hashes, `409 snapshot_mismatch`, boundary-verified cursors). Only accumulating UIs pay it; wall-clock revisions were retired rather than kept as a third naming scheme, because they conflate identity with freshness.
- The shared modules are finished infrastructure, frozen by default. Changes fall into three kinds: **product changes** (columns, filters, row fields, display rules) live in containers and never touch shared code; **new table surfaces** are additive — a query schema, a dataset module, and a ~30-line route plugging into fixed sockets, with `mode: 'local'` giving small tables the same shape minus the server files; **shared-module changes** require a written case (a new ADR) that multiple surfaces need something the contract cannot express. Permanently rejected, so they are not relitigated: an `index.ts` barrel, a route factory, a strategy registry, wall-clock `revision` version naming, speculative storage backings, and any shared option without two live consumers.
- Wire contracts outlive implementations: the rankings cutover and the yields adoption both replaced serving internals while keeping responses byte-identical, verified against fixed dataset versions.
