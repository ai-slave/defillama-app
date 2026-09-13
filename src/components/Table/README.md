# Table rendering

Choose the renderer independently of how rows are fetched or paginated.

| Component                             | Responsibility                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Table`                               | Render every row in the current TanStack row model. Suitable for short lists and tables whose owner already supplies pagination controls. |
| `VirtualTable`                        | Render a window of the current row model using window scrolling. Own virtual spacers, measurements, and the browser-search warning.       |
| `PaginatedTable`                      | Render the current page with pagination controls, a page-size selector, loading overlays, and optional expanded panels.                   |
| `UnifiedVirtualTable` in ProDashboard | Render dashboard tables with container scrolling and dashboard-specific behavior.                                                         |

Import each renderer from its own file. `Table` has no React Virtual dependency.

## Composed searchable tables

Use this composition for new tables that need the searchable preset. Keep an explicit owner when
its narrower features, server/controlled state, or row-dependent callbacks require one. See
[ADR 0007](../../../docs/adr/0007-composed-searchable-tables.md) for scheduling and state lifetime.

`search/SearchTableProvider` owns a table through native `options` and selects no state in its owner.
Place `TableSearchInput`, `TableColumnSelect`, and `TableCsvExport` inside it, arranging them with the
existing `TableToolbar`, `PanelHeader`, and `Card` primitives. Custom filters are ordinary children.
Use `SearchTableView` for full rendering or `VirtualSearchTableView` for window virtualization.
Import the pieces directly; the hook and context never import toolbar or renderer components.

```tsx
<SearchTableProvider options={{ data, columns, initialState: { sorting } }}>
	<Card padding="none">
		<TableToolbar>
			<TableSearchInput columnId="name" placeholder="Search projects..." />
			<TableCsvExport filename="projects" />
		</TableToolbar>
		<VirtualSearchTableView />
	</Card>
</SearchTableProvider>
```

Use native `initialState` for mount defaults and a React key when the product requires a reset.
State survives ordinary data and column updates. The root passes an explicit context value instead
of `table.AppTable` so React Compiler observes option changes even when children are memoized.
Search keeps urgent draft text separate from deferred filtering. External resets and replacements
cancel pending text; equal-value resets are observable through the provider's filter-command signal.
The search context is scoped to this feature family so an unrelated nested provider cannot capture
its controls. A nested `SearchTableProvider` deliberately starts a separate scope.

Controls read only the state they render. Context does not infer a row type from a provider into its
children: keep row-dependent callbacks at a typed table owner. Low-level renderers keep their explicit
`table` prop and narrow feature requirements. Other feature presets and generic search/order helpers
remain useful for those owners; do not enable extra features just to share a provider.

Domain layouts belong beside their consumers. Token table composition stays behind its lazy import;
persistent tabs stay outside the table provider. Add shared pieces when behavior repeats, rather than
adding layout flags or renderer injection to a convenience wrapper.

`TableFrame` shares the ranking/investor table layout, headers, sticky first column, and horizontal
scrollbar behavior. `TableRow` renders its cells and row counters. `PaginatedTable` keeps its distinct
presentation; it shares `TableColumnGroup` and `useTableCells` without changing its styling.

`useTableView` selects reactive rows, headers, and columns. `useTableCells` makes both rows and columns
explicit inputs: a formatter can change without changing row identities or column IDs. Keep reads
from stable core table objects inside their `Subscribe` callbacks, or render from selected values.
Do not replace those subscriptions with compiler opt-outs.

Pagination state belongs to the owner. `Table` never creates a second pagination state or slices
rows again. Data delivery tiers and server pagination are documented in
[ADR 0005](../../../docs/adr/0005-table-delivery-tiers.md).

When changing shared rendering, run the table fixtures both normally and with React Compiler.
Cover state changes, same-ID column replacement, full versus virtual row counts, and grouped headers.
Keep nonvirtual cell preparation out of the virtual render path so large tables only create cells
for their rendered window.
