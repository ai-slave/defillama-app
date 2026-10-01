type SelectableColumn = {
	id: string
	columnDef: { header?: unknown; enableHiding?: boolean; meta?: { hidden?: boolean; headerHelperText?: string } }
}

/**
 * The columns a column picker offers. The identity column (`enableHiding: false`) always shows, so offering it
 * would let "Only" or an uncheck leave a table of numbers with nothing saying which row is which. Every column
 * picker builds its options from this, so a table without an identity column fails the moment its picker renders.
 */
export function getHideableColumns<C extends SelectableColumn>(columns: ReadonlyArray<C>): Array<C> {
	const hideable: Array<C> = []
	let hasIdentityColumn = false
	for (const column of columns) {
		if (column.columnDef.enableHiding === false) hasIdentityColumn = true
		else hideable.push(column)
	}
	if (!hasIdentityColumn) {
		throw new Error(
			`A table with a column picker needs an identity column: set enableHiding: false on the column that names the row (columns: ${columns.map((column) => column.id).join(', ')})`
		)
	}
	return hideable
}

// Export-only (meta.hidden) columns are never offered and never count as selected.
export function getColumnSelectState(columns: ReadonlyArray<SelectableColumn>, visibility: Record<string, boolean>) {
	const options: Array<{ key: string; name: string; help?: string }> = []
	const selected: Array<string> = []
	for (const column of getHideableColumns(columns)) {
		const meta = column.columnDef.meta
		if (meta?.hidden) continue
		const header = column.columnDef.header
		options.push({
			key: column.id,
			name: typeof header === 'string' ? header : column.id,
			...(meta?.headerHelperText ? { help: meta.headerHelperText } : {})
		})
		if (visibility[column.id] !== false) selected.push(column.id)
	}
	return { options, selected }
}

export function getColumnVisibilityForSelection(
	columns: ReadonlyArray<SelectableColumn>,
	selectedIds: ReadonlyArray<string>
): Record<string, boolean> {
	const selected = new Set(selectedIds)
	const visibility: Record<string, boolean> = {}
	for (const column of columns)
		visibility[column.id] = column.columnDef.enableHiding === false || selected.has(column.id)
	return visibility
}
