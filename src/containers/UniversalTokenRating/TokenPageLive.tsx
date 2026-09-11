import { useState, type ReactNode } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { CHART_COLORS, oldBlue } from '~/constants/colors'
import { AccentBadge, SecondaryBadge, StatusBadge } from '~/containers/MarketMakers/badges'
import { Drawer } from '~/containers/MarketMakers/Drawer'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { geckoTokenIconUrl } from '~/utils/icons'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { formatCompactNumber, formatNumber, formatPercent } from '~/utils/numberFormat'
import { UTR_PERCENT_OPTIONS } from './constants'
import { CriteriaDrawer, type CriteriaDrawerState } from './CriteriaDrawer'
import { GradeBadge, GradeChip, ScoreBar } from './grades'
import { MarketMakerPerformance } from './MarketMakerPerformance'
import { PerformanceMatrix } from './PerformanceMatrix'
import { PreTgePerformance } from './PreTgePerformance'
import {
	buildCandleOption,
	buildDualAxisOption,
	buildSeriesOption,
	ChartCaption,
	ChartLegend,
	SimpleChart,
	useChartAxisColor,
	type SimpleSeries
} from './SimpleChart'
import {
	CardDivider,
	ClaimProfileBanner,
	GradeFooter,
	GradeFooterStacked,
	KvTable,
	MetricCard,
	TickScoreStrip,
	UtrDisclaimer
} from './TokenPage'
import type {
	UtrAssetMetrics,
	UtrAssetResponse,
	UtrChartSummary,
	UtrCriterionBreakdown,
	UtrExchangesResponse,
	UtrLeaderboardRow,
	UtrScoringConfig
} from './types'

const NUMBER_OPTIONS = {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
	useGrouping: false
} as const

const PERCENT_FOUR_DECIMALS_OPTIONS = {
	input: 'percent',
	minimumFractionDigits: 4,
	maximumFractionDigits: 4,
	smallValueDisplay: 'rounded',
	useGrouping: false
} as const

const EXCHANGE_LABELS: Record<string, string> = {
	binance_futures: 'Binance (Futures)',
	bybit: 'Bybit (Futures)',
	okex_swap: 'OKX (Futures)',
	binance: 'Binance',
	gdax: 'Coinbase',
	coinbase: 'Coinbase',
	okex: 'OKX',
	okx: 'OKX',
	upbit: 'Upbit'
}

const EXCHANGE_ICON_OVERRIDES: Record<string, string> = {
	gdax: 'coinbase',
	okex: 'okx'
}

const MARKET_CAP_COLOR = oldBlue
const VOLUME_COLOR = '#BB8C23'
const DEPTH_COLOR = '#9C27B0'
const DEPTH_MC_COLOR = '#4CAF50'
const VOLUME_STACK_COLORS = ['#DB9700', '#BB8C23'] as const
const DEPTH_STACK_COLORS = ['#40C4FF', oldBlue] as const

const DISCLOSURE_CATEGORY_ORDER = ['core_contributors', 'legal_financial', 'tokenomics_d', 'service_providers']

const DISCLOSURE_CATEGORY_TITLES: Record<string, string> = {
	core_contributors: 'Core Contributors',
	legal_financial: 'Legal & Financial',
	tokenomics_d: 'Tokenomics',
	service_providers: 'Service Providers'
}

const DISCLOSURE_CRITERION_TITLES: Record<string, string> = {
	team_identities: 'Insider Identities Disclosed',
	roles_org_chart: 'Role descriptions & org structure',
	insider_wallets: 'Anonymized insider wallet disclosures',
	treasury_reports: 'Treasury reporting',
	cash_flows: 'Cash flow disclosures',
	legal_entities: 'Legal entities, licenses & patents',
	vesting_published: 'Vesting schedules fully published',
	distribution_published: 'Distribution schedules fully published',
	external_allocations: 'External allocation disclosures',
	multisigs: 'Multisig disclosures',
	mm_contract_transparency: 'Market maker engagement transparency',
	smart_contract_audits: 'Auditor disclosures (smart contract)',
	exchange_agreements: 'Exchange engagement disclosures'
}

function disclosureCategoryTitle(entry: { key: string; label: string }): string {
	return DISCLOSURE_CATEGORY_TITLES[entry.key] ?? entry.label
}

function withDisclosureTitles(criteria: Array<UtrCriterionBreakdown>): Array<UtrCriterionBreakdown> {
	return criteria.map((criterion) => ({
		...criterion,
		label: DISCLOSURE_CRITERION_TITLES[criterion.key] ?? criterion.label
	}))
}

const TIER1_EXCHANGE_IDS = ['binance', 'okx', 'coinbase', 'upbit']

