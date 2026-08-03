'use no memo'

import { useQuery } from '@tanstack/react-query'
import {
	type ColumnOrderState,
	type ExpandedState,
	getCoreRowModel,
	getExpandedRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
	type VisibilityState,
	type Row
} from '@tanstack/react-table'
import { useContext, useDeferredValue, useMemo, useState } from 'react'
import type {
	ParentProtocolMetrics,
	ProtocolTableSourceRow,
	ProtocolsUnifiedTableResponse
} from '~/containers/ProDashboard/unifiedTable/contracts'
import { fetchJson } from '~/utils/async'
import { StreamDoneContext } from '../../../queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '../../../queryPolicy'
import type { UnifiedTableConfig } from '../../../unifiedTable/config/current'
import {
	FILTERED_SHARE_METRIC_KEYS,
	getFilteredShareMetricKey,
	type FilteredShareMetricKey
} from '../../../unifiedTable/config/filteredShareColumns'
import type { UnifiedRowHeaderType } from '../../../unifiedTable/config/types'
import { buildUnifiedTableQueryString, getUnifiedTableQueryIdentity } from '../../../unifiedTableQuery'
import { getUnifiedTableColumns } from '../config/ColumnRegistry'
import {
	buildProtocolTableReadModel,
	collectProtocolTableLeaves,
	filterProtocolTableSourceRows,
	setProtocolTableFilteredShares
} from '../readModel'
import type { ProtocolTableRow } from '../types'
import { getProtocolAggregationPlan } from '../utils/aggregation'
import { filterReadModelRowsByConfig, filterRowsByConfig, hasProtocolSubsetFilters } from '../utils/dataFilters'

const EMPTY_ROWS: ProtocolTableSourceRow[] = []
const EMPTY_PARENT_METRICS: Record<string, ParentProtocolMetrics> = {}
const EMPTY_CHAIN_METRICS: NonNullable<ProtocolsUnifiedTableResponse['chainMetrics']> = {}
const getProtocolTableRowId = (row: ProtocolTableRow) => row.id
const getProtocolTableSubRows = (row: ProtocolTableRow) => (row.nodeType === 'group' ? row.subRows : undefined)
const getProtocolTableRowCanExpand = (row: Row<ProtocolTableRow>) => {
	if (row.original.nodeType === 'leaf') return false
	if (row.original.header === 'protocol') return row.original.subRows.length > 1
	return row.original.subRows.length > 0
}
const getProtocolTableCoreRowModel = getCoreRowModel<ProtocolTableRow>()
const getProtocolTableExpandedRowModel = getExpandedRowModel<ProtocolTableRow>()
const getProtocolTableSortedRowModel = getSortedRowModel<ProtocolTableRow>()
const getProtocolTablePaginationRowModel = getPaginationRowModel<ProtocolTableRow>()

interface UseUnifiedTableArgs {
	config: UnifiedTableConfig
	rowHeaders: UnifiedRowHeaderType[]
	searchTerm: string
	columnOrder: ColumnOrderState
	columnVisibility: VisibilityState
	sorting: SortingState
	onSortingChange: (updater: SortingState | ((prev: SortingState) => SortingState)) => void
}

const fetchUnifiedTableRows = async (config: UnifiedTableConfig, rowHeaders: UnifiedRowHeaderType[]) => {
	const queryString = buildUnifiedTableQueryString(config, rowHeaders)
	return fetchJson<ProtocolsUnifiedTableResponse>(
		`/api/public/pro-dashboard/unified-table/${config.strategy}?${queryString}`
	)
}

