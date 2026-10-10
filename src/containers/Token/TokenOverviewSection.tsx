import * as Ariakit from '@ariakit/react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { ChartMetricsDialog } from '~/components/ChartMetricsDialog'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { chartColor } from '~/constants/colors'
import { CreateAlertModal } from '~/containers/LlamaAI/components/CreateAlertModal'
import type { MarketTotalsBySegment, TokenMarketSummary } from '~/containers/Markets/api.types'
import type { Segment } from '~/containers/Markets/segments'
import { RaisesTotal } from '~/containers/Raises/RaisesTotal'
import { summarizeRaises } from '~/containers/Raises/summary'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBody, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { EntityTitleRow } from '~/ui/EntityTitleRow'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { KeyMetricsPanel } from '~/ui/KeyMetricsCard'
import { metricChipStyles } from '~/ui/MetricChip'
import { MetricRow, MetricSection, SubMetricRow, SubMetricSection } from '~/ui/MetricPrimitives'
import { TagGroup } from '~/ui/SegmentedControl'
import { StaleText } from '~/ui/StaleText'
import { LoadingIndicator } from '~/ui/Status'
import { StatItem, SummaryCardGrid, SummaryChange, SummaryStatsCard } from '~/ui/SummaryStats'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatDate } from '~/utils/dateFormat'
import { tokenIconUrl } from '~/utils/icons'
import {
	formatUsd,
	formatCompactNumber,
	NUMBER_LOWERCASE_MILLIONS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import {
	DEFAULT_PRICE_CHART_TIMEFRAME,
	getPriceChartTimeframe,
	PRICE_CHART_TIMEFRAMES,
	type PriceChartTimeframe
} from '~/utils/priceChartTimeframes'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { TokenOverviewChartLabel, TokenOverviewData, TokenOverviewRawChartData } from './tokenOverview'
import {
	getTokenOverviewChartBody,
	getTokenOverviewChartQuery,
	resolveTokenOverviewCharts,
	roundToSignificantFigures
} from './TokenOverviewSection.utils'
import type { TokenIssuer } from './types'
import { useFetchTokenOverviewChartData } from './useFetchTokenOverviewChartData'

const TOKEN_OVERVIEW_CHART_COLORS: Record<TokenOverviewChartLabel, string> = {
	'Token Price': chartColor(0),
	'Token Volume': chartColor(1),
	Mcap: chartColor(2),
	FDV: chartColor(3)
}

const FDV_TOOLTIP =
	"Fully Diluted Valuation, this is calculated by taking the expected maximum supply of the token and multiplying it by the price. It's mainly used to calculate the hypothetical marketcap of the token if all the tokens were unlocked and circulating."
const OUTSTANDING_FDV_TOOLTIP =
	'Outstanding FDV is calculated by taking the outstanding supply of the token and multiplying it by the price.\n\nOutstanding supply is the total supply minus the supply that is not yet allocated to anything (eg coins in treasury or reserve).'
const CIRCULATING_SUPPLY_TOOLTIP =
	'Circulating supply is the number of tokens currently available and circulating in the market.'
const MAX_SUPPLY_TOOLTIP = 'Max supply is the maximum number of tokens that can ever exist for this asset.'
const MARKET_CAP_TOOLTIP = 'Market cap is calculated by multiplying the circulating supply by the current token price.'
const VOLUME_24H_TOOLTIP = 'Volume 24h is the total dollar value traded across tracked markets over the last 24 hours.'
const OPEN_INTEREST_TOOLTIP =
	'Open Interest is the total notional USD value of outstanding perpetual contracts across tracked markets.'
const TREASURY_TOOLTIP = 'Treasury is the value of assets held by the entity issuing or stewarding this token.'

const MARKET_CATEGORY_LABELS: Record<Segment, string> = {
	spot: 'Spot',
	linear_perp: 'USD Perp',
	inverse_perp: 'COIN Perp'
}
const MARKET_CATEGORY_ORDER: Array<Segment> = ['spot', 'linear_perp', 'inverse_perp']
const TOKEN_OVERVIEW_CHART_QUERY_KEY = 'chart'
const TOKEN_OVERVIEW_TIMEFRAME_QUERY_KEY = 'timeframe'

const DeferredProtocolChart = dynamic(() => import('~/containers/ProtocolOverview/Chart'), {
	loading: () => <div className="min-h-[360px]" />
})

function formatSupply(value: number | null | undefined, symbol: string) {
	if (value == null) return 'N/A'
	if (value === Infinity) return `∞ ${symbol}`.trim()
	return `${formatCompactNumber(value, NUMBER_LOWERCASE_MILLIONS_OPTIONS)} ${symbol}`.trim()
}

function formatDateLabel(value: string | number | null | undefined) {
	if (value == null) return null
	return typeof value === 'number' ? formatDate(value, { input: 'seconds' }) : formatDate(value)
}

function getChartLabel(label: TokenOverviewChartLabel, symbol: string) {
	if (label.startsWith('Token ')) {
		return symbol ? label.replace('Token', `$${symbol}`) : label
	}

	return label
}

function TokenPriceAlertButton({
	overview,
	geckoId,
	currentPrice
}: {
	overview: TokenOverviewData
	geckoId: string | null | undefined
	currentPrice: number | null
}) {
	const dialogStore = Ariakit.useDialogStore()
	const signInDialogStore = Ariakit.useDialogStore()
	// The alert modal loads with its first opening and leaves once its exit animation ends.
	const alertModalMounted = Ariakit.useStoreState(dialogStore, 'mounted')
	const { isAuthenticated } = useAuthContext()

	if (geckoId == null || currentPrice == null || currentPrice <= 0) return null

	const trendingUp = (overview.marketData.percentChange24h ?? 0) > 0

	return (
		<>
			<Tooltip
				content="Set a price alert"
				render={
					<Button
						variant="ghost"
						size="md"
						square
						aria-label="Set a price alert"
						onClick={() => {
							trackUmamiEvent('llamaai-alerts-open', { source: 'token-page' })
							if (!isAuthenticated) {
								signInDialogStore.show()
								return
							}
							dialogStore.show()
						}}
					/>
				}
			>
				<Icon name="calendar-plus" className="size-4" />
			</Tooltip>
			{alertModalMounted ? (
				<CreateAlertModal
					dialogStore={dialogStore}
					initialTab="price"
					prefill={{
						token_nk: `coingecko:${geckoId}`,
						symbol: overview.symbol,
						value: roundToSignificantFigures(currentPrice * (trendingUp ? 1.05 : 0.95)),
						op: trendingUp ? 'above' : 'below',
						currentPrice
					}}
				/>
			) : null}
			<SignInModal
				store={signInDialogStore}
				prompt={`Sign in to set price alerts for ${overview.symbol.toUpperCase()}`}
			/>
		</>
	)
}

export function TokenPageHero({
	overview,
	logo,
	geckoId,
	headingAs: Heading = 'h1'
}: {
	overview: TokenOverviewData
	logo?: string | null | undefined
	geckoId?: string | null | undefined
	headingAs?: 'h1' | 'div'
}) {
	const change24h = overview.marketData.percentChange24h
	const hasPriceBreakdown = overview.marketData.ath != null || overview.marketData.atl != null
	const price = formatUsd(overview.marketData.currentPrice, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'
	const summaryChange = change24h == null ? null : <SummaryChange value={change24h} comparison="over 24h" />

	return (
		<div className="flex flex-col gap-6">
			<EntityTitleRow
				as={Heading}
				logo={
					logo ? (
						<TokenLogo
							src={logo}
							fallbackSrc={tokenIconUrl(overview.name)}
							size={24}
							alt={`Logo of ${overview.name}`}
						/>
					) : (
						<TokenLogo name={overview.name} kind="token" size={24} alt={`Logo of ${overview.name}`} />
					)
				}
				actions={
					<TokenPriceAlertButton
						overview={overview}
						geckoId={geckoId}
						currentPrice={overview.marketData.currentPrice}
					/>
				}
			>
				{overview.name}
				{overview.symbol ? <span className="font-normal">({overview.symbol})</span> : null}
			</EntityTitleRow>
			{hasPriceBreakdown ? (
				<details className="group/price">
					{/* The change sits in the summary so it shows without opening the price range. */}
					<summary className="flex flex-nowrap items-end justify-between gap-8">
						<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
							<span className="basis-full text-secondary">Token Price</span>
							<StaleText className="min-h-8 mono-xl">{price}</StaleText>
							<Icon
								name="chevron-down"
								height={18}
								width={18}
								className="text-tertiary transition-transform duration-100 group-open/price:rotate-180"
							/>
						</span>
						{summaryChange}
					</summary>
					<div className="mt-3 flex flex-col">
						{overview.marketData.ath != null ? (
							<SubMetricRow
								label="All Time High"
								extra={
									formatDateLabel(overview.marketData.athDate) ? (
										<span className="ml-auto label-sm text-tertiary">
											{formatDateLabel(overview.marketData.athDate)}
										</span>
									) : null
								}
								// The date takes the free space, so the value sits right after it rather than on its own ml-auto.
								valueClassName="mono-md"
								value={formatUsd(overview.marketData.ath, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
							/>
						) : null}
						{overview.marketData.atl != null ? (
							<SubMetricRow
								label="All Time Low"
								extra={
									formatDateLabel(overview.marketData.atlDate) ? (
										<span className="ml-auto label-sm text-tertiary">
											{formatDateLabel(overview.marketData.atlDate)}
										</span>
									) : null
								}
								valueClassName="mono-md"
								value={formatUsd(overview.marketData.atl, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
							/>
						) : null}
					</div>
				</details>
			) : (
				<div className="flex flex-nowrap items-end justify-between gap-8">
					<StatItem label="Token Price" value={<StaleText>{price}</StaleText>} truncate />
					{summaryChange}
				</div>
			)}
		</div>
	)
}

function getCategoryMetric(totals: MarketTotalsBySegment, category: Segment, metric: 'volume' | 'oi'): number | null {
	const entry = totals[category]
	if (!entry) return null
	return metric === 'volume' ? (entry.total_volume_24h ?? null) : (entry.total_oi_usd ?? null)
}

function sumVenueMetric(totals: MarketTotalsBySegment, metric: 'volume' | 'oi'): number | null {
	let sum = 0
	let hasValue = false
	for (const category of MARKET_CATEGORY_ORDER) {
		const value = getCategoryMetric(totals, category, metric)
		if (value != null) {
			sum += value
			hasValue = true
		}
	}
	return hasValue ? sum : null
}

function MarketsCategoryBreakdown({ totals, metric }: { totals: MarketTotalsBySegment; metric: 'volume' | 'oi' }) {
	const visibleCategories = metric === 'oi' ? MARKET_CATEGORY_ORDER.filter((c) => c !== 'spot') : MARKET_CATEGORY_ORDER
	return (
		<>
			{visibleCategories.map((category) => {
				const value = getCategoryMetric(totals, category, metric)
				return (
					<SubMetricRow
						key={category}
						label={MARKET_CATEGORY_LABELS[category]}
						value={value == null ? 'N/A' : (formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A')}
					/>
				)
			})}
		</>
	)
}

function MarketsMetricSection({
	label,
	tooltip,
	totalValue,
	markets,
	metric
}: {
	label: string
	tooltip: string
	totalValue: number | null
	markets: TokenMarketSummary
	metric: 'volume' | 'oi'
}) {
	const cexValue = sumVenueMetric(markets.totals.cex, metric)
	const dexValue = sumVenueMetric(markets.totals.dex, metric)
	return (
		<MetricSection
			label={label}
			tooltip={tooltip}
			value={formatUsd(totalValue, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
		>
			<SubMetricSection
				label="CEX"
				value={cexValue == null ? 'N/A' : (formatUsd(cexValue, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A')}
			>
				<MarketsCategoryBreakdown totals={markets.totals.cex} metric={metric} />
			</SubMetricSection>
			<SubMetricSection
				label="DEX"
				value={dexValue == null ? 'N/A' : (formatUsd(dexValue, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A')}
			>
				<MarketsCategoryBreakdown totals={markets.totals.dex} metric={metric} />
			</SubMetricSection>
		</MetricSection>
	)
}

function TokenMetrics({ overview }: { overview: TokenOverviewData }) {
	const markets = overview.marketSummary
	const marketsHasVolume = markets != null && (markets.total_volume_24h ?? 0) > 0
	const marketsHasOi = markets != null && (markets.total_oi_usd ?? 0) > 0

	return (
		<KeyMetricsPanel id="token-key-metrics">
			{overview.marketData.mcap != null ? (
				<MetricRow
					label="Market Cap"
					tooltip={MARKET_CAP_TOOLTIP}
					value={formatUsd(overview.marketData.mcap, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
				/>
			) : null}
			{overview.marketData.fdv != null ? (
				<MetricRow
					label="Fully Diluted Valuation"
					tooltip={FDV_TOOLTIP}
					value={formatUsd(overview.marketData.fdv, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
				/>
			) : null}
			{overview.marketData.circulatingSupply != null ? (
				<MetricRow
					label="Circ. Supply"
					tooltip={CIRCULATING_SUPPLY_TOOLTIP}
					value={formatSupply(overview.marketData.circulatingSupply, overview.symbol)}
				/>
			) : null}
			{overview.marketData.maxSupply != null ? (
				<MetricRow
					label="Max Supply"
					tooltip={MAX_SUPPLY_TOOLTIP}
					value={formatSupply(overview.marketData.maxSupply, overview.symbol)}
				/>
			) : null}
			{overview.outstandingFDV != null ? (
				<MetricRow
					label="Outstanding FDV"
					tooltip={OUTSTANDING_FDV_TOOLTIP}
					value={formatUsd(overview.outstandingFDV, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
				/>
			) : null}
			{marketsHasVolume && markets ? (
				<MarketsMetricSection
					label="Volume 24h"
					tooltip={VOLUME_24H_TOOLTIP}
					totalValue={markets.total_volume_24h ?? null}
					markets={markets}
					metric="volume"
				/>
			) : overview.marketData.volume24h.total != null ||
			  overview.marketData.volume24h.cex != null ||
			  overview.marketData.volume24h.dex != null ? (
				<MetricSection
					label="Volume 24h"
					tooltip={VOLUME_24H_TOOLTIP}
					value={formatUsd(overview.marketData.volume24h.total, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
				>
					{overview.marketData.volume24h.cex != null ? (
						<SubMetricRow
							label="CEX Volume"
							value={formatUsd(overview.marketData.volume24h.cex, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
						/>
					) : null}
					{overview.marketData.volume24h.dex != null ? (
						<SubMetricRow
							label="DEX Volume"
							value={formatUsd(overview.marketData.volume24h.dex, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
						/>
					) : null}
				</MetricSection>
			) : null}
			{marketsHasOi && markets ? (
				<MarketsMetricSection
					label="Open Interest"
					tooltip={OPEN_INTEREST_TOOLTIP}
					totalValue={markets.total_oi_usd ?? null}
					markets={markets}
					metric="oi"
				/>
			) : null}
			{overview.treasury ? (
				<MetricSection
					label="Treasury"
					tooltip={TREASURY_TOOLTIP}
					value={formatUsd(overview.treasury.total, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
				>
					{overview.treasury.majors != null ? (
						<SubMetricRow
							label="Majors"
							tooltip="BTC, ETH"
							value={formatUsd(overview.treasury.majors, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
						/>
					) : null}
					{overview.treasury.stablecoins != null ? (
						<SubMetricRow
							label="Stablecoins"
							value={formatUsd(overview.treasury.stablecoins, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
						/>
					) : null}
					{overview.treasury.ownTokens != null ? (
						<SubMetricRow
							label="Own Tokens"
							value={formatUsd(overview.treasury.ownTokens, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
						/>
					) : null}
					{overview.treasury.others != null ? (
						<SubMetricRow
							label="Others"
							value={formatUsd(overview.treasury.others, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'N/A'}
						/>
					) : null}
				</MetricSection>
			) : null}
			{overview.raises?.length ? (
				<MetricSection label="Total Raised" value={<RaisesTotal {...summarizeRaises(overview.raises)} />}>
					{overview.raises.map((raise) => (
						<SubMetricRow
							key={`${raise.date}-${raise.round ?? 'raise'}`}
							label={
								raise.round
									? `${raise.round} · ${formatDateLabel(raise.date) ?? 'Unknown date'}`
									: (formatDateLabel(raise.date) ?? 'Unknown date')
							}
							value={
								raise.amountUsd == null ? 'Undisclosed' : formatUsd(raise.amountUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
							}
						/>
					))}
				</MetricSection>
			) : null}
		</KeyMetricsPanel>
	)
}

function TokenChartPanel({ overview, geckoId }: { overview: TokenOverviewData; geckoId: string | null }) {
	const router = useRouter()
	const [isThemeDark] = useDarkModeManager()
	const isClient = useIsClient()
	const activeTimeframe = getPriceChartTimeframe(readSingleQueryValue(router.query[TOKEN_OVERVIEW_TIMEFRAME_QUERY_KEY]))
	const selectedChartsQuery = router.query[TOKEN_OVERVIEW_CHART_QUERY_KEY]
	const { availableCharts, defaultCharts, activeCharts } = useMemo(
		() => resolveTokenOverviewCharts({ geckoId, rawChartData: overview.rawChartData, chartQuery: selectedChartsQuery }),
		[geckoId, overview.rawChartData, selectedChartsQuery]
	)
	const { rawChartData, isLoading } = useFetchTokenOverviewChartData({
		geckoId,
		overview,
		activeCharts,
		timeframe: activeTimeframe,
		enabled: isClient
	})
	const displayedChartData = useMemo(() => {
		const charts: TokenOverviewRawChartData = {}
		for (const chartLabel of activeCharts) {
			const chartData = rawChartData[chartLabel]
			if (chartData?.length) charts[chartLabel] = chartData
		}
		return charts
	}, [rawChartData, activeCharts])
	const pendingCharts = useMemo(
		() => activeCharts.filter((chart) => !displayedChartData[chart]?.length),
		[activeCharts, displayedChartData]
	)
	let hasChartData = false
	for (const _chart in displayedChartData) {
		hasChartData = true
		break
	}
	const chartBody = getTokenOverviewChartBody({
		isClient,
		geckoId,
		pendingChartCount: pendingCharts.length,
		isLoading,
		hasChartData,
		activeChartCount: activeCharts.length
	})
	const [pendingChart] = pendingCharts
	const loadingLabel = pendingChart ? getChartLabel(pendingChart, overview.symbol) : `${pendingCharts.length} metrics`
	const setActiveTimeframe = (timeframe: PriceChartTimeframe) => {
		void pushShallowQuery(router, {
			[TOKEN_OVERVIEW_TIMEFRAME_QUERY_KEY]: timeframe === DEFAULT_PRICE_CHART_TIMEFRAME ? undefined : timeframe
		})
	}

	const setActiveCharts = (nextCharts: Array<TokenOverviewChartLabel>) => {
		void pushShallowQuery(router, {
			[TOKEN_OVERVIEW_CHART_QUERY_KEY]: getTokenOverviewChartQuery(nextCharts, availableCharts, defaultCharts)
		})
	}

	return (
		<>
			<ChartPanelToolbar
				leading={
					<>
						{availableCharts.length > 0 ? (
							<ChartMetricsDialog
								groups={[
									{
										label: 'Market',
										options: availableCharts.map((chart) => ({
											key: chart,
											label: getChartLabel(chart, overview.symbol),
											color: TOKEN_OVERVIEW_CHART_COLORS[chart],
											active: activeCharts.includes(chart)
										}))
									}
								]}
								onToggle={(option) =>
									setActiveCharts(
										option.active ? activeCharts.filter((chart) => chart !== option.key) : [...activeCharts, option.key]
									)
								}
								clear={{ kind: 'clear', onClear: () => setActiveCharts([]) }}
							/>
						) : null}
						{activeCharts.map((chart) => (
							<button
								key={chart}
								type="button"
								aria-label={`Remove ${getChartLabel(chart, overview.symbol)}`}
								// The chip leaves with its series: focus moves to the next chip, else the previous one or Add Metrics.
								ref={passFocusOnLeave((chip) => neighbourRowControl(chip, chip))}
								onClick={() => setActiveCharts(activeCharts.filter((value) => value !== chart))}
								className={metricChipStyles}
								style={{ borderColor: TOKEN_OVERVIEW_CHART_COLORS[chart] }}
							>
								<span>{getChartLabel(chart, overview.symbol)}</span>
								<Icon name="x" aria-hidden="true" className="size-3.5" />
							</button>
						))}
					</>
				}
			>
				<TagGroup
					variant="default"
					size="md"
					selectedValue={activeTimeframe}
					setValue={setActiveTimeframe}
					values={PRICE_CHART_TIMEFRAMES}
					ariaLabel="Price history timeframe"
				/>
			</ChartPanelToolbar>
			<ChartPanelBody>
				{chartBody === 'wait-for-client' ? null : chartBody === 'loading' ? (
					<ChartPanelBodyFallback role="status" aria-live="polite">
						<LoadingIndicator label={`fetching ${loadingLabel}`} />
					</ChartPanelBodyFallback>
				) : chartBody === 'chart' ? (
					<DeferredProtocolChart
						key={`${activeTimeframe}:${activeCharts.join('|')}`}
						chartData={displayedChartData}
						chartColors={TOKEN_OVERVIEW_CHART_COLORS}
						isThemeDark={isThemeDark}
						valueSymbol="$"
						groupBy="daily"
						hallmarks={null}
						rangeHallmarks={null}
					/>
				) : (
					<ChartPanelBodyFallback
						role="status"
						aria-live="polite"
						className="max-w-sm text-center body-sm text-tertiary"
					>
						{chartBody === 'unavailable'
							? 'Chart unavailable for this token right now.'
							: chartBody === 'select-metrics'
								? 'Select metrics to chart.'
								: 'Chart unavailable without CoinGecko market data.'}
					</ChartPanelBodyFallback>
				)}
			</ChartPanelBody>
		</>
	)
}

function TokenInformationCard({
	overview,
	issuer,
	chain
}: {
	overview: TokenOverviewData
	issuer: TokenIssuer | null
	chain: TokenIssuer | null
}) {
	const hasLinks = overview.website || overview.twitter || overview.telegram || overview.discord
	// Previously loaded page props can survive a client code update.
	const categories = overview.categories ?? []
	if (!hasLinks && categories.length === 0 && !issuer && !chain) return null

	return (
		<Card as="section" padding="sm" className="col-span-full flex flex-wrap items-center gap-x-6 gap-y-3 body-md">
			<h3 className="sr-only">Token Information</h3>
			{hasLinks ? (
				<div className="flex flex-wrap gap-2">
					{overview.website ? (
						<ExternalLinkButton
							href={overview.website}
							icon="globe"
							data-umami-event="token-link-click"
							data-umami-event-token={overview.symbol}
							data-umami-event-link="website"
							data-umami-event-url={overview.website}
						>
							Website
						</ExternalLinkButton>
					) : null}
					{overview.twitter ? (
						<ExternalLinkButton
							href={overview.twitter}
							icon="twitter"
							data-umami-event="token-link-click"
							data-umami-event-token={overview.symbol}
							data-umami-event-link="twitter"
							data-umami-event-url={overview.twitter}
						>
							X/Twitter
						</ExternalLinkButton>
					) : null}
					{overview.telegram ? (
						<ExternalLinkButton
							href={overview.telegram}
							icon="telegram"
							data-umami-event="token-link-click"
							data-umami-event-token={overview.symbol}
							data-umami-event-link="telegram"
							data-umami-event-url={overview.telegram}
						>
							Telegram
						</ExternalLinkButton>
					) : null}
					{overview.discord ? (
						<ExternalLinkButton
							href={overview.discord}
							icon="discord"
							data-umami-event="token-link-click"
							data-umami-event-token={overview.symbol}
							data-umami-event-link="discord"
							data-umami-event-url={overview.discord}
						>
							Discord
						</ExternalLinkButton>
					) : null}
				</div>
			) : null}
			{categories.length > 0 ? (
				<div className="flex flex-wrap items-center gap-2">
					<span className="label-md text-secondary">{categories.length > 1 ? 'Categories' : 'Category'}:</span>
					{categories.map((category) => (
						<Button
							as={BasicLink}
							key={category.id}
							href={`/tokens?categories=${encodeURIComponent(category.id)}`}
							size="md"
						>
							{category.label}
						</Button>
					))}
				</div>
			) : null}
			{issuer ? (
				<div className="flex flex-wrap items-center gap-2">
					<span className="label-md text-secondary">Issued by:</span>
					<Button as={BasicLink} href={`/protocol/${issuer.slug}`} size="md">
						{issuer.name}
					</Button>
				</div>
			) : null}
			{chain ? (
				<div className="flex flex-wrap items-center gap-2">
					<span className="label-md text-secondary">Chain:</span>
					<Button as={BasicLink} href={`/chain/${chain.slug}`} size="md">
						{chain.name}
					</Button>
				</div>
			) : null}
		</Card>
	)
}

export function TokenOverviewSection({
	overview,
	geckoId,
	logo,
	issuer,
	chain
}: {
	overview: TokenOverviewData
	geckoId: string | null
	logo?: string | null
	issuer: TokenIssuer | null
	chain: TokenIssuer | null
}) {
	return (
		<section className="scroll-mt-24" id="token-overview">
			<h2 className="sr-only">Overview</h2>
			<SummaryCardGrid>
				<SummaryStatsCard padding="sm" className="xl:min-h-[360px]">
					<TokenPageHero overview={overview} logo={logo} geckoId={geckoId} />
					<TokenMetrics overview={overview} />
				</SummaryStatsCard>
				<div className="col-span-2 grid grid-cols-2 gap-2">
					<ChartPanel className="col-span-full">
						<TokenChartPanel overview={overview} geckoId={geckoId} />
					</ChartPanel>
				</div>
				<TokenInformationCard overview={overview} issuer={issuer} chain={chain} />
			</SummaryCardGrid>
		</section>
	)
}
