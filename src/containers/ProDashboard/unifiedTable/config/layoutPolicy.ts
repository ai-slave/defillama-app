import type { UnifiedRowHeaderType } from './types'

export type UnifiedTableSorting = Array<{ id: string; desc: boolean }>

export const DEFAULT_UNIFIED_TABLE_SORTING: UnifiedTableSorting = [{ id: 'tvl', desc: true }]
export const DEFAULT_UNIFIED_TABLE_ROW_HEADERS = [
	'parent-protocol',
	'protocol'
] as const satisfies readonly UnifiedRowHeaderType[]

const UNIFIED_TABLE_ROW_HEADERS = [
	'chain',
	'category',
	'parent-protocol',
	'protocol'
] as const satisfies readonly UnifiedRowHeaderType[]

export function sanitizeUnifiedTableRowHeaders(
	rowHeaders: readonly UnifiedRowHeaderType[] | undefined
): UnifiedRowHeaderType[] {
	const unique: UnifiedRowHeaderType[] = []
	const provided = rowHeaders?.length ? rowHeaders : DEFAULT_UNIFIED_TABLE_ROW_HEADERS

	for (const header of provided) {
		if (!UNIFIED_TABLE_ROW_HEADERS.includes(header)) continue
		if (unique.includes(header)) continue
		unique.push(header)
	}

	const protocolIndex = unique.indexOf('protocol')
	if (protocolIndex !== -1) unique.splice(protocolIndex, 1)

	const parentIndex = unique.indexOf('parent-protocol')
	if (parentIndex !== -1) {
		unique.splice(parentIndex, 1)
		unique.push('parent-protocol')
	}

	unique.push('protocol')
	return unique
}

export function createUnifiedTableColumnVisibility(
	columnOrder: readonly string[],
	customColumns: ReadonlyArray<{ id: string }>,
	columnVisibility?: Readonly<Record<string, boolean>>
): Record<string, boolean> {
	const visibility: Record<string, boolean> = { name: true }
	for (const column of customColumns) visibility[column.id] = false
	for (const id of columnOrder) visibility[id] = columnVisibility?.[id] !== false
	return visibility
}

export function normalizeUnifiedTableSorting(
	sorting?: ReadonlyArray<{ id: string; desc?: boolean }>
): UnifiedTableSorting {
	const source = sorting?.length ? sorting : DEFAULT_UNIFIED_TABLE_SORTING
	return source.map(({ id, desc }) => ({ id, desc: desc ?? false }))
}

export function applyUnifiedTableRowHeaderVisibility(
	rowHeaders: readonly UnifiedRowHeaderType[],
	baseVisibility: Readonly<Record<string, boolean>>
): Record<string, boolean> {
	const visibility = { ...baseVisibility }

	if (rowHeaders.includes('chain')) {
		visibility.chains = false
		visibility.category = false
	}

	if (rowHeaders.includes('category')) visibility.category = false

	return visibility
}
