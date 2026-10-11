# Tables

Choose the renderer independently of how rows are fetched or paginated. Import each piece from its own file; the hooks, features and context never import toolbar or renderer components, and `Table` has no React Virtual dependency.

## Where the work goes

| To do this                                        | Use                                                                                                                                                          | Example                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Render every row of the row model                 | `Table`                                                                                                                                                      | short lists, owner-paginated tables                        |
| Render a long list with window scrolling          | `VirtualTable`                                                                                                                                               | directories                                                |
| Render one page with page controls                | `PaginatedTable`                                                                                                                                             | `/tokens`                                                  |
| Page a list, grid or owner-paginated table        | `TablePager`: first, previous, next, last, "Page X of Y" or a row range, optional Rows per page; the owner keeps the page state. Never numbered page buttons | `src/pages/pro.tsx`                                        |
| Render a table inside a dashboard card            | `UnifiedVirtualTable`, which scrolls its container                                                                                                           | `src/containers/ProDashboard/components/UnifiedTable/core` |
| Build a searchable table                          | `SearchTableProvider` with native TanStack `options`, then `TableSearchInput`, `TableColumnSelect`, `TableCsvExport` inside it                               | example below                                              |
| Render the searchable table                       | `SearchTableView` for every row, `VirtualSearchTableView` for window virtualization; both render headers                                                     | `src/containers/LiquidationsV2/Table.tsx`                  |
| Reset table state when the entity or view changes | A React `key` on the provider; persistent navigation controls sit outside the keyed subtree                                                                  | `src/containers/Token/TokenMarketsSection.tsx`             |
| Deliver rows too large for page props             | `src/server/tablePages/README.md`                                                                                                                            | server-paginated directories                               |
| Name the row (Name, Ticker, Pair)                 | `enableHiding: false` on the identity column; build pickers with `getHideableColumns` / `getColumnSelectState` or `TableColumnSelect`                        | `search/columnSelect.ts`                                   |
| Size a column                                     | `w-[N] min-w-[N]` in `meta.headerClassName`; see "Column widths"                                                                                             | `meta: { headerClassName: 'w-[121px] min-w-[121px]' }`     |
| Keep a text cell on one line                      | `meta.cellClassName: 'truncate'`                                                                                                                             | `PaginatedTable` text columns                              |

```tsx
<SearchTableProvider options={{ data, columns, initialState: { sorting } }}>
	<Card padding="none">
		<TableToolbar>
			<TableSearchInput columnId="name" placeholder="Search projects…" />
			<TableCsvExport filename="projects" />
		</TableToolbar>
		<VirtualSearchTableView />
	</Card>
</SearchTableProvider>
```

`scripts/policies/check-column-pickers.ts` fails a Columns picker that skips `columnSelect.ts`, and oxlint bans TanStack's own `columnVisibilityFeature` in favor of `features/display.ts`.

## Checks

- Pagination state belongs to the table's owner. `Table` never creates a second pagination state or slices rows again.
- Keep an explicit table owner when narrower features, server or controlled state, or row-dependent callbacks need one. Do not enable extra features just to share a provider.
- Row-dependent callbacks stay at the typed owner; context erases the row type.
- `initialState` supplies mount defaults. New data or column definitions keep current sorting, filters, visibility and expansion; only a `key` resets them.
- Search deferral keeps typing responsive, but it is not a worker or a debounce: the filter still runs synchronously once applied.
- An external reset cancels pending search text, even when the filter it resets is already empty.
- Hiding a column keeps its definition, so search and sorting still work on it.
- Keep non-virtual cell preparation out of the virtual render path, so a large table creates cells only for its rendered window.
- A component that reads state from stable row, cell, column or core table objects puts `Subscribe` inside itself and keeps those reads in its render callback. With `useSelector`, render from the selected result or pass it down as a prop. Under React Compiler, a read outside a subscription freezes sorting, filtering, visibility and replaced data.
- Sorting, filtering, visibility, pagination, replaced data and same-ID column formatter changes must update the UI with and without the compiler. The shared table fixtures run in both Vitest projects.
- React Virtual's compiler bailouts stay in the virtualized files. They never justify a `'use no memo'` on a table-only component.

