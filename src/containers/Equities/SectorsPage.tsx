import Link from 'next/link'
import { useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import type { TreemapNode } from '~/components/ECharts/TreemapChart/types'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelStatus } from '~/ui/Status'
import { formatUsd } from '~/utils/numberFormat'
import {
	buildSectorTreemapData,
	filterKnownAggregates,
	RETURN_PERIODS,
	sortNullableRows,
	type SectorTreemapMetric,
	type ReturnPeriod
} from './aggregateData'
import {
	AggregateTableScroller,
	AggregateTreemap,
	ChangeValue,
	EquitiesPageHeader,
	formatMetric,
	MetricCard,
	ReturnMatrix,
	sectorColor,
	SortableTableHeader,
	StaleDataNotice
} from './AggregateShared'
import type { IEquitiesAggregateHolding } from './api.types'
import { buildEquityTickerCountrySlug } from './tickerCountry'
import type { EquitiesPageDataState, IEquitiesSectorsData } from './types'

type SectorCardSort = 'marketCap' | 'priceChangePercentage1d' | 'dollarVolume24h' | 'trailingPE'
type SectorPerformancePeriod = '1d' | '7d' | '1m' | 'ytd' | '1y'
type SectorTableSort =
	| 'sector'
	| 'marketCap'
	| 'weight'
	| 'priceChangePercentage1d'
	| 'priceChangePercentage7d'
	| 'priceChangePercentage1m'
	| 'priceChangePercentageYtd'
	| 'dollarVolume24h'
	| 'trailingPE'
	| 'dividendYield'
	| 'companyCount'

const TREEMAP_OPTIONS = [
	{ value: 'marketCap', label: 'Market cap' },
	{ value: 'volume', label: 'Volume' },
	{ value: 'revenue', label: 'Revenue' }
] as const

function HoldingLink({ holding, compact = false }: { holding: IEquitiesAggregateHolding; compact?: boolean }) {
	return (
		<Link
			href={`/equities/${buildEquityTickerCountrySlug(holding.ticker, 'US')}`}
			className={
				compact
					? 'flex rounded-full'
					: 'flex items-center gap-1.5 rounded-md border border-medium px-2 py-1 label-sm hover:bg-hover-row'
			}
			title={holding.name}
		>
			<TokenLogo kind="equities" name={holding.ticker} country="US" size={24} alt={`Logo of ${holding.name}`} />
			{compact ? null : holding.ticker}
		</Link>
	)
}

