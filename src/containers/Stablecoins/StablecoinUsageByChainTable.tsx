import {
	type ColumnFiltersState,
	type ColumnOrderState,
	createColumnHelper,
	type ExpandedState,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { PercentChange } from '~/components/PercentChange'
import { VirtualTable } from '~/components/Table/Table'
import type { ColumnOrdersByBreakpoint } from '~/components/Table/utils'
import { useSortColumnOrders, useTableSearch } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import type { useGroupBridgeData } from '~/containers/Stablecoins/hooks'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { TableToolbar } from '~/ui/Toolbar'
import { formattedNum } from '~/utils'

type StablecoinByChainRow = ReturnType<typeof useGroupBridgeData>[number]
type BridgeInfoCell = StablecoinByChainRow['bridgeInfo']
const columnHelper = createColumnHelper<StablecoinByChainRow>()

const stablecoinsByChainColumns = [
	columnHelper.accessor((row) => `${row.name}${row.symbol && row.symbol !== '-' ? ` (${row.symbol})` : ''}`, {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const isSubRow = row.original.name.startsWith('Bridged from')

			return (
				<span
					className="relative flex items-center gap-2"
					style={{ paddingLeft: row.depth ? row.depth * 48 : row.depth === 0 ? 24 : 0 }}
				>
					{row.subRows?.length > 0 ? (
						<button
							className="absolute -left-0.5"
							{...{
								onClick: row.getToggleExpandedHandler()
							}}
						>
							{row.getIsExpanded() ? (
								<>
									<Icon name="chevron-down" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">Hide child protocols</span>
								</>
							) : (
								<>
									<Icon name="chevron-right" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">View child protocols</span>
								</>
							)}
						</button>
					) : null}

					{isSubRow ? (
						<>
							<span>-</span>
							<span>{getValue()}</span>
						</>
					) : (
						<>
							<span className="vf-row-index shrink-0" aria-hidden="true" />
							<TokenLogo name={row.original.name} kind="chain" data-lgonly alt={`Logo of ${row.original.name}`} />
							<BasicLink
								href={`/stablecoins/${row.original.name}`}
								className="overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap text-link"
							>
								{getValue()}
							</BasicLink>
						</>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[160px] min-[900px]:w-[280px]'
		}
	}),
	columnHelper.accessor('bridgeInfo', {
		header: 'Bridge',
		enableSorting: false,
		cell: ({ getValue }) => {
			const value = getValue() as BridgeInfoCell
			if (!value.name || value.name === '-' || value.name === 'not-found') return null
			return (
				<>
					{value.link ? (
						<BasicLink href={value.link} className="text-sm font-medium text-link">
							{value.name}
						</BasicLink>
					) : (
						<span>{value.name}</span>
					)}
				</>
			)
		},
		meta: {
			headerClassName: 'w-[240px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('bridgedAmount', {
		header: 'Bridged Amount',
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('change_1d', {
		header: '1d Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('change_7d', {
		header: '7d Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('change_1m', {
		header: '1m Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('circulating', {
		header: 'Total Circulating',
		cell: (info) => formattedNum(info.getValue()),
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	})
]

const assetsByChainColumnOrders: ColumnOrdersByBreakpoint = {
	0: ['name', 'change_7d', 'circulating', 'change_1d', 'change_1m', 'bridgeInfo', 'bridgedAmount'],
	480: ['name', 'change_7d', 'circulating', 'change_1d', 'change_1m', 'bridgeInfo', 'bridgedAmount'],
	1024: ['name', 'bridgeInfo', 'bridgedAmount', 'change_1d', 'change_7d', 'change_1m', 'circulating']
}
export function StablecoinByChainUsageTable({ data }: { data: StablecoinByChainRow[] }) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'circulating', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
	const [expanded, setExpanded] = React.useState<ExpandedState>({})
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

	const instance = useReactTable({
		data,
		columns: stablecoinsByChainColumns,
		state: {
			sorting,
			expanded,
			columnOrder,
			columnFilters
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onExpandedChange: (updater) => React.startTransition(() => setExpanded(updater)),
		getSubRows: (row: StablecoinByChainRow) => row.subRows,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnOrderChange: (updater) => React.startTransition(() => setColumnOrder(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })
	useSortColumnOrders({
		instance,
		columnOrders: assetsByChainColumnOrders
	})

	return (
		<Panel>
			<TableToolbar className="items-center justify-between">
				<h3 className="label-md">Stablecoins Usage by Chain</h3>
				<label className={`${searchFieldInlineWrapperStyles} ml-auto`}>
					<span className="sr-only">Search</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						onInput={(e) => setProjectName(e.currentTarget.value)}
						placeholder="Search..."
						className={searchFieldInputStyles}
					/>
				</label>
			</TableToolbar>
			<VirtualTable instance={instance} />
		</Panel>
	)
}