function exchangeLabel(id: string): string {
	return EXCHANGE_LABELS[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function exchangeIconSlug(id: string): string {
	const base = id.replace(/[_-](futures|swap|spot|perps?)$/, '')
	return (EXCHANGE_ICON_OVERRIDES[base] ?? base).replace(/_/g, '-')
}

function ExchangeCell({ id }: { id: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<TokenLogo name={exchangeIconSlug(id)} kind="exchange" size={16} />
			{exchangeLabel(id)}
		</span>
	)
}

function usd(value: number | null | undefined): string {
	return value == null ? 'N/A' : `$${formatNumber(Math.round(value))}`
}

function toTime(date: string): number {
	return Date.parse(date)
}

function summaryFooter(summary: UtrChartSummary | null | undefined) {
	return {
		score: summary?.score ?? null,
		grade: summary?.grade ?? null,
		percentile: summary?.percentile ?? null
	}
}

function hasAnyValue(...values: Array<unknown>): boolean {
	return values.some((value) => value != null)
}

function VenueList({
	title,
	venues
}: {
	title: string
	venues: Array<{ name: string; displayName: string; logoUrl: string | null }>
}) {
	if (venues.length === 0) return null
	return (
		<div className="flex flex-col gap-2">
			<h4 className="label-md text-primary">{title}</h4>
			<div className="flex flex-wrap gap-2">
				{keyedOccurrences(venues, (venue) => venue.name).map(({ item: venue, key }) => (
					<span
						key={key}
						className="inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-surface px-2 py-1 body-sm"
					>
						{venue.logoUrl ? (
							<img src={venue.logoUrl} alt={venue.displayName} width={18} height={18} className="rounded-full" />
						) : null}
						{venue.displayName}
					</span>
				))}
			</div>
		</div>
	)
}

function AboutDrawer({
	asset,
	defillamaDescription,
	exchanges,
	iconDataUrl,
	scoringConfig,
	open,
	onClose
}: {
	asset: UtrAssetResponse
	defillamaDescription?: string | null
	exchanges?: UtrExchangesResponse | null
	iconDataUrl?: string | null
	scoringConfig?: UtrScoringConfig | null
	open: boolean
	onClose: () => void
}) {
	if (!open) return null
	const description = defillamaDescription?.trim() || asset.description?.trim() || null
	const matrixRow: UtrLeaderboardRow = {
		asset: asset.coingeckoId ?? asset.arcticId,
		name: asset.projectName,
		symbol: asset.symbol.toUpperCase(),
		sector: asset.sector,
		listingStatus: asset.tgeStatus === 'post' ? 'listed' : 'pre-tge',
		disclosureLevel: 'full',
		claimed: false,
		fdvUsd: asset.fdvUsd,
		coingeckoId: asset.coingeckoId,
		iconDataUrl,
		grade: asset.grade,
		disclosureGrade: asset.disclosure?.grade ?? null,
		performanceGrade: asset.performance?.grade ?? null,
		scores: {
			overall: asset.overallScore,
			overallMomChangePct: asset.momChangePct,
			disclosure: asset.disclosure?.score ?? null,
			performance: asset.performance?.score ?? null,
			rank: asset.rank,
			disclosureRubrics: [],
			performanceRubrics: []
		}
	}
	const cexVenues = exchanges?.tiers.filter((tier) => tier.tier !== 'dex').flatMap((tier) => tier.exchanges) ?? []
	const dexVenues = exchanges?.tiers.find((tier) => tier.tier === 'dex')?.exchanges ?? []
	const rankPercentile =
		asset.overallPercentile ??
		(asset.rank == null || !asset.ratedCount ? null : ((asset.ratedCount - asset.rank + 1) / asset.ratedCount) * 100)
	return (
		<Drawer open onClose={onClose} title={`About ${asset.projectName}`}>
			<div className="flex min-h-full flex-col gap-4 bg-(--bg-page) p-4">
				{description ? (
					<div className="flex flex-col gap-2">
						<h4 className="label-lg">Project Description</h4>
						<p className="body-lg text-secondary">{description}</p>
					</div>
				) : null}
				<div className="flex flex-wrap items-center gap-2">
					<SecondaryBadge className="h-8 px-3">
						Status: {asset.tgeStatus === 'post' ? 'Listed' : 'Pre-TGE'}
					</SecondaryBadge>
					{asset.sector ? <SecondaryBadge className="h-8 px-3">{asset.sector}</SecondaryBadge> : null}
					{asset.chain ? <SecondaryBadge className="h-8 px-3">{asset.chain}</SecondaryBadge> : null}
				</div>
				{asset.websiteUrl ? (
					<Button as="a" href={asset.websiteUrl} target="_blank" rel="noreferrer" size="md" className="w-fit">
						<Icon name="globe" height={14} width={14} />
						Website
						<Icon name="arrow-up-right" height={12} width={12} />
					</Button>
				) : null}
				<div className="grid grid-cols-2 items-center gap-3 rounded-lg border border-subtle bg-surface p-3 lg:flex lg:flex-wrap lg:justify-between lg:gap-4">
					<GradeChip
						score={asset.overallScore}
						grade={asset.grade}
						gradingScale={scoringConfig?.grading.overall.scale}
					/>
					<span className="flex flex-col gap-0.5">
						<span className="body-sm text-tertiary">Overall Score</span>
						<span className="flex items-center gap-2">
							<span className="mono-md tabular-nums">
								{asset.overallScore == null ? 'N/A' : formatNumber(asset.overallScore, NUMBER_OPTIONS)}
								<span className="text-tertiary"> /100</span>
							</span>
							<ScoreBar
								score={asset.overallScore}
								grade={asset.grade}
								gradingScale={scoringConfig?.grading.overall.scale}
								showValue={false}
							/>
						</span>
					</span>
					<span className="flex flex-col gap-0.5">
						<span className="body-sm text-tertiary">Rank</span>
						<span className="mono-md tabular-nums">
							{asset.rank ?? 'N/A'} of {asset.ratedCount}
						</span>
					</span>
					<span className="flex flex-col gap-0.5">
						<span className="body-sm text-tertiary">Percentile</span>
						<span className="flex items-center gap-2">
							<span className="mono-md tabular-nums">
								{formatPercent(rankPercentile, UTR_PERCENT_OPTIONS) ?? 'N/A'}
							</span>
							<span className="h-2 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevated-1">
								<span
									className="block h-full rounded-full bg-(--text-primary)"
									style={{ width: `${Math.max(0, Math.min(100, rankPercentile ?? 0))}%` }}
								/>
							</span>
						</span>
					</span>
				</div>
				<div className="flex items-center gap-2">
					<h4 className="label-lg">Performance</h4>
					<AccentBadge className="h-6">Last 30-day</AccentBadge>
				</div>
				<div className="rounded-lg border border-subtle bg-surface">
					<PerformanceMatrix rows={[matrixRow]} grading={scoringConfig?.grading} className="h-[320px] w-full" />
				</div>
				<div className="flex flex-col divide-y divide-(--border-subtle) rounded-lg border border-subtle bg-surface sm:flex-row sm:divide-x sm:divide-y-0">
					<TickScoreStrip
						label="Disclosures"
						score={asset.disclosure?.score ?? null}
						gradeLabel={asset.disclosure?.grade ?? null}
						gradingScale={scoringConfig?.grading.disclosure.scale}
					/>
					<TickScoreStrip
						label="Performance"
						score={asset.performance?.score ?? null}
						gradeLabel={asset.performance?.grade ?? null}
						gradingScale={scoringConfig?.grading.performance.scale}
					/>
				</div>
				<VenueList title="CEX where listed" venues={cexVenues} />
				{cexVenues.length > 0 && dexVenues.length > 0 ? <div className="border-t border-subtle" /> : null}
				<VenueList title="DEX where listed" venues={dexVenues} />
			</div>
		</Drawer>
	)
}

export function TokenPageLive({
	asset,
	legacy,
	exchanges,
	scoringConfig,
	iconDataUrl,
	defillamaDescription
}: {
	asset: UtrAssetResponse
	legacy?: UtrAssetMetrics | null
	exchanges?: UtrExchangesResponse | null
	scoringConfig?: UtrScoringConfig | null
	iconDataUrl?: string | null
	defillamaDescription?: string | null
}) {
	const axisColor = useChartAxisColor()
	const [criteriaDrawer, setCriteriaDrawer] = useState<CriteriaDrawerState | null>(null)
	const [aboutOpen, setAboutOpen] = useState(false)

	const docsFor = (axis: 'disclosure' | 'performance', categoryKey: string) =>
		scoringConfig?.[axis].categories.find((entry) => entry.key === categoryKey)?.criteria ?? []
	const openCriteria = (
		title: string,
		axis: 'disclosure' | 'performance',
		categoryKey: string,
		criteria: Array<UtrCriterionBreakdown>,
		activeKey: string | null
	) => setCriteriaDrawer({ title, axis, criteria, docs: docsFor(axis, categoryKey), activeKey })

	const { charts, metrics } = asset
	const marketQuality = charts?.marketQuality ?? null
	const priceChart = charts?.pricePerformance ?? null
	const spread = charts?.bidAskSpread ?? null
	const openInterest = charts?.openInterest ?? null
	const funding = charts?.fundingRate ?? null
	const disclosureCategories = [...(asset.disclosure?.categories ?? [])].sort(
		(a, b) => DISCLOSURE_CATEGORY_ORDER.indexOf(a.key) - DISCLOSURE_CATEGORY_ORDER.indexOf(b.key)
	)
	const marketMakerCriteria =
		asset.performance?.categories.find((entry) => entry.key.includes('market_maker') || entry.label === 'Market Makers')
			?.criteria ?? []
	const tokenomicsCategory = asset.performance?.categories.find(
		(entry) => entry.key.includes('tokenomics') || entry.label === 'Tokenomics'
	)
	const footprintCategory = asset.performance?.categories.find((entry) => entry.key === 'liquidity_footprint')
	const totalMarketCategory = asset.performance?.categories.find((entry) => entry.key === 'total_market')
	const openTotalMarket = (activeKey?: string | null) =>
		totalMarketCategory &&
		openCriteria(
			'Performance Overview: Market Quality',
			'performance',
			'total_market',
			totalMarketCategory.criteria,
			activeKey ?? null
		)
	const openFootprint = (activeKey?: string | null) =>
		footprintCategory &&
		openCriteria(
			'Performance Overview: Liquidity Footprint',
			'performance',
			'liquidity_footprint',
			footprintCategory.criteria,
			activeKey ?? null
		)
	const tier1Criterion = footprintCategory?.criteria.find((entry) => entry.key === 'tier1_coverage') ?? null
	const vestingCriterion = tokenomicsCategory?.criteria.find((entry) => entry.key.includes('vesting')) ?? null
	const findTokenomicsCriterion = (keyPart: string) =>
		tokenomicsCategory?.criteria.find((entry) => entry.key.includes(keyPart)) ?? null
	const tier1CoveredLive = exchanges?.tiers.find((tier) => tier.tier === 'tier_1')?.exchanges.map((venue) => venue.name)
	const tier1Covered =
		tier1CoveredLive ?? legacy?.liquidity.tier1Exchanges.map((id) => EXCHANGE_ICON_OVERRIDES[id] ?? id) ?? null

	const tokenomicsCards = [
		{
			title: 'Market Cap vs. FDV (Ratio)',
			value:
				metrics?.marketCapUsd != null && metrics.fdvUsd != null && metrics.fdvUsd !== 0
					? `${formatNumber(metrics.marketCapUsd / metrics.fdvUsd, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
							useGrouping: false
						})}:1`
					: 'N/A',
			hasData: metrics?.marketCapUsd != null && metrics.fdvUsd != null && metrics.fdvUsd !== 0,
			criterion: findTokenomicsCriterion('mcap_vs_fdv')
		},
		{
			title: 'Fully Diluted Valuation (FDV) (USD)',
			value: usd(metrics?.fdvUsd),
			hasData: metrics?.fdvUsd != null,
			criterion: findTokenomicsCriterion('fdv')
		},
		{
			title: 'Annualized Rate of Inflation',
			value: formatPercent(metrics?.annualizedInflationPct, UTR_PERCENT_OPTIONS) ?? 'N/A',
			hasData: metrics?.annualizedInflationPct != null,
			criterion: findTokenomicsCriterion('inflation')
		},
		{
			title: 'Buyback & Burn Events',
			value:
				metrics?.cumulativeBuybackTokens != null || metrics?.cumulativeBurnTokens != null
					? `${formatNumber(Math.round((metrics.cumulativeBuybackTokens ?? 0) + (metrics.cumulativeBurnTokens ?? 0)))} tokens`
					: 'N/A',
			hasData: metrics?.cumulativeBuybackTokens != null || metrics?.cumulativeBurnTokens != null,
			criterion: findTokenomicsCriterion('buyback')
		}
	]
	const visibleTokenomicsCards = tokenomicsCards.filter((card) => card.hasData)
	const hasVestingData = hasAnyValue(
		vestingCriterion?.raw,
		metrics?.vestingAmountVariancePct,
		metrics?.vestingTimingVarianceDays,
		legacy?.tokenomics.vestingActualVsDisclosed
	)
	const hasTokenomicsData = Boolean(
		tokenomicsCategory && (visibleTokenomicsCards.length > 0 || hasVestingData || metrics?.undisclosedUnlockDetected)
	)

	const footprintCharts = [
		{
			title: 'Total Volume (CEX vs DEX)',
			chart: charts.cexVsDexVolume,
			names: ['CEX Volume', 'DEX Volume'] as const,
			kind: 'cexdex' as const,
			colors: VOLUME_STACK_COLORS
		},
		{
			title: 'Total +/- 2% Depth (CEX vs DEX)',
			chart: charts.cexVsDexDepth,
			names: ['CEX Depth', 'DEX Depth'] as const,
			kind: 'cexdex' as const,
			colors: DEPTH_STACK_COLORS
		},
		{
			title: 'Total Volume (Spot vs Perps)',
			chart: charts.spotVsPerpsVolume,
			names: ['Spot Volume', 'Perps Volume'] as const,
			kind: 'spotperp' as const,
			colors: VOLUME_STACK_COLORS
		},
		{
			title: 'Total +/- 2% Depth (Spot vs Perps)',
			chart: charts.spotVsPerpsDepth,
			names: ['Spot Depth', 'Perps Depth'] as const,
			kind: 'spotperp' as const,
			colors: DEPTH_STACK_COLORS
		}
	]
	const visibleFootprintCharts = footprintCharts.filter((entry) => {
		const chart = entry.chart
		if (!chart) return false
		if (chart.points.length > 0) return true
		return 'cexAvgUsd' in chart
			? hasAnyValue(chart.cexAvgUsd, chart.dexAvgUsd, chart.cexSharePct)
			: hasAnyValue(chart.spotAvgUsd, chart.perpsAvgUsd, chart.spotSharePct)
	})
	const hasVolumeMarketQuality = Boolean(
		marketQuality &&
		(marketQuality.series.length > 0 ||
			hasAnyValue(
				marketQuality.volumeMcap.avgUsd,
				marketQuality.volumeMcap.avgMarketCapUsd,
				marketQuality.volumeMcap.ratioPct
			))
	)
	const hasDepthMarketQuality = Boolean(
		marketQuality &&
		(marketQuality.series.length > 0 ||
			hasAnyValue(
				marketQuality.depthMcap.avgUsd,
				marketQuality.depthMcap.avgMarketCapUsd,
				marketQuality.depthMcap.ratioPct
			))
	)
	const hasSpreadData = Boolean(
		spread && (spread.exchanges.length > 0 || hasAnyValue(spread.tightestExchange, spread.vwasPct))
	)
	const hasPriceData = Boolean(
		priceChart &&
		(priceChart.candles.length > 0 ||
			hasAnyValue(priceChart.changePct, priceChart.greenCandles, priceChart.redCandles, priceChart.winRatePct))
	)
	const hasOpenInterestData = Boolean(
		openInterest &&
		(openInterest.venues.length > 0 || hasAnyValue(openInterest.totalOiUsd, openInterest.oiMcapRatioPct))
	)
	const hasFundingData = Boolean(funding && (funding.exchanges.length > 0 || hasAnyValue(funding.oiWeightedFundingPct)))
	const hasMarketQualityData =
		hasVolumeMarketQuality ||
		hasDepthMarketQuality ||
		hasSpreadData ||
		hasPriceData ||
		hasOpenInterestData ||
		hasFundingData
	const hasLiquidityFootprintData = tier1Covered != null || visibleFootprintCharts.length > 0

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-3">
					<TokenLogo src={asset.coingeckoId ? geckoTokenIconUrl(asset.coingeckoId) : null} size={32} />
					<h1 className="heading-sm">
						{asset.projectName} <span className="text-tertiary">{asset.symbol}</span>
					</h1>
					<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
						<SecondaryBadge className="h-8 px-3">
							Status: {asset.tgeStatus === 'post' ? 'Listed' : 'Pre-TGE'}
						</SecondaryBadge>
						{asset.sector ? <SecondaryBadge className="h-8 px-3">{asset.sector}</SecondaryBadge> : null}
						{asset.dataStatus === 'stale' ? <AccentBadge className="h-8 px-3">Stale data</AccentBadge> : null}
					</div>
				</div>
				<div className="flex items-center gap-2 max-lg:w-full">
					<Button type="button" size="md" onClick={() => setAboutOpen(true)} className="justify-center max-lg:flex-1">
						About {asset.symbol}
						<Icon name="circle-help" height={14} width={14} />
					</Button>
					<Button type="button" size="md" className="justify-center max-lg:flex-1">
						Share
						<Icon name="share" height={14} width={14} />
					</Button>
				</div>
			</div>

			<Panel padding="none">
				<div className="flex flex-col divide-y divide-(--border-subtle) md:flex-row md:divide-x md:divide-y-0">
					<div className="flex items-center gap-3 px-4 py-3">
						<GradeChip
							score={asset.overallScore}
							grade={asset.grade}
							gradingScale={scoringConfig?.grading.overall.scale}
						/>
						<div className="flex flex-col">
							<span className="label-md">
								Overall Score:{' '}
								<span className="font-jetbrains tabular-nums">
									{asset.overallScore == null ? 'N/A' : formatNumber(asset.overallScore, NUMBER_OPTIONS)}
								</span>
								<span className="text-tertiary"> /100</span>
							</span>
							{asset.rank != null ? (
								<span className="body-sm text-secondary">
									Rank: {asset.rank} of {asset.ratedCount}
								</span>
							) : null}
						</div>
					</div>
					<TickScoreStrip
						label="Disclosures"
						score={asset.disclosure?.score ?? null}
						gradeLabel={asset.disclosure?.grade ?? null}
						gradingScale={scoringConfig?.grading.disclosure.scale}
					/>
					<TickScoreStrip
						label="Performance"
						score={asset.performance?.score ?? null}
						gradeLabel={asset.performance?.grade ?? null}
						gradingScale={scoringConfig?.grading.performance.scale}
					/>
				</div>
			</Panel>

			<ClaimProfileBanner asset={asset.coingeckoId ?? asset.arcticId} />

			{disclosureCategories.length > 0 ? (
				<>
					<h2 className="heading-sm">Disclosures Overview</h2>
					<Panel padding="none">
						<div className="grid grid-cols-1 lg:grid-cols-2">
							{disclosureCategories.map((entry, index) => (
								<div
									key={entry.key}
									className={`flex flex-col gap-3 p-4 ${index > 0 ? 'border-t border-subtle' : ''} ${
										index === 1 ? 'lg:border-t-0' : ''
									} ${index % 2 === 1 ? 'lg:border-l lg:border-subtle' : ''}`}
								>
									<div className="flex items-center justify-between gap-2">
										<h3 className="label-lg">{disclosureCategoryTitle(entry)}</h3>
										<Button
											type="button"
											size="sm"
											square
											aria-label={`Open ${disclosureCategoryTitle(entry)} details`}
											onClick={() =>
												openCriteria(
													disclosureCategoryTitle(entry),
													'disclosure',
													entry.key,
													withDisclosureTitles(entry.criteria),
													null
												)
											}
										>
											<Icon name="arrow-right" height={14} width={14} />
										</Button>
									</div>
									<div className="flex flex-col overflow-hidden rounded-lg border border-subtle">
										{entry.criteria.map((item) => (
											<button
												key={item.key}
												type="button"
												onClick={() =>
													openCriteria(
														disclosureCategoryTitle(entry),
														'disclosure',
														entry.key,
														withDisclosureTitles(entry.criteria),
														item.key
													)
												}
												className="flex cursor-pointer items-center justify-between gap-3 border-b border-subtle px-3 py-2 text-left last:border-b-0 hover:bg-hover-row"
											>
												<span className="body-sm text-primary">
													{DISCLOSURE_CRITERION_TITLES[item.key] ?? item.label}
												</span>
												<span className="flex items-center gap-2">
													<GradeBadge
														score={item.score}
														scale={10}
														grade={item.grade}
														gradingScale={scoringConfig?.grading.disclosure.scale}
													/>
													<span className="min-w-[8ch] text-right mono-sm tabular-nums">
														{item.score == null ? 'N/A' : formatNumber(item.score, NUMBER_OPTIONS)}
														<span className="text-tertiary"> /10</span>
													</span>
												</span>
											</button>
										))}
									</div>
								</div>
							))}
						</div>
					</Panel>
				</>
			) : null}

			{asset.tgeStatus === 'post' ? (
				<>
					{hasMarketQualityData ? (
						<>
							<h2 className="heading-sm">Performance Overview: Market Quality</h2>
							<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
								{hasVolumeMarketQuality ? (
									<MetricCard
										title="Total Volume (as % of Market Cap)"
										onOpen={() => openTotalMarket(marketQuality?.volumeMcap.criterionKey)}
										gradingScale={scoringConfig?.grading.performance.scale}
										{...summaryFooter(marketQuality?.volumeMcap)}
									>
										{marketQuality?.series.length ? (
											<>
												<div className="flex h-[320px] flex-col gap-3">
													<ChartCaption>Market Cap (USD)</ChartCaption>
													<SimpleChart
														className="min-h-0 w-full flex-1"
														option={buildSeriesOption(
															[
																{
																	name: 'Market Cap (USD)',
																	type: 'area',
																	color: MARKET_CAP_COLOR,
																	data: marketQuality.series.map((point) => [
																		toTime(point.date),
																		point.marketCapUsd ?? 0
																	])
																}
															],
															axisColor
														)}
													/>
													<CardDivider />
													<ChartCaption>Trade Volume (USD)</ChartCaption>
													<SimpleChart
														className="min-h-0 w-full flex-1"
														option={buildSeriesOption(
															[
																{
																	name: 'Trade Volume (USD)',
																	type: 'bar',
																	color: VOLUME_COLOR,
																	data: marketQuality.series.map((point) => [
																		toTime(point.date),
																		point.tradeVolumeUsd ?? 0
																	])
																}
															],
															axisColor,
															'usd',
															2
														)}
													/>
												</div>
												<CardDivider />
											</>
										) : null}
										<KvTable
											rows={[
												[
													`Trade Volume (prev. ${marketQuality?.windowDays ?? 30}D avg.)`,
													usd(marketQuality?.volumeMcap.avgUsd)
												],
												['Market Capitalization (prev. 30D avg.)', usd(marketQuality?.volumeMcap.avgMarketCapUsd)],
												[
													'Trade Volume / Market Capitalization',
													formatPercent(marketQuality?.volumeMcap.ratioPct, UTR_PERCENT_OPTIONS) ?? 'N/A'
												]
											]}
										/>
									</MetricCard>
								) : null}
								{hasDepthMarketQuality ? (
									<MetricCard
										title="Depth +/- 2% (as a % of Market Capitalization)"
										onOpen={() => openTotalMarket(marketQuality?.depthMcap.criterionKey)}
										gradingScale={scoringConfig?.grading.performance.scale}
										{...summaryFooter(marketQuality?.depthMcap)}
									>
										{marketQuality?.series.length ? (
											<>
												<div className="flex h-[320px] flex-col gap-3">
													<ChartCaption>Depth +/- 2% (USD) | Market Cap (USD)</ChartCaption>
													<SimpleChart
														className="min-h-0 w-full flex-1"
														option={buildDualAxisOption(
															{
																name: 'Depth (+/- 2%)',
																type: 'line',
																color: DEPTH_COLOR,
																data: marketQuality.series.map((point) => [toTime(point.date), point.depthUsd ?? 0])
															},
															{
																name: 'Market Cap',
																type: 'line',
																color: DEPTH_MC_COLOR,
																data: marketQuality.series.map((point) => [toTime(point.date), point.marketCapUsd ?? 0])
															},
															axisColor
														)}
													/>
													<ChartLegend
														items={[
															{ label: 'Depth (+/- 2%)', color: DEPTH_COLOR },
															{ label: 'Market Cap', color: DEPTH_MC_COLOR }
														]}
													/>
												</div>
												<CardDivider />
											</>
										) : null}
										<KvTable
											rows={[
												[
													`Depth +/- 2% (prev. ${marketQuality?.windowDays ?? 30}D avg.)`,
													usd(marketQuality?.depthMcap.avgUsd)
												],
												['Market Capitalization (prev. 30D avg.)', usd(marketQuality?.depthMcap.avgMarketCapUsd)],
												[
													'Depth / Market Capitalization',
													formatPercent(marketQuality?.depthMcap.ratioPct, UTR_PERCENT_OPTIONS) ?? 'N/A'
												]
											]}
										/>
									</MetricCard>
								) : null}
								{hasSpreadData ? (
									<MetricCard
										title="Bid / Ask Spread (Volume weighted spreads)"
										onOpen={() => openTotalMarket(spread?.criterionKey)}
										gradingScale={scoringConfig?.grading.performance.scale}
										{...summaryFooter(spread)}
									>
										{spread?.exchanges.length ? (
											<>
												<ChartCaption>Bid / Ask Spread (%)</ChartCaption>
												<SimpleChart
													option={buildSeriesOption(
														spread.exchanges.map((exchange, index) => ({
															name: exchangeLabel(exchange.exchangeId),
															type: 'line' as const,
															color: CHART_COLORS[index % CHART_COLORS.length],
															data: exchange.points.map((point) => [toTime(point.date), point.spreadPct ?? 0])
														})),
														axisColor,
														'pct'
													)}
												/>
												<ChartLegend
													items={spread.exchanges.map((exchange, index) => ({
														label: exchangeLabel(exchange.exchangeId),
														color: CHART_COLORS[index % CHART_COLORS.length]
													}))}
												/>
												<CardDivider />
											</>
										) : null}
										<KvTable
											rows={[
												[
													'Exchange with Tightest Spreads',
													spread?.tightestExchange ? (
														<ExchangeCell key={spread.tightestExchange} id={spread.tightestExchange} />
													) : (
														'N/A'
													)
												],
												[
													'Volume Weighted Bid / Ask Spread (prev. 30 days)',
													formatPercent(spread?.vwasPct, PERCENT_FOUR_DECIMALS_OPTIONS) ?? 'N/A'
												]
											]}
										/>
									</MetricCard>
								) : null}
								{hasPriceData ? (
									<MetricCard
										title="Price Performance"
										onOpen={() => openTotalMarket(priceChart?.criterionKey)}
										gradingScale={scoringConfig?.grading.performance.scale}
										badge={
											priceChart?.changePct == null ? null : (
												<AccentBadge className="h-6">
													{priceChart.windowDays ?? 30}D Change:{' '}
													{formatPercent(priceChart.changePct, UTR_PERCENT_OPTIONS) ?? 'N/A'}
												</AccentBadge>
											)
										}
										{...summaryFooter(priceChart)}
									>
										{priceChart?.candles.length ? (
											<>
												<ChartCaption>Price (USD)</ChartCaption>
												<SimpleChart
													option={buildCandleOption(
														priceChart.candles.map((candle) => ({
															time: toTime(candle.date),
															open: candle.openUsd,
															close: candle.closeUsd,
															low: candle.lowUsd,
															high: candle.highUsd
														})),
														axisColor
													)}
												/>
												<CardDivider />
											</>
										) : null}
										<KvTable
											rows={[
												['Count Green Candles', String(priceChart?.greenCandles ?? 'N/A')],
												['Count Red Candles', String(priceChart?.redCandles ?? 'N/A')],
												['Candle "Win Rate"', formatPercent(priceChart?.winRatePct, UTR_PERCENT_OPTIONS) ?? 'N/A']
											]}
										/>
									</MetricCard>
								) : null}
								{hasOpenInterestData ? (
									<MetricCard
										title="Open Interest (as a % of Market Capitalization)"
										onOpen={() => openTotalMarket(openInterest?.criterionKey)}
										gradingScale={scoringConfig?.grading.performance.scale}
										{...summaryFooter(openInterest)}
									>
										<div className="flex flex-1 flex-col gap-3">
											<h4 className="label-md">Top Venues by OI (prev. 30D avg.)</h4>
											<KvTable
												rows={[
													...(openInterest?.venues.map(
														(venue) =>
															[<ExchangeCell key={venue.exchangeId} id={venue.exchangeId} />, usd(venue.avgOiUsd)] as [
																ReactNode,
																ReactNode
															]
													) ?? []),
													['Total (All Exchanges)', usd(openInterest?.totalOiUsd)]
												]}
											/>
										</div>
										<CardDivider />
										<KvTable
											rows={[
												[
													'Open Interest / Market Capitalization',
													formatPercent(openInterest?.oiMcapRatioPct, UTR_PERCENT_OPTIONS) ?? 'N/A'
												]
											]}
										/>
									</MetricCard>
								) : null}
								{hasFundingData ? (
									<MetricCard
										title="Funding Rate"
										onOpen={() => openTotalMarket(funding?.criterionKey)}
										gradingScale={scoringConfig?.grading.performance.scale}
										{...summaryFooter(funding)}
									>
										{funding?.exchanges.length ? (
											<>
												<div className="flex flex-1 flex-col gap-3">
													<ChartCaption>Funding Rate (%)</ChartCaption>
													<SimpleChart
														className="h-[120px] w-full"
														option={buildSeriesOption(
															funding.exchanges.map((exchange, index) => ({
																name: exchangeLabel(exchange.exchangeId),
																type: 'line' as const,
																color: CHART_COLORS[index % CHART_COLORS.length],
																data: exchange.points.map((point) => [toTime(point.date), point.fundingPct ?? 0])
															})),
															axisColor,
															'pct'
														)}
													/>
													<ChartLegend
														items={funding.exchanges.map((exchange, index) => ({
															label: exchangeLabel(exchange.exchangeId),
															color: CHART_COLORS[index % CHART_COLORS.length]
														}))}
													/>
												</div>
												<CardDivider />
											</>
										) : null}
										<KvTable
											rows={[
												[
													'Open Interest-Weighted Funding Rate',
													formatPercent(funding?.oiWeightedFundingPct, PERCENT_FOUR_DECIMALS_OPTIONS) ?? 'N/A'
												]
											]}
										/>
									</MetricCard>
								) : null}
							</div>
						</>
					) : null}

					<MarketMakerPerformance
						metrics={metrics}
						providers={asset.marketMakers ?? []}
						breakdown={asset.performanceBreakdown ?? null}
						uptimeCalculations={asset.uptimeCalculations ?? []}
						criteria={marketMakerCriteria}
						gradingScale={scoringConfig?.grading.performance.scale}
						onOpenCriterion={(criterion) =>
							openCriteria(
								'Performance Overview: Market Makers',
								'performance',
								'market_makers',
								marketMakerCriteria,
								criterion.key
							)
						}
					/>

					{hasLiquidityFootprintData ? (
						<>
							<h2 className="heading-sm">Performance Overview: Liquidity Footprint</h2>
							{tier1Covered != null ? (
								<Panel padding="none">
									<div className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
										<h3 className="label-lg">Top-Tier Exchange Coverage</h3>
										<Button
											type="button"
											size="sm"
											square
											aria-label="Open exchange coverage details"
											onClick={() => openFootprint(tier1Criterion?.key)}
										>
											<Icon name="arrow-right" height={14} width={14} />
										</Button>
									</div>
									<div className="flex flex-col divide-y divide-(--border-subtle) md:flex-row md:items-stretch md:divide-x md:divide-y-0">
										<div className="flex flex-1 flex-col gap-2 px-4 py-2.5 lg:flex-row lg:flex-wrap lg:items-center">
											<span className="label-lg">
												{tier1Covered.length} out of {TIER1_EXCHANGE_IDS.length} (
												{Math.round((tier1Covered.length / TIER1_EXCHANGE_IDS.length) * 100)}%)
											</span>
											<span className="flex flex-wrap items-center gap-2">
												{TIER1_EXCHANGE_IDS.map((exchange) => {
													const covered = tier1Covered.includes(exchange)
													return (
														<StatusBadge
															key={exchange}
															status={covered ? 'full' : 'not-listed'}
															className="gap-1.5 px-2.5 py-1"
															label={
																<>
																	<span className={covered ? 'flex' : 'flex opacity-50 grayscale'}>
																		<TokenLogo name={exchangeIconSlug(exchange)} kind="exchange" size={14} />
																	</span>
																	{exchangeLabel(exchange)}
																	{covered ? <Icon name="check-circle" height={12} width={12} /> : null}
																</>
															}
														/>
													)
												})}
											</span>
										</div>
										<div className="md:flex md:w-1/2 md:shrink-0 md:flex-col md:justify-center">
											<GradeFooter
												score={tier1Criterion?.score ?? null}
												grade={tier1Criterion?.grade}
												gradingScale={scoringConfig?.grading.performance.scale}
												percentile={tier1Criterion?.percentile}
												divider={false}
											/>
										</div>
									</div>
								</Panel>
							) : null}
							<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
								{visibleFootprintCharts.map((entry) => (
									<MetricCard
										title={entry.title}
										key={entry.title}
										onOpen={() => openFootprint(entry.chart?.criterionKey)}
										gradingScale={scoringConfig?.grading.performance.scale}
										{...summaryFooter(entry.chart)}
									>
										{entry.chart?.points.length ? (
											<>
												<ChartCaption>
													{entry.title.includes('Depth') ? '+/- 2% Depth (USD)' : 'Volume (USD)'}
												</ChartCaption>
												<SimpleChart
													option={buildSeriesOption(
														(entry.kind === 'cexdex'
															? [
																	{ name: entry.names[0], key: 'cexUsd' as const },
																	{ name: entry.names[1], key: 'dexUsd' as const }
																]
															: [
																	{ name: entry.names[0], key: 'spotUsd' as const },
																	{ name: entry.names[1], key: 'perpsUsd' as const }
																]
														).map((series, index) => ({
															name: series.name,
															type: 'bar' as const,
															stack: 'total',
															color: entry.colors[index],
															data: entry.chart!.points.map(
																(point) =>
																	[
																		toTime(point.date),
																		(point as Record<string, any>)[series.key] ?? 0
																	] as SimpleSeries['data'][number]
															)
														})),
														axisColor
													)}
												/>
											</>
										) : null}
										<KvTable
											rows={[
												[
													`${entry.names[0]} (avg)`,
													usd(entry.kind === 'cexdex' ? entry.chart?.cexAvgUsd : entry.chart?.spotAvgUsd)
												],
												[
													`${entry.names[1]} (avg)`,
													usd(entry.kind === 'cexdex' ? entry.chart?.dexAvgUsd : entry.chart?.perpsAvgUsd)
												],
												[
													`${entry.names[0]} share`,
													formatPercent(
														entry.kind === 'cexdex' ? entry.chart?.cexSharePct : entry.chart?.spotSharePct,
														UTR_PERCENT_OPTIONS
													) ?? 'N/A'
												]
											]}
										/>
									</MetricCard>
								))}
							</div>
						</>
					) : null}

					{hasTokenomicsData ? (
						<>
							<div className="flex flex-wrap items-center gap-2">
								<h2 className="heading-sm">Performance Overview: Tokenomics</h2>
								{metrics?.undisclosedUnlockDetected ? (
									<StatusBadge status="none" label="Undisclosed unlock detected" className="px-2.5 py-0.5" />
								) : null}
							</div>
							{hasVestingData ? (
								<Panel padding="none">
									<div className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
										<span className="flex flex-wrap items-center gap-2">
											<h3 className="label-lg">Disclosed Token Vesting vs Actual Vesting</h3>
										</span>
										{vestingCriterion ? (
											<Button
												type="button"
												size="sm"
												square
												aria-label="Open vesting details"
												onClick={() =>
													tokenomicsCategory &&
													vestingCriterion &&
													openCriteria(
														'Performance Overview: Tokenomics',
														'performance',
														'tokenomics_p',
														tokenomicsCategory.criteria,
														vestingCriterion.key
													)
												}
											>
												<Icon name="arrow-right" height={14} width={14} />
											</Button>
										) : null}
									</div>
									<div className="flex flex-col lg:flex-row">
										<div className="flex min-w-0 flex-1 flex-col">
											<div className="grid grid-cols-2 gap-px border-b border-subtle bg-(--border-subtle) sm:grid-cols-4">
												{(
													[
														['Disclosed TGE Date', 'N/A'],
														['Disclosed Duration', 'N/A'],
														['Disclosed Total Groups', 'N/A'],
														[
															'Disclosed Max. Supply',
															legacy?.tokenomics.maxSupply == null
																? 'N/A'
																: `${formatCompactNumber(legacy.tokenomics.maxSupply)} ${asset.symbol.toUpperCase()}`
														]
													] as Array<[string, string]>
												).map(([label, value]) => (
													<div key={label} className="flex flex-col gap-2 bg-surface px-4 py-4">
														<span className="body-sm text-tertiary">{label}</span>
														<span className="label-md">{value}</span>
													</div>
												))}
											</div>
										</div>
										<div className="flex flex-col border-t border-subtle lg:w-[460px] lg:shrink-0 lg:border-t-0 lg:border-l">
											<div className="flex flex-1 flex-col gap-2 p-4">
												<p className="body-sm text-tertiary">Commentary versus actual token vesting</p>
												<p className="text-xl leading-relaxed text-tertiary">N/A</p>
												{vestingCriterion ? (
													<Button
														type="button"
														size="md"
														className="mt-auto w-fit"
														onClick={() =>
															tokenomicsCategory &&
															vestingCriterion &&
															openCriteria(
																'Performance Overview: Tokenomics',
																'performance',
																'tokenomics_p',
																tokenomicsCategory.criteria,
																vestingCriterion.key
															)
														}
													>
														Vesting Details
														<Icon name="arrow-right" height={14} width={14} />
													</Button>
												) : null}
											</div>
											<GradeFooter
												score={vestingCriterion?.score ?? null}
												grade={vestingCriterion?.grade}
												gradingScale={scoringConfig?.grading.performance.scale}
												percentile={vestingCriterion?.percentile}
											/>
										</div>
									</div>
								</Panel>
							) : null}
							<div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
								{visibleTokenomicsCards.map((card) => (
									<Panel key={card.title} padding="none">
										<div className="flex items-center justify-between gap-2 px-4 py-3">
											<div className="flex flex-col gap-0.5">
												<h3 className="body-sm text-secondary">{card.title}</h3>
												<span className="label-lg">{card.value}</span>
											</div>
											{card.criterion ? (
												<Button
													type="button"
													size="sm"
													square
													aria-label={`Open ${card.title} details`}
													onClick={() =>
														tokenomicsCategory &&
														card.criterion &&
														openCriteria(
															'Performance Overview: Tokenomics',
															'performance',
															'tokenomics_p',
															tokenomicsCategory.criteria,
															card.criterion.key
														)
													}
												>
													<Icon name="arrow-right" height={14} width={14} />
												</Button>
											) : null}
										</div>
										<GradeFooterStacked
											score={card.criterion?.score ?? null}
											grade={card.criterion?.grade}
											gradingScale={scoringConfig?.grading.performance.scale}
											percentile={card.criterion?.percentile}
										/>
									</Panel>
								))}
							</div>
						</>
					) : null}
				</>
			) : (
				<PreTgePerformance hasFundraising={asset.hasFundraising ?? null} lastRound={asset.lastRound ?? null} />
			)}

			<p className="body-sm text-tertiary">
				Data as of {asset.asOf ? asset.asOf.slice(0, 10) : 'N/A'} · Scoring config v{asset.configVersion} · Rated{' '}
				{asset.ratedCount} of {asset.totalCount} projects
			</p>
			<UtrDisclaimer />

			<AboutDrawer
				asset={asset}
				defillamaDescription={defillamaDescription}
				exchanges={exchanges}
				iconDataUrl={iconDataUrl}
				scoringConfig={scoringConfig}
				open={aboutOpen}
				onClose={() => setAboutOpen(false)}
			/>
			<CriteriaDrawer
				state={criteriaDrawer}
				assetLabel={`${asset.projectName} (${asset.symbol.toUpperCase()})`}
				lastEditedAt={asset.lastEditedAt}
				grading={scoringConfig?.grading}
				onSelect={(key) => setCriteriaDrawer((current) => (current ? { ...current, activeKey: key } : current))}
				onClose={() => setCriteriaDrawer(null)}
			/>
		</div>
	)
}