export function SectorsPage({ state }: { state: EquitiesPageDataState<IEquitiesSectorsData> }) {
	const [treemapMetric, setTreemapMetric] = useState<SectorTreemapMetric>('marketCap')
	const [cardSort, setCardSort] = useState<SectorCardSort>('marketCap')
	const [performancePeriod, setPerformancePeriod] = useState<SectorPerformancePeriod>('1d')
	const [tableSort, setTableSort] = useState<{ key: SectorTableSort; direction: 'asc' | 'desc' }>({
		key: 'marketCap',
		direction: 'desc'
	})

	if (state.status === 'error') {
		return (
			<PanelStatus variant="error">
				Equity sector data is temporarily unavailable. Please try again shortly.
			</PanelStatus>
		)
	}

	const { overview, sectors } = state.data
	const classifiedSectors = filterKnownAggregates(sectors)
	const sectorsUp = classifiedSectors.filter((row) => (row.priceChangePercentage1d ?? 0) > 0).length
	const treemap = buildSectorTreemapData(sectors, treemapMetric, overview)
	const treemapNodes: Array<TreemapNode> = treemap.rows
		.filter((row) => row.sectorSlug !== 'unknown' && row.value != null && row.value > 0)
		.map((row) => ({
			name: row.sector,
			path: `Equities/${row.sector}`,
			value: [row.value!, row.share, row.priceChangePercentage1d],
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
	const tableRows = sortNullableRows(classifiedSectors, tableSort.key, tableSort.direction)
	const performanceField = RETURN_PERIODS.find(({ key }) => key === performancePeriod)!.field
	const marketReturn = overview[performanceField]
	const performanceRows = sortNullableRows(classifiedSectors, performanceField, 'desc')
	const maxAbsoluteReturn = Math.max(...performanceRows.map((row) => Math.abs(row[performanceField] ?? 0)), 1)
	const outperforming =
		marketReturn == null
			? null
			: performanceRows.filter((row) => row[performanceField] != null && row[performanceField] > marketReturn).length

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<EquitiesPageHeader
				crumb="Sectors"
				title="Equity Sectors"
				description={`Market capitalization, performance and valuation for ${overview.sectorCount} sectors across ${formatMetric(overview.companyCount, 'number')} US-listed equities.`}
			/>
			<StaleDataNotice stale={state.stale} updatedAt={sectors[0]?.updatedAt} />

			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
				<MetricCard
					label="Total equity market cap"
					value={formatMetric(overview.marketCap, 'usd')}
					change={<ChangeValue value={overview.priceChangePercentage1d} />}
					detail={`${formatUsd(overview.marketCapChange1d, { compact: true, maximumFractionDigits: 2 }) ?? '—'} today`}
				/>
				<MetricCard
					label="24h trading volume"
					value={formatMetric(overview.dollarVolume24h, 'usd')}
					detail={`Across ${overview.sectorCount} sectors`}
				/>
				<MetricCard
					label="Best sector · 1D"
					value={overview.bestSector1d.sector}
					valueKind="text"
					change={<ChangeValue value={overview.bestSector1d.priceChangePercentage1d} />}
				/>
				<MetricCard
					label="Worst sector · 1D"
					value={overview.worstSector1d.sector}
					valueKind="text"
					change={<ChangeValue value={overview.worstSector1d.priceChangePercentage1d} />}
				/>
				<MetricCard
					label={`${overview.largestSector.sector} dominance`}
					value={formatMetric(overview.largestSector.weight, 'percent')}
					detail={`${sectorsUp} of ${overview.sectorCount} sectors up today`}
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
				<div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
					{performanceRows.map((sector) => {
						const value = sector[performanceField]
						return (
							<div
								key={sector.sectorSlug}
								className="grid grid-cols-[minmax(0,1fr)_minmax(80px,1fr)_auto] items-center gap-3 body-sm"
							>
								<Link href={`/equities/sectors/${sector.sectorSlug}`} className="truncate font-medium hover:text-link">
									{sector.sector}
								</Link>
								<div className="h-2 overflow-hidden rounded-sm bg-surface-elevated-1">
									<span
										className={`block h-full rounded-sm ${value != null && value < 0 ? 'bg-data-down' : 'bg-data-up'}`}
										style={{ width: `${Math.min(100, (Math.abs(value ?? 0) / maxAbsoluteReturn) * 100)}%` }}
									/>
								</div>
								<ChangeValue value={value} />
							</div>
						)
					})}
				</div>
				<p className="border-t border-subtle px-4 py-3 body-sm text-tertiary">
					All tracked equities <ChangeValue value={marketReturn} /> over the same period
					{outperforming == null
						? ''
						: ` · ${outperforming} of ${performanceRows.length} sectors outperforming the market`}
					.
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
						<p className="body-sm text-tertiary">Sorted client-side over the current aggregate rows</p>
					</div>
					<SegmentedControl<SectorCardSort>
						value={cardSort}
						onValueChange={setCardSort}
						options={[
							{ value: 'marketCap', label: 'Market cap' },
							{ value: 'priceChangePercentage1d', label: '1D change' },
							{ value: 'dollarVolume24h', label: 'Volume' },
							{ value: 'trailingPE', label: 'P/E' }
						]}
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
									<Link href={`/equities/sectors/${sector.sectorSlug}`} className="heading-xs hover:text-link">
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
										<ChangeValue value={sector.priceChangePercentage1d} />
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
									<span className="rounded-md border border-medium px-2 py-1 label-sm text-secondary">
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
						prepareCsv={() => ({
							filename: 'equity-sectors',
							rows: [
								[
									'Rank',
									'Sector',
									'Market cap',
									'Weight',
									'1D',
									'7D',
									'1M',
									'YTD',
									'Volume 24h',
									'P/E',
									'Dividend yield',
									'Equities'
								],
								...tableRows.map((sector, index) => [
									index + 1,
									sector.sector,
									sector.marketCap,
									sector.weight,
									sector.priceChangePercentage1d,
									sector.priceChangePercentage7d,
									sector.priceChangePercentage1m,
									sector.priceChangePercentageYtd,
									sector.dollarVolume24h,
									sector.trailingPE,
									sector.dividendYield,
									sector.companyCount
								])
							]
						})}
					/>
				</PanelHeader>
				<AggregateTableScroller>
					<table className="w-full min-w-[900px]">
						<thead>
							<tr className="border-b border-subtle table-header text-secondary">
								<th className="p-3 text-left">#</th>
								<SortableTableHeader
									column="sector"
									sort={tableSort}
									onSort={setTableSort}
									align="left"
									defaultDirection="asc"
								>
									Sector
								</SortableTableHeader>
								<SortableTableHeader column="marketCap" sort={tableSort} onSort={setTableSort}>
									Market cap
								</SortableTableHeader>
								<SortableTableHeader column="weight" sort={tableSort} onSort={setTableSort}>
									Weight
								</SortableTableHeader>
								<SortableTableHeader column="priceChangePercentage1d" sort={tableSort} onSort={setTableSort}>
									1D
								</SortableTableHeader>
								<SortableTableHeader column="priceChangePercentage7d" sort={tableSort} onSort={setTableSort}>
									7D
								</SortableTableHeader>
								<SortableTableHeader column="priceChangePercentage1m" sort={tableSort} onSort={setTableSort}>
									1M
								</SortableTableHeader>
								<SortableTableHeader column="priceChangePercentageYtd" sort={tableSort} onSort={setTableSort}>
									YTD
								</SortableTableHeader>
								<SortableTableHeader column="dollarVolume24h" sort={tableSort} onSort={setTableSort}>
									Volume 24h
								</SortableTableHeader>
								<SortableTableHeader column="trailingPE" sort={tableSort} onSort={setTableSort}>
									P/E
								</SortableTableHeader>
								<SortableTableHeader column="dividendYield" sort={tableSort} onSort={setTableSort}>
									Div. yield
								</SortableTableHeader>
								<SortableTableHeader column="companyCount" sort={tableSort} onSort={setTableSort}>
									Equities
								</SortableTableHeader>
								<th className="p-3 text-left">Top holdings</th>
							</tr>
						</thead>
						<tbody>
							{tableRows.map((sector, index) => (
								<tr key={sector.sectorSlug} className="border-b border-subtle body-md hover:bg-hover-row">
									<td className="p-3 text-tertiary">{index + 1}</td>
									<td className="p-3">
										<Link href={`/equities/sectors/${sector.sectorSlug}`} className="font-medium hover:text-link">
											{sector.sector}
										</Link>
									</td>
									<td className="p-3 text-right">{formatMetric(sector.marketCap, 'usd')}</td>
									<td className="p-3 text-right">{formatMetric(sector.weight, 'percent')}</td>
									<td className="p-3 text-right">
										<ChangeValue value={sector.priceChangePercentage1d} />
									</td>
									<td className="p-3 text-right">
										<ChangeValue value={sector.priceChangePercentage7d} />
									</td>
									<td className="p-3 text-right">
										<ChangeValue value={sector.priceChangePercentage1m} />
									</td>
									<td className="p-3 text-right">
										<ChangeValue value={sector.priceChangePercentageYtd} />
									</td>
									<td className="p-3 text-right">{formatMetric(sector.dollarVolume24h, 'usd')}</td>
									<td className="p-3 text-right">{formatMetric(sector.trailingPE, 'multiple')}</td>
									<td className="p-3 text-right">{formatMetric(sector.dividendYield, 'percent')}</td>
									<td className="p-3 text-right">{sector.companyCount}</td>
									<td className="p-3">
										{sector.topHoldings.length > 0 ? (
											<div className="flex items-center gap-1.5">
												{sector.topHoldings.slice(0, 3).map((holding) => (
													<HoldingLink key={holding.ticker} holding={holding} compact />
												))}
											</div>
										) : (
											'—'
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</AggregateTableScroller>
			</Panel>
		</div>
	)
}
