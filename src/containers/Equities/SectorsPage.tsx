import { createColumnHelper, type SortingState } from '@tanstack/react-table'
import Link from 'next/link'
import { lazy, Suspense, useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { type paginatedTableFeatures, usePaginatedTable } from '~/components/Table/features/pagination'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { prepareTableCsv } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { chartColor } from '~/constants/colors'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Change, formatChange } from '~/ui/Change'
import { CHART_FILL, ChartPanelBody, ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelStatus, SurfaceBodyStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import {
	buildSectorTreemapData,
	filterKnownAggregates,
	RETURN_PERIODS,
	sortNullableRows,
	type SectorTreemapMetric,
	type ReturnPeriod
} from './aggregateData'
import {
	AggregateTreemap,
	EquitiesPageHeader,
	formatMetric,
	ReturnMatrix,
	RowNumber,
	sectorColor,
	StaleDataNotice
} from './AggregateShared'
import type { IEquitiesAggregateHolding, IEquitiesSectorApiItem } from './api.types'
import { buildEquityTickerCountrySlug } from './tickerCountry'
import type { EquitiesPageDataState, IEquitiesSectorsData } from './types'

type SectorCardSort = 'marketCap' | 'priceChangePercentage1d' | 'dollarVolume24h' | 'trailingPE'
type SectorPerformancePeriod = '1d' | '7d' | '1m' | 'ytd' | '1y'
const TREEMAP_OPTIONS = [
	{ value: 'marketCap', label: 'Market cap' },
	{ value: 'volume', label: 'Volume' },
	{ value: 'revenue', label: 'Revenue' }
] as const

const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))

function HoldingLink({ holding, compact = false }: { holding: IEquitiesAggregateHolding; compact?: boolean }) {
	const href = `/equities/${buildEquityTickerCountrySlug(holding.ticker, 'US')}`
	if (compact) {
		return (
			<Link href={href} className="flex rounded-full">
				<TokenLogo kind="equities" name={holding.ticker} country="US" size={24} alt={`Logo of ${holding.name}`} />
			</Link>
		)
	}
	return (
		<Button as={Link} href={href} size="md">
			<TokenLogo kind="equities" name={holding.ticker} country="US" size={16} alt={`Logo of ${holding.name}`} />
			{holding.ticker}
		</Button>
	)
}

const sectorColumnHelper = createColumnHelper<typeof paginatedTableFeatures, IEquitiesSectorApiItem>()
const SECTOR_TABLE_SORT: SortingState = [{ id: 'marketCap', desc: true }]
const SECTOR_TABLE_PAGE_SIZES = [20, 50] as const

