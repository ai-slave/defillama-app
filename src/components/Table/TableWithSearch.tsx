import type {
	ColumnFiltersState,
	ColumnOrderState,
	ColumnVisibilityState,
	ExpandedState,
	RowData,
	SortingState,
	TableOptions
} from '@tanstack/react-table'
import * as React from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { VirtualTable, type VirtualTableLayout } from '~/components/Table/Table'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import {
	searchFieldFlexibleWrapperStyles,
	searchFieldIconStyles,
	searchFieldInlineWrapperStyles,
	searchFieldInputStyles,
	searchFieldWrapperStyles
} from '~/ui/Input'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { TableToolbar } from '~/ui/Toolbar'
import type { SearchTableFeatures } from './features/search'
import { useSearchTable } from './features/searchHook'
import type { ColumnOrdersByBreakpoint } from './utils'
import { prepareTableCsv, useSortColumnOrders, useTableSearch } from './utils'

const EMPTY_SORTING: SortingState = []
const EMPTY_EXPANDED: ExpandedState = {}

type CustomFiltersProp = React.ReactNode | (() => React.ReactNode)

export type TableWithSearchLayout = (controls: React.ReactNode, table: React.ReactNode) => React.ReactNode

interface ITableWithSearchBaseProps<T extends RowData> {
	data: Array<T>
	// Each column keeps the value type inferred by createColumnHelper; TanStack erases
	// those heterogeneous value types only when the columns enter a table together.
	columns: TableOptions<SearchTableFeatures, T>['columns']
	placeholder?: string
	columnToSearch?: string
	header?: string | null
	leadingControls?: React.ReactNode | null
	searchAlign?: 'start' | 'end'
	headingAs?: 'h1' | 'h2'
	columnOrders?: ColumnOrdersByBreakpoint | null
	initialSorting?: SortingState
	columnVisibility?: ColumnVisibilityState | null
	rowSize?: number | null
	compact?: boolean
	embedded?: boolean
	/** Arrange the toolbar and table around persistent controls owned by the caller. */
	renderLayout?: TableWithSearchLayout
	skipVirtualization?: boolean
	tableLayout?: VirtualTableLayout
	getSubRows?: (row: T) => Array<T> | undefined
	initialExpanded?: ExpandedState
	showColumnSelect?: boolean
	columnSelectLabel?: string
	csvExportAllColumns?: boolean
}

type ITableWithSearchProps<T extends RowData = RowData> = ITableWithSearchBaseProps<T> &
	(
		| {
				csvFileName: string
				customFilters?: CustomFiltersProp | null
		  }
		| {
				csvFileName?: null
				customFilters: CustomFiltersProp
		  }
	)

