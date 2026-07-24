import type { ParsedCsvRow } from './csvParse'

type PreviewSearchIndex = WeakMap<ParsedCsvRow, string>

export function createPreviewSearchIndex(rows: ParsedCsvRow[], columnCount: number): PreviewSearchIndex {
	const index: PreviewSearchIndex = new WeakMap()
	for (const row of rows) {
		index.set(row, row.values.slice(0, columnCount).join('\0').toLowerCase())
	}
	return index
}

export function filterPreviewRows(
	rows: ParsedCsvRow[],
	searchIndex: PreviewSearchIndex,
	normalizedSearchValue: string
): ParsedCsvRow[] {
	if (!normalizedSearchValue) return rows
	return rows.filter((row) => searchIndex.get(row)!.includes(normalizedSearchValue))
}