const sectorColumns = sectorColumnHelper.columns([
	sectorColumnHelper.accessor('sector', {
		header: 'Sector',
		cell: ({ row, getValue }) => (
			<span className="flex items-center gap-2">
				<RowNumber rowId={row.id} />
				<Link href={`/equities/sectors/${row.original.sectorSlug}`} className="label-md text-link hover:underline">
					{getValue()}
				</Link>
			</span>
		),
		enableHiding: false,
		meta: { headerClassName: 'w-52', align: 'start' }
	}),
	sectorColumnHelper.accessor((row) => row.marketCap ?? undefined, {
		id: 'marketCap',
		header: 'Market cap',
		cell: ({ getValue }) => formatMetric(getValue(), 'usd'),
		meta: { headerClassName: 'w-28', align: 'end' }
	}),
	sectorColumnHelper.accessor((row) => row.weight ?? undefined, {
		id: 'weight',
		header: 'Weight',
		cell: ({ getValue }) => formatMetric(getValue(), 'percent'),
		meta: { headerClassName: 'w-20', align: 'end' }
	}),
	...(
		[
			['priceChangePercentage1d', '1D'],
			['priceChangePercentage7d', '7D'],
			['priceChangePercentage1m', '1M'],
			['priceChangePercentageYtd', 'YTD']
		] as const
	).map(([field, header]) =>
		sectorColumnHelper.accessor((row) => row[field] ?? undefined, {
			id: field,
			header,
			cell: ({ getValue }) => {
				const value = getValue()
				return value == null ? '—' : <Change value={value} />
			},
			meta: { headerClassName: 'w-20', align: 'end' }
		})
	),
	sectorColumnHelper.accessor((row) => row.dollarVolume24h ?? undefined, {
		id: 'dollarVolume24h',
		header: 'Volume 24h',
		cell: ({ getValue }) => formatMetric(getValue(), 'usd'),
		meta: { headerClassName: 'w-28', align: 'end' }
	}),
	sectorColumnHelper.accessor((row) => row.trailingPE ?? undefined, {
		id: 'trailingPE',
		header: 'P/E',
		cell: ({ getValue }) => formatMetric(getValue(), 'multiple'),
		meta: { headerClassName: 'w-18', align: 'end' }
	}),
	sectorColumnHelper.accessor((row) => row.dividendYield ?? undefined, {
		id: 'dividendYield',
		header: 'Div. yield',
		cell: ({ getValue }) => formatMetric(getValue(), 'percent'),
		meta: { headerClassName: 'w-24', align: 'end' }
	}),
	sectorColumnHelper.accessor('companyCount', {
		header: 'Equities',
		meta: { headerClassName: 'w-20', align: 'end' }
	}),
	sectorColumnHelper.accessor('topHoldings', {
		header: 'Top holdings',
		enableSorting: false,
		cell: ({ getValue }) => {
			const holdings = getValue()
			return holdings.length > 0 ? (
				<div className="flex items-center gap-1.5">
					{holdings.slice(0, 3).map((holding) => (
						<HoldingLink key={holding.ticker} holding={holding} compact />
					))}
				</div>
			) : (
				'—'
			)
		},
		meta: {
			headerClassName: 'w-28',
			align: 'start',
			csvValue: (row) => row.topHoldings.map((holding) => holding.ticker).join(', ')
		}
	})
])

// `ranking` completes "Ranked by …" under the heading.
const CARD_SORT_OPTIONS: Array<{ value: SectorCardSort; label: string; ranking: string }> = [
	{ value: 'marketCap', label: 'Market cap', ranking: 'market cap' },
	{ value: 'priceChangePercentage1d', label: '1D change', ranking: '1D change' },
	{ value: 'dollarVolume24h', label: 'Volume', ranking: '24h volume' },
	{ value: 'trailingPE', label: 'P/E', ranking: 'P/E' }
]
export function SectorsPage({ state }: { state: EquitiesPageDataState<IEquitiesSectorsData> }) {
	if (state.status === 'error') {
		return (
			<PanelStatus variant="error">
				Equity sector data is temporarily unavailable. Please try again shortly.
			</PanelStatus>
		)
	}

	return <SectorsReadyPage state={state} />
}

