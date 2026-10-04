import type { ColumnVisibilityState, SortingState } from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { downloadCSV } from '~/utils/download'
import { requestDashboardItemReveal } from '../../hooks/useDashboardItemDeepLink'
import { useProDashboardEditorActions, useProDashboardPermissions } from '../../ProDashboardAPIContext'
import type { UnifiedTableConfig, UnifiedTableFilters } from '../../unifiedTable/config/current'
import { FILTERED_SHARE_METRIC_KEYS, getFilteredShareColumnId } from '../../unifiedTable/config/filteredShareColumns'
import { sanitizeFiltersForGrouping } from '../../unifiedTable/config/groupingCapabilities'
import {
	applyUnifiedTableRowHeaderVisibility,
	normalizeUnifiedTableSorting,
	sanitizeUnifiedTableRowHeaders
} from '../../unifiedTable/config/layoutPolicy'
import type { CustomColumnDefinition, UnifiedRowHeaderType } from '../../unifiedTable/config/types'
import { toastRefusal } from '../../useDashboardActions'
import { BoundParameterBadge } from '../BoundParameterBadge'
import { ProCardError, ProCardLoading, ProCardRefreshFailed } from '../ProCardStatus'
import { TablePagination } from '../Table/TablePagination'
import { sanitizeConfigColumns } from './config/metricCapabilities'
import type { CsvExportLevel } from './core/csvExportLevels'
import { UnifiedTableHeader } from './core/UnifiedTableHeader'
import { UnifiedVirtualTable } from './core/UnifiedVirtualTable'
import { useUnifiedTable } from './core/useUnifiedTable'
import type { ProtocolTableRow, UnifiedTableProps } from './types'
import { getDefaultColumnOrder, getDefaultColumnVisibility } from './utils/configHelpers'
import { buildGroupedCsvData, getProtocolTableCsvValue, getRowsAtGroupLevel } from './utils/csvExport'
import type { ActiveFilterChip } from './utils/filterChips'
import { getActiveFilterChips } from './utils/filterChips'

const CSV_PERCENT_COLUMNS = new Set([
	'change1d',
	'change7d',
	'change1m',
	'volumeChange_1d',
	'volume24hChange7dAgo',
	'volume24hChange30dAgo',
	'volumeChange7dOver7d',
	'volumeChange30dOver30d',
	'volumeDominance_24h',
	'volumeMarketShare7d',
	'feesChange_1d',
	'fees24hChange7dAgo',
	'fees24hChange30dAgo',
	'feesChange7dOver7d',
	'feesChange30dOver30d',
	'holderRevenueChange7dOver7d',
	'holderRevenueChange30dOver30d',
	'revenueChange_1d',
	'revenue24hChange7dAgo',
	'revenue24hChange30dAgo',
	'revenueChange7dOver7d',
	'revenueChange30dOver30d',
	'perps_volume_change_1d',
	'perpsVolume24hChange7dAgo',
	'perpsVolume24hChange30dAgo',
	'perpsVolumeChange7dOver7d',
	'perpsVolumeChange30dOver30d',
	'perps_volume_dominance_24h',
	'aggregators_volume_change_1d',
	'aggregatorVolume24hChange7dAgo',
	'aggregatorVolume24hChange30dAgo',
	'aggregatorVolumeChange7dOver7d',
	'aggregators_volume_dominance_24h',
	'aggregators_volume_marketShare7d',
	'derivatives_aggregators_volume_change_1d',
	'derivativesAggregatorVolume24hChange7dAgo',
	'derivativesAggregatorVolume24hChange30dAgo',
	'derivativesAggregatorVolumeChange7dOver7d',
	'derivativesAggregatorVolumeChange30dOver30d',
	'options_volume_change_1d',
	'optionsVolume24hChange7dAgo',
	'optionsVolume24hChange30dAgo',
	'optionsVolumeChange7dOver7d',
	'options_volume_dominance_24h',
	'tvlShare',
	'stablesShare',
	'volume24hShare',
	'bridgeAggregatorVolumeDominance24h',
	...FILTERED_SHARE_METRIC_KEYS.map(getFilteredShareColumnId)
])

const ROW_HEADER_LABELS: Record<UnifiedRowHeaderType, string> = {
	chain: 'Chain',
	category: 'Category',
	'parent-protocol': 'Protocol',
	protocol: 'Protocol'
}

