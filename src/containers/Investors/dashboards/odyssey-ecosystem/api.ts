import { useQuery } from '@tanstack/react-query'
import { buildAlignedCartesianChartModel, type CartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import { readInvestorApiJson, type ApiDate, type ApiIsoTimestamp, type ApiUnixSeconds } from '../../api.types'

const BASE = '/api/public/odyssey-ecosystem'
const STALE_MS = 10 * 60 * 1000

export function useTab<T>(tab: string) {
	return useQuery<T>({
		queryKey: ['odyssey-ecosystem', tab],
		queryFn: async () => {
			const res = await fetch(`${BASE}/${tab}`)
			if (!res.ok) throw new Error(`Odyssey ${tab} ${res.status}`)
			return readInvestorApiJson<T>(res)
		},
		staleTime: STALE_MS,
		refetchOnWindowFocus: false
	})
}

/* ──────────────────────────── shared types ──────────────────────────── */

export interface FormattedValue {
	value: number
	formatted: string
}

export interface Series {
	name: string
	data: Array<number | null>
	color?: string
	type?: 'line' | 'bar'
	stack?: string
	yAxisIndex?: number
}

export interface ChartData {
	// IR-server chart builders normalize calendar axes to UTC YYYY-MM-DD.
	dates: Array<ApiDate>
	series: Array<Series>
}

/* ──────────────────────────── chart helpers ──────────────────────────── */

/** Build shared-date Odyssey responses directly into the canonical row-major chart model. */
export function chartToModel(c: ChartData | undefined): CartesianChartModel {
	if (!c?.dates) return buildAlignedCartesianChartModel([], [])
	const timestamps = new Array<number>(c.dates.length)
	for (let i = 0; i < c.dates.length; i++) timestamps[i] = Date.parse(`${c.dates[i]}T00:00:00Z`)
	return buildAlignedCartesianChartModel(
		timestamps,
		c.series.map((series) => ({
			name: series.name,
			type: series.type ?? 'line',
			color: series.color ?? '#6366f1',
			stack: series.stack,
			yAxisIndex: series.yAxisIndex,
			values: series.data
		})),
		{ timestampMultiplier: 1 }
	)
}

export function zoomStartPct(dates: Array<string> | undefined, fromDate: string): number {
	if (!dates || dates.length < 2) return 0
	const idx = dates.findIndex((d) => d >= fromDate)
	if (idx <= 0) return 0
	return (idx / (dates.length - 1)) * 100
}

export function defaultZoomOptions(start: number) {
	if (start <= 0) return undefined
	return {
		dataZoom: [
			{ start, end: 100 },
			{ start, end: 100 }
		]
	}
}

/* ──────────────────────────── metadata ──────────────────────────── */

export interface MetadataResponse {
	projectId: number
	projectName: string
	updatedAt: ApiIsoTimestamp
	dataLastUpdated?: ApiIsoTimestamp
	description: string
	protocols: Array<{ id: string; name: string; llamaSlug: string; docs: string }>
	chains: Array<{ name: string; chainId: number }>
	debankBundles: Record<string, string>
	links: Record<string, string>
	faq: Array<{ question: string; answer: string }>
}

/* ──────────────────────────── TVL ──────────────────────────── */

interface MorphoMarket {
	chain: string
	market: string
	supplyUsd: number
	borrowUsd: number
	borrowableUsd: number
	utilizationPct: number
	targetPct: number
	mintNeededUsd: number
	lltvPct: number
	supplyApyPct: number
	borrowApyPct: number
}

interface MorphoVault {
	vault: string
	chain: string
	totalAssetsUsd: number
	idleLiquidityUsd: number
	netApyPct: number
	allocations?: Array<{ market: string; key: string; supplyUsd: number; isIdle?: boolean }>
}

interface PoolRow {
	venue: string
	chain: string
	pool: string
	poolAddress?: string
	feePct?: number
	tvl: string
	tvlUsd?: number
	apy: string
	apySource?: string
	source?: string
}

export interface MorphoMarketHistoryPoint {
	date: ApiDate
	supplyUsd: number
	borrowUsd: number
	utilization: number
}

export interface MorphoMarketHistory {
	marketId: string
	chain: string
	name: string
	source?: string
	series: Array<MorphoMarketHistoryPoint>
}

export interface TvlResponse {
	defaultFrom: string
	ecosystemChart: ChartData
	marketOverlay: ChartData
	protocolByChain: Array<ChartData & { protocol: string }>
	utilization?: {
		kpis: {
			supply: FormattedValue
			borrows: FormattedValue
			avgUtilization: FormattedValue
			idleLiquidity: FormattedValue
		}
		vaults: Array<MorphoVault>
		marketsByChain: Array<{ chain: string; markets: Array<MorphoMarket> }>
	}
	morphoMarketHistory?: {
		title?: string
		subtitle?: string
		markets: Array<MorphoMarketHistory>
	}
	synthLpTvl?: { title?: string; subtitle?: string; pools: Array<PoolRow> }
	metbasis?: { title?: string; subtitle?: string; totalUsd?: number; totalFormatted?: string; pools: Array<PoolRow> }
	kpis: {
		total: FormattedValue & { label?: string }
		metronome: FormattedValue
		vesper: FormattedValue
		odyssey: FormattedValue
		morpho: FormattedValue
	}
}

/* ──────────────────────────── Revenue ──────────────────────────── */

export interface MetronomeClaimed {
	monthLabel: string
	claimedUsd: number
	claimedFormatted: string
	source: string
	hasBreakdown: boolean
	methodology?: Record<string, Record<string, string>>
	items: Array<{
		id: string
		label: string
		chain: string
		detail: string
		amountUsd: number
		amountFormatted: string
	}>
	monthly?: Array<{
		month: string
		grossUsd: number
		profitUsd: number
		tokenHolderUsd: number
		byLabel: Record<string, number>
	}>
}

interface SimpleClaimed {
	windowDays: number
	claimedUsd: number
	claimedFormatted: string
	source: string
}

interface UnclaimedPipeline {
	totalUsd: number
	totalFormatted: string
	asOf: string
	note: string
	pie: Array<{ name: string; value: number }>
	treasuryLps: Array<{
		pool: string
		treasury: string
		stakedLp: string
		rewards: string
		rewardsUsd: number
		value: string
		valueUsd: number
	}>
	ethUniv3: Array<{ position: string; pool: string; rewards: string; usd: number }>
	plasmaUniv3: Array<{ position: string; pool: string; rewards?: string; usd: number }>
	amoPositions: Array<{
		vaultName: string
		asset: string
		chainId: number
		assetsUsd: number
		grossPnlUsd: number
		feeRate: number
		pnlUsd: number
		allTimeHarvestedUsd: number
		lastHarvestDate: ApiDate | null
		lastHarvestUsd: number
	}>
	aeroLocks: Array<{ nft: string; locked: string; rewards: string; usd: number; unlock: ApiDate | null }>
	convex: Array<{ type: string; status: string; usd: number; unlock: ApiDate | null; isClaimable: boolean }>
}

export interface RevenueResponse {
	llamaDailyChart: ChartData
	holderRevenueChart: ChartData
	metronomeClaimed: MetronomeClaimed
	vesperClaimed: SimpleClaimed
	odysseyClaimed: SimpleClaimed
	unclaimedPipeline: UnclaimedPipeline
	synthInterestDetail: Array<{
		asset: string
		annualRatePct: number
		totalDebtUsd: number
		estimatedDailyUsd: number
		estimatedMonthlyUsd: number
		byChain: Array<{ chain: string; amount_synth: number; amount_usd: number; ratePct?: number }>
	}>
	holdersByMonth?: {
		metronome: Array<{ month: string; totalUsd: number }>
		vesper: Array<{ month: string; totalUsd: number }>
	}
	kpis: {
		revenueAllTime: {
			ecosystem: FormattedValue
			metronome: FormattedValue & { claimed: number; unclaimed: number }
			vesper: FormattedValue
			odyssey: FormattedValue
		}
		claimed30d: { metronome: FormattedValue; vesper: FormattedValue; odyssey: FormattedValue }
		unclaimedPipeline: FormattedValue
		holdersAllTime: { metronome: FormattedValue; vesper: FormattedValue }
	}
}

/* ──────────────────────────── Incentives ──────────────────────────── */

export interface EpochRow {
	pool: string
	period: string
	emissions?: string
	incentiveSpend?: string
	incentiveSpendUsd?: number
	latestCycle?: string
	currentEpochUsd?: number
	monthSoFarUsd?: number
	previousMonthUsd?: number
}

export interface SpendWindowRow {
	period: string
	spend: string
}

export interface NonSpendIncentives {
	title?: string
	subtitle?: string
	feesRolledIntoIncentives?: {
		title?: string
		subtitle?: string
		totalUsd?: number
		totalFormatted?: string
		rows: Array<{
			venue: string
			pool: string
			bribesUsd: number
			emissionsUsd: number
			feesRolledInUsd: number
			multiplier?: number
		}>
	}
	govTokenPower?: {
		title?: string
		subtitle?: string
		vlCvxLockedUsd?: number
		veAeroLockedUsd?: number
		totalUsd?: number
		totalFormatted?: string
	}
	thirdPartySponsorship?: {
		note?: string
		knownSponsors: Array<{
			sponsor: string
			pool: string
			venue: string
			chain: string
			token?: string
			amountUsd: number | null
			source?: string
		}>
	}
}

export interface IncentivesResponse {
	weeklyHistoryChart: ChartData
	weeklyPoolCharts: Record<string, ChartData>
	epochTables: {
		aerodrome: Array<EpochRow>
		velodrome: Array<EpochRow>
		votemarket: Array<EpochRow>
		merkl: Array<SpendWindowRow>
		lithos: Array<SpendWindowRow>
	}
	gauges: {
		aerodrome: Array<{ pool: string; tvl: string; apy: string }>
		velodrome: Array<{ pool: string; tvl: string; apy: string }>
		lithos: Array<{ pool: string; tvl: string; apy: string }>
	}
	curvePools: Array<{ pool: string; apy: string; balances: string; tvlUsd: string }>
	nonSpendIncentives?: NonSpendIncentives
	kpis: {
		thirtyDayTotal: FormattedValue
		allTimeTotal: FormattedValue
		thirtyDayByVenue: Array<{ venue: string; id: string; chain: string; amountUsd: number; amountFormatted: string }>
		feesRolledIntoIncentives?: FormattedValue
		govTokenPowerUsd?: FormattedValue
	}
}

/* ──────────────────────────── Yields (slimmed) ──────────────────────────── */

export interface VesperPool {
	pool: string
	chain: string
	asset: string
	tvl: string
	netApyPct: number
}

export interface LpApyPool {
	pool: string
	venue: string
	latestApy: number
}

export interface YieldsResponse {
	odysseyApy: { rows: Array<{ chain: string; strategies: number; netApyPct: number; maxApyPct?: number }> }
	looperApy: {
		rows: Array<{
			name: string
			chain: string
			collateral: string
			borrow: string
			collateralApyPct: number
			borrowApyPct: number
			netApyPct: number
			maxApyPct?: number
			underlyingApyPct?: number
		}>
	}
	vesperApy: { pools: Array<VesperPool> }
	lpApyHistory: Record<string, { venue: string; pools: Array<LpApyPool> }>
	lpPools: { rows: Array<{ venue: string; chain: string; pool: string; tvl: string; apy: string; apyPct: number }> }
	kpis: {
		topLooperApy: (FormattedValue & { label?: string }) | null
		topOdysseyApy: (FormattedValue & { label?: string }) | null
		topVesperApy: FormattedValue & { label?: string }
		odysseyStrategyCount: FormattedValue
	}
}

/* ──────────────────────────── Treasury ──────────────────────────── */

export interface TreasuryResponse {
	treasuryLps: {
		totalFormatted: string
		unclaimedRewardsFormatted: string
		rows: Array<{
			pool: string
			treasury?: string
			stakedLp: string
			rewards: string
			rewardsUsd: number
			value: string
			valueUsd: number
		}>
	}
	ethUniv3?: {
		totalFormatted?: string
		rows: Array<{ pool: string; rewards: string; usd: number }>
	}
	plasmaUniv3: {
		totalFormatted: string
		rows: Array<{ pool: string; position?: string; rewards?: string; usd: number }>
	}
	vlCvx: { rows: Array<{ type: string; status: string; balance: string; unlock: string }> }
	veAero: { rows: Array<{ nft: string; locked: string; rewards: string; unlock: string }> }
	govLocks?: {
		title?: string
		subtitle?: string
		rows: Array<{
			token: string
			lockedTokens: number | string
			supply: number | string
			nftCount: number
			avgLockYears: number
			avgRemainingYears: number
		}>
	}
	metronomeAllocation: {
		title?: string
		subtitle?: string
		rows: Array<{ bucket: string; share: string; value: string }>
	}
	vesperAllocation: {
		title?: string
		subtitle?: string
		rows: Array<{ bucket: string; share: string; value: string }>
	}
}

/* ──────────────────────────── Growth ──────────────────────────── */

export interface LooprDailyRow {
	day: string
	new_positions: number
	new_users: number
	cumulative_positions: number
	cumulative_users: number
	active_positions: number
	active_users: number
}

export interface LooprStrategy {
	strategyId: string
	asset: string
	users: number
	totalDepositedUsd: number
	totalDepositedFormatted: string
	performanceFeePct: number | null
	chains: Record<string, { users: number; usd: number }>
}

interface TokenPriceBlock {
	history: Array<{ price: number; timestamp: ApiUnixSeconds }>
}

export interface GrowthResponse {
	loopr: {
		chains: Record<string, Array<LooprDailyRow>>
		total: Array<LooprDailyRow>
		byStrategy: Array<LooprStrategy>
	}
	tokenPrices: { MET: TokenPriceBlock; VSP: TokenPriceBlock }
	marketComparison: {
		combined: ChartData & { name: string }
		protocols: Record<string, ChartData & { name: string }>
	}
	depositsByChain: ChartData
	caseStudies: {
		title?: string
		morphoMarkets: Array<ChartData & { id: string; label: string; title: string }>
		spendVsTvl: Array<ChartData & { venue: string; title: string; latestTvl: number }>
		morphoMarket: ChartData
		kpis: {
			morphoUtilization: number
		}
	}
	kpis: {
		activeAccounts: FormattedValue
		activePositions: FormattedValue
		totalUsers: FormattedValue
		morphoUtilization: FormattedValue
	}
}

/* ──────────────────────────── Pegs (new) ──────────────────────────── */

export interface PegDepthRow {
	sizeUsd: number
	effectivePriceUsd: number
	pegRatio: number
	slippagePct: number
	ok: boolean
}

export interface PegRow {
	synth: 'msUSD' | 'msETH'
	chain: string
	synthAddr: string
	counter: string
	spotPrice: number
	expectedPrice: number
	pegRatio: number
	depth: Array<PegDepthRow>
	kyberSupported: boolean
}

export interface PegSupplyCap {
	chain: string
	synth: string
	supply: number
	maxSupply: number
	usagePct: number
}

export interface PegsResponse {
	asOf: string
	methodology: string
	kpis: Record<
		'msUSD' | 'msETH',
		{
			spotPegRatio: number
			spotDeviationBps: number
			worstChain: string
			worstSizeUsd: number
			worstPegRatio: number
			worstDeviationBps: number
		}
	>
	rows: Array<PegRow>
	supplyCaps: Array<PegSupplyCap>
	bridgeInCaps?: Array<PegSupplyCap & { capType?: string }>
	bridgeOutCaps?: Array<PegSupplyCap & { capType?: string }>
}
