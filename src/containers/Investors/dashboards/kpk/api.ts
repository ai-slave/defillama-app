import { useQuery } from '@tanstack/react-query'
import { readInvestorApiJson, type ApiDate, type ApiIsoTimestamp } from '../../api.types'

/**
 * Wire contract for the ir-server `kpk` adapter (projectId 8), proxied through
 * `/api/public/kpk/<tab>`. Four independent fetchFns, one query each.
 *
 * Every monetary field is in **$m** unless its name ends in `Usd` or it arrives
 * pre-formatted as a string. `transform.ts` does the conversion once.
 */

const BASE = '/api/public/kpk'
const STALE_MS = 10 * 60 * 1000

function useTab<T>(tab: string) {
	return useQuery<T>({
		queryKey: ['kpk', tab],
		queryFn: async () => {
			const res = await fetch(`${BASE}/${tab}`)
			if (!res.ok) throw new Error(`KPK ${tab} ${res.status}`)
			return readInvestorApiJson<T>(res)
		},
		staleTime: STALE_MS,
		refetchOnWindowFocus: false
	})
}

/* ──────────────────────────── shared ──────────────────────────── */

export interface KpkRef {
	label: string
	url: string
}

export interface KpkCompositionSegment {
	name: string
	/** Latest value, $m. */
	value: number
	/** Percent of the breakdown total. */
	share: number
	/** One point per entry in `months`, $m. */
	series: Array<number>
	/**
	 * This band's assets are also counted inside another band of the same
	 * breakdown. `line` nets it out; the table marks it.
	 */
	duplicate?: boolean
	/** Why this band is a duplicate, stated per band rather than per breakdown. */
	note?: string
}

export interface KpkCompositionLine {
	name: string
	note: string
	value: number
	series: Array<number>
}

export interface KpkCompositionGap {
	from: ApiDate
	to: ApiDate
	days: number
}

export interface KpkCompositionWindow {
	from: ApiDate
	to: ApiDate
	/** Measured days in the range. */
	days: number
	/** Points plotted — `max` is thinned, the shorter ranges are not. */
	points: number
	gaps: Array<KpkCompositionGap>
	missingDays: number
}

/** The stacked-area payload every breakdown on every tab uses. */
export interface KpkComposition {
	title: string
	/** $m */
	total: number
	/**
	 * Period labels — `"Sept 25"` on the monthly breakdowns, `"3 Oct 25"` on the
	 * daily ones. Not dates; the chart plots them as categories.
	 */
	months: Array<string>
	segments: Array<KpkCompositionSegment>
	line?: KpkCompositionLine
	window?: KpkCompositionWindow
}

export const KPK_RANGES = ['1m', '3m', 'ytd', 'max'] as const

export type KpkRangeKey = (typeof KPK_RANGES)[number]

export interface KpkRangedComposition {
	title: string
	ranges: Partial<Record<KpkRangeKey, KpkComposition>>
}

/* ──────────────────────────── metadata ──────────────────────────── */

export type KpkLinkKey = 'website' | 'docs' | 'app' | 'x' | 'github'

export interface KpkMetadata {
	projectId: number
	projectName: string
	tagline: string
	asOf: ApiDate
	updatedAt: ApiIsoTimestamp
	notes: Array<string>
	links: Partial<Record<KpkLinkKey, string>>
}

export const useKpkMetadata = () => useTab<KpkMetadata>('metadata')

/* ──────────────────────────── overview ──────────────────────────── */

/**
 * A ledger tile. `value` and `metric` are `null` where the query behind them
 * failed, and the tile reads `—` rather than dropping out of the strip. A metric
 * the brief states outright rather than computing — the transaction count — never
 * fails, so it is always a string; `metricRef` still points at the query it came from.
 */
export interface KpkLedgerFact {
	value: string | null
	suffix?: string
	sub: string
	metric?: string | null
	metricLabel?: string
	ref?: KpkRef
	/** The query behind `metric`, where it has one. */
	metricRef?: KpkRef
}

export type KpkOverviewAsOf = {
	mandates: ApiDate | null
	vaults: ApiDate | null
}

export type KpkOverviewCompKey = 'line' | 'denom' | 'chain' | 'protocol'

export interface KpkOverviewBooks {
	mandates: number
	vaults: number
}

