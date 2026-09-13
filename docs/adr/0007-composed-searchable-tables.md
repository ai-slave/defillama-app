# ADR 0007: Compose Searchable Tables With Scoped State

## Status

Accepted

## Context

The former table wrapper mixed state, toolbar controls, page layout, and renderer selection.
Separating those responsibilities makes custom layouts possible without adding wrapper flags.
The separation must preserve typing responsiveness, state lifetime, and compiler-visible updates.

## Decision

Use `SearchTableProvider` with native TanStack `options` for new searchable tables that need the
search feature preset. Compose `TableSearchInput`, `TableColumnSelect`, and `TableCsvExport` with
ordinary `TableToolbar`, `PanelHeader`, and `Card` children. Choose `SearchTableView` for full rendering
or `VirtualSearchTableView` for window virtualization. These views render headers as well as rows.

Keep explicit table owners where narrower features, server state, controlled updates, or typed
row callbacks require them. The generic search and column-order hooks remain supported for those
owners. Do not add unused features to adopt context. Keep hook defaults and feature presets free
of UI imports; import controls and renderers separately. Domain layouts and lazy-loading boundaries
belong beside their consumers.

The provider selects no table state. It passes an explicit scoped context value so React Compiler
observes data and column option changes, including when child elements are memoized. It does not
use the stable `table.AppTable` wrapper, whose internal ref can hide those changes from memoization.
Row types are checked at the native options boundary and erased in context. Row-dependent callbacks
stay with the typed owner; the context views expose presentation options only.

### State lifetime

`initialState` supplies mount defaults. Replacing data or column definitions preserves current sorting,
filters, visibility, and expansion. A React key deliberately resets that state by remounting the
provider. Persistent navigation controls must sit outside that keyed subtree.

Standalone liquidations reset table state when changing views. Token liquidations preserve search
and sorting across views. Token market venue/category changes reset the table while keeping the
focused navigation control mounted. These are product decisions, not universal reset rules.

### Search scheduling and resets

The search input owns immediate draft text. A deferred value applies that text to the table after
the urgent input commit. Wrapping an external-store write in `startTransition` alone does not make
it nonblocking. The eventual filter computation still runs synchronously; deferral is not a worker,
a debounce interval, or a guarantee of interruptible filtering.

Filter commands carry a small change counter because TanStack suppresses equal state updates.
Resetting an already-empty applied filter must still cancel pending text. Drafts track the command
and filter snapshot they started from; external resets or replacements supersede them. Acknowledging
an input's own write preserves newer typing. Controlled callbacks remain authoritative, and an
unapplied controlled request is not repeatedly emitted.

Keep column definitions stable when the user hides columns. Visibility changes must not remove
search or sorting capabilities. CSV exports visible columns by default; explicit all-column exports
include hidden columns according to the existing CSV metadata rules. If a domain genuinely replaces
its schema, a temporarily absent search column must not crash the input.

## Verification

Run the composition fixtures normally and through React Compiler. Cover urgent input before filtering,
rapid edits, empty and nonempty resets during pending work, external filter replacement, controlled
callbacks, hidden-column search/CSV, and same-ID column replacement through both views. Preserve
keyboard focus and tab state lifetime in domain integration tests.

Static import-boundary tests cover the provider, hook, and renderer paths. They establish source
separation and lazy imports; they do not measure final production bundle sizes or bundler tree-shaking.
