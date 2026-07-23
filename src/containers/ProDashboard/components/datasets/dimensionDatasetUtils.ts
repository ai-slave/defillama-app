import type { ColumnDef } from '@tanstack/react-table'
import type { DimensionDatasetProtocol } from '~/containers/AdapterMetrics/server/datasets'

export function getDimensionDatasetCategories(data: DimensionDatasetProtocol[]): string[] {
	const categories = new Set<string>()
	for (const row of data) if (row.category) categories.add(row.category)
	return Array.from(categories).sort((a, b) => a.localeCompare(b))
}

export function sanitizeDimensionDatasetCategories(categories: string[], availableCategories: Set<string>): string[] {
	return categories.filter((category) => availableCategories.has(category))
}

export function filterDimensionDatasetRows(
	data: DimensionDatasetProtocol[],
	includeCategories: string[],
	excludeCategories: string[]
): DimensionDatasetProtocol[] {
	if (includeCategories.length === 0 && excludeCategories.length === 0) return data
	const included = new Set(includeCategories)
	const excluded = new Set(excludeCategories)
	return data.filter((row) => {
		const category = row.category ?? ''
		if (included.size > 0 && !included.has(category)) return false
		if (excluded.size > 0 && excluded.has(category)) return false
		return true
	})
}

export function getDimensionDatasetColumnId(column: ColumnDef<DimensionDatasetProtocol>): string | undefined {
	if (column.id) return column.id
	if ('accessorKey' in column && typeof column.accessorKey === 'string') return column.accessorKey
	return undefined
}

export function buildDimensionDatasetCSV(
	rows: DimensionDatasetProtocol[],
	metricLabel: string,
	includeChanges: boolean
): string {
	const headers = [
		'Protocol',
		'Category',
		`24h ${metricLabel}`,
		`7d ${metricLabel}`,
		`30d ${metricLabel}`,
		...(includeChanges ? ['24h Change', '7d Change'] : []),
		'Chains'
	]
	return [
		headers.join(','),
		...rows.map((row) => {
			const values: Array<string | number | null | undefined> = [
				row.name,
				row.category,
				row.total24h,
				row.total7d,
				row.total30d
			]
			if (includeChanges) values.push(row.change_1d, row.change_7d)
			values.push(row.chains.join(';'))
			return values.join(',')
		})
	].join('\n')
}
