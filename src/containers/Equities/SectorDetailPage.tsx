import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelStatus, SurfaceBodyStatus } from '~/ui/Status'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import {
	calculateCompanyDollarVolume,
	calculateConstituentSectorWeight,
	calculateNetMargin,
	toEquitiesTaxonomySlug,
	normalizeIndustrySelection,
	sortRowsByValue
} from './aggregateData'
import {
	AggregateTableScroller,
	ChangeValue,
	categoryColor,
	EquitiesPageHeader,
	formatMetric,
	MetricCard,
	SortableTableHeader,
	StaleDataNotice
} from './AggregateShared'
import type { AggregateTableSort } from './AggregateShared'
import { readEquitiesSectorPageCompanies, type IEquitiesSectorPageViewData } from './sectorPageData'
import { buildEquityTickerCountrySlug } from './tickerCountry'
import type { EquitiesPageDataState } from './types'

const PAGE_SIZE = 25

type ConstituentSort =
	| 'name'
	| 'industry'
	| 'marketCap'
	| 'sectorWeight'
	| 'currentPrice'
	| 'priceChangePercentage1d'
	| 'priceChangePercentage7d'
	| 'priceChangePercentage1m'
	| 'dollarVolume24h'
	| 'trailingPE'

const CONSTITUENT_SORT_LABELS: Record<ConstituentSort, string> = {
	name: 'company',
	industry: 'industry',
	marketCap: 'market cap',
	sectorWeight: 'sector weight',
	currentPrice: 'price',
	priceChangePercentage1d: '1D return',
	priceChangePercentage7d: '7D return',
	priceChangePercentage1m: '1M return',
	dollarVolume24h: '24h volume',
	trailingPE: 'P/E'
}

