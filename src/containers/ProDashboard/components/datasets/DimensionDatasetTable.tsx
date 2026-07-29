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
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { useTableSearch } from '~/components/Table/utils'
import type { DimensionDatasetProtocol } from '~/containers/AdapterMetrics/server/datasets'
import { useBreakpointWidth } from '~/hooks/useBreakpointWidth'
import { Icon } from '~/ui/Icon'
import { downloadCSV } from '~/utils/download'
import { useProDashboardEditorActions } from '../../ProDashboardAPIContext'
import type { TableFilters } from '../../types'
import { CategoryFilterModal } from '../CategoryFilterModal'
import { LoadingSpinner } from '../LoadingSpinner'
import { ProTableCSVButton } from '../ProTable/CsvButton'
import { TableBody } from '../ProTable/TableBody'
import { TablePagination } from '../ProTable/TablePagination'
import { DimensionDatasetCoverageNotice } from './DimensionDatasetCoverageNotice'
import {
	buildDimensionDatasetCSV,
	filterDimensionDatasetRows,
	getDimensionDatasetCategories,
	getDimensionDatasetColumnId,
	sanitizeDimensionDatasetCategories
} from './dimensionDatasetUtils'
import { useDimensionDatasetData } from './useDimensionDatasetData'

const EMPTY_CATEGORIES: string[] = []
const EMPTY_TABLE_DATA: DimensionDatasetProtocol[] = []
const DEFAULT_COLUMN_SIZING: ColumnSizingState = {
	name: 280,
	category: 120,
	total24h: 145,
	total7d: 120,
	total30d: 120,
	change_1d: 100,
	change_7d: 100,
	chains: 200
}

interface DimensionDatasetTableProps {
	datasetType: 'revenue' | 'fees' | 'holders-revenue' | 'earnings'
	chains?: string[]
	tableId?: string
	filters?: TableFilters
	columns: ColumnDef<DimensionDatasetProtocol>[]
	title: string
	loadingText: string
	errorText: string
	csvFilename: string
	csvMetricLabel: string
	categoryFiltering: boolean
	omitChangeColumnsWithChains: boolean
	searchInputClassName: string
}