interface RowGroupingOption {
	id: string
	label: string
	headers: Array<UnifiedRowHeaderType>
}

const PROTOCOL_GROUPING_OPTIONS: Array<RowGroupingOption> = [
	{ id: 'parent-protocol', label: 'Protocol Group › Protocol', headers: ['parent-protocol', 'protocol'] },
	{ id: 'protocol-only', label: 'Protocol only', headers: ['protocol'] },
	{ id: 'category-protocol', label: 'Category › Protocol', headers: ['category', 'parent-protocol', 'protocol'] },
	{ id: 'chain-protocol', label: 'Chain › Protocol', headers: ['chain', 'parent-protocol', 'protocol'] },
	{
		id: 'chain-category-protocol',
		label: 'Chain › Category › Protocol',
		headers: ['chain', 'category', 'parent-protocol', 'protocol']
	}
]

const PROTOCOL_GROUPING_OPTION_MAP = new Map(PROTOCOL_GROUPING_OPTIONS.map((option) => [option.id, option]))
const PROTOCOL_GROUPING_HEADERS = PROTOCOL_GROUPING_OPTIONS.map(({ id, label }) => ({ id, label }))
const EMPTY_COLUMN_ORDER: Array<string> = []
const EMPTY_COLUMN_VISIBILITY: ColumnVisibilityState = {}
const EMPTY_CUSTOM_COLUMNS: Array<CustomColumnDefinition> = []
const EMPTY_CHAINS: Array<string> = []

type ConfigOverrides = Omit<Partial<UnifiedTableConfig>, 'filters'> & {
	filters?: UnifiedTableFilters | undefined
}

const rowHeadersMatch = (a: Array<UnifiedRowHeaderType>, b: Array<UnifiedRowHeaderType>) => {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false
	}
	return true
}

