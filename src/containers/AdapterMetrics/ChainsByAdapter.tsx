import {
	type ColumnFiltersState,
	type ColumnOrderState,
	createColumnHelper,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import { startTransition, useState } from 'react'
import { Announcement } from '~/components/Announcement'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'
import { BasicLink } from '~/components/Link'
import { VirtualTable } from '~/components/Table/Table'
import { prepareTableCsv, useSortColumnOrders, useTableSearch } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { definitions } from '~/public/definitions'
import { Icon } from '~/ui/Icon'
import { searchFieldWrapperStyles, searchFieldIconStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'
import { ChainsByAdapterChart } from './ChainChart'
import type { IChainsByAdapterPageData } from './types'

type TPageType =
	| 'Fees'
	| 'Revenue'
	| 'Holders Revenue'
	| 'DEX Volume'
	| 'Perp Volume'
	| 'Normalized Volume'
	| 'Bridge Aggregator Volume'
	| 'Perp Aggregator Volume'
	| 'DEX Aggregator Volume'
	| 'Options Premium Volume'
	| 'Options Notional Volume'
	| 'App Revenue'
	| 'App Fees'

interface IProps extends IChainsByAdapterPageData {
	type: TPageType
}

const FEES_CHART_PAGE_TYPES: Array<TPageType> = ['Holders Revenue', 'App Fees', 'App Revenue']

export function ChainsByAdapter(props: IProps) {
	const [sorting, setSorting] = useState<SortingState>([{ desc: true, id: 'total24h' }])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])

	const instance = useReactTable({
		data: props.chains,
		columns: columnsByType[props.type],
		state: {
			sorting,
			columnFilters,
			columnOrder
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		filterFromLeafRows: true,
		onSortingChange: (updater) => startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => startTransition(() => setColumnFilters(updater)),
		onColumnOrderChange: (updater) => startTransition(() => setColumnOrder(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })
	useSortColumnOrders({
		instance
	})
	const showChartPanel = props.adapterType !== 'fees' || FEES_CHART_PAGE_TYPES.includes(props.type)

	return (
		<>
			{props.type === 'Fees' ? (
				<Announcement notCancellable>
					<span>Are we missing any protocol?</span>{' '}
					<a
						href="https://airtable.com/shrtBA9lvj6E036Qx"
						className="font-medium text-brand underline"
						target="_blank"
						rel="noopener noreferrer"
					>
						Request it here!
					</a>
				</Announcement>
			) : null}
			{showChartPanel ? (
				<ChainsByAdapterChart
					adapterType={props.adapterType}
					dataType={props.dataType}
					chartData={props.chartData}
					allChains={props.allChains}
					chartName={props.type}
				/>
			) : null}
			<Panel padding="none">
				<TableToolbar className="justify-end">
					<label className={searchFieldWrapperStyles}>
						<span className="sr-only">Search chains</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<input
							onInput={(e) => setProjectName(e.currentTarget.value)}
							placeholder="Search..."
							className={searchFieldInputStyles}
						/>
					</label>
					<CSVDownloadButton
						prepareCsv={() => prepareTableCsv({ instance, filename: `${props.type}-chains-protocols` })}
						smol
						size="md"
					/>
				</TableToolbar>
				<VirtualTable instance={instance} rowSize={64} compact />
			</Panel>
		</>
	)
}
type ChainRow = IChainsByAdapterPageData['chains'][0]

const columnHelper = createColumnHelper<ChainRow>()

const NameColumn = (route: string) =>
	columnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()

			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo src={row.original.logo} alt={`Logo of ${row.original.name}`} data-lgonly />

					<BasicLink
						href={route ? `/${route}/chain/${slug(value)}` : `/chain/${slug(value)}`}
						className="truncate text-sm font-medium text-link hover:underline"
					>
						{value}
					</BasicLink>
					{row.original.deprecated ? <DeprecatedEntityMarker content="Deprecated chain" /> : null}
					{row.original.warning ? (
						<Tooltip content={row.original.warning}>
							<Icon name="alert-triangle" height={14} width={14} className="shrink-0 text-warning" />
						</Tooltip>
					) : null}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[180px] sm:w-[240px] md:w-[280px]'
		}
	})

const metricColumnWidthClassBySize: Record<number, string> = {
	128: 'w-[128px]',
	152: 'w-[152px]',
	160: 'w-[160px]',
	169: 'w-[169px] min-w-[169px]',
	172: 'w-[172px] min-w-[172px]',
	180: 'w-[min(180px,40vw)]',
	184: 'w-[184px] min-w-[184px]',
	200: 'w-[min(200px,40vw)]'
}

