import {
	createPaginatedRowModel,
	rowPaginationFeature,
	tableFeatures,
	useTable,
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnVisibilityState,
	type PaginationState,
	type SortingState
} from '@tanstack/react-table'
import * as React from 'react'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { downloadCSV } from '~/utils/download'
import { formatPercent } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { ProCardError, ProCardLoading, ProCardRefreshFailed } from '../../ProCardStatus'
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

const CHAIN_COLUMN_IDS = [
	...chainsDatasetColumns.map((column) => column.id!),
	...CHAIN_SHARE_METRICS.map((metric) => `${metric.key}_share`)
]

function matchingChainColumnPreset(activeColumns: Array<string>): string | null {
	const shown = activeColumns.join()
	for (const key in CHAIN_COLUMN_PRESETS) {
		if (CHAIN_COLUMN_PRESETS[key as keyof typeof CHAIN_COLUMN_PRESETS].join() === shown) return key
	}
	return null
}

function presetVisibility(presetColumns: Array<string>): ColumnVisibilityState {
	const visibility: ColumnVisibilityState = {}
	for (const id of CHAIN_COLUMN_IDS) visibility[id] = presetColumns.includes(id)
	return visibility
}

type ChainColumns = { order: ColumnOrderState; visibility: ColumnVisibilityState }
const ESSENTIAL_COLUMNS: ChainColumns = {
	order: CHAIN_COLUMN_PRESETS.essential,
	visibility: presetVisibility(CHAIN_COLUMN_PRESETS.essential)
}
const ALL_COLUMNS: ChainColumns = { order: CHAIN_COLUMN_IDS, visibility: {} }

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
	// An editable card draws the saved columns, so dashboard undo and redo redraw the table, and a card with
	// nothing saved shows the essential preset. A read-only card cannot save, so a viewer's own change wins there.
	const [viewerColumns, setViewerColumns] = React.useState<ChainColumns | null>(null)
	const ownColumns = onColumnsChange ? null : viewerColumns
	const fallbackColumns = savedColumnOrder || savedColumnVisibility ? ALL_COLUMNS : ESSENTIAL_COLUMNS
	const columnOrder = ownColumns?.order ?? (savedColumnOrder?.length ? savedColumnOrder : fallbackColumns.order)
	const columnVisibility =
		ownColumns?.visibility ??
		(savedColumnVisibility && Object.keys(savedColumnVisibility).length > 0
			? savedColumnVisibility
			: fallbackColumns.visibility)
	const writeColumns = (order: ColumnOrderState, visibility: ColumnVisibilityState) => {
		if (onColumnsChange) onColumnsChange(order, visibility)
		else setViewerColumns({ order, visibility })
	}
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10
	})
	const [showColumnPanel, setShowColumnPanel] = React.useState(false)
	const customizeRef = React.useRef<HTMLButtonElement>(null)
	// The shown columns in table order; a column missing from the order is drawn after it.
	const activeColumns = [
		...columnOrder.filter((id) => columnVisibility[id] !== false),
		...CHAIN_COLUMN_IDS.filter((id) => columnVisibility[id] !== false && !columnOrder.includes(id))
	]
	// The preset follows the columns, so undo, redo and a saved card mark the preset they show.
	const selectedPreset = matchingChainColumnPreset(activeColumns)

	const chainsQuery = useChainsData(category)
	const { data, isLoading } = chainsQuery

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
				if (value == null) return <span className="text-secondary">-</span>

				return (
					<span className="text-secondary">
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
			columnFilters,
			columnVisibility,
			pagination
		},
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		autoResetPageIndex: true
	})

	const applyPreset = (preset: string) => {
		const presetColumns = getChainColumnPreset(preset)
		if (presetColumns) writeColumns(presetColumns, presetVisibility(presetColumns))
	}

	const toggleColumnVisibility = (columnId: string) => {
		// A column missing from the map is drawn, so toggling it hides it.
		const newVisibility = { ...columnVisibility, [columnId]: columnVisibility[columnId] === false }
		// A newly shown column joins the end of the order.
		const shownNow = newVisibility[columnId] !== false && !columnOrder.includes(columnId)
		writeColumns(shownNow ? [...columnOrder, columnId] : columnOrder, newVisibility)
	}

	// Show all appends the newly shown columns to the order; Hide all keeps the chain name.
	const setAllColumnsVisible = (visible: boolean) => {
		const newVisibility: ColumnVisibilityState = {}
		for (const id of CHAIN_COLUMN_IDS) newVisibility[id] = visible || id === 'name'
		const hidden = visible ? CHAIN_COLUMN_IDS.filter((id) => !columnOrder.includes(id)) : []
		writeColumns([...columnOrder, ...hidden], newVisibility)
	}

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

	// Moves a shown column past its shown neighbour; hidden columns between them keep their places.
	const moveColumn = (columnId: string, delta: -1 | 1) => {
		const neighbour = activeColumns[activeColumns.indexOf(columnId) + delta]
		const order = [...columnOrder]
		for (const id of [columnId, neighbour]) if (!order.includes(id)) order.push(id)
		const from = order.indexOf(columnId)
		const to = order.indexOf(neighbour)
		order[from] = neighbour
		order[to] = columnId
		writeColumns(order, columnVisibility)
	}

	return (
		<div className="isolate flex h-full w-full flex-col">
			<ChainsTableHeader
				selectedPreset={selectedPreset}
				applyPreset={applyPreset}
				showColumnSelector={showColumnPanel}
				setShowColumnSelector={setShowColumnPanel}
				customizeRef={customizeRef}
				handleExportCSV={handleExportCSV}
			/>

			{showColumnPanel ? (
				<ColumnManagementPanel
					columns={columnOptions}
					columnVisibility={columnVisibility}
					activeColumns={activeColumns}
					toggleColumnVisibility={toggleColumnVisibility}
					setAllColumnsVisible={setAllColumnsVisible}
					moveColumn={moveColumn}
					onDone={() => {
						customizeRef.current?.focus()
						setShowColumnPanel(false)
					}}
				/>
			) : null}

			{queryReadFailed(chainsQuery) && !data ? (
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardError title="Couldn't load chains data" retry={chainsQuery} />
				</div>
			) : isLoading ? (
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading chains data…" />
				</div>
			) : (
				<>
					{queryReadFailed(chainsQuery) ? <ProCardRefreshFailed retry={chainsQuery} /> : null}
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
				</>
			)}
		</div>
	)
}
