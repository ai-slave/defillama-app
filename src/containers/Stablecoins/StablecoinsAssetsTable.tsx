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
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import { BasicLink } from '~/components/Link'
import { orderedFilteredTableFeatures } from '~/components/Table/features/orderedFiltering'
import type { ColumnOrdersByBreakpoint } from '~/components/Table/utils'
import { prepareTableCsv, useSortColumnOrders, useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import type { calcCirculating } from '~/containers/Stablecoins/hooks'
import { Change, formatChange } from '~/ui/Change'
import { searchFieldWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SearchField } from '~/ui/SearchField'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatPercentChange, formatUsd } from '~/utils/numberFormat'

type StablecoinDeviationInfo = {
	timestamp: number
	price: number
	priceSource: string | number | null
}

type StablecoinsTableInputRow = {
	name: string
	symbol?: string
	deprecated?: boolean
	yieldBearing?: boolean
	depeggedTwoPercent?: boolean
	floatingPeg?: boolean
	chains: Array<string>
	pegDeviation?: number | null
	pegDeviation_1m?: number | null
	pegDeviationInfo?: StablecoinDeviationInfo | null
	price?: number | null
	change_1d?: number | null
	change_7d?: number | null
	change_1m?: number | null
	change_1d_usd?: number | null
	change_7d_usd?: number | null
	change_1m_usd?: number | null
	mcap?: number | null
	pegType?: string | null
	unreleased?: number | null
	doublecounted?: boolean
	delisted?: boolean
	deadFrom?: string
	circulating?: number | null
	subRows?: Array<StablecoinsTableInputRow>
}
type StablecoinRow = ReturnType<typeof calcCirculating<StablecoinsTableInputRow>>[number]
const columnHelper = createColumnHelper<typeof orderedFilteredTableFeatures, StablecoinRow>()