export function SectorDetailPage({ state }: { state: EquitiesPageDataState<IEquitiesSectorPageViewData> }) {
	const router = useRouter()
	const [page, setPage] = useState(1)
	const [tableSort, setTableSort] = useState<{ key: ConstituentSort; direction: 'asc' | 'desc' }>({
		key: 'marketCap',
		direction: 'desc'
	})
	const updateTableSort = (sort: AggregateTableSort<ConstituentSort>) => {
		setPage(1)
		setTableSort(sort)
	}

	if (state.status === 'error') {
		return (
			<PanelStatus variant="error">
				This equity sector is temporarily unavailable. Please try again shortly.
			</PanelStatus>
		)
	}

	const { sector, overview, industries } = state.data
	const companies = readEquitiesSectorPageCompanies(state.data.companies)
	const selectedIndustry = normalizeIndustrySelection(
		readSingleQueryValue(router.query.industry) ?? 'all',
		industries.map((industry) => industry.industrySlug)
	)
	const industryOptions = [
		{ value: 'all', label: 'All industries' },
		...industries.map((industry) => ({
			value: industry.industrySlug,
			label: `${industry.industry} ${industry.companyCount}`
		}))
	]
	const filteredCompanies = companies.filter(
		(company) =>
			selectedIndustry === 'all' ||
			(company.industrySlug ?? toEquitiesTaxonomySlug(company.industry)) === selectedIndustry
	)
	const sortedCompanies = sortRowsByValue(
		filteredCompanies,
		(company) => {
			switch (tableSort.key) {
				case 'sectorWeight':
					return calculateConstituentSectorWeight(company.marketCap, sector.marketCap)
				case 'dollarVolume24h':
					return calculateCompanyDollarVolume(company.volume, company.currentPrice)
				default:
					return company[tableSort.key]
			}
		},
		tableSort.direction
	)
	const totalPages = Math.max(1, Math.ceil(sortedCompanies.length / PAGE_SIZE))
	const safePage = Math.min(page, totalPages)
	const pageRows = sortedCompanies.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
	const netMargin = calculateNetMargin(sector.earningsTTM, sector.revenueTTM)
	const topThree = sector.topHoldings.slice(0, 3)
	const nextSevenWeight = sector.topHoldings.slice(3, 10).reduce((sum, row) => sum + (row.sectorWeight ?? 0), 0)
	const remainingIndustries = industries.slice(8)
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
					<span className="rounded-md border border-brand bg-brand-muted px-2 py-1 label-sm text-link-on-tint">
						#{sector.rank} by market cap
					</span>
				}
				description={`${sector.description} ${sector.companyCount} US-listed equities across ${sector.industryCount} industries; the sector accounts for ${formatMetric(sector.weight, 'percent')} of tracked equity market cap and ${formatMetric(sector.dollarVolumeShare24h, 'percent')} of daily volume.`}
			/>
			<StaleDataNotice stale={state.stale} updatedAt={sector.updatedAt} />

			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
				<MetricCard
					label="Market cap"
					value={formatMetric(sector.marketCap, 'usd')}
					change={<ChangeValue value={sector.priceChangePercentage1d} />}
					detail={`${formatMetric(sector.marketCapChange1d, 'usd')} · 1D`}
				/>
				<MetricCard
					label="Sector weight"
					value={formatMetric(sector.weight, 'percent')}
					detail="of tracked market cap"
				/>
				<MetricCard
					label="Volume 24h"
					value={formatMetric(sector.dollarVolume24h, 'usd')}
					detail={`${formatMetric(sector.dollarVolumeShare24h, 'percent')} of market volume`}
				/>
				<MetricCard label="Revenue TTM" value={formatMetric(sector.revenueTTM, 'usd')} detail="Sum of constituents" />
				<MetricCard
					label="Net income TTM"
					value={formatMetric(sector.earningsTTM, 'usd')}
					detail={`${formatMetric(netMargin, 'percent')} net margin`}
				/>
				<MetricCard
					label="P/E (TTM)"
					value={
						sector.trailingPE == null
							? `${formatMetric(sector.earningsYield, 'percent')} earnings yield`
							: formatMetric(sector.trailingPE, 'multiple')
					}
					detail={`Market ${formatMetric(overview.trailingPE, 'multiple')}`}
				/>
				<MetricCard
					label="Dividend yield"
					value={formatMetric(sector.dividendYield, 'percent')}
					detail={`Market ${formatMetric(overview.dividendYield, 'percent')}`}
				/>
				<MetricCard
					label="Employees"
					value={formatMetric(sector.employeeCount, 'number')}
					detail={`Across ${sector.companyCount} companies`}
				/>
			</div>

			<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
				<Panel padding="none">
					<PanelHeader>
						<div className="mr-auto">
							<PanelTitle>Industry breakdown</PanelTitle>
							<p className="body-sm text-tertiary">Share of sector market cap · {industries.length} industries</p>
						</div>
					</PanelHeader>
					<div className="flex flex-col p-4">
						<div className="mb-4 flex h-3 overflow-hidden rounded-sm bg-surface-elevated-1">
							{industries.slice(0, 8).map((industry, index) => (
								<span
									key={industry.industrySlug}
									style={{ width: `${industry.sectorWeight ?? 0}%`, backgroundColor: categoryColor(index) }}
								/>
							))}
						</div>
						{industries.slice(0, 8).map((industry) => (
							<div
								key={industry.industrySlug}
								className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-subtle py-2 body-md"
							>
								<Link
									href={`/equities/sectors/${sector.sectorSlug}?industry=${encodeURIComponent(industry.industrySlug)}`}
									className="truncate font-medium hover:text-link"
								>
									{industry.industry}
								</Link>
								<span>{formatMetric(industry.marketCap, 'usd')}</span>
								<span className="w-16 text-right">
									<ChangeValue value={industry.priceChangePercentage1m} />
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
							View all {industries.length} industries →
						</Link>
					</div>
				</Panel>

				<Panel padding="none">
					<PanelHeader>
						<div className="mr-auto">
							<PanelTitle>Concentration</PanelTitle>
							<p className="body-sm text-tertiary">Share of sector market cap by constituent</p>
						</div>
					</PanelHeader>
					<div className="grid gap-4 p-4 md:grid-cols-[180px_1fr]">
						<div className="relative aspect-square">
							<svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden="true">
								<circle cx="21" cy="21" r="15.915" fill="none" strokeWidth="6" className="stroke-surface-elevated-2" />
								<circle
									cx="21"
									cy="21"
									r="15.915"
									fill="none"
									strokeWidth="6"
									strokeDasharray={`${Math.max(0, Math.min(100, sector.concentration.top10MarketCapShare ?? 0))} 100`}
									className="stroke-brand"
								/>
							</svg>
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
				<Panel padding="none">
					<PanelHeader>
						<div className="mr-auto">
							<PanelTitle>Valuation vs. market</PanelTitle>
							<p className="body-sm text-tertiary">
								Sector totals valued as one company; marker is the all-equities median
							</p>
						</div>
					</PanelHeader>
					<div className="flex flex-col gap-4 p-4">
						{valuationRows.map(([label, value, median, kind]) => {
							const maximum = Math.max(Math.abs(value ?? 0), Math.abs(median ?? 0), 1) * 1.2
							return (
								<div key={label} className="grid grid-cols-[130px_1fr_auto] items-center gap-3 body-md">
									<span className="text-secondary">{label}</span>
									<div className="relative h-2 rounded-sm bg-surface-elevated-1">
										<span
											className="absolute inset-y-0 left-0 rounded-sm bg-brand"
											style={{ width: `${Math.min(100, Math.max(0, ((value ?? 0) / maximum) * 100))}%` }}
										/>
										<span
											className="absolute inset-y-[-4px] border-l border-strong"
											style={{ left: `${Math.min(100, Math.max(0, ((median ?? 0) / maximum) * 100))}%` }}
										/>
									</div>
									<span className="w-16 text-right font-medium">{formatMetric(value, kind)}</span>
								</div>
							)
						})}
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

				<Panel padding="none">
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
										<td className="p-3 text-right">
											<ChangeValue value={sectorReturn} />
										</td>
										<td className="p-3 text-right">
											<ChangeValue value={marketReturn} />
										</td>
										<td className="p-3 text-right">
											<ChangeValue
												value={sectorReturn == null || marketReturn == null ? null : sectorReturn - marketReturn}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Panel>
			</div>

			<Panel padding="none">
				<PanelHeader>
					<div className="mr-auto">
						<PanelTitle>Constituents</PanelTitle>
						<p className="body-sm text-tertiary">
							{filteredCompanies.length} equities · sorted by {CONSTITUENT_SORT_LABELS[tableSort.key]}
						</p>
					</div>
					<CSVDownloadButton
						free
						size="md"
						smol
						prepareCsv={() => ({
							filename: `${sector.sectorSlug}-constituents`,
							rows: [
								['Ticker', 'Company', 'Industry', 'Market cap', 'Price', '1D', '7D', '1M'],
								...sortedCompanies.map((company) => [
									company.ticker,
									company.name,
									company.industry,
									company.marketCap,
									company.currentPrice,
									company.priceChangePercentage1d,
									company.priceChangePercentage7d,
									company.priceChangePercentage1m
								])
							]
						})}
					/>
				</PanelHeader>
				<div className="border-b border-subtle p-2">
					<SegmentedControl
						value={selectedIndustry}
						onValueChange={(next) => {
							setPage(1)
							void pushShallowQuery(router, { industry: next === 'all' ? undefined : next })
						}}
						options={industryOptions}
						label="Filter constituents by industry"
						variant="chips"
						size="md"
					/>
				</div>
				{filteredCompanies.length === 0 ? (
					<SurfaceBodyStatus variant="empty">
						<div className="flex flex-col items-center gap-3">
							<span>No constituents match this industry.</span>
							<Button
								type="button"
								variant="secondary"
								size="md"
								onClick={() => void pushShallowQuery(router, { industry: undefined })}
							>
								Show all industries
							</Button>
						</div>
					</SurfaceBodyStatus>
				) : (
					<>
						<AggregateTableScroller>
							<table className="w-full min-w-[1100px]">
								<thead>
									<tr className="border-b border-subtle table-header text-secondary">
										<th className="p-3 text-left">#</th>
										<SortableTableHeader
											column="name"
											sort={tableSort}
											onSort={updateTableSort}
											align="left"
											defaultDirection="asc"
										>
											Company
										</SortableTableHeader>
										<SortableTableHeader
											column="industry"
											sort={tableSort}
											onSort={updateTableSort}
											align="left"
											defaultDirection="asc"
										>
											Industry
										</SortableTableHeader>
										<SortableTableHeader column="marketCap" sort={tableSort} onSort={updateTableSort}>
											Market cap
										</SortableTableHeader>
										<SortableTableHeader column="sectorWeight" sort={tableSort} onSort={updateTableSort}>
											Sector wt.
										</SortableTableHeader>
										<SortableTableHeader column="currentPrice" sort={tableSort} onSort={updateTableSort}>
											Price
										</SortableTableHeader>
										<SortableTableHeader column="priceChangePercentage1d" sort={tableSort} onSort={updateTableSort}>
											1D
										</SortableTableHeader>
										<SortableTableHeader column="priceChangePercentage7d" sort={tableSort} onSort={updateTableSort}>
											7D
										</SortableTableHeader>
										<SortableTableHeader column="priceChangePercentage1m" sort={tableSort} onSort={updateTableSort}>
											1M
										</SortableTableHeader>
										<SortableTableHeader column="dollarVolume24h" sort={tableSort} onSort={updateTableSort}>
											Volume 24h
										</SortableTableHeader>
										<SortableTableHeader column="trailingPE" sort={tableSort} onSort={updateTableSort}>
											P/E
										</SortableTableHeader>
									</tr>
								</thead>
								<tbody>
									{pageRows.map((company, index) => (
										<tr
											key={`${company.ticker}:${company.country}`}
											className="border-b border-subtle body-md hover:bg-hover-row"
										>
											<td className="p-3 text-tertiary">{(safePage - 1) * PAGE_SIZE + index + 1}</td>
											<td className="p-3">
												<div className="flex items-center gap-2">
													<TokenLogo kind="equities" name={company.ticker} country={company.country} />
													<div>
														<Link
															href={`/equities/${buildEquityTickerCountrySlug(company.ticker, company.country)}`}
															className="font-medium hover:text-link"
														>
															{company.name}
														</Link>
														<p className="body-sm text-tertiary">
															{company.ticker} · {company.country}
														</p>
													</div>
												</div>
											</td>
											<td className="p-3">{company.industry || 'Unknown'}</td>
											<td className="p-3 text-right">{formatMetric(company.marketCap, 'usd')}</td>
											<td className="p-3 text-right">
												{formatMetric(calculateConstituentSectorWeight(company.marketCap, sector.marketCap), 'percent')}
											</td>
											<td className="p-3 text-right">{formatMetric(company.currentPrice, 'usd')}</td>
											<td className="p-3 text-right">
												<ChangeValue value={company.priceChangePercentage1d} />
											</td>
											<td className="p-3 text-right">
												<ChangeValue value={company.priceChangePercentage7d} />
											</td>
											<td className="p-3 text-right">
												<ChangeValue value={company.priceChangePercentage1m} />
											</td>
											<td className="p-3 text-right">
												{formatMetric(calculateCompanyDollarVolume(company.volume, company.currentPrice), 'usd')}
											</td>
											<td className="p-3 text-right">{formatMetric(company.trailingPE, 'multiple')}</td>
										</tr>
									))}
								</tbody>
							</table>
						</AggregateTableScroller>
						<div className="flex items-center justify-end gap-2 border-t border-subtle p-2 body-sm text-secondary">
							<span>
								Page {safePage} of {totalPages}
							</span>
							<Button
								type="button"
								variant="secondary"
								size="md"
								disabled={safePage <= 1}
								onClick={() => setPage((value) => Math.max(1, value - 1))}
							>
								Previous
							</Button>
							<Button
								type="button"
								variant="secondary"
								size="md"
								disabled={safePage >= totalPages}
								onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
							>
								Next
							</Button>
						</div>
					</>
				)}
			</Panel>
		</div>
	)
}
