import { createColumnHelper, type SortingState } from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { lazy, Suspense, useMemo } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { readSelectionFromQuery, updateQueryFromSelected } from '~/components/Select/query'
import { type paginatedTableFeatures, usePaginatedTable } from '~/components/Table/features/pagination'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { prepareTableCsv } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { chartColor, OTHERS_COLOR } from '~/constants/colors'
import { Button } from '~/ui/Button'
import { Change, formatChange } from '~/ui/Change'
import { CHART_FILL } from '~/ui/ChartPanel'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelStatus, SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import {
	calculateCompanyDollarVolume,
	calculateConstituentSectorWeight,
	calculateNetMargin,
	filterKnownAggregates,
	getSelectionChip
} from './aggregateData'
import { EquitiesPageHeader, formatMetric, RowNumber, StaleDataNotice } from './AggregateShared'
import {
	readEquitiesSectorPageCompanies,
	type IEquitiesSectorPageCompanyRow,
	type IEquitiesSectorPageViewData
} from './sectorPageData'
import { buildEquityTickerCountrySlug } from './tickerCountry'
import type { EquitiesPageDataState } from './types'

type ConstituentTableRow = IEquitiesSectorPageCompanyRow & {
	sectorWeight: number | null
	dollarVolume24h: number | null
}

const constituentColumnHelper = createColumnHelper<typeof paginatedTableFeatures, ConstituentTableRow>()
const CONSTITUENT_TABLE_SORT: SortingState = [{ id: 'marketCap', desc: true }]
const CONSTITUENT_PAGE_SIZES = [25, 50, 100] as const
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))
const CONCENTRATION_PIE_HEIGHT = '220px'

const constituentColumns = constituentColumnHelper.columns([
	constituentColumnHelper.accessor('name', {
		header: 'Company',
		cell: ({ row, getValue }) => (
			<div className="flex items-center gap-2">
				<RowNumber rowId={row.id} />
				<TokenLogo kind="equities" name={row.original.ticker} country={row.original.country} />
				<div>
					<Link
						href={`/equities/${buildEquityTickerCountrySlug(row.original.ticker, row.original.country)}`}
						className="label-md text-link hover:underline"
					>
						{getValue()}
					</Link>
					<p className="body-sm text-tertiary">
						{row.original.ticker} · {row.original.country}
					</p>
				</div>
			</div>
		),
		enableHiding: false,
		meta: { headerClassName: 'w-56', align: 'start' }
	}),
	constituentColumnHelper.accessor('industry', {
		header: 'Industry',
		meta: { headerClassName: 'w-44', align: 'start' }
	}),
	constituentColumnHelper.accessor((row) => row.marketCap ?? undefined, {
		id: 'marketCap',
		header: 'Market cap',
		cell: ({ getValue }) => formatMetric(getValue(), 'usd'),
		meta: { headerClassName: 'w-28', align: 'end' }
	}),
	constituentColumnHelper.accessor((row) => row.sectorWeight ?? undefined, {
		id: 'sectorWeight',
		header: 'Sector wt.',
		cell: ({ getValue }) => formatMetric(getValue(), 'percent'),
		meta: { headerClassName: 'w-24', align: 'end' }
	}),
	constituentColumnHelper.accessor((row) => row.currentPrice ?? undefined, {
		id: 'currentPrice',
		header: 'Price',
		cell: ({ getValue }) => formatMetric(getValue(), 'usd'),
		meta: { headerClassName: 'w-24', align: 'end' }
	}),
	...(
		[
			['priceChangePercentage1d', '1D'],
			['priceChangePercentage7d', '7D'],
			['priceChangePercentage1m', '1M']
		] as const
	).map(([field, header]) =>
		constituentColumnHelper.accessor((row) => row[field] ?? undefined, {
			id: field,
			header,
			cell: ({ getValue }) => {
				const value = getValue()
				return value == null ? '—' : <Change value={value} />
			},
			meta: { headerClassName: 'w-20', align: 'end' }
		})
	),
	constituentColumnHelper.accessor((row) => row.dollarVolume24h ?? undefined, {
		id: 'dollarVolume24h',
		header: 'Volume 24h',
		cell: ({ getValue }) => formatMetric(getValue(), 'usd'),
		meta: { headerClassName: 'w-28', align: 'end' }
	}),
	constituentColumnHelper.accessor((row) => row.trailingPE ?? undefined, {
		id: 'trailingPE',
		header: 'P/E',
		cell: ({ getValue }) => formatMetric(getValue(), 'multiple'),
		meta: { headerClassName: 'w-18', align: 'end' }
	})
])

