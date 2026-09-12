import type { ColumnOrderState, RowData, Table } from '@tanstack/react-table'
import {
	column_getFilterValue,
	column_setFilterValue,
	table_getVisibleLeafColumns
} from '@tanstack/react-table/static-functions'
import {
	startTransition,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore
} from 'react'
import type { CsvCell } from '~/utils/csvCell'
import type {
	FilteringFeatures,
	OrderedTableInstance,
	OrderingFeatures,
	VisibilityFeatures
} from './features/contracts'

type BreakpointMap<T> = Record<number, T>
export type ColumnOrdersByBreakpoint = BreakpointMap<ColumnOrderState>

type ColumnTableColumn = { getLeafColumns: () => Array<{ id: string }> }

const isColumnOrderEqual = (current: ColumnOrderState, next: ColumnOrderState) => {
	if (current === next) return true
	if (current.length !== next.length) return false
	for (let i = 0; i < current.length; i++) {
		if (current[i] !== next[i]) return false
	}
	return true
}

const getColumnOrderEntries = (columnOrders: ColumnOrdersByBreakpoint) =>
	Object.entries(columnOrders)
		.map(([size, value]) => [Number(size), value] as const)
		.sort(([a], [b]) => a - b)

type ColumnOrderEntry = ReturnType<typeof getColumnOrderEntries>[number]

const getColumnOrderChangeBreakpoints = (entries: Array<ColumnOrderEntry>) => {
	const breakpoints: Array<number> = []
	let previousOrder: ColumnOrderState | null = null

	for (const [size, order] of entries) {
		if (size > 0 && (previousOrder == null || !isColumnOrderEqual(previousOrder, order))) {
			breakpoints.push(size)
		}
		previousOrder = order
	}

	return breakpoints
}

const getFixedColumnOrder = (entries: Array<ColumnOrderEntry>): ColumnOrderState | null => {
	if (entries.length === 0) return null

	const zeroBreakpointOrder = entries.find(([size]) => size === 0)?.[1]
	if (!zeroBreakpointOrder) return null

	for (const [, order] of entries) {
		if (!isColumnOrderEqual(order, zeroBreakpointOrder)) return null
	}

	return zeroBreakpointOrder
}

const getCurrentColumnOrderBreakpoint = (
	entries: Array<ColumnOrderEntry>,
	defaultColumnOrder: ColumnOrderState | null
) => {
	if (typeof window === 'undefined') return null

	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i]
		if (!entry) continue
		const [size, order] = entry
		if (size <= 0 || window.matchMedia(`(min-width: ${size}px)`).matches) {
			return defaultColumnOrder != null && isColumnOrderEqual(order, defaultColumnOrder) ? null : size
		}
	}

	return null
}

const getOrderForBreakpoint = (entries: Array<ColumnOrderEntry>, breakpoint: number | null) => {
	if (breakpoint == null) return null
	return entries.find(([size]) => size === breakpoint)?.[1] ?? null
}

const getLeafColumnIds = (columns: Array<ColumnTableColumn>) => {
	const columnIds: ColumnOrderState = []
	for (const column of columns) {
		for (const leaf of column.getLeafColumns()) columnIds.push(leaf.id)
	}
	return columnIds
}

export function splitArrayByFalsyValues<T extends object, K extends keyof T>(data: Array<T>, column: K) {
	const truthy: Array<T> = []
	const falsy: Array<T> = []
	for (const curr of data) {
		const value = curr[column]
		if (!value && value !== 0) falsy.push(curr)
		else truthy.push(curr)
	}
	return [truthy, falsy] as [Array<T>, Array<T>]
}

function applyColumnOrder<F extends OrderingFeatures, T extends RowData>({
	instance,
	order
}: {
	instance: OrderedTableInstance<F, T>
	order: ColumnOrderState | null
}) {
	if (order == null) return

	const currentOrder = instance.atoms.columnOrder.get()
	const effectiveOrder =
		currentOrder.length > 0 ? currentOrder : instance.getAllLeafColumns().map((column) => column.id)
	if (!isColumnOrderEqual(effectiveOrder, order)) instance.setColumnOrder(order)
}