export function DimensionDatasetTable({
	datasetType,
	chains,
	tableId,
	filters,
	columns,
	title,
	loadingText,
	errorText,
	csvFilename,
	csvMetricLabel,
	categoryFiltering,
	omitChangeColumnsWithChains,
	searchInputClassName
}: DimensionDatasetTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'total24h', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
	const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
	const [showFilterModal, setShowFilterModal] = React.useState(false)
	const [includeCategories, setIncludeCategories] = React.useState<string[]>(
		categoryFiltering ? (filters?.categories ?? EMPTY_CATEGORIES) : EMPTY_CATEGORIES
	)
	const [excludeCategories, setExcludeCategories] = React.useState<string[]>(
		categoryFiltering ? (filters?.excludedCategories ?? EMPTY_CATEGORIES) : EMPTY_CATEGORIES
	)

	const { handleTableFiltersChange } = useProDashboardEditorActions()
	const { data, isLoading, error, unavailableChains } = useDimensionDatasetData(datasetType, chains)
	const width = useBreakpointWidth()
	const tableData = data ?? EMPTY_TABLE_DATA
	const hasSelectedChains = Boolean(chains?.length)

	React.useEffect(() => {
		if (!categoryFiltering) return
		setIncludeCategories(filters?.categories ?? EMPTY_CATEGORIES)
		setExcludeCategories(filters?.excludedCategories ?? EMPTY_CATEGORIES)
	}, [categoryFiltering, filters?.categories, filters?.excludedCategories])

	const availableCategories = React.useMemo(
		() => (categoryFiltering ? getDimensionDatasetCategories(tableData) : EMPTY_CATEGORIES),
		[categoryFiltering, tableData]
	)
	const availableCategoriesSet = React.useMemo(() => new Set(availableCategories), [availableCategories])

	React.useEffect(() => {
		if (!categoryFiltering || availableCategoriesSet.size === 0) return
		setIncludeCategories((previous) => sanitizeDimensionDatasetCategories(previous, availableCategoriesSet))
		setExcludeCategories((previous) => sanitizeDimensionDatasetCategories(previous, availableCategoriesSet))
	}, [categoryFiltering, availableCategoriesSet])

	const filteredData = React.useMemo(
		() => (categoryFiltering ? filterDimensionDatasetRows(tableData, includeCategories, excludeCategories) : tableData),
		[categoryFiltering, excludeCategories, includeCategories, tableData]
	)
	const filteredIncludeCategories = React.useMemo(
		() => sanitizeDimensionDatasetCategories(includeCategories, availableCategoriesSet),
		[availableCategoriesSet, includeCategories]
	)
	const filteredExcludeCategories = React.useMemo(
		() => sanitizeDimensionDatasetCategories(excludeCategories, availableCategoriesSet),
		[availableCategoriesSet, excludeCategories]
	)

	const columnsToUse = React.useMemo(() => {
		if (!hasSelectedChains || !omitChangeColumnsWithChains) return columns
		return columns.filter((column) => {
			const id = getDimensionDatasetColumnId(column)
			return id !== 'change_1d' && id !== 'change_7d'
		})
	}, [columns, hasSelectedChains, omitChangeColumnsWithChains])

	const filterButtonIsActive = includeCategories.length + excludeCategories.length > 0
	const columnsWithFilterButton = React.useMemo(() => {
		if (!categoryFiltering) return columnsToUse
		return columnsToUse.map((column): ColumnDef<DimensionDatasetProtocol> => {
			if (getDimensionDatasetColumnId(column) !== 'category') return column
			return {
				...column,
				header: () => (
					<div className="flex items-center justify-end gap-2">
						<span>Category</span>
						<button
							onClick={(event) => {
								event.stopPropagation()
								setShowFilterModal(true)
							}}
							className={`ml-2 rounded-md p-1 transition-colors hover:bg-surface-elevated-2 ${
								filterButtonIsActive ? 'text-brand' : 'text-pro-text-tertiary'
							}`}
							title="Filter categories"
						>
							<Icon name="settings" height={14} width={14} />
						</button>
					</div>
				)
			} as ColumnDef<DimensionDatasetProtocol>
		})
	}, [categoryFiltering, columnsToUse, filterButtonIsActive])

	const instance = useReactTable({
		data: filteredData.length > 0 ? filteredData : EMPTY_TABLE_DATA,
		columns: columnsWithFilterButton,
		state: { sorting, columnOrder, columnSizing, columnFilters, pagination },
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		onColumnOrderChange: setColumnOrder,
		onColumnSizingChange: setColumnSizing,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		autoResetPageIndex: false
	})

	React.useEffect(() => {
		instance.setColumnSizing(DEFAULT_COLUMN_SIZING)
		instance.setColumnOrder(instance.getAllLeafColumns().map((column) => column.id))
	}, [instance, width])

	const [_protocolName, setProtocolName] = useTableSearch({ instance, columnToSearch: 'name' })

	const handleApplyCategoryFilters = (include: string[], exclude: string[]) => {
		const sanitizedInclude = sanitizeDimensionDatasetCategories(include, availableCategoriesSet)
		const sanitizedExclude = sanitizeDimensionDatasetCategories(exclude, availableCategoriesSet)
		setIncludeCategories(sanitizedInclude)
		setExcludeCategories(sanitizedExclude)
		if (tableId) {
			const nextFilters: TableFilters = {}
			if (sanitizedInclude.length > 0) nextFilters.categories = sanitizedInclude
			if (sanitizedExclude.length > 0) nextFilters.excludedCategories = sanitizedExclude
			handleTableFiltersChange(tableId, nextFilters)
		}
	}

	if (isLoading) {
		return (
			<div className="flex h-full w-full flex-col p-4">
				<div className="mb-3">
					<div className="flex items-center justify-between gap-4">
						<h3 className="text-lg font-semibold text-pro-text-primary">{title}</h3>
					</div>
				</div>
				<div className="flex min-h-[500px] flex-1 flex-col items-center justify-center gap-4">
					<LoadingSpinner />
					<p className="text-sm text-pro-text-secondary">{loadingText}</p>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full w-full flex-col p-4">
				<div className="mb-3">
					<div className="flex items-center justify-between gap-4">
						<h3 className="text-lg font-semibold text-pro-text-primary">{title}</h3>
					</div>
				</div>
				<div className="flex min-h-[500px] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">{errorText}</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full w-full flex-col p-4">
			<div className="mb-3">
				<div className="flex flex-wrap items-center justify-end gap-4">
					<h3 className="mr-auto text-lg font-semibold text-pro-text-primary">{title}</h3>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<ProTableCSVButton
							onClick={() => {
								const rows = instance.getFilteredRowModel().rows.map((row) => row.original)
								downloadCSV(
									csvFilename,
									buildDimensionDatasetCSV(rows, csvMetricLabel, !omitChangeColumnsWithChains || !hasSelectedChains),
									{ addTimestamp: true }
								)
							}}
							smol
						/>
						<input
							type="text"
							placeholder="Search protocols..."
							onInput={(event) => setProtocolName(event.currentTarget.value)}
							className={searchInputClassName}
						/>
					</div>
				</div>
			</div>
			<DimensionDatasetCoverageNotice unavailableChains={unavailableChains} />
			<TableBody table={instance} />
			<TablePagination table={instance} />
			{categoryFiltering && showFilterModal ? (
				<CategoryFilterModal
					isOpen
					onClose={() => setShowFilterModal(false)}
					onApply={handleApplyCategoryFilters}
					onClear={() => handleApplyCategoryFilters([], [])}
					categories={availableCategories}
					initialInclude={filteredIncludeCategories}
					initialExclude={filteredExcludeCategories}
				/>
			) : null}
		</div>
	)
}
