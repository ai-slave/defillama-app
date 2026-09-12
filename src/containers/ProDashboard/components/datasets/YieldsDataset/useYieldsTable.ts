import {
	columnFilteringFeature,
	columnOrderingFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_includesString,
	filterFn_inNumberRange,
	rowPaginationFeature,
	tableFeatures,
	useTable,
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnSizingState,
	type ColumnVisibilityState,
	type PaginationState,
	type SortingState
} from '@tanstack/react-table'
import * as React from 'react'
import { sortingFeatures } from '~/components/Table/features/sorting'
import { useTableSearch } from '~/components/Table/utils'
import type { YieldsFilters } from '~/containers/ProDashboard/types'
import { downloadCSV as downloadCSVFile } from '~/utils/download'
import type { ProYieldRow } from '../../../yieldData'
import { YIELDS_COLUMN_ID_SET, YIELDS_COLUMN_IDS, yieldsDatasetColumns, type YieldColumnId } from './columns'
import { buildYieldsFilterOptions } from './options'

export const tableFeaturesConfig = tableFeatures({
	...sortingFeatures,
	columnVisibilityFeature,
	columnSizingFeature,
	columnOrderingFeature,
	columnFilteringFeature,
	rowPaginationFeature,
	filterFns: { includesString: filterFn_includesString, inNumberRange: filterFn_inNumberRange },
	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	paginatedRowModel: createPaginatedRowModel()
})

const ESSENTIAL_YIELDS_COLUMNS: ReadonlyArray<YieldColumnId> = [
	'pool',
	'project',
	'chains',
	'tvl',
	'apy',
	'apyBase',
	'apyReward'
]
const YIELDS_COLUMN_PRESETS = {
	essential: ESSENTIAL_YIELDS_COLUMNS,
	supply: ['pool', 'project', 'chains', 'tvl', 'apy', 'apyBase', 'apyReward', 'apyMean30d'],
	borrow: ['pool', 'project', 'chains', 'apyBorrow', 'totalSupplyUsd', 'totalBorrowUsd', 'totalAvailableUsd', 'ltv'],
	risk: ['pool', 'project', 'chains', 'tvl', 'apy', 'stabilityRating', 'ilRisk'],
	activity: ['pool', 'project', 'chains', 'tvl', 'apy', 'volumeUsd1d']
} satisfies Record<string, ReadonlyArray<YieldColumnId>>
const EMPTY_TABLE_DATA: Array<ProYieldRow> = []
const DEFAULT_COLUMN_SIZING: ColumnSizingState = {
	pool: 320,
	project: 140,
	chains: 60,
	tvl: 120,
	apy: 100,
	apyBase: 100,
	apyReward: 150,
	apyMean30d: 130,
	stabilityRating: 120,
	volumeUsd1d: 120,
	ilRisk: 80,
	apyBorrow: 100,
	totalSupplyUsd: 130,
	totalBorrowUsd: 130,
	totalAvailableUsd: 120,
	ltv: 80
}
const YIELDS_CSV_HEADER_MAP: Record<YieldColumnId, string> = {
	pool: 'Pool',
	project: 'Project',
	chains: 'Chain',
	tvl: 'TVL',
	apy: 'Supply APY',
	apyBase: 'Base APY',
	apyReward: 'Reward APY',
	apyMean30d: '30d Avg APY',
	stabilityRating: '30d Stability',
	volumeUsd1d: '24h Volume',
	ilRisk: 'IL Risk',
	apyBorrow: 'Borrow Cost APY',
	totalSupplyUsd: 'Total Supplied',
	totalBorrowUsd: 'Total Borrowed',
	totalAvailableUsd: 'Available',
	ltv: 'LTV'
}
interface UseYieldsTableOptions {
	data: Array<ProYieldRow>
	initialColumnOrder: Array<string> | undefined
	initialColumnVisibility: Record<string, boolean> | undefined
	initialFilters: YieldsFilters | undefined
	onColumnsChange: (columnOrder: Array<string>, columnVisibility: Record<string, boolean>) => void
	onFiltersChange: (filters: YieldsFilters) => void
}

function isYieldColumnId(id: string): id is YieldColumnId {
	return YIELDS_COLUMN_ID_SET.has(id)
}

function getYieldColumnPreset(name: string): ReadonlyArray<YieldColumnId> | undefined {
	switch (name) {
		case 'essential':
			return YIELDS_COLUMN_PRESETS.essential
		case 'supply':
			return YIELDS_COLUMN_PRESETS.supply
		case 'borrow':
			return YIELDS_COLUMN_PRESETS.borrow
		case 'risk':
			return YIELDS_COLUMN_PRESETS.risk
		case 'activity':
			return YIELDS_COLUMN_PRESETS.activity
		default:
			return undefined
	}
}