function useColumnOrderBreakpoint(
	entries: Array<ColumnOrderEntry>,
	defaultColumnOrder: ColumnOrderState | null,
	enabled: boolean
) {
	const breakpoints = useMemo(() => getColumnOrderChangeBreakpoints(entries), [entries])

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			if (!enabled || breakpoints.length === 0 || typeof window === 'undefined') return () => {}

			const mediaQueries = breakpoints.map((size) => window.matchMedia(`(min-width: ${size}px)`))
			for (const mediaQuery of mediaQueries) {
				mediaQuery.addEventListener('change', onStoreChange)
			}

			return () => {
				for (const mediaQuery of mediaQueries) {
					mediaQuery.removeEventListener('change', onStoreChange)
				}
			}
		},
		[breakpoints, enabled]
	)

	const getSnapshot = useCallback(() => {
		if (!enabled) return null
		return getCurrentColumnOrderBreakpoint(entries, defaultColumnOrder)
	}, [entries, defaultColumnOrder, enabled])

	return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

export function useTableSearch<F extends FilteringFeatures, T extends RowData>({
	instance,
	columnToSearch
}: {
	instance: Table<F, T>
	columnToSearch: string | undefined
}): [string, (value: string) => void] {
	const [search, setSearch] = useState('')
	const deferredSearch = useDeferredValue(search)

	useEffect(() => {
		if (!columnToSearch) return
		const column = instance.getColumn(columnToSearch)
		if (!column) return

		const currentValue = column_getFilterValue(column)
		if (currentValue === deferredSearch) return

		startTransition(() => {
			column_setFilterValue(column, deferredSearch)
		})
	}, [deferredSearch, instance, columnToSearch])

	return [search, setSearch]
}

export function useSortColumnOrders<F extends OrderingFeatures, T extends RowData>({
	instance,
	columnOrders
}: {
	instance: OrderedTableInstance<F, T>
	columnOrders?: ColumnOrdersByBreakpoint | null
}) {
	const allColumns = instance.getAllColumns()
	const defaultColumnOrder = useMemo(() => getLeafColumnIds(allColumns), [allColumns])
	const columnOrderEntries = useMemo(() => (columnOrders ? getColumnOrderEntries(columnOrders) : []), [columnOrders])
	const fixedColumnOrder = useMemo(() => getFixedColumnOrder(columnOrderEntries), [columnOrderEntries])
	const onlyDefaultColumnOrders =
		defaultColumnOrder != null &&
		columnOrderEntries.length > 0 &&
		columnOrderEntries.every(([, order]) => isColumnOrderEqual(order, defaultColumnOrder))
	const shouldTrackWidth = columnOrders != null && fixedColumnOrder == null
	const breakpoint = useColumnOrderBreakpoint(
		columnOrderEntries,
		defaultColumnOrder,
		shouldTrackWidth && !onlyDefaultColumnOrders
	)
	const selectedColumnOrder =
		columnOrders == null
			? null
			: (fixedColumnOrder ?? getOrderForBreakpoint(columnOrderEntries, breakpoint) ?? defaultColumnOrder)

	useEffect(() => {
		applyColumnOrder({ instance, order: selectedColumnOrder })
	}, [instance, selectedColumnOrder])
}

export function prepareTableCsv<F extends VisibilityFeatures, T extends RowData>({
	instance,
	filename,
	includeHiddenColumns = false
}: {
	instance: Table<F, T>
	filename: string
	includeHiddenColumns?: boolean
}): {
	filename: string
	rows: Array<Array<CsvCell>>
} {
	const columns = (includeHiddenColumns ? instance.getAllLeafColumns() : table_getVisibleLeafColumns(instance)).filter(
		(column) => !column.columnDef.meta?.hidden || column.columnDef.meta?.csvOnly
	)
	const tableRows = instance.getPrePaginatedRowModel().rows
	if (columns.length === 0) return { filename, rows: [] }

	const headers = columns.map((column) => {
		const csvHeader = (column.columnDef.meta as { csvHeader?: unknown } | undefined)?.csvHeader
		if (typeof csvHeader === 'string' && csvHeader.length > 0) return csvHeader
		const header = column.columnDef.header
		if (typeof header === 'string') return header
		if (typeof header === 'number') return String(header)
		return column.columnDef.id ?? column.id
	})

	const rows: Array<Array<CsvCell>> = tableRows.map((row) =>
		columns.map((column) => {
			const csvValue = column.columnDef.meta?.csvValue
			if (csvValue) return csvValue(row.original)
			const value = row.getValue(column.id)
			if (value == null) return ''
			if (typeof value === 'number') return Number.isFinite(value) ? value : ''
			if (typeof value === 'string' || typeof value === 'boolean') return value
			if (Array.isArray(value)) {
				return value
					.filter(
						(item): item is CsvCell =>
							(typeof item === 'number' && Number.isFinite(item)) ||
							typeof item === 'string' ||
							typeof item === 'boolean'
					)
					.join(', ')
			}
			return ''
		})
	)

	return { filename, rows: [headers, ...rows] }
}
