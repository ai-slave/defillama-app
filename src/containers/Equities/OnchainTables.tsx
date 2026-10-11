import { createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import { usePaginatedTable } from '~/components/Table/features/pagination'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { prepareTableCsv } from '~/components/Table/utils'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StaleText } from '~/ui/StaleText'
import { Tag } from '~/ui/Tag'
import { TextLink } from '~/ui/TextLink'
import { TableToolbar } from '~/ui/Toolbar'
import { formatDateTime } from '~/utils/dateFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { formatEquitiesCompactValue } from './financialsFormatting'
import type { IEquitiesOnchainMarketRow, IEquitiesOnchainTokenRow } from './types'

const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50] as const
const DEFAULT_TABLE_PAGE_SIZE = 10

const MARKET_VENUE_FILTERS = ['all', 'CEX', 'DEX'] as const
type MarketVenueFilter = (typeof MARKET_VENUE_FILTERS)[number]
const MARKET_VENUE_QUERY_VALUES: Record<MarketVenueFilter, string | undefined> = {
	all: undefined,
	CEX: 'cex',
	DEX: 'dex'
}

function getMarketVenueFromQuery(value?: string): MarketVenueFilter {
	const match = MARKET_VENUE_FILTERS.find((filter) => MARKET_VENUE_QUERY_VALUES[filter] === value)
	return match ?? 'all'
}

const marketsColumnHelper = createColumnHelper<typeof paginatedTableFeatures, IEquitiesOnchainMarketRow>()
const tokensColumnHelper = createColumnHelper<typeof paginatedTableFeatures, IEquitiesOnchainTokenRow>()

function formatFundingRate(value: number | null): string {
	return value == null ? '-' : (formatEquitiesCompactValue(value, '%') ?? '-')
}

function rwaPerpsContractHref(slug: string): string {
	return `/rwa/perps/contract/${encodeURIComponent(slug)}`
}

function protocolHref(slug: string): string {
	return `/protocol/${slug}`
}

function rwaPlatformHref(slug: string): string {
	return `/rwa/platform/${slug}`
}

function rwaAssetHref(slug: string): string {
	return `/rwa/asset/${encodeURIComponent(slug)}`
}

const marketsColumns = marketsColumnHelper.columns([
	marketsColumnHelper.accessor('pair', {
		header: 'Pair',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[132px]',
			align: 'start'
		}
	}),
	marketsColumnHelper.accessor('contractSlug', {
		header: 'Contract',
		enableSorting: false,
		cell: ({ getValue }) => <TextLink href={rwaPerpsContractHref(getValue())}>{getValue()}</TextLink>,
		meta: {
			headerClassName: 'w-[168px]',
			align: 'start'
		}
	}),
	marketsColumnHelper.accessor((row) => row.price ?? undefined, {
		id: 'price',
		header: 'Price',
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end'
		}
	}),
	marketsColumnHelper.accessor((row) => row.volume24h ?? undefined, {
		id: 'volume24h',
		header: '24h Volume',
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[124px]',
			align: 'end'
		}
	}),
	marketsColumnHelper.accessor((row) => row.openInterest ?? undefined, {
		id: 'openInterest',
		header: 'Open Interest',
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[132px]',
			align: 'end'
		}
	}),
	marketsColumnHelper.accessor((row) => row.annualizedFundingRate ?? undefined, {
		id: 'annualizedFundingRate',
		header: 'Funding APR',
		cell: ({ getValue }) => formatFundingRate(getValue() ?? null),
		meta: {
			headerClassName: 'w-[124px]',
			align: 'end'
		}
	}),
	marketsColumnHelper.accessor('exchangeName', {
		header: 'Exchange',
		enableSorting: false,
		cell: ({ getValue, row }) =>
			row.original.exchangeProtocolSlug ? (
				<TextLink href={protocolHref(row.original.exchangeProtocolSlug)}>{getValue()}</TextLink>
			) : (
				'-'
			),
		meta: {
			headerClassName: 'w-[180px]',
			align: 'start'
		}
	}),
	marketsColumnHelper.accessor('exchangeType', {
		header: 'Type',
		enableSorting: false,
		cell: ({ getValue }) => <Tag>{getValue()}</Tag>,
		meta: {
			headerClassName: 'w-[84px]',
			align: 'start'
		}
	}),
	marketsColumnHelper.accessor('platformName', {
		header: 'Platform',
		enableSorting: false,
		cell: ({ getValue, row }) =>
			row.original.rwaPlatformSlug ? (
				<TextLink href={rwaPlatformHref(row.original.rwaPlatformSlug)}>{getValue()}</TextLink>
			) : (
				'-'
			),
		meta: {
			headerClassName: 'w-[180px]',
			align: 'start'
		}
	}),
	marketsColumnHelper.accessor('tradeUrl', {
		header: 'Trade',
		enableSorting: false,
		cell: ({ getValue }) => (
			<a
				href={getValue()}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-1 text-link hover:underline"
			>
				Open
				<Icon name="arrow-up-right" className="size-3.5" />
			</a>
		),
		meta: {
			headerClassName: 'w-[92px]',
			align: 'end'
		}
	}),
	marketsColumnHelper.accessor('updatedAt', {
		header: 'Updated',
		cell: ({ getValue }) => (
			<StaleText className="whitespace-nowrap">
				{formatDateTime(getValue(), { timeZone: 'local', timeZoneName: 'short' }) ?? '-'}
			</StaleText>
		),
		meta: {
			headerClassName: 'w-[172px]',
			align: 'end'
		}
	})
])

