import {
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnSizingState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
	type VisibilityState
} from '@tanstack/react-table'
import * as React from 'react'
import { useTableSearch } from '~/components/Table/utils'
import { downloadCSV as downloadCSVFile } from '~/utils/download'
import { YIELDS_COLUMN_IDS, yieldsDatasetColumns } from './columns'
import type { ProYieldRow } from './data'
import { buildYieldsFilterOptions } from './options'
import type { YieldsFilters } from './YieldsFiltersPanel'

const YIELDS_COLUMN_PRESETS: Record<string, string[]> = {
	essential: ['pool', 'project', 'chains', 'tvl', 'apy', 'apyBase', 'apyReward'],
	supply: ['pool', 'project', 'chains', 'tvl', 'apy', 'apyBase', 'apyReward', 'apyMean30d'],
	borrow: ['pool', 'project', 'chains', 'apyBorrow', 'totalSupplyUsd', 'totalBorrowUsd', 'totalAvailableUsd', 'ltv'],
	risk: ['pool', 'project', 'chains', 'tvl', 'apy', 'stabilityRating', 'ilRisk'],
	activity: ['pool', 'project', 'chains', 'tvl', 'apy', 'volumeUsd1d']
}
const EMPTY_TABLE_DATA: ProYieldRow[] = []
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
const YIELDS_CSV_HEADER_MAP: Record<string, string> = {
	pool: 'Pool',
	project: 'Project',
	chains: 'Chain',
	tvl: 'TVL',
	apy: 'Supply APY',
	apyBase: 'Base APY',
	apyReward: 'Reward APY',
	rewardTokensSymbols: 'Reward Tokens',
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
	data: ProYieldRow[]
	initialColumnOrder?: string[]
	initialColumnVisibility?: Record<string, boolean>
	initialFilters?: YieldsFilters
	onColumnsChange?: (columnOrder: string[], columnVisibility: Record<string, boolean>) => void
	onFiltersChange?: (filters: YieldsFilters) => void
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
	const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
		const visibility: VisibilityState = {}
		for (const id of YIELDS_COLUMN_IDS) {
			visibility[id] = hasInitialVisibility
				? initialColumnVisibility?.[id] !== false
				: YIELDS_COLUMN_PRESETS.essential.includes(id)
		}
		return visibility
	})
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() => {
		const savedOrder = (initialColumnOrder ?? []).filter((id) =>
			YIELDS_COLUMN_IDS.includes(id as (typeof YIELDS_COLUMN_IDS)[number])
		)
		if (savedOrder.length > 0 && hasInitialVisibility) return savedOrder
		return hasInitialVisibility
			? YIELDS_COLUMN_IDS.filter((id) => columnVisibility[id] !== false)
			: [...YIELDS_COLUMN_PRESETS.essential]
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
	const [filters, setFilters] = React.useState<YieldsFilters>(initialFilters || {})

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

			if (selectedProtocols) {
				if (!selectedProtocols.has(row.projectslug.toLowerCase()) && !selectedProtocols.has(row.project.toLowerCase()))
					return false
			}

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

	const table = useReactTable({
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
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		maxMultiSortColCount: 1,
		autoResetPageIndex: false
	})

	React.useEffect(() => {
		if (onColumnsChange && columnOrder.length > 0) {
			onColumnsChange(columnOrder, columnVisibility)
		}
	}, [columnOrder, columnVisibility, onColumnsChange])

	const applyPreset = React.useCallback((presetName: string) => {
		const preset = YIELDS_COLUMN_PRESETS[presetName as keyof typeof YIELDS_COLUMN_PRESETS]
		if (preset) {
			const newVisibility = {}
			const allColumnIds = [...YIELDS_COLUMN_IDS]

			for (const colId of allColumnIds) {
				newVisibility[colId] = preset.includes(colId)
			}

			setColumnVisibility(newVisibility)
			setColumnOrder(preset)
			setShowColumnPanel(false)
			setSelectedPreset(presetName)
		}
	}, [])

	const currentColumns = React.useMemo(() => {
		const allColumns = table.getAllLeafColumns()
		const visibility = {}
		for (const col of allColumns) {
			visibility[col.id] = columnVisibility[col.id] !== false
		}
		return visibility
	}, [table, columnVisibility])

	const toggleColumnVisibility = (columnKey: string, isVisible: boolean) => {
		setColumnVisibility((prev) => ({
			...prev,
			[columnKey]: isVisible
		}))

		if (isVisible) {
			setColumnOrder((prev) => {
				if (!prev.includes(columnKey)) {
					return [...prev, columnKey]
				}
				return prev
			})
		} else {
			setColumnOrder((prev) => prev.filter((id) => id !== columnKey))
		}

		setSelectedPreset(null)
	}

	const moveColumnUp = (columnKey: string) => {
		setColumnOrder((prev) => {
			const index = prev.indexOf(columnKey)
			if (index <= 0) return prev

			const newOrder = [...prev]
			;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
			return newOrder
		})
	}

	const moveColumnDown = (columnKey: string) => {
		setColumnOrder((prev) => {
			const index = prev.indexOf(columnKey)
			if (index === -1 || index >= prev.length - 1) return prev

			const newOrder = [...prev]
			;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
			return newOrder
		})
	}

	const downloadCSV = React.useCallback(() => {
		const visibleColumnIds = columnOrder.filter((id) => columnVisibility[id] !== false)
		const headers = visibleColumnIds.map((id) => YIELDS_CSV_HEADER_MAP[id] || id)
		const csvRows = table.getFilteredRowModel().rows.map((row) =>
			visibleColumnIds.map((id) => {
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
			if (onFiltersChange) {
				onFiltersChange(filtersToApply)
			}
		},
		[filters, onFiltersChange]
	)

	const resetFilters = React.useCallback(() => {
		setFilters({})
		if (onFiltersChange) {
			onFiltersChange({})
		}
	}, [onFiltersChange])

	return {
		table,
		sorting,
		pagination,
		setPagination,
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