export function useUnifiedTable({
	config,
	rowHeaders,
	searchTerm,
	columnOrder,
	columnVisibility,
	sorting,
	onSortingChange
}: UseUnifiedTableArgs) {
	const [expanded, setExpanded] = useState<ExpandedState>({})
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 30 })

	const queryIdentity = useMemo(() => getUnifiedTableQueryIdentity(config, rowHeaders), [config, rowHeaders])
	const { queryKey } = queryIdentity
	const aggregationPlan = getProtocolAggregationPlan(queryIdentity)

	const streamDone = useContext(StreamDoneContext)
	const { data, isError, isLoading, refetch } = useQuery({
		queryKey,
		queryFn: () => fetchUnifiedTableRows(config, rowHeaders),
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME,
		retry: 1,
		enabled: streamDone
	})

	const deferredSearchTerm = useDeferredValue(searchTerm)

	const parentMetrics = data?.parentMetrics ?? EMPTY_PARENT_METRICS
	const chainMetrics = data?.chainMetrics ?? EMPTY_CHAIN_METRICS
	const sourceRows = useMemo(
		() => filterRowsByConfig(data?.rows ?? EMPTY_ROWS, config.filters, parentMetrics, chainMetrics),
		[data?.rows, config.filters, parentMetrics, chainMetrics]
	)
	const visibleSourceRows = useMemo(
		() => filterProtocolTableSourceRows(sourceRows, deferredSearchTerm, parentMetrics),
		[sourceRows, deferredSearchTerm, parentMetrics]
	)
	const filteredShareMetricKey = useMemo(() => {
		const metricKeys = new Set<FilteredShareMetricKey>()
		const addMetricKey = (columnId: string) => {
			const metricKey = getFilteredShareMetricKey(columnId)
			if (metricKey) metricKeys.add(metricKey)
		}
		for (const columnId of columnOrder) {
			if (columnVisibility[columnId] === false) continue
			addMetricKey(columnId)
		}
		for (const columnId in columnVisibility) {
			if (!columnVisibility[columnId]) continue
			addMetricKey(columnId)
		}
		for (const sort of sorting) {
			addMetricKey(sort.id)
		}
		const orderedMetricKeys: FilteredShareMetricKey[] = []
		for (const metricKey of FILTERED_SHARE_METRIC_KEYS) {
			if (metricKeys.has(metricKey)) orderedMetricKeys.push(metricKey)
		}
		return orderedMetricKeys.join('|')
	}, [columnOrder, columnVisibility, sorting])
	const filteredShareMetricKeys = useMemo(() => {
		if (!filteredShareMetricKey) return []
		const selected = new Set(filteredShareMetricKey.split('|'))
		return FILTERED_SHARE_METRIC_KEYS.filter((metricKey) => selected.has(metricKey))
	}, [filteredShareMetricKey])
	const readModel = useMemo(() => {
		const chainMetricScope =
			rowHeaders[0] !== 'chain'
				? 'group'
				: queryIdentity.rowMembership.kind === 'all-protocols' &&
					  !deferredSearchTerm.trim() &&
					  !config.params?.category &&
					  !hasProtocolSubsetFilters(config.filters)
					? 'canonical'
					: 'partial'
		const model = buildProtocolTableReadModel({
			rows: visibleSourceRows,
			rowHeaders,
			parentMetrics,
			chainMetrics,
			customColumns: config.customColumns ?? [],
			chainMetricScope,
			aggregationPlan
		})
		const rows = filterReadModelRowsByConfig(model.rows, config.filters)
		setProtocolTableFilteredShares(rows, filteredShareMetricKeys)
		if (rows === model.rows) return model
		return { rows, leaves: collectProtocolTableLeaves(rows) }
	}, [
		visibleSourceRows,
		rowHeaders,
		parentMetrics,
		chainMetrics,
		config.customColumns,
		config.filters,
		config.params?.category,
		queryIdentity.rowMembership.kind,
		deferredSearchTerm,
		filteredShareMetricKeys,
		aggregationPlan
	])
	const runtimeColumnIdsKey = useMemo(() => {
		const ids = new Set<string>(['name'])
		for (const columnId of columnOrder) {
			if (columnVisibility[columnId] !== false) ids.add(columnId)
		}
		for (const columnId in columnVisibility) {
			if (columnVisibility[columnId]) ids.add(columnId)
		}
		for (const sort of sorting) ids.add(sort.id)
		return Array.from(ids).sort().join('\0')
	}, [columnOrder, columnVisibility, sorting])
	const runtimeColumnIds = useMemo(() => runtimeColumnIdsKey.split('\0'), [runtimeColumnIdsKey])
	const earningsAreEstimated =
		rowHeaders.includes('chain') ||
		Boolean(config.params?.chains?.some((chain) => chain.trim().toLowerCase() !== 'all'))
	const columns = useMemo(
		() =>
			getUnifiedTableColumns({
				customColumns: config.customColumns,
				columnIds: runtimeColumnIds,
				earningsAreEstimated
			}),
		[config.customColumns, runtimeColumnIds, earningsAreEstimated]
	)

	const tableState = useMemo(
		() => ({
			columnOrder,
			columnVisibility,
			sorting,
			expanded,
			pagination
		}),
		[expanded, pagination, sorting, columnOrder, columnVisibility]
	)

	const table = useReactTable<ProtocolTableRow>({
		data: readModel.rows,
		columns,
		getRowId: getProtocolTableRowId,
		getSubRows: getProtocolTableSubRows,
		state: tableState,
		onSortingChange,
		onExpandedChange: setExpanded,
		onPaginationChange: setPagination,
		paginateExpandedRows: true,
		getRowCanExpand: getProtocolTableRowCanExpand,
		getCoreRowModel: getProtocolTableCoreRowModel,
		getExpandedRowModel: getProtocolTableExpandedRowModel,
		getSortedRowModel: getProtocolTableSortedRowModel,
		getPaginationRowModel: getProtocolTablePaginationRowModel,
		autoResetExpanded: false,
		autoResetPageIndex: true
	})
	const rows = table.getRowModel().rows

	return {
		table,
		isLoading: isLoading || (!streamDone && data === undefined),
		hasInitialError: isError && data === undefined,
		refetch,
		leafRows: readModel.leaves,
		rows,
		headerGroups: table.getHeaderGroups(),
		visibleLeafColumns: table.getVisibleLeafColumns(),
		totalTableWidth: table.getTotalSize(),
		pageIndex: pagination.pageIndex,
		pageSize: pagination.pageSize,
		pageCount: table.getPageCount(),
		canPreviousPage: table.getCanPreviousPage(),
		canNextPage: table.getCanNextPage(),
		previousPage: table.previousPage,
		nextPage: table.nextPage,
		setPageSize: table.setPageSize
	}
}
