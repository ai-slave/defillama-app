import {
	type ColumnDef,
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
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { downloadCSV } from '~/utils/download'
import { formatPercent } from '~/utils/numberFormat'
import { LoadingSpinner } from '../../LoadingSpinner'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'
import { buildChainShareTotals, CHAIN_SHARE_METRICS, getChainMetricShare } from './chainShares'
import { ChainsTableHeader } from './ChainsTableHeader'
import { ColumnManagementPanel } from './ColumnManagementPanel'
import { chainsDatasetColumns } from './columns'
import { useChainsData } from './useChainsData'

const EMPTY_DATA: ChainsDatasetRow[] = []
const getChainsCoreRowModel = getCoreRowModel<ChainsDatasetRow>()
const getChainsSortedRowModel = getSortedRowModel<ChainsDatasetRow>()
const getChainsFilteredRowModel = getFilteredRowModel<ChainsDatasetRow>()
const getChainsPaginationRowModel = getPaginationRowModel<ChainsDatasetRow>()
const CHAIN_COLUMN_PRESETS = {
	essential: ['name', 'protocols', 'users', 'change_1d', 'change_7d', 'tvl', 'stablesMcap'],
	defi: [
		'name',
		'protocols',
		'tvl',
		'change_1d',
		'change_7d',
		'change_1m',
		'bridgedTvl',
		'stablesMcap',
		'mcaptvl',
		'mcap'
	],
	volume: [
		'name',
		'tvl',
		'totalVolume24h',
		'totalVolume30d',
		'totalFees24h',
		'totalFees30d',
		'totalAppRevenue24h',
		'totalAppRevenue30d',
		'totalRevenue30d',
		'users',
		'nftVolume'
	],
	advanced: [
		'name',
		'protocols',
		'users',
		'change_1d',
		'change_7d',
		'change_1m',
		'tvl',
		'bridgedTvl',
		'stablesMcap',
		'totalVolume24h',
		'totalVolume30d',
		'totalFees24h',
		'totalFees30d',
		'totalAppRevenue24h',
		'totalAppRevenue30d',
		'totalRevenue30d',
		'mcaptvl',
		'mcap',
		'nftVolume'
	],
	shares: [
		'name',
		'tvl_share',
		'stablesMcap_share',
		'totalVolume24h_share',
		'totalFees24h_share',
		'totalAppRevenue24h_share'
	]
} satisfies Record<string, string[]>

function getChainColumnPreset(preset: string): string[] | undefined {
	switch (preset) {
		case 'essential':
			return CHAIN_COLUMN_PRESETS.essential
		case 'defi':
			return CHAIN_COLUMN_PRESETS.defi
		case 'volume':
			return CHAIN_COLUMN_PRESETS.volume
		case 'advanced':
			return CHAIN_COLUMN_PRESETS.advanced
		case 'shares':
			return CHAIN_COLUMN_PRESETS.shares
		default:
			return undefined
	}
}

interface ChainsDatasetProps {
	category?: string
	columnOrder?: string[]
	columnVisibility?: Record<string, boolean>
	onColumnsChange?: (columnOrder: string[], columnVisibility: Record<string, boolean>) => void
}

export function ChainsDataset({
	category,
	columnOrder: savedColumnOrder,
	columnVisibility: savedColumnVisibility,
	onColumnsChange
}: ChainsDatasetProps) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'tvl', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
	const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	})
	const [selectedPreset, setSelectedPreset] = React.useState<string | null>(
		savedColumnOrder || savedColumnVisibility ? null : 'essential'
	)
	const [showColumnPanel, setShowColumnPanel] = React.useState(false)

	const { data, isLoading, error } = useChainsData(category)

	const totals = React.useMemo(() => buildChainShareTotals(data), [data])

	const percentageShareColumns = React.useMemo(() => {
		return CHAIN_SHARE_METRICS.map(
			(metric): ColumnDef<ChainsDatasetRow> => ({
				id: `${metric.key}_share`,
				header: metric.name,
				size: 120,
				accessorFn: (row) => {
					const value = row[metric.key]
					const total = totals[metric.key]

					return getChainMetricShare(value, total)
				},
				cell: ({ row }) => {
					const sourceValue = row.original[metric.key]
					const total = totals[metric.key]
					const value = getChainMetricShare(sourceValue, total)
					if (value == null) return <span className="text-pro-text-secondary">-</span>

					return (
						<span className="text-pro-text-secondary">
							{formatPercent(value, {
								input: 'percent',
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
								useGrouping: false
							})}
						</span>
					)
				},
				sortingFn: (rowA, rowB) => {
					if (totals[metric.key] <= 0) return 0
					const sourceA = rowA.original[metric.key]
					const sourceB = rowB.original[metric.key]
					if (sourceA === null) return sourceB === null ? 0 : 1
					if (sourceB === null) return -1
					return sourceA - sourceB
				}
			})
		)
	}, [totals])

	const allColumns = React.useMemo(() => {
		return [...chainsDatasetColumns, ...percentageShareColumns]
	}, [percentageShareColumns])

	const instance = useReactTable({
		data: data ?? EMPTY_DATA,
		columns: allColumns,
		state: {
			sorting,
			columnOrder,
			columnSizing,
			columnFilters,
			columnVisibility,
			pagination
		},
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		onColumnOrderChange: setColumnOrder,
		onColumnSizingChange: setColumnSizing,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onPaginationChange: setPagination,
		getCoreRowModel: getChainsCoreRowModel,
		getSortedRowModel: getChainsSortedRowModel,
		getFilteredRowModel: getChainsFilteredRowModel,
		getPaginationRowModel: getChainsPaginationRowModel,
		autoResetPageIndex: true
	})

	const applyPreset = (preset: string) => {
		const presetColumns = getChainColumnPreset(preset)
		if (presetColumns) {
			const tableColumns = instance.getAllColumns()
			const newVisibility: Record<string, boolean> = {}

			for (const column of tableColumns) {
				newVisibility[column.id] = presetColumns.includes(column.id)
			}

			instance.setColumnVisibility(newVisibility)
			instance.setColumnOrder(presetColumns)
			setColumnVisibility(newVisibility)
			setColumnOrder(presetColumns)
			setSelectedPreset(preset)

			onColumnsChange?.(presetColumns, newVisibility)
		}
	}

	const toggleColumnVisibility = (columnId: string) => {
		const column = instance.getColumn(columnId)
		if (column) {
			column.toggleVisibility()
			setSelectedPreset(null)

			const newVisibility = { ...columnVisibility, [columnId]: !columnVisibility[columnId] }
			setColumnVisibility(newVisibility)

			if (newVisibility[columnId] !== false && !columnOrder.includes(columnId)) {
				const leafColumnIds = instance.getAllLeafColumns().map((d) => d.id)
				const originalIndex = leafColumnIds.indexOf(columnId)

				const newOrder = [...columnOrder]
				let insertIndex = newOrder.length

				for (let i = originalIndex + 1; i < leafColumnIds.length; i++) {
					const colId = leafColumnIds[i]
					if (!colId) continue
					const orderIndex = newOrder.indexOf(colId)
					if (orderIndex !== -1) {
						insertIndex = orderIndex
						break
					}
				}

				newOrder.splice(insertIndex, 0, columnId)
				setColumnOrder(newOrder)

				onColumnsChange?.(newOrder, newVisibility)
			} else {
				onColumnsChange?.(columnOrder, newVisibility)
			}
		}
	}

	const onSyncInitialColumns = React.useEffectEvent(() => {
		const defaultOrder = instance.getAllLeafColumns().map((d) => d.id)
		const defaultSizing = {
			name: 200,
			protocols: 100,
			users: 130,
			change_1d: 90,
			change_7d: 90,
			change_1m: 90,
			tvl: 140,
			bridgedTvl: 120,
			stablesMcap: 120,
			totalVolume24h: 150,
			totalVolume30d: 150,
			totalFees24h: 130,
			totalFees30d: 130,
			totalAppRevenue24h: 120,
			totalAppRevenue30d: 140,
			totalRevenue30d: 140,
			mcaptvl: 120,
			mcap: 140,
			nftVolume: 120
		}

		instance.setColumnSizing(defaultSizing)

		if (savedColumnOrder && savedColumnOrder.length > 0) {
			setColumnOrder(savedColumnOrder)
			instance.setColumnOrder(savedColumnOrder)
		} else if (columnOrder.length === 0) {
			setColumnOrder(defaultOrder)
			instance.setColumnOrder(defaultOrder)
		}

		let hasSavedVisibility = false
		if (savedColumnVisibility) {
			for (const _ in savedColumnVisibility) {
				hasSavedVisibility = true
				break
			}
		}
		let hasCurrentVisibility = false
		for (const _ in columnVisibility) {
			hasCurrentVisibility = true
			break
		}
		if (savedColumnVisibility && hasSavedVisibility) {
			setColumnVisibility(savedColumnVisibility)
			instance.setColumnVisibility(savedColumnVisibility)
		} else if (!hasCurrentVisibility && selectedPreset === 'essential') {
			const presetColumns = CHAIN_COLUMN_PRESETS.essential
			if (presetColumns) {
				const tableColumns = instance.getAllColumns()
				const newVisibility: Record<string, boolean> = {}
				for (const column of tableColumns) {
					newVisibility[column.id] = presetColumns.includes(column.id)
				}
				setColumnVisibility(newVisibility)
				setColumnOrder(presetColumns)
				instance.setColumnVisibility(newVisibility)
				instance.setColumnOrder(presetColumns)
			}
		}
	})

	React.useEffect(() => {
		onSyncInitialColumns()
	}, [savedColumnOrder, savedColumnVisibility])

	const handleExportCSV = () => {
		const headers = instance
			.getVisibleFlatColumns()
			.filter((col) => col.id !== 'expand')
			.map((col) => (typeof col.columnDef.header === 'string' ? col.columnDef.header : (col.id ?? '')))

		const rows = instance.getFilteredRowModel().rows.map((row) => {
			return instance
				.getVisibleFlatColumns()
				.filter((col) => col.id !== 'expand')
				.map((col) => {
					const value = row.getValue(col.id)
					if (value == null) return ''
					if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
					if (Array.isArray(value)) return value.join(', ')
					if (typeof value === 'object') return ''
					return String(value)
				})
		})

		downloadCSV('chains-data.csv', [headers, ...rows], { addTimestamp: true })
	}

	const columnOptions = React.useMemo(
		() =>
			instance.getAllLeafColumns().map((column) => ({
				id: column.id,
				name: typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id
			})),
		[instance]
	)

	const moveColumnUp = (columnId: string) => {
		const currentOrder = [...columnOrder]
		const index = currentOrder.indexOf(columnId)
		if (index > 0) {
			const column = currentOrder[index]
			if (!column) return
			currentOrder.splice(index, 1)
			currentOrder.splice(index - 1, 0, column)
			setColumnOrder(currentOrder)
			onColumnsChange?.(currentOrder, columnVisibility)
		}
	}

	const moveColumnDown = (columnId: string) => {
		const currentOrder = [...columnOrder]
		const index = currentOrder.indexOf(columnId)
		if (index < currentOrder.length - 1) {
			const column = currentOrder[index]
			if (!column) return
			currentOrder.splice(index, 1)
			currentOrder.splice(index + 1, 0, column)
			setColumnOrder(currentOrder)
			onColumnsChange?.(currentOrder, columnVisibility)
		}
	}

	if (isLoading) {
		return (
			<div className="isolate flex h-full w-full flex-col p-4">
				<ChainsTableHeader
					selectedPreset="essential"
					setSelectedPreset={() => {}}
					applyPreset={() => {}}
					showColumnSelector={false}
					setShowColumnSelector={() => {}}
					handleExportCSV={() => {}}
					category={category}
				/>
				<div className="flex min-h-[500px] flex-1 flex-col items-center justify-center gap-4">
					<LoadingSpinner />
					<p className="text-sm text-pro-text-secondary">Loading chains data...</p>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="isolate flex h-full w-full flex-col p-4">
				<ChainsTableHeader
					selectedPreset="essential"
					setSelectedPreset={() => {}}
					applyPreset={() => {}}
					showColumnSelector={false}
					setShowColumnSelector={() => {}}
					handleExportCSV={() => {}}
					category={category}
				/>
				<div className="flex min-h-[500px] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">Failed to load chains data</div>
				</div>
			</div>
		)
	}

	return (
		<div className="isolate flex h-full w-full flex-col p-4">
			<ChainsTableHeader
				selectedPreset={selectedPreset}
				setSelectedPreset={setSelectedPreset}
				applyPreset={applyPreset}
				showColumnSelector={showColumnPanel}
				setShowColumnSelector={setShowColumnPanel}
				handleExportCSV={handleExportCSV}
				category={category}
			/>

			<ColumnManagementPanel
				showColumnPanel={showColumnPanel}
				setShowColumnPanel={setShowColumnPanel}
				columns={columnOptions}
				columnVisibility={columnVisibility}
				columnOrder={columnOrder}
				toggleColumnVisibility={toggleColumnVisibility}
				moveColumnUp={moveColumnUp}
				moveColumnDown={moveColumnDown}
			/>

			<div className="min-h-0 flex-1">
				<TableBody table={instance} />
			</div>

			<TablePagination
				pageSize={pagination.pageSize}
				pageIndex={pagination.pageIndex}
				pageCount={instance.getPageCount()}
				canPreviousPage={instance.getCanPreviousPage()}
				canNextPage={instance.getCanNextPage()}
				previousPage={instance.previousPage}
				nextPage={instance.nextPage}
				setPageSize={instance.setPageSize}
				showPageSizes={(data?.length ?? 0) > 10}
			/>
		</div>
	)
}