export function useYieldsTable({
	data,
	initialColumnOrder,
	initialColumnVisibility,
	initialFilters,
	onColumnsChange,
	onFiltersChange
}: UseYieldsTableOptions) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'tvl', desc: true }])
	let hasInitialVisibility = false
	for (const id of YIELDS_COLUMN_IDS) {
		if (initialColumnVisibility?.[id] != null) {
			hasInitialVisibility = true
			break
		}
	}
	const initialPreset = hasInitialVisibility ? null : 'essential'
	const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>(() => {
		const visibility: ColumnVisibilityState = {}
		for (const id of YIELDS_COLUMN_IDS) {
			visibility[id] = hasInitialVisibility
				? initialColumnVisibility?.[id] !== false
				: ESSENTIAL_YIELDS_COLUMNS.includes(id)
		}
		return visibility
	})
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() => {
		const savedOrder = (initialColumnOrder ?? []).filter(isYieldColumnId)
		if (savedOrder.length > 0 && hasInitialVisibility) return savedOrder
		return hasInitialVisibility
			? YIELDS_COLUMN_IDS.filter((id) => columnVisibility[id] !== false)
			: [...ESSENTIAL_YIELDS_COLUMNS]
	})
	const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(DEFAULT_COLUMN_SIZING)
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	})
	const [showColumnPanel, setShowColumnPanel] = React.useState(false)
	const [searchTerm, setSearchTerm] = React.useState('')
	const [selectedPreset, setSelectedPreset] = React.useState<string | null>(initialPreset)
	const [showFiltersPanel, setShowFiltersPanel] = React.useState(false)
	const [filters, setFilters] = React.useState<YieldsFilters>(initialFilters ?? {})

	const filteredData = React.useMemo(() => {
		const selectedProtocols = filters.protocols?.length
			? new Set(filters.protocols.map((protocol) => protocol.toLowerCase()))
			: null
		const selectedChains =
			filters.chains && filters.chains.length > 0 ? new Set(filters.chains.map((chain) => chain.toLowerCase())) : null
		const selectedCategories = filters.categories?.length ? new Set(filters.categories) : null
		const selectedTokens = filters.tokens?.length ? new Set(filters.tokens.map((token) => token.toUpperCase())) : null

		return data.filter((row) => {
			if (filters.apyMin !== undefined && (row.apy == null || row.apy < filters.apyMin)) return false
			if (filters.apyMax !== undefined && (row.apy == null || row.apy > filters.apyMax)) return false

			if (filters.baseApyMin !== undefined && (row.apyBase == null || row.apyBase < filters.baseApyMin)) return false
			if (filters.baseApyMax !== undefined && (row.apyBase == null || row.apyBase > filters.baseApyMax)) return false

			if (filters.tvlMin !== undefined && (row.tvl == null || row.tvl < filters.tvlMin)) return false
			if (filters.tvlMax !== undefined && (row.tvl == null || row.tvl > filters.tvlMax)) return false
			if (selectedChains) {
				const hasMatchingChain = row.chains.some((chain) => selectedChains.has(chain.toLowerCase()))
				if (!hasMatchingChain) return false
			}

			if (
				selectedProtocols &&
				!selectedProtocols.has(row.projectslug.toLowerCase()) &&
				!selectedProtocols.has(row.project.toLowerCase())
			)
				return false

			if (filters.hasRewards && (!row.apyReward || row.apyReward <= 0)) return false

			if (filters.stablesOnly && !row.stablecoin) return false

			if (selectedCategories && (!row.category || !selectedCategories.has(row.category))) return false

			if (selectedTokens) {
				const hasMatchingToken = row.tokenSymbols.some((token) => selectedTokens.has(token.toUpperCase()))
				if (!hasMatchingToken) return false
			}

			return true
		})
	}, [data, filters])

	const table = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
		data: filteredData.length > 0 ? filteredData : EMPTY_TABLE_DATA,
		columns: yieldsDatasetColumns,
		state: {
			sorting,
			columnOrder,
			columnSizing,
			columnFilters,
			pagination,
			columnVisibility
		},
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		onColumnOrderChange: setColumnOrder,
		onColumnSizingChange: setColumnSizing,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		onColumnVisibilityChange: setColumnVisibility,
		maxMultiSortColCount: 1,
		autoResetPageIndex: true
	})

	const applyPreset = React.useCallback(
		(presetName: string) => {
			const preset = getYieldColumnPreset(presetName)
			if (!preset) return
			const nextOrder = [...preset]
			const nextVisibility: ColumnVisibilityState = {}

			for (const colId of YIELDS_COLUMN_IDS) nextVisibility[colId] = preset.includes(colId)

			setColumnVisibility(nextVisibility)
			setColumnOrder(nextOrder)
			setShowColumnPanel(false)
			setSelectedPreset(presetName)
			onColumnsChange(nextOrder, nextVisibility)
		},
		[onColumnsChange]
	)

	const currentColumns = React.useMemo(() => {
		const allColumns = table.getAllLeafColumns()
		const visibility: ColumnVisibilityState = {}
		for (const col of allColumns) {
			visibility[col.id] = columnVisibility[col.id] !== false
		}
		return visibility
	}, [table, columnVisibility])

	const toggleColumnVisibility = (columnKey: string, isVisible: boolean) => {
		const nextVisibility = { ...columnVisibility, [columnKey]: isVisible }
		const nextOrder = isVisible
			? columnOrder.includes(columnKey)
				? columnOrder
				: [...columnOrder, columnKey]
			: columnOrder.filter((id) => id !== columnKey)
		setColumnVisibility(nextVisibility)
		setColumnOrder(nextOrder)
		setSelectedPreset(null)
		onColumnsChange(nextOrder, nextVisibility)
	}

	const moveColumnUp = (columnKey: string) => {
		const index = columnOrder.indexOf(columnKey)
		if (index <= 0) return

		const nextOrder = [...columnOrder]
		const column = nextOrder[index]
		if (!column) return
		nextOrder.splice(index, 1)
		nextOrder.splice(index - 1, 0, column)
		setColumnOrder(nextOrder)
		onColumnsChange(nextOrder, columnVisibility)
	}

	const moveColumnDown = (columnKey: string) => {
		const index = columnOrder.indexOf(columnKey)
		if (index === -1 || index >= columnOrder.length - 1) return

		const nextOrder = [...columnOrder]
		const column = nextOrder[index]
		if (!column) return
		nextOrder.splice(index, 1)
		nextOrder.splice(index + 1, 0, column)
		setColumnOrder(nextOrder)
		onColumnsChange(nextOrder, columnVisibility)
	}

	const downloadCSV = React.useCallback(() => {
		const visibleColumnIds = columnOrder.filter((id) => columnVisibility[id] !== false)
		const headers = visibleColumnIds.map((id) => (isYieldColumnId(id) ? YIELDS_CSV_HEADER_MAP[id] : id))
		const csvRows = table.getFilteredRowModel().rows.map((row) =>
			visibleColumnIds.map((id) => {
				if (!isYieldColumnId(id)) return ''
				const value = row.original[id]
				if (Array.isArray(value)) return value.join(';')
				return value ?? ''
			})
		)

		downloadCSVFile('yields-data.csv', [headers, ...csvRows], { addTimestamp: true })
	}, [table, columnOrder, columnVisibility])

	const [poolName, setPoolName] = useTableSearch({ instance: table, columnToSearch: 'pool' })

	const { availableTokens, availableProtocols, availableCategories } = React.useMemo(
		() => buildYieldsFilterOptions(data),
		[data]
	)

	const activeFilterCount = React.useMemo(() => {
		let count = 0
		if (filters.apyMin !== undefined) count++
		if (filters.apyMax !== undefined) count++
		if (filters.tvlMin !== undefined) count++
		if (filters.tvlMax !== undefined) count++
		if (filters.baseApyMin !== undefined) count++
		if (filters.baseApyMax !== undefined) count++
		if (filters.chains && filters.chains.length > 0) count++
		if (filters.protocols && filters.protocols.length > 0) count++
		if (filters.tokens && filters.tokens.length > 0) count++
		if (filters.hasRewards) count++
		if (filters.stablesOnly) count++
		if (filters.categories && filters.categories.length > 0) count++
		return count
	}, [filters])

	const applyFilters = React.useCallback(
		(newFilters?: YieldsFilters) => {
			const filtersToApply = newFilters !== undefined ? newFilters : filters
			onFiltersChange(filtersToApply)
		},
		[filters, onFiltersChange]
	)

	const resetFilters = React.useCallback(() => {
		setFilters({})
		onFiltersChange({})
	}, [onFiltersChange])

	return {
		table,
		pageIndex: pagination.pageIndex,
		pageSize: pagination.pageSize,
		pageCount: table.getPageCount(),
		canPreviousPage: table.getCanPreviousPage(),
		canNextPage: table.getCanNextPage(),
		previousPage: table.previousPage,
		nextPage: table.nextPage,
		setPageSize: table.setPageSize,
		rowCount: table.getRowCount(),
		showColumnPanel,
		setShowColumnPanel,
		searchTerm,
		setSearchTerm,
		currentColumns,
		columnOrder,
		toggleColumnVisibility,
		moveColumnUp,
		moveColumnDown,
		applyPreset,
		activePreset: selectedPreset,
		downloadCSV,
		poolName,
		setPoolName,
		showFiltersPanel,
		setShowFiltersPanel,
		filters,
		setFilters,
		availableTokens,
		availableProtocols,
		availableCategories,
		activeFilterCount,
		applyFilters,
		resetFilters,
		columnPresets: YIELDS_COLUMN_PRESETS
	}
}
