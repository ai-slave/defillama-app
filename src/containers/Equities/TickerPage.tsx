import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { lazy, Suspense, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { createCategoryChartOptions } from '~/components/ECharts/MultiSeriesChart/categoryOptions'
import { TokenLogo } from '~/components/TokenLogo'
import { ViewTabs } from '~/components/ViewTabs'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import defs from '~/public/equities-definitions.json'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyError, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { KeyMetricsPanel } from '~/ui/KeyMetricsCard'
import { MetricRow } from '~/ui/MetricPrimitives'
import { TagGroup } from '~/ui/SegmentedControl'
import { StaleText } from '~/ui/StaleText'
import { LoadingIndicator } from '~/ui/Status'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { Tabs, TabPanel } from '~/ui/Tabs'
import { formatDate, formatDateTime } from '~/utils/dateFormat'
import { equityCountryFlagUrl } from '~/utils/icons'
import {
	DEFAULT_PRICE_CHART_TIMEFRAME,
	getPriceChartTimeframe,
	isPriceChartIntradayTimeframe,
	PRICE_CHART_TIMEFRAMES,
	type PriceChartTimeframe
} from '~/utils/priceChartTimeframes'
import { queryReadFailed } from '~/utils/query'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { EquitiesDimensionMetric, EquitiesDimensionPeriod, IEquitiesSummaryResponse } from './api.types'
import {
	buildEquitiesDimensionsChart,
	buildEquitiesDimensionsCsvRows,
	createReportingPeriodTooltipFormatter,
	buildIntradayPriceHistoryChart,
	buildPriceHistoryChart,
	formatIntradayAxisTimeOnly,
	FUNDAMENTAL_CHART_VALUE_SYMBOLS
} from './chartData'
import { EquitiesFilingsTable } from './FilingsTable'
import { formatEquitiesCompactValue } from './financialsFormatting'
import { EquitiesFinancialsTable } from './FinancialsTable'
import { EquitiesMarketsTable, EquitiesTokensTable } from './OnchainTables'
import { fetchEquitiesPriceHistoryFromProxy } from './priceHistoryClient'
import { getAvailableEquityTabs, type EquityTab } from './tickerPageState'
import type { IEquityTickerPageProps } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const TokenUnlocksSection = dynamic(
	() => import('~/containers/Token/TokenUnlocksSection').then((mod) => mod.TokenUnlocksSection),
	{ loading: () => <div className="min-h-[572px]" /> }
)

const SCALED_Y_AXIS_CHART_OPTIONS = { yAxis: { scale: true } }

// Category axis so closed-market hours are compressed out instead of drawn as a
// diagonal between sessions. boundaryGap:false keeps the line flush with the edges.
const INTRADAY_CHART_OPTIONS = {
	...createCategoryChartOptions('$'),
	xAxis: { type: 'category' as const, boundaryGap: false },
	yAxis: { scale: true }
}
const INTRADAY_SINGLE_SESSION_CHART_OPTIONS = {
	...INTRADAY_CHART_OPTIONS,
	xAxis: { ...INTRADAY_CHART_OPTIONS.xAxis, axisLabel: { formatter: formatIntradayAxisTimeOnly } }
}

const EQUITY_FUNDAMENTAL_CHART_OPTIONS = ['Revenue', 'Holders Revenue', 'Earnings', 'Shares Outstanding'] as const
type EquityFundamentalChartOption = (typeof EQUITY_FUNDAMENTAL_CHART_OPTIONS)[number]
const DEFAULT_EQUITY_FUNDAMENTAL_CHART: EquityFundamentalChartOption = 'Revenue'
const EQUITY_FUNDAMENTAL_CHART_QUERY_VALUES: Record<EquityFundamentalChartOption, string | undefined> = {
	Revenue: undefined,
	'Holders Revenue': 'holders-revenue',
	Earnings: 'earnings',
	'Shares Outstanding': 'shares-outstanding'
}
const EQUITY_FUNDAMENTAL_CHART_API_KEYS: Record<EquityFundamentalChartOption, EquitiesDimensionMetric> = {
	Revenue: 'revenue',
	'Holders Revenue': 'holdersRevenue',
	Earnings: 'earnings',
	'Shares Outstanding': 'basicSharesOutstanding'
}

const EQUITY_DIMENSION_PERIOD_OPTIONS = ['Quarterly', 'Annual'] as const
type EquityDimensionPeriodOption = (typeof EQUITY_DIMENSION_PERIOD_OPTIONS)[number]
const DEFAULT_EQUITY_DIMENSION_PERIOD: EquityDimensionPeriodOption = 'Quarterly'
const EQUITY_DIMENSION_PERIOD_QUERY_VALUES: Record<EquityDimensionPeriodOption, string | undefined> = {
	Quarterly: undefined,
	Annual: 'annual'
}
const EQUITY_DIMENSION_PERIOD_API_KEYS: Record<EquityDimensionPeriodOption, EquitiesDimensionPeriod> = {
	Quarterly: 'quarterly',
	Annual: 'annual'
}

const TAB_LABELS: Record<EquityTab, string> = {
	overview: 'Overview',
	financials: 'Financials',
	filings: 'Filings',
	tokens: 'Tokens',
	markets: 'Markets',
	unlocks: 'Unlocks'
}

function ChangeMetricValue({ value, symbol }: { value: number | null; symbol?: string }) {
	return (
		<span className={value == null || value === 0 ? undefined : value > 0 ? 'text-data-up' : 'text-data-down'}>
			{formatEquitiesCompactValue(value, symbol) ?? '-'}
		</span>
	)
}

function getFundamentalChartFromQuery(value?: string): EquityFundamentalChartOption {
	const match = EQUITY_FUNDAMENTAL_CHART_OPTIONS.find(
		(option) => EQUITY_FUNDAMENTAL_CHART_QUERY_VALUES[option] === value
	)
	return match ?? DEFAULT_EQUITY_FUNDAMENTAL_CHART
}

function getDimensionPeriodFromQuery(value?: string): EquityDimensionPeriodOption {
	const match = EQUITY_DIMENSION_PERIOD_OPTIONS.find((option) => EQUITY_DIMENSION_PERIOD_QUERY_VALUES[option] === value)
	return match ?? DEFAULT_EQUITY_DIMENSION_PERIOD
}

export function EquityKeyMetrics({ summary }: { summary: IEquitiesSummaryResponse }) {
	return (
		<KeyMetricsPanel>
			<MetricRow
				label={defs.currentPrice.label}
				tooltip={defs.currentPrice.description}
				value={formatEquitiesCompactValue(summary.currentPrice, '$') ?? '-'}
			/>
			<MetricRow
				label={defs.revenueTTM.label}
				tooltip={defs.revenueTTM.description}
				value={formatEquitiesCompactValue(summary.revenueTTM, '$') ?? '-'}
			/>
			<MetricRow
				label={defs.holdersRevenueTTM.label}
				tooltip={defs.holdersRevenueTTM.description}
				value={formatEquitiesCompactValue(summary.holdersRevenueTTM, '$') ?? '-'}
			/>
			<MetricRow
				label={defs.grossProfitTTM.label}
				tooltip={defs.grossProfitTTM.description}
				value={formatEquitiesCompactValue(summary.grossProfitTTM, '$') ?? '-'}
			/>
			<MetricRow
				label={defs.earningsTTM.label}
				tooltip={defs.earningsTTM.description}
				value={formatEquitiesCompactValue(summary.earningsTTM, '$') ?? '-'}
			/>
			<MetricRow
				label={defs.ebitdaTTM.label}
				tooltip={defs.ebitdaTTM.description}
				value={formatEquitiesCompactValue(summary.ebitdaTTM, '$') ?? '-'}
			/>
			<MetricRow
				label={defs.operatingProfitMarginTTM.label}
				tooltip={defs.operatingProfitMarginTTM.description}
				value={formatEquitiesCompactValue(summary.operatingProfitMarginTTM, '%') ?? '-'}
			/>
			<MetricRow
				label={defs.dividendYield.label}
				tooltip={defs.dividendYield.description}
				value={formatEquitiesCompactValue(summary.dividendYield, '%') ?? '-'}
			/>
			<MetricRow
				label={defs.holdersYield.label}
				tooltip={defs.holdersYield.description}
				value={formatEquitiesCompactValue(summary.holdersYield, '%') ?? '-'}
			/>
			<MetricRow
				label={defs.cashAndCashEquivalents.label}
				tooltip={defs.cashAndCashEquivalents.description}
				value={formatEquitiesCompactValue(summary.cashAndCashEquivalents, '$') ?? '-'}
			/>
			<MetricRow
				label={defs.totalAssets.label}
				tooltip={defs.totalAssets.description}
				value={formatEquitiesCompactValue(summary.totalAssets, '$') ?? '-'}
			/>
			<MetricRow
				label={defs.totalShareholdersEquity.label}
				tooltip={defs.totalShareholdersEquity.description}
				value={formatEquitiesCompactValue(summary.totalShareholdersEquity, '$') ?? '-'}
			/>
			<MetricRow
				label={defs.totalDebt.label}
				tooltip={defs.totalDebt.description}
				value={formatEquitiesCompactValue(summary.totalDebt, '$') ?? '-'}
			/>
		</KeyMetricsPanel>
	)
}

function EquityTitle({
	ticker,
	country,
	name,
	website
}: Pick<IEquityTickerPageProps, 'ticker' | 'country' | 'name'> & { website: string | null }) {
	return (
		<span className="flex items-center gap-2">
			<TokenLogo kind="equities" name={ticker} country={country} alt={`Logo of ${ticker}`} />
			<h1 className="flex flex-1 flex-wrap items-center gap-2 heading-sm">
				<span className="font-bold">{name}</span>
				<span className="font-normal text-secondary">
					({ticker}:{country})
				</span>
			</h1>
			{website ? (
				<WebsiteGlobeLink url={website} name={name} event="equities-website-click" eventData={{ ticker }} />
			) : null}
		</span>
	)
}

/**
 * The chart memo lives in a hook so the compiler preserves it: in the component body `activeTimeframe`
 * carries a mutable range it cannot see past, and it drops the memo instead. A parameter carries none.
 */
function useIntradayPriceHistoryChart(
	intradayTimeframe: Parameters<typeof buildIntradayPriceHistoryChart>[1] | null,
	priceHistoryData: Parameters<typeof buildIntradayPriceHistoryChart>[0] | undefined
) {
	return useMemo(
		() =>
			intradayTimeframe && priceHistoryData?.length
				? buildIntradayPriceHistoryChart(priceHistoryData, intradayTimeframe)
				: null,
		[intradayTimeframe, priceHistoryData]
	)
}

export function EquityTickerPage(props: IEquityTickerPageProps) {
	const router = useRouter()
	const { chartInstance: priceChartInstance, handleChartReady: handlePriceChartReady } = useGetChartInstance()
	const { chartInstance: fundamentalsChartInstance, handleChartReady: handleFundamentalsChartReady } =
		useGetChartInstance()
	const availableTabs = useMemo<ReadonlyArray<EquityTab>>(
		() =>
			getAvailableEquityTabs({
				hasFilings: props.filings !== null,
				hasOnchain: props.onchain !== null,
				hasUnlocks: props.unlocksSlug !== null
			}),
		[props.filings, props.onchain, props.unlocksSlug]
	)

	const tabQueryValue = readSingleQueryValue(router.query.tab)
	const activeTab: EquityTab =
		tabQueryValue && availableTabs.includes(tabQueryValue as EquityTab) ? (tabQueryValue as EquityTab) : 'financials'

	const activeTimeframe = getPriceChartTimeframe(readSingleQueryValue(router.query.timeframe))

	const activeFundamentalChart: EquityFundamentalChartOption = getFundamentalChartFromQuery(
		readSingleQueryValue(router.query.fundamentals)
	)

	const activeDimensionPeriod: EquityDimensionPeriodOption = getDimensionPeriodFromQuery(
		readSingleQueryValue(router.query.fundamentalsPeriod)
	)

	const isIntradayTimeframe = isPriceChartIntradayTimeframe(activeTimeframe)

	const priceHistory = useQuery({
		queryKey: ['equities-price-history', props.ticker, props.country, activeTimeframe],
		queryFn: () => fetchEquitiesPriceHistoryFromProxy(props.ticker, props.country, activeTimeframe),
		// Only seed the default timeframe; every other range comes from its own proxy request.
		initialData: activeTimeframe === DEFAULT_PRICE_CHART_TIMEFRAME ? (props.priceHistory ?? undefined) : undefined,
		staleTime: 30 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const dailyPriceHistoryChart = useMemo(() => {
		if (isIntradayTimeframe || !priceHistory.data?.length) return null
		return buildPriceHistoryChart(priceHistory.data)
	}, [isIntradayTimeframe, priceHistory.data])

	const intradayPriceHistoryChart = useIntradayPriceHistoryChart(
		isIntradayTimeframe ? activeTimeframe : null,
		priceHistory.data
	)

	const activePriceHistoryChart = intradayPriceHistoryChart ?? dailyPriceHistoryChart
	const priceHistoryChartOptions = intradayPriceHistoryChart
		? intradayPriceHistoryChart.timeOnlyAxisLabels
			? INTRADAY_SINGLE_SESSION_CHART_OPTIONS
			: INTRADAY_CHART_OPTIONS
		: SCALED_Y_AXIS_CHART_OPTIONS

	const activeFundamentalMetric = EQUITY_FUNDAMENTAL_CHART_API_KEYS[activeFundamentalChart]

	const activeFundamentalsChart = useMemo(() => {
		return buildEquitiesDimensionsChart(
			props.dimensions,
			activeFundamentalMetric,
			EQUITY_DIMENSION_PERIOD_API_KEYS[activeDimensionPeriod]
		)
	}, [activeDimensionPeriod, activeFundamentalMetric, props.dimensions])
	const fundamentalsChartOptions = useMemo(
		() => ({
			yAxis: SCALED_Y_AXIS_CHART_OPTIONS.yAxis,
			tooltip: {
				formatter: createReportingPeriodTooltipFormatter(
					EQUITY_DIMENSION_PERIOD_API_KEYS[activeDimensionPeriod],
					FUNDAMENTAL_CHART_VALUE_SYMBOLS[activeFundamentalMetric]
				)
			}
		}),
		[activeDimensionPeriod, activeFundamentalMetric]
	)

	const setActiveTab = (tab: EquityTab) => {
		void pushShallowQuery(router, { tab: tab === 'financials' ? undefined : tab })
	}

	const setActiveTimeframe = (timeframe: PriceChartTimeframe) => {
		void pushShallowQuery(router, {
			timeframe: timeframe === DEFAULT_PRICE_CHART_TIMEFRAME ? undefined : timeframe
		})
	}

	const setActiveFundamentalChart = (chart: EquityFundamentalChartOption) => {
		void pushShallowQuery(router, {
			fundamentals: EQUITY_FUNDAMENTAL_CHART_QUERY_VALUES[chart]
		})
	}

	const setActiveDimensionPeriod = (period: EquityDimensionPeriodOption) => {
		void pushShallowQuery(router, {
			fundamentalsPeriod: EQUITY_DIMENSION_PERIOD_QUERY_VALUES[period]
		})
	}

	const exportTitle = `${props.ticker} Price History (${activeTimeframe})`
	const exportFilename = `${props.ticker.toLowerCase()}-price-history-${activeTimeframe.toLowerCase()}`
	const fundamentalsExportTitle = `${props.ticker} ${activeFundamentalChart} (${activeDimensionPeriod})`
	const fundamentalsExportFilename = `${props.ticker.toLowerCase()}-${activeFundamentalChart.toLowerCase().replaceAll(' ', '-')}-${activeDimensionPeriod.toLowerCase()}`
	return (
		<article className="flex flex-col gap-2">
			<SummaryCardGrid>
				{/* Desktop: left stats panel */}
				<SummaryStatsCard padding="sm" className="max-xl:hidden xl:min-h-[360px]">
					<EquityTitle
						ticker={props.ticker}
						country={props.country}
						name={props.name}
						website={props.metadata.website}
					/>
					<p className="flex flex-col">
						<span className="text-secondary">{defs.marketCap.label}</span>
						<span className="min-h-8 mono-xl">{formatEquitiesCompactValue(props.summary.marketCap, '$') ?? '-'}</span>
					</p>
					<EquityKeyMetrics summary={props.summary} />
				</SummaryStatsCard>

				<div className="col-span-2 grid grid-cols-2 gap-2">
					<ChartPanel className="col-span-full">
						{/* Mobile: name + market cap */}
						<div className="flex flex-col gap-6 p-2 pb-0 xl:hidden">
							<EquityTitle
								ticker={props.ticker}
								country={props.country}
								name={props.name}
								website={props.metadata.website}
							/>
							<p className="flex flex-col">
								<span className="text-secondary">{defs.marketCap.label}</span>
								<span className="min-h-8 mono-xl">
									{formatEquitiesCompactValue(props.summary.marketCap, '$') ?? '-'}
								</span>
							</p>
						</div>

						<ChartPanelToolbar>
							<h2 className="mr-auto heading-xs">Price History</h2>
							<TagGroup
								variant="default"
								size="md"
								selectedValue={activeTimeframe}
								setValue={setActiveTimeframe}
								values={PRICE_CHART_TIMEFRAMES}
								ariaLabel="Price history timeframe"
							/>
							<ChartExportButtons
								chartInstance={priceChartInstance}
								filename={exportFilename}
								title={exportTitle}
								disabled={!activePriceHistoryChart}
								csvSource={{
									type: 'dataset',
									prepare: () => {
										if (intradayPriceHistoryChart) return intradayPriceHistoryChart.csvDataset
										if (activePriceHistoryChart) return activePriceHistoryChart.dataset
										throw new Error('Price history export requires chart data')
									}
								}}
							/>
						</ChartPanelToolbar>
						<Suspense fallback={<ChartPanelBodyFallback />}>
							{/* A failed refresh of a chart already drawn keeps the chart. */}
							{queryReadFailed(priceHistory) && !activePriceHistoryChart ? (
								<ChartPanelBodyError retry={priceHistory}>Failed to load price history.</ChartPanelBodyError>
							) : priceHistory.isPending ? (
								<ChartPanelBodyFallback role="status" aria-label="Loading price history">
									<LoadingIndicator />
								</ChartPanelBodyFallback>
							) : activePriceHistoryChart ? (
								<MultiSeriesChart
									dataset={activePriceHistoryChart.dataset}
									charts={activePriceHistoryChart.charts}
									chartOptions={priceHistoryChartOptions}
									valueSymbol="$"
									title=""
									hideDataZoom={intradayPriceHistoryChart !== null || activePriceHistoryChart.dataset.source.length < 2}
									onReady={handlePriceChartReady}
								/>
							) : (
								<ChartPanelBodyFallback className="body-sm text-tertiary" role="status">
									No price history available for this timeframe.
								</ChartPanelBodyFallback>
							)}
						</Suspense>
					</ChartPanel>

					{/* Mobile: key metrics below chart */}
					<Card padding="sm" className="col-span-full flex flex-col gap-6 xl:hidden">
						<EquityKeyMetrics summary={props.summary} />
					</Card>
				</div>

				<ChartPanel className="col-span-full">
					<ChartPanelToolbar
						leading={
							<TagGroup
								variant="default"
								size="md"
								selectedValue={activeFundamentalChart}
								setValue={setActiveFundamentalChart}
								values={EQUITY_FUNDAMENTAL_CHART_OPTIONS}
							/>
						}
					>
						<TagGroup
							variant="default"
							size="md"
							selectedValue={activeDimensionPeriod}
							setValue={setActiveDimensionPeriod}
							values={EQUITY_DIMENSION_PERIOD_OPTIONS}
						/>
						<ChartExportButtons
							chartInstance={fundamentalsChartInstance}
							filename={fundamentalsExportFilename}
							title={fundamentalsExportTitle}
							csvSource={{
								type: 'prepare-csv',
								prepare: () => ({
									filename: `${fundamentalsExportFilename}.csv`,
									rows: buildEquitiesDimensionsCsvRows(activeFundamentalsChart)
								})
							}}
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={activeFundamentalsChart.dataset}
							charts={activeFundamentalsChart.charts}
							chartOptions={fundamentalsChartOptions}
							valueSymbol={FUNDAMENTAL_CHART_VALUE_SYMBOLS[activeFundamentalMetric]}
							title=""
							hideDataZoom={activeFundamentalsChart.dataset.source.length < 2}
							onReady={handleFundamentalsChartReady}
						/>
					</Suspense>
				</ChartPanel>
			</SummaryCardGrid>

			<Tabs value={activeTab} onValueChange={setActiveTab} values={availableTabs}>
				<ViewTabs tabs={availableTabs.map((id) => ({ id, label: TAB_LABELS[id] }))} label="Ticker sections" />
				<TabPanel value={activeTab}>
					{activeTab === 'overview' ? (
						<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
							<Card as="section" padding="sm" className="flex flex-col gap-3">
								<h2 className="heading-xs">Market Data</h2>
								<div className="flex flex-col">
									<MetricRow
										label={defs.currentPrice.label}
										tooltip={defs.currentPrice.description}
										value={formatEquitiesCompactValue(props.summary.currentPrice, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.marketCap.label}
										tooltip={defs.marketCap.description}
										value={formatEquitiesCompactValue(props.summary.marketCap, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.circulatingMarketCap.label}
										tooltip={defs.circulatingMarketCap.description}
										value={formatEquitiesCompactValue(props.summary.circulatingMarketCap, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.enterpriseValue.label}
										tooltip={defs.enterpriseValue.description}
										value={formatEquitiesCompactValue(props.summary.enterpriseValue, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.volume.label}
										tooltip={defs.volume.description}
										value={formatEquitiesCompactValue(props.summary.volume) ?? '-'}
									/>
									<MetricRow
										label={defs.priceChangePercentage1d.label}
										tooltip={defs.priceChangePercentage1d.description}
										value={<ChangeMetricValue value={props.summary.priceChangePercentage1d} symbol="%" />}
									/>
									<MetricRow
										label={defs.priceChangePercentage7d.label}
										tooltip={defs.priceChangePercentage7d.description}
										value={<ChangeMetricValue value={props.summary.priceChangePercentage7d} symbol="%" />}
									/>
									<MetricRow
										label={defs.priceChangePercentage1m.label}
										tooltip={defs.priceChangePercentage1m.description}
										value={<ChangeMetricValue value={props.summary.priceChangePercentage1m} symbol="%" />}
									/>
									<MetricRow
										label={defs.priceChange1d.label}
										tooltip={defs.priceChange1d.description}
										value={<ChangeMetricValue value={props.summary.priceChange1d} symbol="$" />}
									/>
									<MetricRow
										label={defs.marketCapChange1d.label}
										tooltip={defs.marketCapChange1d.description}
										value={<ChangeMetricValue value={props.summary.marketCapChange1d} symbol="$" />}
									/>
									<MetricRow
										label={defs.fiftyTwoWeekLow.label}
										tooltip={defs.fiftyTwoWeekLow.description}
										value={formatEquitiesCompactValue(props.summary.fiftyTwoWeekLow, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.fiftyTwoWeekHigh.label}
										tooltip={defs.fiftyTwoWeekHigh.description}
										value={formatEquitiesCompactValue(props.summary.fiftyTwoWeekHigh, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.circulatingSupply.label}
										tooltip={defs.circulatingSupply.description}
										value={formatEquitiesCompactValue(props.summary.circulatingSupply) ?? '-'}
									/>
									<MetricRow
										label={defs.totalSupply.label}
										tooltip={defs.totalSupply.description}
										value={formatEquitiesCompactValue(props.summary.totalSupply) ?? '-'}
									/>
									<MetricRow
										label={defs.trailingPE.label}
										tooltip={defs.trailingPE.description}
										value={formatEquitiesCompactValue(props.summary.trailingPE) ?? '-'}
									/>
									<MetricRow
										label={defs.priceToRevenue.label}
										tooltip={defs.priceToRevenue.description}
										value={formatEquitiesCompactValue(props.summary.priceToRevenue) ?? '-'}
									/>
									<MetricRow
										label={defs.priceToBook.label}
										tooltip={defs.priceToBook.description}
										value={formatEquitiesCompactValue(props.summary.priceToBook) ?? '-'}
									/>
									<MetricRow
										label={defs.enterpriseValueToEbitda.label}
										tooltip={defs.enterpriseValueToEbitda.description}
										value={formatEquitiesCompactValue(props.summary.enterpriseValueToEbitda) ?? '-'}
									/>
								</div>
							</Card>

							<Card as="section" padding="sm" className="flex flex-col gap-3">
								<h2 className="heading-xs">Profile</h2>
								<div className="flex flex-col">
									<MetricRow label="Ticker" value={props.ticker} />
									<MetricRow
										label="Country"
										value={
											<span className="flex items-center gap-2">
												<TokenLogo src={equityCountryFlagUrl(props.country)} alt={`${props.country} flag`} />
												{props.country}
											</span>
										}
									/>
									<MetricRow label="Company" value={props.name} />
									<MetricRow label="Sector" value={props.metadata.sector || '—'} />
									<MetricRow label="Industry" value={props.metadata.industry || '—'} />
									<MetricRow
										label={defs.employeeCount.label}
										tooltip={defs.employeeCount.description}
										value={formatEquitiesCompactValue(props.metadata.employeeCount) ?? '-'}
									/>
									<MetricRow
										label="Website"
										value={
											props.metadata.website ? (
												<a
													href={props.metadata.website}
													target="_blank"
													rel="noopener noreferrer"
													className="text-link hover:underline"
													data-umami-event="equities-website-click"
													data-umami-event-ticker={props.ticker}
													data-umami-event-placement="info"
													data-umami-event-url={props.metadata.website}
												>
													{props.metadata.website}
												</a>
											) : (
												'—'
											)
										}
									/>
									<MetricRow
										label="Coverage since"
										value={<StaleText>{formatDate(props.metadata.startDate) ?? '-'}</StaleText>}
									/>
									<MetricRow
										label="Last Updated"
										value={
											<StaleText>
												{formatDateTime(props.summary.updatedAt, { timeZone: 'local', timeZoneName: 'short' }) ?? '-'}
											</StaleText>
										}
									/>
								</div>
								{props.metadata.description ? <p className="body-sm">{props.metadata.description}</p> : null}
							</Card>

							<Card as="section" padding="sm" className="flex flex-col gap-3">
								<h2 className="heading-xs">Financials</h2>
								<div className="flex flex-col">
									<MetricRow
										label={defs.revenueTTM.label}
										tooltip={defs.revenueTTM.description}
										value={formatEquitiesCompactValue(props.summary.revenueTTM, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.grossProfitTTM.label}
										tooltip={defs.grossProfitTTM.description}
										value={formatEquitiesCompactValue(props.summary.grossProfitTTM, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.earningsTTM.label}
										tooltip={defs.earningsTTM.description}
										value={formatEquitiesCompactValue(props.summary.earningsTTM, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.ebitdaTTM.label}
										tooltip={defs.ebitdaTTM.description}
										value={formatEquitiesCompactValue(props.summary.ebitdaTTM, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.operatingProfitMarginTTM.label}
										tooltip={defs.operatingProfitMarginTTM.description}
										value={formatEquitiesCompactValue(props.summary.operatingProfitMarginTTM, '%') ?? '-'}
									/>
									<MetricRow
										label={defs.holdersRevenueTTM.label}
										tooltip={defs.holdersRevenueTTM.description}
										value={formatEquitiesCompactValue(props.summary.holdersRevenueTTM, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.holderEarningsTTM.label}
										tooltip={defs.holderEarningsTTM.description}
										value={formatEquitiesCompactValue(props.summary.holderEarningsTTM, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.dividendYield.label}
										tooltip={defs.dividendYield.description}
										value={formatEquitiesCompactValue(props.summary.dividendYield, '%') ?? '-'}
									/>
									<MetricRow
										label={defs.holdersYield.label}
										tooltip={defs.holdersYield.description}
										value={formatEquitiesCompactValue(props.summary.holdersYield, '%') ?? '-'}
									/>
									<MetricRow
										label={defs.dividendsTTM.label}
										tooltip={defs.dividendsTTM.description}
										value={formatEquitiesCompactValue(props.summary.dividendsTTM, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.stockRepurchaseTTM.label}
										tooltip={defs.stockRepurchaseTTM.description}
										value={formatEquitiesCompactValue(props.summary.stockRepurchaseTTM, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.stockIssuanceTTM.label}
										tooltip={defs.stockIssuanceTTM.description}
										value={formatEquitiesCompactValue(props.summary.stockIssuanceTTM, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.stockBasedCompensationTTM.label}
										tooltip={defs.stockBasedCompensationTTM.description}
										value={formatEquitiesCompactValue(props.summary.stockBasedCompensationTTM, '$') ?? '-'}
									/>
								</div>
							</Card>

							<Card as="section" padding="sm" className="flex flex-col gap-3">
								<h2 className="heading-xs">Balance Sheet</h2>
								<div className="flex flex-col">
									<MetricRow
										label={defs.cashAndCashEquivalents.label}
										tooltip={defs.cashAndCashEquivalents.description}
										value={formatEquitiesCompactValue(props.summary.cashAndCashEquivalents, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.totalAssets.label}
										tooltip={defs.totalAssets.description}
										value={formatEquitiesCompactValue(props.summary.totalAssets, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.totalLiabilities.label}
										tooltip={defs.totalLiabilities.description}
										value={formatEquitiesCompactValue(props.summary.totalLiabilities, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.totalShareholdersEquity.label}
										tooltip={defs.totalShareholdersEquity.description}
										value={formatEquitiesCompactValue(props.summary.totalShareholdersEquity, '$') ?? '-'}
									/>
									<MetricRow
										label={defs.totalDebt.label}
										tooltip={defs.totalDebt.description}
										value={formatEquitiesCompactValue(props.summary.totalDebt, '$') ?? '-'}
									/>
								</div>
							</Card>
						</div>
					) : null}

					{activeTab === 'financials' ? <EquitiesFinancialsTable statements={props.statements} /> : null}
					{activeTab === 'filings' && props.filings ? (
						<EquitiesFilingsTable filings={props.filings} filingForms={props.filingForms} />
					) : null}
					{activeTab === 'tokens' && props.onchain ? (
						<EquitiesTokensTable tokens={props.onchain.tokens} ticker={props.ticker} />
					) : null}
					{activeTab === 'markets' && props.onchain ? (
						<EquitiesMarketsTable markets={props.onchain.perps} ticker={props.ticker} />
					) : null}
					{activeTab === 'unlocks' && props.unlocksSlug ? (
						<TokenUnlocksSection resolvedUnlocksSlug={props.unlocksSlug} />
					) : null}
				</TabPanel>
			</Tabs>

			<Card as="footer" padding="sm">
				<h2 className="label-md text-primary">Attribution</h2>
				<p className="mt-1 body-sm text-tertiary">
					Market and statements data provided by{' '}
					<a href="https://twelvedata.com" target="_blank" rel="noopener noreferrer" className="underline">
						Twelve Data
					</a>
					. Filings data from SEC EDGAR.
				</p>
			</Card>
		</article>
	)
}
