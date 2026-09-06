import type { ParsedCsvRow } from './csvParse'

type PreviewSearchIndex = WeakMap<ParsedCsvRow, string>

export function createPreviewSearchIndex(rows: Array<ParsedCsvRow>, columnCount: number): PreviewSearchIndex {
	const index: PreviewSearchIndex = new WeakMap()
	for (const row of rows) {
		index.set(row, row.values.slice(0, columnCount).join('\0').toLowerCase())
	}
	return index
}

export function filterPreviewRows(
	rows: Array<ParsedCsvRow>,
	searchIndex: PreviewSearchIndex,
	normalizedSearchValue: string
): Array<ParsedCsvRow> {
	if (!normalizedSearchValue) return rows
	return rows.filter((row) => searchIndex.get(row)!.includes(normalizedSearchValue))
}