function UnifiedTable({ config, onEdit }: UnifiedTableProps) {
	const { handleDuplicateUnifiedTable, handleEditItem } = useProDashboardEditorActions()
	const { isReadOnly, hideDuplicateButton } = useProDashboardPermissions()
	const [searchTerm, setSearchTerm] = useState('')
	const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
	const canEditFilters = !isReadOnly
	const resolvedRowHeaders = useMemo(() => sanitizeUnifiedTableRowHeaders(config.rowHeaders), [config.rowHeaders])
	const configuredFilters = useMemo(
		() => sanitizeFiltersForGrouping(config.filters, resolvedRowHeaders),
		[config.filters, resolvedRowHeaders]
	)
	const filterChips = useMemo(() => getActiveFilterChips(configuredFilters), [configuredFilters])
	const activeFilterCount = filterChips.length
	const canEditGrouping = !isReadOnly && PROTOCOL_GROUPING_OPTIONS.length > 0
	const { columnOrder, columnVisibility, customColumns } = config
	const selectedGroupingId = useMemo(() => {
		if (PROTOCOL_GROUPING_OPTIONS.length === 0) {
			return undefined
		}
		const match = PROTOCOL_GROUPING_OPTIONS.find((option) => rowHeadersMatch(option.headers, resolvedRowHeaders))
		return match?.id
	}, [resolvedRowHeaders])

	const configuredColumnOrder = useMemo(
		() =>
			getDefaultColumnOrder(
				{
					columnOrder: columnOrder ?? EMPTY_COLUMN_ORDER,
					customColumns: customColumns ?? EMPTY_CUSTOM_COLUMNS
				},
				resolvedRowHeaders
			),
		[columnOrder, customColumns, resolvedRowHeaders]
	)
	const configuredColumnVisibility = useMemo(
		() =>
			getDefaultColumnVisibility(
				{
					columnOrder: columnOrder ?? EMPTY_COLUMN_ORDER,
					columnVisibility: columnVisibility ?? EMPTY_COLUMN_VISIBILITY,
					customColumns: customColumns ?? EMPTY_CUSTOM_COLUMNS
				},
				resolvedRowHeaders
			),
		[columnOrder, columnVisibility, customColumns, resolvedRowHeaders]
	)
	const configuredSorting = useMemo(
		() =>
			sanitizeConfigColumns({
				order: [],
				visibility: {},
				sorting: normalizeUnifiedTableSorting(config.defaultSorting),
				customColumns: config.customColumns,
				rowHeaders: resolvedRowHeaders
			}).sorting,
		[config.defaultSorting, config.customColumns, resolvedRowHeaders]
	)

	const persistConfigChanges = useCallback(
		(overrides: ConfigOverrides) => {
			if (isReadOnly) return
			const { filters, ...otherOverrides } = overrides
			const nextRowHeaders = sanitizeUnifiedTableRowHeaders(otherOverrides.rowHeaders ?? resolvedRowHeaders)
			const nextColumns = sanitizeConfigColumns({
				order: otherOverrides.columnOrder ?? configuredColumnOrder,
				visibility: otherOverrides.columnVisibility ?? configuredColumnVisibility,
				sorting: otherOverrides.defaultSorting ?? configuredSorting,
				customColumns: otherOverrides.customColumns ?? config.customColumns,
				rowHeaders: nextRowHeaders
			})
			const sourceFilters = Object.hasOwn(overrides, 'filters') ? filters : configuredFilters
			const nextFilters = sanitizeFiltersForGrouping(sourceFilters, nextRowHeaders)
			const { filters: _configFilters, ...configWithoutFilters } = config
			const nextConfig: UnifiedTableConfig = {
				...configWithoutFilters,
				...otherOverrides,
				rowHeaders: nextRowHeaders,
				columnOrder: nextColumns.order,
				columnVisibility: nextColumns.visibility,
				defaultSorting: nextColumns.sorting
			}
			if (nextFilters) nextConfig.filters = nextFilters
			toastRefusal(handleEditItem(config.id, nextConfig))
		},
		[
			config,
			configuredColumnOrder,
			configuredColumnVisibility,
			configuredSorting,
			configuredFilters,
			handleEditItem,
			isReadOnly,
			resolvedRowHeaders
		]
	)

	const handleSortingChange = useCallback(
		(updater: SortingState | ((prev: SortingState) => SortingState)) => {
			const next = typeof updater === 'function' ? updater(configuredSorting) : updater
			persistConfigChanges({ defaultSorting: next })
		},
		[configuredSorting, persistConfigChanges]
	)

	const memoizedConfig = useMemo<UnifiedTableConfig>(() => {
		const nextConfig: UnifiedTableConfig = {
			...config,
			rowHeaders: resolvedRowHeaders,
			columnOrder: configuredColumnOrder,
			columnVisibility: configuredColumnVisibility,
			defaultSorting: configuredSorting
		}
		if (configuredFilters === undefined) delete nextConfig.filters
		else nextConfig.filters = configuredFilters
		return nextConfig
	}, [
		config,
		configuredFilters,
		configuredColumnOrder,
		configuredColumnVisibility,
		configuredSorting,
		resolvedRowHeaders
	])

	const unifiedTable = useUnifiedTable({
		config: memoizedConfig,
		rowHeaders: resolvedRowHeaders,
		searchTerm,
		columnOrder: configuredColumnOrder,
		columnVisibility: configuredColumnVisibility,
		sorting: configuredSorting,
		onSortingChange: handleSortingChange
	})

	const handleFilterChipRemove = useCallback(
		(chip: ActiveFilterChip) => {
			if (!canEditFilters) {
				return
			}
			const currentFilters: UnifiedTableFilters = { ...configuredFilters }
			let changed = false
			for (const key of chip.clearKeys) {
				if (key in currentFilters) {
					delete currentFilters[key]
					changed = true
				}
			}
			if (!changed) {
				return
			}
			const nextFilters = Object.keys(currentFilters).length > 0 ? currentFilters : undefined
			persistConfigChanges(nextFilters ? { filters: nextFilters } : { filters: undefined })
		},
		[canEditFilters, configuredFilters, persistConfigChanges]
	)

	const handleClearFilters = useCallback(() => {
		if (!canEditFilters) {
			return
		}
		if (!configuredFilters) {
			return
		}
		let hasFilters = false
		for (const _ in configuredFilters) {
			hasFilters = true
			break
		}
		if (!hasFilters) {
			return
		}
		persistConfigChanges({ filters: undefined })
	}, [canEditFilters, configuredFilters, persistConfigChanges])

	const handleGroupingChange = useCallback(
		(groupingId: string) => {
			const option = PROTOCOL_GROUPING_OPTION_MAP.get(groupingId)
			if (!option) {
				return
			}
			const nextVisibility = applyUnifiedTableRowHeaderVisibility(option.headers, configuredColumnVisibility)
			persistConfigChanges({ rowHeaders: option.headers, columnVisibility: nextVisibility })
		},
		[configuredColumnVisibility, persistConfigChanges]
	)

	const handleExportClick = useCallback(() => {
		const table = unifiedTable.table
		const leafColumns = table.getAllLeafColumns().filter((column) => column.getIsVisible())

		const columnHeaders = leafColumns.map((column) => {
			const header = column.columnDef.header
			return typeof header === 'string' ? header : (column.id ?? '')
		})

		const nameIndex = columnHeaders.findIndex((h) => h === 'Name' || h === 'name')
		const insertIndex = nameIndex >= 0 ? nameIndex + 1 : 0
		const headers = [...columnHeaders.slice(0, insertIndex), 'Chain', ...columnHeaders.slice(insertIndex)]
		const customColumnsById = new Map((config.customColumns ?? []).map((column) => [column.id, column]))
		const csvRows: Array<Array<string>> = [headers]
		const appendLeafRow = (row: Extract<ProtocolTableRow, { nodeType: 'leaf' }>) => {
			const rowData: Array<string> = []
			for (let index = 0; index <= leafColumns.length; index++) {
				if (index === insertIndex) rowData.push(row.chain ?? '')
				const column = leafColumns[index]
				if (column) rowData.push(getProtocolTableCsvValue(row, column.id, CSV_PERCENT_COLUMNS, customColumnsById))
			}
			csvRows.push(rowData)
		}
		const appendLeafRows = (rows: ReturnType<(typeof table)['getPreExpandedRowModel']>['rows']) => {
			for (const row of rows) {
				if (row.original.nodeType === 'group' && row.subRows.length > 0) appendLeafRows(row.subRows)
				else if (row.original.nodeType === 'leaf') appendLeafRow(row.original)
			}
		}
		appendLeafRows(table.getPreExpandedRowModel().rows)

		downloadCSV(`unified-table.csv`, csvRows)
	}, [config.customColumns, unifiedTable.table])

	const handleCsvClick = useCallback(() => {
		if (unifiedTable.leafRows.length === 0) return
		handleExportClick()
	}, [handleExportClick, unifiedTable.leafRows.length])

	const handleExportAtLevel = useCallback(
		(level: CsvExportLevel) => {
			if (unifiedTable.leafRows.length === 0) return

			const table = unifiedTable.table
			const leafColumns = table.getAllLeafColumns().filter((column) => column.getIsVisible())

			if (level === 'all') {
				handleExportClick()
				return
			}

			const groupedRows = getRowsAtGroupLevel(table, level)
			if (groupedRows.length === 0) {
				handleExportClick()
				return
			}

			const { headers, data } = buildGroupedCsvData({
				rows: groupedRows,
				columns: leafColumns,
				percentColumns: CSV_PERCENT_COLUMNS,
				level,
				customColumns: config.customColumns ?? []
			})
			data.unshift(headers)
			downloadCSV(`unified-table-${level}.csv`, data)
		},
		[handleExportClick, unifiedTable.leafRows.length, unifiedTable.table, config.customColumns]
	)

	const title = 'Protocols overview'
	const scopeDescription = useMemo(() => {
		const selectedChains = (config.params?.chains ?? EMPTY_CHAINS).filter((value): value is string => Boolean(value))
		if (selectedChains.length === 0 || selectedChains.includes('All')) {
			return 'Scope: All chains'
		}
		if (selectedChains.length <= 3) {
			return `Scope: ${selectedChains.join(', ')}`
		}
		return `Scope: ${selectedChains.length} chains`
	}, [config.params?.chains])
	const rowHeadersSummary = useMemo(() => {
		if (resolvedRowHeaders.length === 0) {
			return null
		}
		const labels = resolvedRowHeaders.map((header) => ROW_HEADER_LABELS[header] ?? header)
		const uniqueLabels = [...new Set(labels)]
		return uniqueLabels.join(' › ')
	}, [resolvedRowHeaders])

	const handleCustomizeColumns = useCallback(() => {
		if (isReadOnly) return
		onEdit?.('columns')
	}, [isReadOnly, onEdit])

	const handleFiltersClick = useCallback(() => {
		onEdit?.('filters')
	}, [onEdit])

	const canCustomizeColumns = Boolean(!isReadOnly && onEdit)

	return (
		<div className="flex h-full w-full flex-col overflow-hidden p-0">
			{unifiedTable.loadError === 'refresh' ? <ProCardRefreshFailed retry={unifiedTable} /> : null}
			<UnifiedTableHeader
				title={title}
				titleBadge={<BoundParameterBadge {...(config.bindings === undefined ? {} : { bindings: config.bindings })} />}
				scopeDescription={scopeDescription}
				rowHeadersSummary={rowHeadersSummary}
				onCustomizeColumns={canCustomizeColumns ? handleCustomizeColumns : undefined}
				onDuplicate={!isReadOnly && !hideDuplicateButton ? () => setShowDuplicateConfirm(true) : undefined}
				onCsvExport={handleCsvClick}
				onCsvExportLevel={handleExportAtLevel}
				rowHeaders={resolvedRowHeaders}
				isExportDisabled={unifiedTable.leafRows.length === 0}
				isLoading={unifiedTable.isLoading}
				onSearchChange={setSearchTerm}
				filterChips={filterChips}
				onFilterRemove={canEditFilters ? handleFilterChipRemove : undefined}
				onClearFilters={canEditFilters ? handleClearFilters : undefined}
				filtersEditable={canEditFilters}
				activeFilterCount={activeFilterCount}
				onFiltersClick={canEditFilters && onEdit ? handleFiltersClick : undefined}
				groupingOptions={PROTOCOL_GROUPING_HEADERS}
				selectedGroupingId={selectedGroupingId}
				onGroupingChange={canEditGrouping ? handleGroupingChange : undefined}
			/>
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
				{unifiedTable.loadError === 'initial' ? (
					<div className="relative isolate flex h-[calc(450px*var(--card-scale,1))] overflow-hidden rounded-md border border-pro-cards-border bg-pro-cards-bg">
						<ProCardError title="Couldn't load this table" retry={unifiedTable} />
					</div>
				) : unifiedTable.isLoading ? (
					<div className="relative isolate flex h-[calc(450px*var(--card-scale,1))] overflow-hidden rounded-md border border-pro-cards-border bg-pro-cards-bg p-3">
						<ProCardLoading variant="table" />
					</div>
				) : (
					<div className="relative isolate flex h-[calc(450px*var(--card-scale,1))] flex-col overflow-hidden rounded-md border border-pro-cards-border bg-pro-cards-bg">
						<UnifiedVirtualTable
							rows={unifiedTable.rows}
							headerGroups={unifiedTable.headerGroups}
							visibleLeafColumns={unifiedTable.visibleLeafColumns}
							totalTableWidth={unifiedTable.totalTableWidth}
							pageIndex={unifiedTable.pageIndex}
							pageSize={unifiedTable.pageSize}
						/>
						{unifiedTable.leafRows.length === 0 ? (
							<div className="pointer-events-none absolute inset-0 z-5 flex items-center justify-center bg-linear-to-b from-transparent via-pro-cards-bg/90 to-pro-cards-bg">
								<div
									role="status"
									className="pointer-events-auto rounded-md border border-pro-cards-border bg-pro-cards-bg px-4 py-3 body-md text-pro-text-secondary"
								>
									No rows match your scope or filters.
								</div>
							</div>
						) : null}
					</div>
				)}
				<TablePagination
					pageSize={unifiedTable.pageSize}
					pageIndex={unifiedTable.pageIndex}
					pageCount={unifiedTable.pageCount}
					canPreviousPage={unifiedTable.canPreviousPage}
					canNextPage={unifiedTable.canNextPage}
					previousPage={unifiedTable.previousPage}
					nextPage={unifiedTable.nextPage}
					setPageSize={unifiedTable.setPageSize}
					showPageSizes
				/>
			</div>
			<ConfirmDialog
				open={showDuplicateConfirm}
				onClose={() => setShowDuplicateConfirm(false)}
				unmountOnHide
				scope="pro"
				title="Duplicate table"
				description="Create a duplicate of this table in the dashboard?"
				confirmLabel="Duplicate"
				pendingLabel={null}
				error={null}
				tone="primary"
				onConfirm={() => {
					const duplicated = handleDuplicateUnifiedTable(config)
					setShowDuplicateConfirm(false)
					toastRefusal(duplicated)
					if (duplicated.status === 'saved') requestDashboardItemReveal(duplicated.ids[0], { scroll: 'nearest' })
				}}
			/>
		</div>
	)
}

export default UnifiedTable