function ConstituentsPanel({
	companies,
	sectorMarketCap,
	sectorSlug,
	selectedIndustry,
	industryOptions,
	onSelectIndustry,
	onClearIndustry
}: {
	companies: Array<IEquitiesSectorPageCompanyRow>
	sectorMarketCap: number | null
	sectorSlug: string
	selectedIndustry: string
	industryOptions: Array<{ value: string; label: string }>
	onSelectIndustry: (value: string) => void
	onClearIndustry: () => void
}) {
	const rows = useMemo(
		() =>
			companies.map((company) => ({
				...company,
				sectorWeight: calculateConstituentSectorWeight(company.marketCap, sectorMarketCap),
				dollarVolume24h: calculateCompanyDollarVolume(company.volume, company.currentPrice)
			})),
		[companies, sectorMarketCap]
	)
	const table = usePaginatedTable({
		data: rows,
		columns: constituentColumns,
		defaultColumn: { sortUndefined: 'last' },
		initialState: { sorting: CONSTITUENT_TABLE_SORT, pagination: { pageIndex: 0, pageSize: 25 } },
		enableSortingRemoval: false,
		getRowId: (row) => `${row.ticker}:${row.country}`
	})
	return (
		<Panel>
			<PanelHeader>
				<div className="mr-auto">
					<PanelTitle>Constituents</PanelTitle>
					<p className="body-sm text-tertiary">{companies.length} equities</p>
				</div>
				<CSVDownloadButton
					free
					size="md"
					smol
					prepareCsv={() => prepareTableCsv({ instance: table, filename: `${sectorSlug}-constituents` })}
				/>
			</PanelHeader>
			<div className="border-b border-subtle p-2">
				<SegmentedControl
					value={selectedIndustry}
					onValueChange={onSelectIndustry}
					options={industryOptions}
					label="Filter constituents by industry"
					variant="chips"
					size="md"
				/>
			</div>
			{companies.length === 0 ? (
				<SurfaceBodyStatus variant="empty">
					<div className="flex flex-col items-center gap-3">
						<span>No constituents match this industry.</span>
						<Button type="button" variant="secondary" size="md" onClick={onClearIndustry}>
							Show all industries
						</Button>
					</div>
				</SurfaceBodyStatus>
			) : (
				<PaginatedTable table={table} pageSizeOptions={CONSTITUENT_PAGE_SIZES} />
			)}
		</Panel>
	)
}

