# ADR 0008: Additive Pro Dashboard Document Model

## Status

Accepted

## Context

A Pro dashboard is a JSON document owned by the frontend. features-server stores
`data` as received, sanitizes only the `content`/`title` of `text` cards, counts
widgets for Discover, and rejects documents whose serialized size exceeds 1 MiB.
Every read passes through `migrateDashboardConfig`, which rebuilds each card from
its persisted shape and drops cards it cannot understand.

The dashboard package adds document-level state (`variables`, `annotations`),
card-level layout and binding fields (`height`, `bindings`), two new card kinds
(`section`, `custom-data`) and per-card stream readiness. All of it must load on
documents written before this change and must be safe to write from an older
tab that never learned the new fields.

## Decision

- **Additive fields only, no document version.** Every new field is optional and
  its absence equals the default: no `variables` means no parameter bar, no
  `height` means scale 1, no sections means one unnamed group. Because absence is
  never ambiguous, a `schemaVersion` would have nothing to discriminate. Kind-level
  `configVersion` (used by unified tables) remains the tool for non-additive
  changes to one card kind.
- **Read-time sanitization instead of write-time migration.**
  `migrateDashboardConfig` validates `variables` (kind, id, value mask, cap 4),
  `annotations` (ISO date, plain label, cap 50), `height` (three presets),
  `bindings` (fields allowed for the card kind) and both new kinds; invalid
  entries are dropped, the document is never rejected. Old documents acquire the
  new shape on the owner's first save.
- **Structure is derived from order.** Sections are flat `kind: 'section'` items;
  `buildDashboardLayout` groups the cards that follow a section until the next
  one, and any `displayAs: 'tab'` section turns the cards before the first tab
  into a shared header. There is no nesting to keep in sync and the three-way
  merge on 409 treats sections like any other card.
- **Parameters resolve at exactly two points.** `variables` hold defaults, cards
  keep their literals plus `bindings` (field → variable id). The client resolves
  items on the way into `ChartGrid`; the stream resolves after the protocol
  catalog is available and before planning sources. Owners persist a value by
  rewriting the bound literals in the same save; viewers override through
  `?var-<id>=…`, which also reaches the stream URL so edge cache variants stay
  correct. Search, SEO and AI iteration keep seeing real values.
- **Custom data lives inside the document.** `custom-data.rows` is stored inline
  as JSON up to 24 KiB and as `{ encoding: 'gzip-base64', data, rowCount }`
  above it; rows are stripped from the SSR HTML and arrive with the stream's
  `dashboard` chunk. A client-side size gate mirrors the server's
  `JSON.stringify(data).length` check at 900 K characters.
- **Conflicts are merges, not locks.** The optimistic `baseEditedAt` → 409 →
  `mergeDashboardItems` flow is the only conflict mechanism. `variables` and
  `annotations` merge as whole top-level keys; the reducer keeps local edits of
  those keys when they differ from the save baseline.
- **Undo is a session stack.** History lives in the reducer as
  `{ items, variables }` snapshots (cap 50); nothing is persisted, so a deleted
  card is recoverable until the tab closes and no trash needs cleanup.

## Consequences

- New text fields (section titles, parameter labels, annotation labels, custom
  data names and columns) bypass server sanitization and must render as plain
  text only.
- The only features-server change is `countDashboardItems` ignoring sections, so
  a dashboard made of sections alone stays out of Discover.
- Adding a card kind follows the checklist in `PLAN.md` §0: the type unions, the
  migration switch, the capability maps, the grid renderer and the SEO summary
  are compile-enforced; minimum height, persisted-field stripping and the modal
  are not.
