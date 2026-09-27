import {
	type ColumnFiltersState,
	type ColumnOrderState,
	createColumnHelper,
	type SortingState,
	type Table,
	useTable
} from '@tanstack/react-table'
import * as React from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import type { ColumnOrdersByBreakpoint } from '~/components/Table/utils'
import { prepareTableCsv, useSortColumnOrders, useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles, searchFieldWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate, formatIsoDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import type { Raise } from './model'

export const tableFeaturesConfig = orderedFilteredTableFeatures

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, Raise>()

export const raisesColumns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.date ?? undefined, {
		id: 'date',
		meta: {
			headerClassName: 'w-[120px]'
		},
		header: 'Date',
		cell: (info) => formatDate(info.getValue(), { input: 'seconds' })
	}),
	columnHelper.accessor((row) => row.amountUsd ?? undefined, {
		id: 'amount',
		header: 'Amount Raised',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[140px]'
		}
	}),
	columnHelper.accessor('round', {
		header: 'Round',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[140px]'
		}
	}),
	columnHelper.accessor('category', {
		header: 'Category',
		meta: {
			headerClassName: 'w-[160px]'
		},
		enableSorting: false,
		cell: (info) => <Tooltip content={info.getValue()}>{info.getValue()}</Tooltip>
	}),
	columnHelper.accessor('sector', {
		header: 'Description',
		meta: {
			headerClassName: 'w-[140px]'
		},
		enableSorting: false,
		cell: (info) => <Tooltip content={info.getValue()}>{info.getValue()}</Tooltip>
	}),
	columnHelper.accessor('leadInvestors', {
		header: 'Lead Investor',
		meta: {
			headerClassName: 'w-[120px]'
		},
		enableSorting: false,
		cell: (info) => <Tooltip content={info.getValue().join(', ')}>{info.getValue().join(', ')}</Tooltip>
	}),
	columnHelper.accessor((row) => row.valuationUsd ?? undefined, {
		id: 'valuation',
		header: 'Valuation',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[100px]'
		}
	}),
	columnHelper.accessor('chains', {
		header: 'Chains',
		enableSorting: false,
		cell: ({ getValue }) => <IconsRow items={toChainIconItems(getValue(), (chain) => chainHref('/chain', chain))} />,
		meta: {
			headerClassName: 'w-[80px]'
		}
	}),
	columnHelper.accessor('otherInvestors', {
		header: 'Other Investors',
		meta: {
			headerClassName: 'w-[min(400px,40vw)]'
		},
		enableSorting: false,
		cell: (info) => <Tooltip content={info.getValue().join(', ')}>{info.getValue().join(', ')}</Tooltip>
	})
])

export const raisesColumnOrders: ColumnOrdersByBreakpoint = {
	0: [
		'name',
		'amount',
		'date',
		'round',
		'category',
		'sector',
		'leadInvestors',
		'valuation',
		'chains',
		'otherInvestors'
	],
	1024: [
		'name',
		'date',
		'amount',
		'round',
		'category',
		'sector',
		'leadInvestors',
		'valuation',
		'chains',
		'otherInvestors'
	]
}

export const prepareRaisesCsv = (instance: Table<typeof tableFeaturesConfig, Raise>) => {
	const csv = prepareTableCsv({ instance, filename: 'raises' })
	const headers = csv.rows[0]
	if (!headers) return csv
	const dateIdx = headers.indexOf('Date')
	const newHeaders = [...headers]

	if (dateIdx !== -1) {
		newHeaders.splice(dateIdx, 1, 'Timestamp', 'Date')
	}

	return {
		...csv,
		rows: [
			newHeaders,
			...csv.rows.slice(1).map((row) => {
				const newRow = [...row]
				const ts = newRow[dateIdx]
				if (dateIdx !== -1 && typeof ts === 'number') {
					newRow.splice(dateIdx, 1, ts, formatIsoDate(ts, { input: 'seconds' }) ?? '')
				}
				return newRow
			})
		]
	}
}

export function RaisesTable({ raises }: { raises: Array<Raise> }) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ desc: true, id: 'date' }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])

	const instance = useTable({
		features: tableFeaturesConfig,
		data: raises,
		columns: raisesColumns,
		state: {
			columnFilters,
			columnOrder,
			sorting
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
		columnOrders: raisesColumnOrders
	})

	return (
		<Panel padding="none">
			<TableToolbar>
				<label className={searchFieldWrapperStyles}>
					<span className="sr-only">Search projects...</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<Input
						name="search"
						onInput={(e) => setProjectName(e.currentTarget.value)}
						placeholder="Search projects..."
						className={searchFieldInputPlacementStyles}
					/>
				</label>
				<ExternalLinkButton href="https://github.com/DefiLlama/DefiLlama-Adapters/discussions/7093">
					Methodology & biases
				</ExternalLinkButton>
				<CSVDownloadButton prepareCsv={() => prepareRaisesCsv(instance)} smol size="md" />
			</TableToolbar>

			<VirtualTable table={instance} />
		</Panel>
	)
}