export function SectorDetailPage({ state }: { state: EquitiesPageDataState<IEquitiesSectorPageViewData> }) {
	const router = useRouter()

	if (state.status === 'error') {
		return (
			<PanelStatus variant="error">This equity sector is temporarily unavailable. Try again in a moment.</PanelStatus>
		)
	}

	const { sector, overview, industries } = state.data
	const companies = readEquitiesSectorPageCompanies(state.data.companies)
	const classifiedIndustries = filterKnownAggregates(industries)
	const industrySlugs = classifiedIndustries.map((industry) => industry.industrySlug)
	const selectedIndustries = new Set(readSelectionFromQuery(router.query, 'industry', 'excludeIndustry', industrySlugs))
	const setIndustry = (value: string) =>
		updateQueryFromSelected(router, 'industry', 'excludeIndustry', industrySlugs, value === 'all' ? null : value)
	const industryOptions = [
		{ value: 'all', label: 'All industries' },
		...classifiedIndustries.map((industry) => ({
			value: industry.industrySlug,
			label: `${industry.industry} ${industry.companyCount}`
		}))
	]
	const filteredCompanies = companies.filter((company) => selectedIndustries.has(company.industrySlug))
	const netMargin = calculateNetMargin(sector.earningsTTM, sector.revenueTTM)
	const topThree = sector.topHoldings.slice(0, 3)
	const topTenShare = Math.max(0, Math.min(100, sector.concentration.top10MarketCapShare ?? 0))
	const concentrationData = [
		{ name: 'Top 10', value: topTenShare },
		{ name: 'Other companies', value: 100 - topTenShare }
	]
	const nextSevenWeight = sector.topHoldings.slice(3, 10).reduce((sum, row) => sum + (row.sectorWeight ?? 0), 0)
	const remainingIndustries = classifiedIndustries.slice(8)
	const remainingIndustryMarketCap = remainingIndustries.reduce((sum, row) => sum + (row.marketCap ?? 0), 0)
	const remainingIndustryWeight = remainingIndustries.reduce((sum, row) => sum + (row.sectorWeight ?? 0), 0)
	const trailingPePremium =
		sector.valuation.trailingPE == null || overview.trailingPE == null || overview.trailingPE === 0
			? null
			: (sector.valuation.trailingPE / overview.trailingPE - 1) * 100
	const valuationRows = [
		['P/E (TTM)', sector.valuation.trailingPE, overview.medianTrailingPE, 'multiple'] as const,
		['P/S', sector.valuation.priceToRevenue, overview.medianPriceToRevenue, 'multiple'] as const,
		[
			'EV / EBITDA',
			sector.valuation.enterpriseValueToEbitda,
			overview.medianEnterpriseValueToEbitda,
			'multiple'
		] as const,
		[
			'Operating margin',
			sector.valuation.operatingProfitMarginTTM,
			overview.medianOperatingProfitMarginTTM,
			'percent'
		] as const,
		['Dividend yield', sector.valuation.dividendYield, overview.medianDividendYield, 'percent'] as const
	]
	const valuationComparisonRows = valuationRows.filter(
		(row): row is (typeof valuationRows)[number] & [string, number, number, 'multiple' | 'percent'] =>
			row[1] != null && row[2] != null && row[2] !== 0
	)
	const returnRows = [
		['1 day', sector.priceChangePercentage1d, overview.priceChangePercentage1d],
		['1 week', sector.priceChangePercentage7d, overview.priceChangePercentage7d],
		['1 month', sector.priceChangePercentage1m, overview.priceChangePercentage1m],
		['3 months', sector.priceChangePercentage3m, overview.priceChangePercentage3m],
		['Year to date', sector.priceChangePercentageYtd, overview.priceChangePercentageYtd],
		['1 year', sector.priceChangePercentage1y, overview.priceChangePercentage1y]
	] as const

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<EquitiesPageHeader
				crumb={`Sectors / ${sector.sector}`}
				title={sector.sector}
				meta={
					<span className="rounded-md border border-brand bg-brand-muted px-2 py-1 label-sm text-link">
						#{sector.rank} by market cap
					</span>
				}
				description={`${sector.description} ${sector.companyCount} US-listed equities across ${sector.industryCount} industries; the sector accounts for ${formatMetric(sector.weight, 'percent')} of tracked equity market cap and ${formatMetric(sector.dollarVolumeShare24h, 'percent')} of daily volume.`}
			/>
			<StaleDataNotice stale={state.stale} updatedAt={sector.updatedAt} />

			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
				<StatTile
					label="Market cap"
					value={formatMetric(sector.marketCap, 'usd')}
					change={
						sector.priceChangePercentage1d == null
							? undefined
							: {
									value: sector.priceChangePercentage1d,
									comparison: 'today',
									tooltip: sector.marketCapChange1d == null ? undefined : formatChange(sector.marketCapChange1d, 'usd')
								}
					}
				/>
				<StatTile label="Sector weight" value={formatMetric(sector.weight, 'percent')} sub="of tracked market cap" />
				<StatTile
					label="Volume 24h"
					value={formatMetric(sector.dollarVolume24h, 'usd')}
					sub={`${formatMetric(sector.dollarVolumeShare24h, 'percent')} of market volume`}
				/>
				<StatTile label="Revenue TTM" value={formatMetric(sector.revenueTTM, 'usd')} sub="Sum of constituents" />
				<StatTile
					label="Net income TTM"
					value={formatMetric(sector.earningsTTM, 'usd')}
					sub={`${formatMetric(netMargin, 'percent')} net margin`}
				/>
				<StatTile
					label={sector.trailingPE == null ? 'Earnings yield' : 'P/E (TTM)'}
					value={
						sector.trailingPE == null
							? formatMetric(sector.earningsYield, 'percent')
							: formatMetric(sector.trailingPE, 'multiple')
					}
					sub={`Market P/E ${formatMetric(overview.trailingPE, 'multiple')}`}
				/>
				<StatTile
					label="Dividend yield"
					value={formatMetric(sector.dividendYield, 'percent')}
					sub={`Market ${formatMetric(overview.dividendYield, 'percent')}`}
				/>
				<StatTile
					label="Employees"
					value={formatMetric(sector.employeeCount, 'number')}
					sub={`Across ${sector.companyCount} companies`}
				/>
			</div>

			<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
				<Panel>
					<PanelHeader>
						<div className="mr-auto">
							<PanelTitle>Industry breakdown</PanelTitle>
							<p className="body-sm text-tertiary">
								Share of sector market cap · {classifiedIndustries.length} industries
							</p>
						</div>
					</PanelHeader>
					<div className="flex flex-col p-4">
						{classifiedIndustries.slice(0, 8).map((industry) => (
							<div
								key={industry.industrySlug}
								className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-subtle py-2 body-md"
							>
								<Link
									href={`/equities/sectors/${sector.sectorSlug}?industry=${encodeURIComponent(industry.industrySlug)}`}
									className="truncate label-md text-link hover:underline"
								>
									{industry.industry}
								</Link>
								<span>{formatMetric(industry.marketCap, 'usd')}</span>
								<span className="w-16 text-right">
									{industry.priceChangePercentage1m == null ? '—' : <Change value={industry.priceChangePercentage1m} />}
								</span>
							</div>
						))}
						{remainingIndustries.length > 0 ? (
							<div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-subtle py-2 body-md text-secondary">
								<span>{remainingIndustries.length} more industries</span>
								<span>{formatMetric(remainingIndustryMarketCap, 'usd')}</span>
								<span className="w-16 text-right">{formatMetric(remainingIndustryWeight, 'percent')}</span>
							</div>
						) : null}
						<Link href="/equities/industries" className="mt-3 body-sm text-link hover:underline">
							View all {classifiedIndustries.length} industries →
						</Link>
					</div>
				</Panel>

				<Panel>
					<PanelHeader>
						<div className="mr-auto">
							<PanelTitle>Concentration</PanelTitle>
							<p className="body-sm text-tertiary">Share of sector market cap by constituent</p>
						</div>
					</PanelHeader>
					<div className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
						<div className="relative h-[220px]">
							<Suspense
								fallback={
									<SurfaceBodyLoadingStatus label="Loading chart" style={{ minHeight: CONCENTRATION_PIE_HEIGHT }} />
								}
							>
								<PieChart
									chartData={concentrationData}
									stackColors={{ 'Top 10': chartColor(0), 'Other companies': OTHERS_COLOR }}
									valueSymbol="%"
									radius={['55%', '78%']}
									height={CONCENTRATION_PIE_HEIGHT}
									showLegend={false}
									exportButtons="hidden"
								/>
							</Suspense>
							<div className="absolute inset-0 flex flex-col items-center justify-center">
								<span className="mono-xl">{formatMetric(sector.concentration.top10MarketCapShare, 'percent')}</span>
								<span className="body-sm text-tertiary">top 10</span>
							</div>
						</div>
						<div className="flex flex-col gap-2">
							{topThree.map((holding) => (
								<div key={holding.ticker} className="flex items-center justify-between gap-3 body-md">
									<span className="flex items-center gap-2">
										<TokenLogo kind="equities" name={holding.ticker} country="US" />
										{holding.ticker}
									</span>
									<span className="font-medium">{formatMetric(holding.sectorWeight, 'percent')}</span>
								</div>
							))}
							<div className="flex items-center justify-between body-md text-secondary">
								<span>Next {Math.max(0, sector.topHoldings.length - 3)}</span>
								<span>{formatMetric(nextSevenWeight, 'percent')}</span>
							</div>
							<div className="flex items-center justify-between body-md text-secondary">
								<span>Other {Math.max(0, sector.companyCount - 10)}</span>
								<span>
									{formatMetric(
										sector.concentration.top10MarketCapShare == null
											? null
											: 100 - sector.concentration.top10MarketCapShare,
										'percent'
									)}
								</span>
							</div>
						</div>
					</div>
					<div className="grid grid-cols-3 border-t border-subtle p-4">
						<p className="body-sm text-secondary">
							HHI index
							<br />
							<span className="label-lg text-primary">{formatMetric(sector.concentration.hhi, 'number')}</span>
						</p>
						<p className="body-sm text-secondary">
							Mega caps
							<br />
							<span className="label-lg text-primary">{sector.concentration.megaCapCount}</span>
						</p>
						<p className="body-sm text-secondary">
							Median cap
							<br />
							<span className="label-lg text-primary">{formatMetric(sector.concentration.medianMarketCap, 'usd')}</span>
						</p>
					</div>
				</Panel>
			</div>

			<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
				<Panel>
					<PanelHeader>
						<div className="mr-auto">
							<PanelTitle>Valuation vs. market</PanelTitle>
							<p className="body-sm text-tertiary">
								Sector totals valued as one company; marker is the all-equities median
							</p>
						</div>
					</PanelHeader>
					<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
						<HBarChart
							categories={valuationComparisonRows.map(([label]) => label)}
							values={[]}
							series={[
								{
									name: sector.sector,
									values: valuationComparisonRows.map(([, value, median]) => (value / median) * 100),
									color: chartColor(0)
								},
								{
									name: 'Market',
									values: valuationComparisonRows.map(() => 100),
									color: chartColor(1)
								}
							]}
							valueSymbol=""
							containerClassName={CHART_FILL}
						/>
					</Suspense>
					<div className="flex flex-col gap-3 p-4">
						<div className="grid gap-2 sm:grid-cols-2">
							{valuationRows.map(([label, value, median, kind]) => (
								<p key={label} className="body-sm text-secondary">
									{label}: <span className="text-primary">{formatMetric(value, kind)}</span> · market{' '}
									{formatMetric(median, kind)}
								</p>
							))}
						</div>
						<p className="body-sm text-tertiary">
							{trailingPePremium == null ? (
								'P/E comparison with the all-equities market is unavailable.'
							) : (
								<>
									Trading at a {formatMetric(Math.abs(trailingPePremium), 'percent')} P/E{' '}
									{trailingPePremium >= 0 ? 'premium' : 'discount'} to the all-equities market.
								</>
							)}
						</p>
					</div>
				</Panel>

				<Panel>
					<PanelHeader>
						<div className="mr-auto">
							<PanelTitle>Returns vs. market</PanelTitle>
							<p className="body-sm text-tertiary">Cap-weighted price return · spread in percentage points</p>
						</div>
					</PanelHeader>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-subtle table-header text-secondary">
									<th className="p-3 text-left">Period</th>
									<th className="p-3 text-right">Sector</th>
									<th className="p-3 text-right">Market</th>
									<th className="p-3 text-right">Spread</th>
								</tr>
							</thead>
							<tbody>
								{returnRows.map(([label, sectorReturn, marketReturn]) => (
									<tr key={label} className="border-b border-subtle body-md">
										<th className="p-3 text-left font-medium">{label}</th>
										<td className="p-3 text-right">{sectorReturn == null ? '—' : <Change value={sectorReturn} />}</td>
										<td className="p-3 text-right">{marketReturn == null ? '—' : <Change value={marketReturn} />}</td>
										<td className="p-3 text-right">
											{sectorReturn == null || marketReturn == null ? (
												'—'
											) : (
												<Change value={sectorReturn - marketReturn} unit="pp" />
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Panel>
			</div>

			<ConstituentsPanel
				companies={filteredCompanies}
				sectorMarketCap={sector.marketCap}
				sectorSlug={sector.sectorSlug}
				selectedIndustry={getSelectionChip([...selectedIndustries], industrySlugs)}
				industryOptions={industryOptions}
				onSelectIndustry={setIndustry}
				onClearIndustry={() => setIndustry('all')}
			/>
		</div>
	)
}
