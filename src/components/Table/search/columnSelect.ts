type SelectableColumn = {
	id: string
	columnDef: { header?: unknown; meta?: { hidden?: boolean; headerHelperText?: string } }
}

// Export-only (meta.hidden) columns are never offered and never count as selected.
export function getColumnSelectState(columns: ReadonlyArray<SelectableColumn>, visibility: Record<string, boolean>) {
	const options: Array<{ key: string; name: string; help?: string }> = []
	const selected: Array<string> = []
	for (const column of columns) {
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
	for (const column of columns) visibility[column.id] = selected.has(column.id)
	return visibility
}