export function TableWithSearch<T extends RowData>({
	data,
	columns,
	placeholder,
	columnToSearch,
	customFilters = null,
	header = null,
	leadingControls = null,
	searchAlign = 'end',
	headingAs: HeadingTag = 'h2',
	columnOrders = null,
	initialSorting = EMPTY_SORTING,
	columnVisibility: columnVisibilityProp = null,
	rowSize = null,
	compact = false,
	embedded = false,
	renderLayout,
	skipVirtualization = false,
	tableLayout = 'fixed',
	showColumnSelect = false,
	columnSelectLabel = 'Columns',
	csvExportAllColumns = false,
	csvFileName = null,
	getSubRows: getSubRowsProp,
	initialExpanded = EMPTY_EXPANDED
}: ITableWithSearchProps<T>) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
	const [expanded, setExpanded] = React.useState<ExpandedState>(initialExpanded)
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
	const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>(columnVisibilityProp ?? {})

	const instance = useSearchTable({
		data,
		columns,
		state: {
			sorting,
			columnFilters,
			expanded,
			columnOrder,
			columnVisibility
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		filterFromLeafRows: true,
		onExpandedChange: (updater) => React.startTransition(() => setExpanded(updater)),
		...(getSubRowsProp ? { getSubRows: getSubRowsProp } : {}),
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater)),
		onColumnOrderChange: (updater) => React.startTransition(() => setColumnOrder(updater)),
		onColumnVisibilityChange: (updater) => React.startTransition(() => setColumnVisibility(updater))
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch })
	const columnsOptions = React.useMemo(
		() =>
			columns.flatMap((column) => {
				if (column.meta?.hidden) return []
				const key = column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '')
				if (!key) return []
				const name = typeof column.header === 'function' ? key : column.header != null ? String(column.header) : key
				const help = column.meta?.headerHelperText
				return [{ key, name, ...(help !== undefined ? { help } : {}) }]
			}),
		[columns]
	)
	const selectedColumns = instance
		.getAllLeafColumns()
		.filter((column) => column.getIsVisible() && !column.columnDef.meta?.hidden)
		.map((column) => column.id)
	const setColumnOptions = React.useCallback(
		(newOptions: Array<string> | ((prev: Array<string>) => Array<string>)) => {
			const resolvedOptions = typeof newOptions === 'function' ? newOptions(selectedColumns) : newOptions
			const nextVisibility = Object.fromEntries(
				instance.getAllLeafColumns().map((column) => [column.id, resolvedOptions.includes(column.id)])
			)
			instance.setColumnVisibility(nextVisibility)
		},
		[instance, selectedColumns]
	)

	useSortColumnOrders({ instance, columnOrders })

	const hasLeadingContent = Boolean(leadingControls || header)
	const renderedCustomFilters = typeof customFilters === 'function' ? customFilters() : customFilters
	const searchWrapperStyles =
		searchAlign === 'start'
			? searchFieldFlexibleWrapperStyles
			: hasLeadingContent
				? searchFieldInlineWrapperStyles
				: searchFieldWrapperStyles
	const searchControl = columnToSearch ? (
		<label className={searchWrapperStyles}>
			<span className="sr-only">{placeholder}</span>
			<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
			<input
				onInput={(e) => setProjectName(e.currentTarget.value)}
				placeholder={placeholder}
				className={searchFieldInputStyles}
			/>
		</label>
	) : null
	const columnSelectControl = showColumnSelect ? (
		<SelectWithCombobox
			allValues={columnsOptions}
			selectedValues={selectedColumns}
			setSelectedValues={setColumnOptions}
			nestedMenu={false}
			label={columnSelectLabel}
			labelType="smol"
			variant="filter-responsive"
			size="md"
		/>
	) : null
	const csvControl = csvFileName ? (
		<CSVDownloadButton
			prepareCsv={() => prepareTableCsv({ instance, filename: csvFileName, includeHiddenColumns: csvExportAllColumns })}
			smol
			size="md"
		/>
	) : null

	const controls =
		HeadingTag === 'h1' && !embedded ? (
			<PanelHeader className="w-full justify-end">
				{searchAlign === 'start' ? (
					<div className="mr-auto flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
						{leadingControls ? <div className="flex items-center overflow-x-auto">{leadingControls}</div> : null}
						{header ? (
							<PanelTitle as={HeadingTag} className="mr-0 whitespace-nowrap">
								{header}
							</PanelTitle>
						) : null}
						{searchControl}
					</div>
				) : leadingControls ? (
					<div className="mr-auto flex items-center gap-2 overflow-x-auto">
						<div className="flex items-center overflow-x-auto">{leadingControls}</div>
						{header ? (
							<PanelTitle as={HeadingTag} className="mr-0 whitespace-nowrap">
								{header}
							</PanelTitle>
						) : null}
					</div>
				) : header ? (
					<PanelTitle as={HeadingTag} className="whitespace-nowrap">
						{header}
					</PanelTitle>
				) : null}
				{searchAlign === 'end' ? searchControl : null}
				{renderedCustomFilters}
				{columnSelectControl}
				{csvControl}
			</PanelHeader>
		) : (
			<TableToolbar className="w-full justify-end">
				{searchAlign === 'start' ? (
					<div className="mr-auto flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
						{leadingControls ? <div className="flex items-center overflow-x-auto">{leadingControls}</div> : null}
						{header ? <HeadingTag className="label-md whitespace-nowrap">{header}</HeadingTag> : null}
						{searchControl}
					</div>
				) : hasLeadingContent ? (
					<div className="mr-auto flex items-center gap-2 overflow-x-auto">
						{leadingControls ? <div className="flex items-center overflow-x-auto">{leadingControls}</div> : null}
						{header ? <HeadingTag className="label-md whitespace-nowrap">{header}</HeadingTag> : null}
					</div>
				) : null}
				{searchAlign === 'end' ? searchControl : null}
				{renderedCustomFilters}
				{columnSelectControl}
				{csvControl}
			</TableToolbar>
		)

	const table = (
		<VirtualTable
			table={instance}
			{...(rowSize != null ? { rowSize } : {})}
			compact={compact}
			skipVirtualization={skipVirtualization}
			tableLayout={tableLayout}
		/>
	)
	const content = renderLayout ? (
		renderLayout(controls, table)
	) : (
		<>
			{controls}
			{table}
		</>
	)

	return embedded ? content : <Card padding="none">{content}</Card>
}