export interface KpkOverview {
	asOf: KpkOverviewAsOf
	tva: number
	tvaAdjusted: number | null
	tvaAdjustedLabel: string | null
	doubleCountNote: string | null
	books?: KpkOverviewBooks
	deployedOnchain: KpkLedgerFact
	rebalancing: KpkLedgerFact
	fundsLost: { value: number; since: number; years: Array<number> }
	comp: Record<KpkOverviewCompKey, KpkRangedComposition>
	refs: Array<KpkRef>
}

export const useKpkOverview = () => useTab<KpkOverview>('overview')

/* ──────────────────────────── treasury mandates ──────────────────────────── */

/**
 * One denomination sleeve of a mandate: its share of the client's AUM today, and
 * the alpha that denomination actually earned over the trailing 30 days.
 */
export interface KpkMandateSleeve {
	/** Percent of the client's AUM in this denomination. */
	mix: number
	/** Alpha over benchmark in bps, or null where no benchmark resolved. */
	alpha: number | null
}

export interface KpkMandateClient {
	name: string
	aum: number | null
	share: number | null
	deployedPct: number | null
	usd: KpkMandateSleeve | null
	eth: KpkMandateSleeve | null
	since: string | null
	url?: string
	/** AUM-weighted alpha across both sleeves, bps. */
	alphaBps: number | null
	/** Excess return earned above benchmark over the trailing year, $m. */
	excess: number | null
	excessRunRate: number | null
	excessAvgBalance: number | null
	yieldAum: number | null
	defiUsd: number | null
	opsUsd: number | null
	deployedUsd: number | null
	idleUsd: number | null
	coveragePct: number | null
}

export interface KpkMandateSpotRate {
	apy: number | null
	bench: number | null
	spread: number | null
	spreadBps: number | null
}

export interface KpkMandateWindow {
	label: string
	/** Window length in days, the key the realized rates are matched on. */
	days: number
	apy: number | null
	bench: number | null
	spread: number | null
	spreadBps: number | null
	excessAnnualUsd: number
	/**
	 * The rate is money-weighted over leg-days — the same accrual that produces the
	 * earned dollars — rather than a trailing mean applied to today's balances.
	 * False where the legs store could not serve the window and the spot rate stands.
	 */
	realized?: boolean
	/** Mean balance the realized rate was earned on, $m. */
	avgBalance?: number
	spot?: KpkMandateSpotRate
}

export interface KpkMandateScope {
	defiUsd: number
	unresolvedUsd: number
	coveragePct: number
	opsUsd: number
	opsBuckets: Array<{ name: string; usd: number }>
}

export interface KpkMandatePerf {
	denom: string
	usd: number
	bench: number | null
	benchLabel: string
	/** Excess return earned above benchmark over the trailing year, $m. */
	excess: number | null
	/** The annualised run-rate at the 30-day spread, $m. */
	excessRunRate?: number
	/** $m this denomination earned over the window, gross of the benchmark. */
	earned?: number | null
	/** $m the same balances would have earned at benchmark. */
	benchEarned?: number | null
	/** Mean balance over the window, $m. */
	avgBalance?: number | null
	windows: Array<KpkMandateWindow>
	scope: KpkMandateScope
}

/** A position priced by a stand-in series, or by two stacked ones, and declared. */
export interface KpkExcessSubstitution {
	name: string
	label: string
	/** Mean daily balance it covers, $m. */
	usd: number
}

export interface KpkExcessUnpriced {
	name: string
	/** Mean daily balance excluded from both sides of the spread, $m. */
	usd: number
	days: number
	reason: string
}

/** How the trailing-year earned figure was measured, and what it leaves out. */
export interface KpkExcessWindow {
	from: ApiDate
	to: ApiDate
	days: number
	/** Days the legs store actually holds a snapshot for. */
	snapshotDays: number
	/** Days carried forward from the previous snapshot, up to 7. */
	carriedDays: number
	/** Days that accrued nothing at all. */
	missingDays: number
	/** Priced balance-days over scoped balance-days. */
	coveragePct: number
	/** $m earned above benchmark. */
	excess: number
	/** $m earned, gross. */
	earned: number
	/** $m the same balances would have earned at benchmark. */
	benchEarned: number
	/** Mean daily balance, $m. */
	avgBalance: number
	fallback: Array<KpkExcessSubstitution>
	stacked: Array<KpkExcessSubstitution>
	unpriced: Array<KpkExcessUnpriced>
}

/** One day's accrual. The 365 of them sum to `totals.excess`. */
export interface KpkExcessDay {
	date: ApiDate
	/** Dollars and cents, not $m — a single day's accrual is small. */
	excess: number
	/** Balance it accrued on, $m. */
	usd: number
}