## Column widths

`PaginatedTable` always uses `table-layout: fixed`, and `Table` and `VirtualTable` default to it. Under that layout the rendered width equals the `headerClassName` width including padding, so the math below is exact.

```
width = ceil(24 + max(header + 14 if sortable, widest body value))
```

- 24 is the cell's `px-3` padding on both sides; 14 is the 10px `SortIcon` plus its 4px `gap-1`.
- A long-label numeric column is header-bound; a short-label one (`P/E`, `Price`) is body-bound, so do not shrink it to its header.
- A column of bounded vocabulary (sector) widens so values fit on one line. A free-text column (industry, description) takes a sensible width and truncates.
- A truncated cell does not show its full value on hover. When the value must be readable, widen the column or give the cell a tooltip.
- Renaming a header changes a header-bound width; re-measure in the same change. When the new label would need a width out of proportion to its values, shorten it and put the detail in `headerHelperText`.

Measure on a page that renders the table, with the widest values on screen (sort descending or show more rows):

```js
// Per visible column: current width → width that fits the header and every visible body cell.
const table = document.querySelector('table')
const headers = [...table.tHead.rows[0].cells]
const bodyRows = [...table.tBodies[0].rows]
const contentWidth = (cell) => {
	const range = document.createRange()
	range.selectNodeContents(cell)
	return range.getBoundingClientRect().width
}
headers.forEach((th, i) => {
	const cells = [th, ...bodyRows.map((r) => r.cells[i])].filter(Boolean)
	const need = Math.max(...cells.map((c) => Math.ceil(contentWidth(c))))
	const pad = parseFloat(getComputedStyle(th).paddingLeft) + parseFloat(getComputedStyle(th).paddingRight)
	const current = th.getBoundingClientRect().width
	console.log(th.innerText.trim().padEnd(24), 'now', Math.round(current), '→', need + pad)
})
```

## Look

- Normal rows are 50px and compact rows 40px. `rowSize` overrides both for multiline or entity rows, and the virtualizer estimate uses the same value.
- Compact mode also drops vertical dividers and tightens padding; never shrink one cell or header on its own.
- Headers use `table-header` and stay on one line (`whitespace-nowrap`). Body cells inherit 14px Inter.
- Numeric cells use Inter, never `mono-*`. The shared renderers add `tabular-nums` to end-aligned columns so sorted digits line up; measure those columns with tabular digits on.
- Numeric columns usually align to the end; text columns (names, categories) align to the start, header and cells alike.
- In grouped headers only a group header centers over its columns. A leaf header spanning the group rows aligns with its own column.
- The sort caret is a 10px `SortIcon` after the label with `gap-1`; the active caret is `text-link`, inactive carets `text-tertiary`.
- Comparable rows expose sortable headers, default to the page's stated ranking, keep nulls last in both directions, and recompute the rank and CSV order from the active sort. Fixed sequences such as period matrices and calendars do not sort.
- The identity column stays sticky when metric columns scroll horizontally. Wide tables sit in a `min-w-0 max-w-full overflow-x-auto overscroll-x-contain` scroller.
- An empty row model renders one full-width `NoResults` row under the headers (`TableEmptyRow`), so the toolbar, search and headers stay usable. Pages never add their own message beside the table; `PaginatedTable` takes `emptyMessage` for page-specific text and hides the row while `interactionDisabled` shows its loading overlay. A page status that replaces the whole table, such as a full-panel `SurfaceBodyStatus`, stays the page's.
- Row and cell borders use `border-subtle`.
- `PaginatedTable` has no border of its own: the surrounding `Panel` or `Card` is the table's only rounded border, and the pagination row attaches with `border-t border-subtle p-2`.
- `PaginatedTable` body cells wrap unless the column sets `truncate`. `stickyHeader` is only for long directories that need persistent column context.