const getMetricColumnWidthClass = (size: number) => metricColumnWidthClassBySize[size] ?? 'w-[160px]'

const metricColumn = (
	id: string,
	header: string,
	accessor: (protocol: ChainRow) => number | null | undefined,
	headerHelperText: string,
	size: number,
	csvHeader?: string
) =>
	columnHelper.accessor((row) => accessor(row) ?? undefined, {
		id,
		header,
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: getMetricColumnWidthClass(size),
			align: 'center',
			headerHelperText,
			...(csvHeader ? { csvHeader } : {})
		}
	})

const columnsByType = {
	Fees: [
		NameColumn('fees'),
		metricColumn('total24h', 'Fees 24h', (protocol) => protocol.total24h, definitions.fees.chain['24h'], 128),
		metricColumn('total7d', 'Fees 7d', (protocol) => protocol.total7d, definitions.fees.chain['7d'], 128),
		metricColumn('total30d', 'Fees 30d', (protocol) => protocol.total30d, definitions.fees.chain['30d'], 128)
	],
	Revenue: [
		NameColumn('revenue'),
		metricColumn('total24h', 'Revenue 24h', (protocol) => protocol.total24h, definitions.revenue.chain['24h'], 128),
		metricColumn('total7d', 'Revenue 7d', (protocol) => protocol.total7d, definitions.revenue.chain['7d'], 128),
		metricColumn('total30d', 'Revenue 30d', (protocol) => protocol.total30d, definitions.revenue.chain['30d'], 128)
	],
	'Holders Revenue': [
		NameColumn('holders-revenue'),
		metricColumn(
			'total24h',
			'Holders Revenue 24h',
			(protocol) => protocol.total24h,
			definitions.holdersRevenue.chain['24h'],
			180
		),
		metricColumn(
			'total7d',
			'Holders Revenue 7d',
			(protocol) => protocol.total7d,
			definitions.holdersRevenue.chain['7d'],
			180
		),
		metricColumn(
			'total30d',
			'Holders Revenue 30d',
			(protocol) => protocol.total30d,
			definitions.holdersRevenue.chain['30d'],
			180
		)
	],
	'App Revenue': [
		NameColumn('revenue'),
		metricColumn(
			'total24h',
			'App Revenue 24h',
			(protocol) => protocol.total24h,
			definitions.appRevenue.chain['24h'],
			180
		),
		metricColumn('total7d', 'App Revenue 7d', (protocol) => protocol.total7d, definitions.appRevenue.chain['7d'], 180),
		metricColumn(
			'total30d',
			'App Revenue 30d',
			(protocol) => protocol.total30d,
			definitions.appRevenue.chain['30d'],
			180
		)
	],
	'App Fees': [
		NameColumn('fees'),
		metricColumn('total24h', 'App Fees 24h', (protocol) => protocol.total24h, definitions.appFees.chain['24h'], 180),
		metricColumn('total7d', 'App Fees 7d', (protocol) => protocol.total7d, definitions.appFees.chain['7d'], 180),
		metricColumn('total30d', 'App Fees 30d', (protocol) => protocol.total30d, definitions.appFees.chain['30d'], 180)
	],
	'Options Premium Volume': [
		NameColumn('options/premium-volume'),
		metricColumn(
			'total24h',
			'Premium Volume 24h',
			(protocol) => protocol.total24h,
			definitions.optionsPremium.chain['24h'],
			180
		),
		metricColumn(
			'total7d',
			'Premium Volume 7d',
			(protocol) => protocol.total7d,
			definitions.optionsPremium.chain['7d'],
			180
		),
		metricColumn(
			'total30d',
			'Premium Volume 30d',
			(protocol) => protocol.total30d,
			definitions.optionsPremium.chain['30d'],
			180
		)
	],
	'Options Notional Volume': [
		NameColumn('options/notional-volume'),
		metricColumn(
			'total24h',
			'Notional Volume 24h',
			(protocol) => protocol.total24h,
			definitions.optionsNotional.chain['24h'],
			180
		),
		metricColumn(
			'total7d',
			'Notional Volume 7d',
			(protocol) => protocol.total7d,
			definitions.optionsNotional.chain['7d'],
			180
		),
		metricColumn(
			'total30d',
			'Notional Volume 30d',
			(protocol) => protocol.total30d,
			definitions.optionsNotional.chain['30d'],
			180
		)
	],
	'DEX Volume': [
		NameColumn('dexs'),
		metricColumn('total24h', 'DEX Volume 24h', (protocol) => protocol.total24h, definitions.dexs.chain['24h'], 152),
		metricColumn('total7d', 'DEX Volume 7d', (protocol) => protocol.total7d, definitions.dexs.chain['7d'], 152),
		metricColumn('total30d', 'DEX Volume 30d', (protocol) => protocol.total30d, definitions.dexs.chain['30d'], 152)
	],
	'Perp Volume': [
		NameColumn('perps'),
		metricColumn('total24h', 'Perp Volume 24h', (protocol) => protocol.total24h, definitions.perps.chain['24h'], 160),
		metricColumn('total7d', 'Perp Volume 7d', (protocol) => protocol.total7d, definitions.perps.chain['7d'], 160),
		metricColumn('total30d', 'Perp Volume 30d', (protocol) => protocol.total30d, definitions.perps.chain['30d'], 160),
		metricColumn(
			'openInterest',
			'Open Interest',
			(protocol) => protocol.openInterest,
			definitions.openInterest.chain,
			160
		)
	],
	'Normalized Volume': [
		NameColumn('normalized-volume'),
		metricColumn(
			'total24h',
			'Normalized Volume 24h',
			(protocol) => protocol.total24h,
			definitions.normalizedVolume.chain['24h'],
			160
		),
		metricColumn(
			'activeLiquidity',
			'Active Liquidity',
			(protocol) => protocol.activeLiquidity,
			definitions.activeLiquidity.chain,
			160
		),
		metricColumn(
			'total7d',
			'Normalized Volume 7d',
			(protocol) => protocol.total7d,
			definitions.normalizedVolume.chain['7d'],
			160
		),
		metricColumn(
			'total30d',
			'Normalized Volume 30d',
			(protocol) => protocol.total30d,
			definitions.normalizedVolume.chain['30d'],
			160
		)
	],
	'Perp Aggregator Volume': [
		NameColumn('perps-aggregators'),
		metricColumn(
			'total24h',
			'Perp Agg Vol 24h',
			(protocol) => protocol.total24h,
			definitions.perpsAggregators.chain['24h'],
			172,
			'Perp Aggregator Volume 24h'
		),
		metricColumn(
			'total7d',
			'Perp Agg Vol 7d',
			(protocol) => protocol.total7d,
			definitions.perpsAggregators.chain['7d'],
			172,
			'Perp Aggregator Volume 7d'
		),
		metricColumn(
			'total30d',
			'Perp Agg Vol 30d',
			(protocol) => protocol.total30d,
			definitions.perpsAggregators.chain['30d'],
			172,
			'Perp Aggregator Volume 30d'
		)
	],
	'Bridge Aggregator Volume': [
		NameColumn('bridge-aggregators'),
		metricColumn(
			'total24h',
			'Bridge Agg Vol 24h',
			(protocol) => protocol.total24h,
			definitions.bridgeAggregators.chain['24h'],
			184,
			'Bridge Aggregator Volume 24h'
		),
		metricColumn(
			'total7d',
			'Bridge Agg Vol 7d',
			(protocol) => protocol.total7d,
			definitions.bridgeAggregators.chain['7d'],
			184,
			'Bridge Aggregator Volume 7d'
		),
		metricColumn(
			'total30d',
			'Bridge Agg Vol 30d',
			(protocol) => protocol.total30d,
			definitions.bridgeAggregators.chain['30d'],
			184,
			'Bridge Aggregator Volume 30d'
		)
	],
	'DEX Aggregator Volume': [
		NameColumn('dex-aggregators'),
		metricColumn(
			'total24h',
			'DEX Agg Vol 24h',
			(protocol) => protocol.total24h,
			definitions.dexAggregators.chain['24h'],
			169,
			'DEX Aggregator Volume 24h'
		),
		metricColumn(
			'total7d',
			'DEX Agg Vol 7d',
			(protocol) => protocol.total7d,
			definitions.dexAggregators.chain['7d'],
			169,
			'DEX Aggregator Volume 7d'
		),
		metricColumn(
			'total30d',
			'DEX Agg Vol 30d',
			(protocol) => protocol.total30d,
			definitions.dexAggregators.chain['30d'],
			169,
			'DEX Aggregator Volume 30d'
		)
	]
}
