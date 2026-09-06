import {
	type ColumnFiltersState,
	type ColumnOrderState,
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { IconsRow } from '~/components/IconsRow'
import { toChainIconItems } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import { VirtualTable } from '~/components/Table/Table'
import { prepareTableCsv, useSortColumnOrders } from '~/components/Table/utils'
import type { ColumnOrdersByBreakpoint } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { PercentChange } from '~/ui/PercentChange'
import { slug } from '~/utils'
import type { CsvCell } from '~/utils/csvCell'
import { formatUsd } from '~/utils/numberFormat'

type BridgesTableRow = {
	displayName: string
	icon?: string | null
	chains: Array<string>
	change_1d?: number | null
	lastDailyVolume?: number | null
	weeklyVolume?: number | null
	monthlyVolume?: number | null
	txsPrevDay?: number | null
}

export type BridgesTableHandle = {
	prepareCsv: () => { filename: string; rows: Array<Array<CsvCell>> }
}

type BridgesTableProps = {
	data: Array<BridgesTableRow>
	searchValue?: string
	csvFileName?: string
}

const columnHelper = createColumnHelper<BridgesTableRow>()

const BRIDGES_COLUMNS = [
	columnHelper.accessor('displayName', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()
			const linkValue = slug(value)
			const rowValues = row.original
			const icon = rowValues.icon
			const colonIdx = icon ? icon.indexOf(':') : -1
			const iconType = colonIdx > 0 ? icon!.slice(0, colonIdx) : undefined
			const iconName = colonIdx > 0 ? icon!.slice(colonIdx + 1) : icon

			return (
				<span className="flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					{iconName ? (
						<TokenLogo
							name={iconName}
							kind={iconType === 'chain' ? 'chain' : 'token'}
							alt={`Logo of ${value}`}
							data-lgonly
						/>
					) : null}
					<BasicLink href={`/bridge/${linkValue}`} className="truncate text-sm font-medium text-link">
						{value}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[140px] min-[480px]:w-[180px] lg:w-[240px]'
		}
	}),
	columnHelper.accessor('chains', {
		header: 'Chains',
		enableSorting: false,
		cell: ({ getValue }) => <IconsRow items={toChainIconItems(getValue(), (chain) => `/bridges/${slug(chain)}`)} />,
		meta: {
			headerClassName: 'w-[180px] lg:w-[200px]',
			align: 'end',
			headerHelperText: 'Chains are ordered by bridge volume on each chain'
		}
	}),
	columnHelper.accessor((row) => row.change_1d ?? undefined, {
		id: 'change_1d',
		header: '1d Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.lastDailyVolume ?? undefined, {
		id: 'lastDailyVolume',
		header: 'Completed day',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: 'Volume during the last completed UTC day'
		}
	}),
	columnHelper.accessor((row) => row.weeklyVolume ?? undefined, {
		id: 'weeklyVolume',
		header: '7 completed days',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: 'Volume during the last 7 completed UTC days'
		}
	}),
	columnHelper.accessor((row) => row.monthlyVolume ?? undefined, {
		id: 'monthlyVolume',
		header: '30 completed days',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: 'Volume during the last 30 completed UTC days'
		}
	}),
	columnHelper.accessor((row) => row.txsPrevDay ?? undefined, {
		id: 'txsPrevDay',
		header: '24h # of Txs',
		meta: {
			headerClassName: 'w-[124px]',
			align: 'end'
		}
	})
]

// key: min width of window/screen
// values: table columns order
const bridgesColumnOrders: ColumnOrdersByBreakpoint = {
	0: ['displayName', 'lastDailyVolume', 'change_1d', 'weeklyVolume', 'monthlyVolume', 'chains', 'txsPrevDay'],
	1024: ['displayName', 'chains', 'change_1d', 'lastDailyVolume', 'weeklyVolume', 'monthlyVolume', 'txsPrevDay']
}
export const BridgesTable = React.forwardRef<BridgesTableHandle, BridgesTableProps>(function BridgesTable(
	{ data, searchValue = '', csvFileName = 'bridges' },
	ref
) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'lastDailyVolume', desc: true }])
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
	const instance = useReactTable({
		data,
		columns: BRIDGES_COLUMNS,
		state: {
			sorting,
			columnFilters,
			columnOrder
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater)),
		onColumnOrderChange: (updater) => React.startTransition(() => setColumnOrder(updater)),
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel()
	})

	React.useEffect(() => {
		React.startTransition(() => {
			instance.getColumn('displayName')?.setFilterValue(searchValue)
		})
	}, [searchValue, instance])

	useSortColumnOrders({
		instance,
		columnOrders: bridgesColumnOrders
	})

	React.useImperativeHandle(
		ref,
		() => ({
			prepareCsv: () => prepareTableCsv({ instance, filename: csvFileName })
		}),
		[csvFileName, instance]
	)

	return <VirtualTable instance={instance} />
})
