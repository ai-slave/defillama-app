import {
	type ColumnFiltersState,
	type ColumnOrderState,
	createColumnHelper,
	type SortingState,
	useTable
} from '@tanstack/react-table'
import * as React from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { BasicLink } from '~/components/Link'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import type { ColumnOrdersByBreakpoint } from '~/components/Table/utils'
import { prepareTableCsv, useSortColumnOrders, useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'
import type { BridgeChainTableRow } from './utils'

const tableFeaturesConfig = orderedFilteredTableFeatures

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, BridgeChainTableRow>()

const bridgeChainsColumn = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()
			return (
				<span className="flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo name={value} kind="chain" data-lgonly alt={`Logo of ${value}`} />
					<BasicLink href={`/bridges/${slug(value)}`} className="truncate text-sm font-medium text-link">
						{value}
					</BasicLink>
					{row.original.deprecated ? <DeprecatedEntityMarker content="Deprecated chain" /> : null}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[160px] min-[480px]:w-[180px]'
		}
	}),
	columnHelper.accessor((row) => row.prevDayNetFlow ?? undefined, {
		id: 'prevDayNetFlow',
		header: '24h Net Flow',
		cell: (info) => {
			const value = info.getValue()
			if (value == null) return null
			if (value === 0) return <>$0</>
			return (
				<span className={`${value > 0 ? 'text-data-up' : 'text-data-down'}`}>
					{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[120px] min-[480px]:w-[140px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.prevDayUsdDeposits ?? undefined, {
		id: 'prevDayUsdDeposits',
		header: '24h Deposits',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[130px] min-[480px]:w-[150px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.prevDayUsdWithdrawals ?? undefined, {
		id: 'prevDayUsdWithdrawals',
		header: '24h Withdrawals',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[130px] min-[480px]:w-[150px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.prevWeekNetFlow ?? undefined, {
		id: 'prevWeekNetFlow',
		header: '7d Net Flow',
		cell: (info) => {
			const value = info.getValue()
			if (value == null) return null
			if (value === 0) return <>$0</>
			return (
				<span className={`${value > 0 ? 'text-data-up' : 'text-data-down'}`}>
					{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[120px] min-[480px]:w-[140px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.prevWeekUsdDeposits ?? undefined, {
		id: 'prevWeekUsdDeposits',
		header: '7d Deposits',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[130px] min-[480px]:w-[150px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.prevWeekUsdWithdrawals ?? undefined, {
		id: 'prevWeekUsdWithdrawals',
		header: '7d Withdrawals',
		cell: (info) =>
			formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[130px] min-[480px]:w-[150px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('topTokenWithdrawnSymbol', {
		header: '24h Top Deposit',
		cell: ({ getValue }) => {
			const value = getValue()
			if (value == null) return null
			if (value === '') return 'Not found'
			return value
		},
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	})
])

const bridgeChainsColumnOrders: ColumnOrdersByBreakpoint = {
	0: [
		'name',
		'prevDayUsdWithdrawals',
		'prevDayUsdDeposits',
		'prevDayNetFlow',
		'prevWeekUsdWithdrawals',
		'prevWeekUsdDeposits',
		'prevWeekNetFlow',
		'topTokenWithdrawnSymbol'
	],
	1024: [
		'name',
		'topTokenWithdrawnSymbol',
		'prevDayUsdWithdrawals',
		'prevDayUsdDeposits',
		'prevDayNetFlow',
		'prevWeekUsdWithdrawals',
		'prevWeekUsdDeposits',
		'prevWeekNetFlow'
	]
}
export function BridgeChainsTable({ data }: { data: Array<BridgeChainTableRow> }) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'prevDayNetFlow', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
	const instance = useTable({
		features: tableFeaturesConfig,
		data,
		columns: bridgeChainsColumn,
		state: {
			sorting,
			columnOrder,
			columnFilters
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnOrderChange: (updater) => React.startTransition(() => setColumnOrder(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater))
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })

	useSortColumnOrders({
		instance,
		columnOrders: bridgeChainsColumnOrders
	})

	return (
		<Panel padding="none">
			<PanelHeader>
				<PanelTitle as="h1">Chains</PanelTitle>
				<label className={searchFieldInlineWrapperStyles}>
					<span className="sr-only">Search...</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						name="search"
						onInput={(e) => setProjectName(e.currentTarget.value)}
						placeholder="Search..."
						className={searchFieldInputStyles}
					/>
				</label>
				<CSVDownloadButton prepareCsv={() => prepareTableCsv({ instance, filename: 'bridge-chains' })} smol size="md" />
			</PanelHeader>
			<VirtualTable table={instance} />
		</Panel>
	)
}
