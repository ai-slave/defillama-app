import {
	createPaginatedRowModel,
	rowPaginationFeature,
	tableFeatures,
	useTable,
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnSizingState,
	type ColumnVisibilityState,
	type PaginationState,
	type SortingState
} from '@tanstack/react-table'
import * as React from 'react'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { downloadCSV } from '~/utils/download'
import { formatPercent } from '~/utils/numberFormat'
import { ProCardLoading } from '../../ProCardStatus'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'
import { buildChainShareTotals, CHAIN_SHARE_METRICS, getChainMetricShare } from './chainShares'
import { ChainsTableHeader } from './ChainsTableHeader'
import { ColumnManagementPanel } from './ColumnManagementPanel'
import { chainsDatasetColumns } from './columns'
import { useChainsData } from './useChainsData'

export const tableFeaturesConfig = tableFeatures({
	...orderedFilteredTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

const EMPTY_DATA: Array<ChainsDatasetRow> = []
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
		'users'
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
		'mcap'
	],
	shares: [
		'name',
		'tvl_share',
		'stablesMcap_share',
		'totalVolume24h_share',
		'totalFees24h_share',
		'totalAppRevenue24h_share'
	]
} satisfies Record<string, Array<string>>

function getChainColumnPreset(preset: string): Array<string> | undefined {
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
	columnOrder?: Array<string>
	columnVisibility?: Record<string, boolean>
	onColumnsChange?: (columnOrder: Array<string>, columnVisibility: Record<string, boolean>) => void
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
	const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
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
		return CHAIN_SHARE_METRICS.map((metric): ColumnDef<typeof tableFeaturesConfig, ChainsDatasetRow> => ({
			id: `${metric.key}_share`,
			header: metric.name,
			size: 120,
			accessorFn: (row) => {
				const value = row[metric.key]
				const total = totals[metric.key]

				return getChainMetricShare(value, total) ?? undefined
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
			}
		}))
	}, [totals])

	const allColumns = React.useMemo(() => {
		return [...chainsDatasetColumns, ...percentageShareColumns]
	}, [percentageShareColumns])

	const instance = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
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

	const onSyncInitialColumns = React.useEffectEvent(
		(nextColumnOrder: ColumnOrderState | undefined, nextColumnVisibility: ColumnVisibilityState | undefined) => {
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
				mcap: 140
			}

			instance.setColumnSizing(defaultSizing)

			if (nextColumnOrder && nextColumnOrder.length > 0) {
				setColumnOrder(nextColumnOrder)
				instance.setColumnOrder(nextColumnOrder)
			} else if (columnOrder.length === 0) {
				setColumnOrder(defaultOrder)
				instance.setColumnOrder(defaultOrder)
			}

			let hasSavedVisibility = false
			if (nextColumnVisibility) {
				for (const _ in nextColumnVisibility) {
					hasSavedVisibility = true
					break
				}
			}
			let hasCurrentVisibility = false
			for (const _ in columnVisibility) {
				hasCurrentVisibility = true
				break
			}
			if (nextColumnVisibility && hasSavedVisibility) {
				setColumnVisibility(nextColumnVisibility)
				instance.setColumnVisibility(nextColumnVisibility)
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
		}
	)

	React.useEffect(() => {
		React.startTransition(() => onSyncInitialColumns(savedColumnOrder, savedColumnVisibility))
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
			<div className="isolate flex h-full w-full flex-col">
				<ChainsTableHeader
					selectedPreset="essential"
					setSelectedPreset={() => {}}
					applyPreset={() => {}}
					showColumnSelector={false}
					setShowColumnSelector={() => {}}
					handleExportCSV={() => {}}
				/>
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading chains data…" />
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="isolate flex h-full w-full flex-col">
				<ChainsTableHeader
					selectedPreset="essential"
					setSelectedPreset={() => {}}
					applyPreset={() => {}}
					showColumnSelector={false}
					setShowColumnSelector={() => {}}
					handleExportCSV={() => {}}
				/>
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">Failed to load chains data</div>
				</div>
			</div>
		)
	}

	return (
		<div className="isolate flex h-full w-full flex-col">
			<ChainsTableHeader
				selectedPreset={selectedPreset}
				setSelectedPreset={setSelectedPreset}
				applyPreset={applyPreset}
				showColumnSelector={showColumnPanel}
				setShowColumnSelector={setShowColumnPanel}
				handleExportCSV={handleExportCSV}
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
