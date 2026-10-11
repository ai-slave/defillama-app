import {
	type ColumnFiltersState,
	type ColumnOrderState,
	createColumnHelper,
	type ExpandedState,
	type SortingState,
	useTable
} from '@tanstack/react-table'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { searchTableFeatures } from '~/components/Table/features/search'
import type { ColumnOrdersByBreakpoint } from '~/components/Table/utils'
import { useSortColumnOrders, useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import type { groupBridgeData } from '~/containers/Stablecoins/hooks'
import { Button } from '~/ui/Button'
import { Change } from '~/ui/Change'
import { Icon } from '~/ui/Icon'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { SearchField } from '~/ui/SearchField'
import { TableToolbar } from '~/ui/Toolbar'
import { formatCompactNumber, formatPercent } from '~/utils/numberFormat'

type StablecoinByChainRow = ReturnType<typeof groupBridgeData>[number]
const columnHelper = createColumnHelper<typeof searchTableFeatures, StablecoinByChainRow>()

const stablecoinsByChainColumns = columnHelper.columns([
	columnHelper.accessor((row) => `${row.name}${row.symbol && row.symbol !== '-' ? ` (${row.symbol})` : ''}`, {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const isSubRow = row.depth > 0

			return (
				<span
					className="relative flex items-center gap-2"
					style={{ paddingLeft: row.depth ? row.depth * 48 : row.depth === 0 ? 24 : 0 }}
				>
					{row.subRows?.length > 0 ? (
						<Button
							size="sm"
							variant="ghost"
							square
							aria-expanded={row.getIsExpanded()}
							type="button"
							className="absolute -left-1.5"
							{...{
								onClick: row.getToggleExpandedHandler()
							}}
						>
							{row.getIsExpanded() ? (
								<>
									<Icon name="chevron-down" className="size-4 text-tertiary" />
									<span className="sr-only">Hide child protocols</span>
								</>
							) : (
								<>
									<Icon name="chevron-right" className="size-4 text-tertiary" />
									<span className="sr-only">View child protocols</span>
								</>
							)}
						</Button>
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
								className="truncate label-md text-link hover:underline"
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
			const value = getValue()
			if (!value.name || value.name === '-' || value.name === 'not-found') return null
			return (
				<>
					{value.link ? (
						<BasicLink href={value.link} className="label-md text-link hover:underline">
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
	columnHelper.accessor((row) => row.bridgedPercent ?? undefined, {
		id: 'bridgedAmount',
		header: 'Bridged %',
		cell: ({ getValue }) => {
			const value = getValue()
			return formatPercent(value, {
				input: 'percent',
				minimumFractionDigits: value === 100 ? 0 : 2,
				maximumFractionDigits: 2,
				useGrouping: false
			})
		},
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.change_1d ?? undefined, {
		id: 'change_1d',
		header: '1d Change',
		cell: (info) => <Change value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.change_7d ?? undefined, {
		id: 'change_7d',
		header: '7d Change',
		cell: (info) => <Change value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.change_1m ?? undefined, {
		id: 'change_1m',
		header: '1m Change',
		cell: (info) => <Change value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.circulating ?? undefined, {
		id: 'circulating',
		header: 'Total Circulating',
		cell: (info) =>
			formatCompactNumber(info.getValue(), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	})
])

const assetsByChainColumnOrders: ColumnOrdersByBreakpoint = {
	0: ['name', 'change_7d', 'circulating', 'change_1d', 'change_1m', 'bridgeInfo', 'bridgedAmount'],
	480: ['name', 'change_7d', 'circulating', 'change_1d', 'change_1m', 'bridgeInfo', 'bridgedAmount'],
	1024: ['name', 'bridgeInfo', 'bridgedAmount', 'change_1d', 'change_7d', 'change_1m', 'circulating']
}
export function StablecoinByChainUsageTable({ data }: { data: Array<StablecoinByChainRow> }) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'circulating', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
	const [expanded, setExpanded] = React.useState<ExpandedState>({})
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

	const instance = useTable({
		features: searchTableFeatures,
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
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater))
	})

	const [projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })
	useSortColumnOrders({
		instance,
		columnOrders: assetsByChainColumnOrders
	})

	return (
		<Panel>
			<TableToolbar>
				<h3 className="label-md">Stablecoins Usage by Chain</h3>
				<SearchField
					label="Search chains"
					value={projectName}
					onChange={setProjectName}
					placeholder="Search…"
					className={`${searchFieldInlineWrapperStyles} ml-auto`}
				/>
			</TableToolbar>
			<VirtualTable table={instance} />
		</Panel>
	)
}