export interface KpkOpsBucket {
	name: string
	/** $m */
	usd: number
	positions: number
}

export interface KpkMandateOps {
	/** $m */
	usd: number
	pctOfTvl: number
	/** $m */
	defiUsd: number
	buckets: Array<KpkOpsBucket>
	coveragePct: number
	/** $m */
	unresolvedUsd: number
	unbenchmarked: { usd: number; denoms: Array<{ name: string; usd: number }> }
}

export interface KpkDydxChain {
	stakedDydx: number
	months: number
	usd: number
}

export interface KpkInactiveMandates {
	count: number
	names: Array<string>
	/** Their share of the earned excess, $m. */
	excess: number | null
}

export interface KpkMandates {
	asOf: ApiDate | null
	yieldAsOf: ApiDate | null
	yieldIsSample: boolean | null
	dydxChain: KpkDydxChain | null
	/** $m */
	aum: number
	clientCount: number
	/** Pre-formatted cumulative deployment, e.g. `"$8.03bn"`. Absent on a Dune outage. */
	deployedOnchain?: string
	deployedOnchainUsd?: number
	deployedOnchainTxns?: number
	/** Pre-formatted transaction count behind the deployment, e.g. `"10,382"`. */
	deployedOnchainTxnsLabel?: string
	/** The query behind the transaction count. */
	deployedOnchainTxnsRef?: KpkRef
	/** The query behind the deployment figure. */
	deploymentRef?: KpkRef
	/** Empty when the positions report is unavailable, which hides the performance section. */
	denominations: Array<string>
	comp: Record<string, KpkRangedComposition>
	perf: Record<string, KpkMandatePerf>
	/** Null where the legs store is unreadable, which drops the earned figure's caption. */
	excessWindow: KpkExcessWindow | null
	/** The audit trail for the headline. Null alongside `excessWindow`. */
	excessDaily: Array<KpkExcessDay> | null
	ops: KpkMandateOps | null
	/** Only the mandates holding a balance on one of the two sources. */
	clients: Array<KpkMandateClient>
	inactive: KpkInactiveMandates | null
	totals: {
		aum: number
		weightedDeployedPct: number | null
		/** Earned above benchmark over the trailing year, $m. */
		excess: number | null
		/** The annualised run-rate it replaced, $m. */
		excessRunRate?: number | null
	}
	refs: Array<KpkRef>
}

export const useKpkMandates = () => useTab<KpkMandates>('mandates')

/* ──────────────────────────── vaults ──────────────────────────── */

export interface KpkVault {
	name: string
	venue: string
	chain: string
	asset: string
	/** $m */
	tva: number
	/** $m */
	interest: number
	liqTarget: number
	apy?: number
	apy30?: number
	exposure?: string
	/**
	 * A count, the literal `"NA"` for venues with no rebalancing agent to count,
	 * or absent where there is no source. The three are rendered differently.
	 */
	rebalances30d?: number | 'NA'
	/**
	 * All-time count of agent-executed derisking rebalances. Absent for the venues
	 * with no agent-attributed event source, which is not the same as zero.
	 */
	deriskingAutomations?: number
	liq?: number
	bench?: number
	benchName?: string
	apyHistory?: Array<number>
	url?: string
	spreadBps: number | null
	belowTarget: boolean
	/** This vault's TVA is also counted inside another vault on the same table. */
	doubleCounted?: boolean
}

export type KpkVaultCompKey = 'venue' | 'chain' | 'asset' | 'collateral'

export interface KpkVaults {
	/** $m */
	tva: number
	/** $m, net of every `doubleCounted` vault. Absent where nothing is netted out. */
	tvaAdjusted?: number
	count: number
	venues: Array<string>
	rebalancingVolume: string
	rebalancingVolumeUsd: number
	rebalancingActions: number
	rebalancingActionsLabel: string
	/** The query behind the rebalancing figures. */
	rebalancingRef?: KpkRef
	/** TVA-weighted, over the vaults that report it. Absent when none do. */
	liquidityPct?: number
	liquidityTarget: number
	comp: Partial<Record<KpkVaultCompKey, KpkRangedComposition>>
	/** Last day sampled by the composition chart, `YYYY-MM-DD`. */
	compAsOf: ApiDate
	compTotal: number
	list: Array<KpkVault>
	doubleCountNote?: string
	totals: { tva: number; interest: number; tvaAdjusted?: number; interestAdjusted?: number }
	riskDisclaimer: string
	refs: Array<KpkRef>
}

export const useKpkVaults = () => useTab<KpkVaults>('vaults')