const stablecoinsColumns = columnHelper.columns([
	columnHelper.accessor((row) => `${row.name}${row.symbol && row.symbol !== '-' ? ` (${row.symbol})` : ''}`, {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const lifecycleStatus = row.original.deadFrom
				? `Ended on ${row.original.deadFrom}`
				: row.original.delisted
					? 'Delisted stablecoin'
					: row.original.deprecated
						? 'Deprecated stablecoin'
						: null
			return (
				<span className="flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo name={row.original.name} kind="pegged" alt={`Logo of ${row.original.name}`} data-lgonly />
					<BasicLink
						href={`/stablecoin/${slug(row.original.name)}`}
						className="flex items-center gap-1 truncate label-md text-link hover:underline"
					>
						<span className="truncate">{getValue()}</span>
						{lifecycleStatus ? <DeprecatedEntityMarker content={lifecycleStatus} /> : null}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[180px] lg:w-[240px]'
		}
	}),
	columnHelper.accessor('chains', {
		header: 'Chains',
		enableSorting: false,
		cell: ({ getValue }) => (
			<IconsRow items={toChainIconItems(getValue(), (chain) => chainHref('/stablecoins', chain))} />
		),
		meta: {
			headerClassName: 'w-[180px] lg:w-[200px]',
			align: 'end',
			headerHelperText: 'Chains are ordered by stablecoin issuance on each chain'
		}
	}),
	columnHelper.accessor((row) => (row.yieldBearing ? null : row.pegDeviation) ?? undefined, {
		id: 'pegDeviation',
		header: '% Off Peg',
		cell: ({ getValue, row }) => {
			const value = getValue()
			const rowValues = row.original
			if (rowValues.yieldBearing) {
				return <span>-</span>
			}
			return (
				<span className="flex w-full items-center justify-end gap-1">
					{rowValues.depeggedTwoPercent ? <QuestionHelper text="Currently de-pegged by 2% or more." /> : null}
					{value != null ? formatPercentChange(value) : '-'}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => (row.yieldBearing ? null : row.pegDeviation_1m) ?? undefined, {
		id: 'pegDeviation_1m',
		header: '30d % Off Peg',
		cell: ({ getValue, row }) => {
			const value = getValue()
			const rowValues = row.original
			if (rowValues.yieldBearing) {
				return <span>-</span>
			}
			return (
				<span className="flex w-full items-center justify-end gap-1">
					{rowValues.pegDeviationInfo ? <QuestionHelper text={pegDeviationText(rowValues.pegDeviationInfo)} /> : null}
					{value != null ? formatPercentChange(value) : '-'}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[132px]',
			align: 'end',
			headerHelperText: 'Shows greatest % price deviation from peg over the past month'
		}
	}),
	columnHelper.accessor((row) => row.price ?? undefined, {
		id: 'price',
		header: 'Price',
		cell: ({ getValue, row }) => {
			const value = getValue()
			const rowValues = row.original
			return (
				<span className="flex w-full items-center justify-end gap-1">
					{rowValues.floatingPeg ? <QuestionHelper text="Has a variable, floating, or crawling peg." /> : null}
					{value != null ? (
						formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					) : (
						<span>-</span>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.change_1d ?? undefined, {
		id: 'change_1d',
		header: '1d Change',
		cell: (info) =>
			// A percent needs the previous mcap, so its dollar change is always there too.
			info.getValue() != null ? (
				<Change value={info.getValue()} tooltip={formatChange(info.row.original.change_1d_usd!, 'usd')} />
			) : (
				'-'
			),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.change_7d ?? undefined, {
		id: 'change_7d',
		header: '7d Change',
		cell: (info) =>
			info.getValue() != null ? (
				<Change value={info.getValue()} tooltip={formatChange(info.row.original.change_7d_usd!, 'usd')} />
			) : (
				'-'
			),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.change_1m ?? undefined, {
		id: 'change_1m',
		header: '30d Change',
		cell: (info) =>
			info.getValue() != null ? (
				<Change value={info.getValue()} tooltip={formatChange(info.row.original.change_1m_usd!, 'usd')} />
			) : (
				'-'
			),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.mcap ?? undefined, {
		id: 'mcap',
		header: 'Market Cap',
		cell: (info) => {
			const value = info.getValue()
			if (value != null) {
				return (
					<span className="flex w-full items-center justify-end gap-1">
						{info.row.original.doublecounted ? (
							<QuestionHelper text="This stablecoin is excluded from aggregate stablecoin market cap to avoid double counting." />
						) : null}
						<span className={info.row.original.doublecounted ? 'text-tertiary' : ''}>
							{formatUsd(value, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</span>
					</span>
				)
			}
			return info.row.original.deadFrom || info.row.original.delisted ? (
				<Tooltip
					content={
						info.row.original.deadFrom
							? `No current market cap after ${info.row.original.deadFrom}`
							: 'No current market cap for this delisted stablecoin'
					}
					className="w-full cursor-help justify-end underline decoration-dotted"
					tabIndex={0}
				>
					N/A
				</Tooltip>
			) : (
				<span className="flex w-full justify-end">N/A</span>
			)
		},
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	})
])

const assetsColumnOrders: ColumnOrdersByBreakpoint = {
	0: ['name', 'mcap', 'change_1d', 'change_7d', 'change_1m', 'price', 'pegDeviation', 'pegDeviation_1m', 'chains'],
	1024: ['name', 'chains', 'mcap', 'pegDeviation', 'pegDeviation_1m', 'price', 'change_1d', 'change_7d', 'change_1m']
}
const formatPriceSource: Record<string, string> = {
	chainlink: 'Chainlink',
	uniswap: 'a Uniswap v3 pool oracle',
	dexscreener: 'DEX Screener',
	curve: 'a Curve pool oracle',
	coingecko: 'CoinGecko',
	birdeye: 'Birdeye',
	kucoin: 'KuCoin Exchange',
	defillama: 'DefiLlama',
	kaddex: 'Kaddex'
}

function pegDeviationText(pegDeviationInfo: { timestamp: number; price: number; priceSource: string | number | null }) {
	const { timestamp, price, priceSource } = pegDeviationInfo
	const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
	const sourceLabel = priceSource != null ? formatPriceSource[String(priceSource)] : undefined
	return `On ${date}, ${sourceLabel ?? (priceSource != null ? `source ${String(priceSource)}` : 'an unknown source')} reported a price of ${formatUsd(price, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}.`
}

export function StablecoinsTable({ data }: { data: Array<StablecoinRow> }) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'mcap', desc: true }])
	const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

	const instance = useTable({
		features: orderedFilteredTableFeatures,
		data,
		columns: stablecoinsColumns,
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

	const [projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })
	useSortColumnOrders({ instance, columnOrders: assetsColumnOrders })

	return (
		<Panel>
			<TableToolbar>
				<SearchField
					label="Search stablecoins"
					value={projectName}
					onChange={setProjectName}
					placeholder="Search…"
					className={searchFieldWrapperStyles}
				/>
				<CSVDownloadButton
					prepareCsv={() => prepareTableCsv({ instance, filename: 'stablecoins-assets' })}
					smol
					size="md"
				/>
			</TableToolbar>
			<VirtualTable table={instance} />
		</Panel>
	)
}