function SectorsReadyPage({
	state
}: {
	state: Extract<EquitiesPageDataState<IEquitiesSectorsData>, { status: 'ready' }>
}) {
	const [treemapMetric, setTreemapMetric] = useState<SectorTreemapMetric>('marketCap')
	const [cardSort, setCardSort] = useState<SectorCardSort>('marketCap')
	const [performancePeriod, setPerformancePeriod] = useState<SectorPerformancePeriod>('1d')

	const { overview, sectors } = state.data
	const classifiedSectors = filterKnownAggregates(sectors)
	const sectorsUp = classifiedSectors.filter((row) => (row.priceChangePercentage1d ?? 0) > 0).length
	const treemap = buildSectorTreemapData(sectors, treemapMetric, overview)
	const treemapNodes: Array<TreemapNode> = treemap.rows
		.filter((row) => row.sectorSlug !== 'unknown' && row.value != null && row.value > 0)
		.map((row) => ({
			name: row.sector,
			path: `Equities/${row.sector}`,
			value: [row.value!, null, row.share, row.priceChangePercentage1d],
			itemStyle: { color: sectorColor(row.sectorSlug) }
		}))
	const matrixRows = classifiedSectors.map((row) => ({
		industry: row.sector,
		industrySlug: row.sectorSlug,
		sectorSlug: row.sectorSlug,
		values: Object.fromEntries(RETURN_PERIODS.map(({ key, field }) => [key, row[field]])) as Record<
			ReturnPeriod,
			number | null
		>
	}))
	const cardRows = sortNullableRows(classifiedSectors, cardSort, cardSort === 'trailingPE' ? 'asc' : 'desc')
	const sectorTable = usePaginatedTable({
		data: classifiedSectors,
		columns: sectorColumns,
		defaultColumn: { sortUndefined: 'last' },
		initialState: { sorting: SECTOR_TABLE_SORT, pagination: { pageIndex: 0, pageSize: 20 } },
		enableSortingRemoval: false,
		getRowId: (row) => row.sectorSlug
	})
	const performanceField = RETURN_PERIODS.find(({ key }) => key === performancePeriod)!.field
	const marketReturn = overview[performanceField]
	const performanceRows = sortNullableRows(classifiedSectors, performanceField, 'desc').flatMap((row) => {
		const value = row[performanceField]
		return value == null ? [] : [{ row, value }]
	})
	const unavailablePerformanceCount = classifiedSectors.length - performanceRows.length
	const outperforming = marketReturn == null ? null : performanceRows.filter(({ value }) => value > marketReturn).length

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<EquitiesPageHeader
				crumb="Sectors"
				title="Equity Sectors"
				description={`Market capitalization, performance and valuation for ${overview.sectorCount} sectors across ${formatMetric(overview.companyCount, 'number')} US-listed equities.`}
			/>
			<StaleDataNotice stale={state.stale} updatedAt={sectors[0]?.updatedAt} />

			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
				<StatTile
					label="Total equity market cap"
					value={formatMetric(overview.marketCap, 'usd')}
					change={
						overview.priceChangePercentage1d == null
							? undefined
							: {
									value: overview.priceChangePercentage1d,
									comparison: 'today',
									tooltip:
										overview.marketCapChange1d == null ? undefined : formatChange(overview.marketCapChange1d, 'usd')
								}
					}
				/>
				<StatTile
					label="24h trading volume"
					value={formatMetric(overview.dollarVolume24h, 'usd')}
					sub={`Across ${overview.sectorCount} sectors`}
				/>
				<StatTile
					label="Best sector · 1D"
					value={
						overview.bestSector1d.priceChangePercentage1d == null ? (
							'—'
						) : (
							<Change value={overview.bestSector1d.priceChangePercentage1d} />
						)
					}
					sub={overview.bestSector1d.sector}
				/>
				<StatTile
					label="Worst sector · 1D"
					value={
						overview.worstSector1d.priceChangePercentage1d == null ? (
							'—'
						) : (
							<Change value={overview.worstSector1d.priceChangePercentage1d} />
						)
					}
					sub={overview.worstSector1d.sector}
				/>
				<StatTile
					label={`${overview.largestSector.sector} dominance`}
					value={formatMetric(overview.largestSector.weight, 'percent')}
					sub={`${sectorsUp} of ${overview.sectorCount} sectors up today`}
				/>
			</div>

			<AggregateTreemap
				title="Sector market map"
				subtitle={`${formatMetric(treemap.total, 'usd')} total`}
				nodes={treemapNodes}
				valueLabel={TREEMAP_OPTIONS.find((option) => option.value === treemapMetric)?.label ?? 'Value'}
				controls={
					<SegmentedControl<SectorTreemapMetric>
						value={treemapMetric}
						onValueChange={setTreemapMetric}
						options={TREEMAP_OPTIONS}
						label="Treemap size"
						variant="default"
						size="md"
					/>
				}
			/>

			<Panel padding="none">
				<PanelHeader>
					<div className="mr-auto">
						<PanelTitle>Sector performance</PanelTitle>
						<p className="body-sm text-tertiary">Cap-weighted price return by sector</p>
					</div>
					<SegmentedControl<SectorPerformancePeriod>
						value={performancePeriod}
						onValueChange={setPerformancePeriod}
						options={[
							{ value: '1d', label: '1D' },
							{ value: '7d', label: '7D' },
							{ value: '1m', label: '1M' },
							{ value: 'ytd', label: 'YTD' },
							{ value: '1y', label: '1Y' }
						]}
						label="Sector performance period"
						variant="default"
						size="md"
					/>
				</PanelHeader>
				{performanceRows.length > 0 ? (
					<ChartPanelBody>
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<HBarChart
								categories={performanceRows.map(({ row }) => row.sector)}
								values={performanceRows.map(({ value }) => value)}
								color={chartColor(0)}
								valueSymbol="%"
								showValueLabels
								containerClassName={CHART_FILL}
							/>
						</Suspense>
					</ChartPanelBody>
				) : (
					<SurfaceBodyStatus variant="empty">No sector returns are available for this period.</SurfaceBodyStatus>
				)}
				<p className="border-t border-subtle px-4 py-3 body-sm text-tertiary">
					All tracked equities {marketReturn == null ? '—' : <Change value={marketReturn} />} over the same period
					{outperforming == null
						? ''
						: ` · ${outperforming} of ${performanceRows.length} sectors with data outperforming the market`}
					{unavailablePerformanceCount > 0 ? ` · ${unavailablePerformanceCount} unavailable` : ''}.
				</p>
			</Panel>

			<ReturnMatrix
				title="Sector rotation"
				subtitle="Price return by period · all classified sectors"
				rows={matrixRows}
			/>

			<section className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<h2 className="heading-sm">Sector cards</h2>
						<p className="body-sm text-tertiary">
							Ranked by {CARD_SORT_OPTIONS.find((option) => option.value === cardSort)!.ranking}
						</p>
					</div>
					<SegmentedControl<SectorCardSort>
						value={cardSort}
						onValueChange={setCardSort}
						options={CARD_SORT_OPTIONS}
						label="Sort sector cards"
						variant="default"
						size="md"
					/>
				</div>
				<div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
					{cardRows.map((sector) => (
						<Card key={sector.sectorSlug} padding="md" className="flex flex-col gap-4">
							<div className="flex items-start justify-between gap-2">
								<div>
									<Link
										href={`/equities/sectors/${sector.sectorSlug}`}
										className="heading-xs text-link hover:underline"
									>
										{sector.sector}
									</Link>
									<p className="body-sm text-tertiary">
										{sector.companyCount} equities · {sector.industryCount} industries
									</p>
								</div>
								<span className="size-3 rounded-sm" style={{ backgroundColor: sectorColor(sector.sectorSlug) }} />
							</div>
							<div className="grid grid-cols-2 gap-3">
								<p className="body-sm text-secondary">
									Market cap
									<br />
									<span className="label-lg text-primary">{formatMetric(sector.marketCap, 'usd')}</span>
								</p>
								<p className="body-sm text-secondary">
									1D
									<br />
									<span className="label-lg">
										{sector.priceChangePercentage1d == null ? '—' : <Change value={sector.priceChangePercentage1d} />}
									</span>
								</p>
								<p className="body-sm text-secondary">
									Weight
									<br />
									<span className="label-md text-primary">{formatMetric(sector.weight, 'percent')}</span>
								</p>
								<p className="body-sm text-secondary">
									P/E
									<br />
									<span className="label-md text-primary">{formatMetric(sector.trailingPE, 'multiple')}</span>
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-1.5">
								{sector.topHoldings.slice(0, 3).map((holding) => (
									<HoldingLink key={holding.ticker} holding={holding} />
								))}
								{sector.companyCount > Math.min(3, sector.topHoldings.length) ? (
									<span className="label-sm text-secondary">
										+{sector.companyCount - Math.min(3, sector.topHoldings.length)}
									</span>
								) : null}
							</div>
						</Card>
					))}
				</div>
			</section>

			<Panel padding="none">
				<PanelHeader>
					<PanelTitle>All sectors</PanelTitle>
					<CSVDownloadButton
						free
						smol
						size="md"
						prepareCsv={() => prepareTableCsv({ instance: sectorTable, filename: 'equity-sectors' })}
					/>
				</PanelHeader>
				<PaginatedTable table={sectorTable} pageSizeOptions={SECTOR_TABLE_PAGE_SIZES} />
			</Panel>
		</div>
	)
}