const tokensColumns = tokensColumnHelper.columns([
	tokensColumnHelper.accessor('assetSlug', {
		header: 'Asset',
		enableSorting: false,
		cell: ({ getValue }) => <TextLink href={rwaAssetHref(getValue())}>{getValue()}</TextLink>,
		meta: {
			headerClassName: 'w-[132px]',
			align: 'start'
		}
	}),
	tokensColumnHelper.accessor('issuerRwaPlatformName', {
		header: 'Platform',
		enableSorting: false,
		cell: ({ getValue, row }) => (
			<TextLink href={rwaPlatformHref(row.original.issuerRwaPlatformSlug)}>{getValue()}</TextLink>
		),
		meta: {
			headerClassName: 'w-[180px]',
			align: 'start'
		}
	}),
	tokensColumnHelper.accessor((row) => row.price ?? undefined, {
		id: 'price',
		header: 'Price',
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[112px]',
			align: 'end'
		}
	}),
	tokensColumnHelper.accessor((row) => row.activeMarketcap ?? undefined, {
		id: 'activeMarketcap',
		header: 'Active Market Cap',
		cell: ({ getValue }) => formatEquitiesCompactValue(getValue(), '$') ?? '-',
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end'
		}
	}),
	tokensColumnHelper.accessor('issuer', {
		header: 'Issuer',
		enableSorting: false,
		meta: {
			headerClassName: 'w-[min(320px,48vw)]',
			align: 'start'
		}
	})
])

export function EquitiesMarketsTable({
	markets,
	ticker
}: {
	markets: Array<IEquitiesOnchainMarketRow>
	ticker: string
}) {
	const router = useRouter()
	const activeVenue = getMarketVenueFromQuery(readSingleQueryValue(router.query.marketVenue))

	const { rows, counts } = useMemo(() => {
		let cexCount = 0
		for (const market of markets) {
			if (market.exchangeType === 'CEX') cexCount += 1
		}
		return {
			counts: { all: markets.length, CEX: cexCount, DEX: markets.length - cexCount },
			rows: activeVenue === 'all' ? markets : markets.filter((market) => market.exchangeType === activeVenue)
		}
	}, [activeVenue, markets])

	const columnVisibility = useMemo(
		() => ({ exchangeType: activeVenue === 'all', exchangeName: activeVenue === 'DEX' }),
		[activeVenue]
	)

	const table = usePaginatedTable(
		{
			defaultColumn: { sortUndefined: 'last' },
			data: rows,
			state: { columnVisibility },
			columns: marketsColumns,
			initialState: {
				pagination: {
					pageIndex: 0,
					pageSize: DEFAULT_TABLE_PAGE_SIZE
				},
				sorting: []
			}
		},
		() => null
	)

	const setActiveVenue = (venue: MarketVenueFilter) => {
		table.resetPageIndex()
		void pushShallowQuery(router, { marketVenue: MARKET_VENUE_QUERY_VALUES[venue] })
	}

	const csvFilename =
		activeVenue === 'all'
			? `equities-${ticker.toLowerCase()}-markets`
			: `equities-${ticker.toLowerCase()}-markets-${activeVenue.toLowerCase()}`

	return (
		<Panel className="col-span-full">
			<TableToolbar>
				<SegmentedControl
					value={activeVenue}
					onValueChange={setActiveVenue}
					options={MARKET_VENUE_FILTERS.map((filter) => ({
						value: filter,
						label: `${filter === 'all' ? 'All' : filter} (${counts[filter]})`,
						disabled: counts[filter] === 0
					}))}
					label="Venue type"
					variant="default"
					size="md"
					className="mr-auto"
				/>
				<CSVDownloadButton
					prepareCsv={() => prepareTableCsv({ instance: table, filename: csvFilename })}
					smol
					size="md"
				/>
			</TableToolbar>
			<PaginatedTable
				table={table}
				pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
				emptyMessage={
					activeVenue === 'all'
						? `No onchain markets found for ${ticker}.`
						: `No ${activeVenue} markets found for ${ticker}.`
				}
			/>
		</Panel>
	)
}

export function EquitiesTokensTable({ tokens, ticker }: { tokens: Array<IEquitiesOnchainTokenRow>; ticker: string }) {
	const table = usePaginatedTable(
		{
			defaultColumn: { sortUndefined: 'last' },
			data: tokens,
			columns: tokensColumns,
			initialState: {
				pagination: {
					pageIndex: 0,
					pageSize: DEFAULT_TABLE_PAGE_SIZE
				},
				sorting: [{ id: 'activeMarketcap', desc: true }]
			}
		},
		() => null
	)

	return (
		<Panel className="col-span-full">
			<TableToolbar>
				<CSVDownloadButton
					prepareCsv={() => prepareTableCsv({ instance: table, filename: `equities-${ticker.toLowerCase()}-tokens` })}
					smol
					size="md"
				/>
			</TableToolbar>
			<PaginatedTable
				table={table}
				pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
				emptyMessage={`No tokenized assets found for ${ticker}.`}
			/>
		</Panel>
	)
}
