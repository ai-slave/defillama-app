import {
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnOrderState,
	type ExpandedState,
	type RowData,
	type VisibilityState,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { CSVDownloadButton } from '~/components/ButtonStyled/CsvButton'
import { Icon } from '~/components/Icon'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { VirtualTable, type VirtualTableLayout } from '~/components/Table/Table'
import { Card } from '~/ui/Card'
import {
	searchFieldIconStyles,
	searchFieldInlineWrapperStyles,
	searchFieldInputStyles,
	searchFieldWrapperStyles
} from '~/ui/Input'
import { TableToolbar } from '~/ui/Toolbar'
import { prepareTableCsv, useSortColumnOrders, useTableSearch } from './utils'
import type { ColumnOrdersByBreakpoint } from './utils'

const EMPTY_SORTING: SortingState = []

type CustomFiltersProp = React.ReactNode | (() => React.ReactNode)

interface ITableWithSearchBaseProps<T extends RowData> {
	data: T[]
	columns: ColumnDef<T>[]
	placeholder?: string
	columnToSearch?: string
	header?: string | null
	leadingControls?: React.ReactNode | null
	headingAs?: 'h1' | 'h2'
	columnOrders?: ColumnOrdersByBreakpoint | null
	sortingState?: SortingState
	columnVisibility?: VisibilityState | null
	rowSize?: number | null
	compact?: boolean
	embedded?: boolean
	skipVirtualization?: boolean
	tableLayout?: VirtualTableLayout
	getSubRows?: (row: T) => T[] | undefined
	showColumnSelect?: boolean
	columnSelectLabel?: string
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
	headingAs: HeadingTag = 'h2',
	columnOrders = null,
	sortingState = EMPTY_SORTING,
	columnVisibility: columnVisibilityProp = null,
	rowSize = null,
	compact = false,
	embedded = false,
	skipVirtualization = false,
	tableLayout = 'fixed',
	showColumnSelect = false,
	columnSelectLabel = 'Columns',
	csvFileName = null,
	getSubRows: getSubRowsProp
}: ITableWithSearchProps<T>) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>(sortingState)
	const [expanded, setExpanded] = React.useState<ExpandedState>({})
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
	const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(columnVisibilityProp ?? {})

	const instance = useReactTable({
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
		getSubRows:
			getSubRowsProp ??
			((row) => {
				const sub = (row as Record<string, unknown>).subRows
				return Array.isArray(sub) ? (sub as T[]) : undefined
			}),
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater)),
		onColumnOrderChange: (updater) => React.startTransition(() => setColumnOrder(updater)),
		onColumnVisibilityChange: (updater) => React.startTransition(() => setColumnVisibility(updater)),
		getFilteredRowModel: getFilteredRowModel(),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel()
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch })
	const columnsOptions = React.useMemo(
		() =>
			columns.flatMap((column) => {
				const key = column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '')
				if (!key) return []
				const name = typeof column.header === 'function' ? key : column.header != null ? String(column.header) : key
				const help = column.meta?.headerHelperText ?? undefined
				return [{ key, name, help }]
			}),
		[columns]
	)
	const selectedColumns = instance
		.getAllLeafColumns()
		.filter((column) => column.getIsVisible())
		.map((column) => column.id)
	const setColumnOptions = React.useCallback(
		(newOptions: string[] | ((prev: string[]) => string[])) => {
			const resolvedOptions = typeof newOptions === 'function' ? newOptions(selectedColumns) : newOptions
			const nextVisibility = Object.fromEntries(
				instance.getAllLeafColumns().map((column) => [column.id, resolvedOptions.includes(column.id)])
			)
			instance.setColumnVisibility(nextVisibility)
		},
		[instance, selectedColumns]
	)

	useSortColumnOrders({ instance, columnOrders })

	const controls = (
		<TableToolbar className="w-full justify-end">
			{leadingControls || header ? (
				<div className="mr-auto flex items-center gap-2 overflow-x-auto">
					{leadingControls ? <div className="flex items-center overflow-x-auto">{leadingControls}</div> : null}
					{header ? <HeadingTag className="label-md whitespace-nowrap">{header}</HeadingTag> : null}
				</div>
			) : null}
			{columnToSearch ? (
				<label className={leadingControls || header ? searchFieldInlineWrapperStyles : searchFieldWrapperStyles}>
					<span className="sr-only">{placeholder}</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						onInput={(e) => setProjectName(e.currentTarget.value)}
						placeholder={placeholder}
						className={searchFieldInputStyles}
					/>
				</label>
			) : null}
			{typeof customFilters === 'function' ? customFilters() : customFilters}
			{showColumnSelect ? (
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
			) : null}
			{csvFileName ? (
				<CSVDownloadButton prepareCsv={() => prepareTableCsv({ instance, filename: csvFileName })} smol size="md" />
			) : null}
		</TableToolbar>
	)

	if (embedded) {
		return (
			<>
				{controls}
				<VirtualTable
					instance={instance}
					rowSize={rowSize ?? undefined}
					compact={compact}
					skipVirtualization={skipVirtualization}
					tableLayout={tableLayout}
				/>
			</>
		)
	}

	return (
		<Card padding="none" border="subtle">
			{controls}
			<VirtualTable
				instance={instance}
				rowSize={rowSize ?? undefined}
				compact={compact}
				skipVirtualization={skipVirtualization}
				tableLayout={tableLayout}
			/>
		</Card>
	)
}
