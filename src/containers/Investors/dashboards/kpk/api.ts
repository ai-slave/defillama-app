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
	series: number[]
	/**
	 * This band's assets are also counted inside another band of the same
	 * breakdown. `line` nets it out; the table marks it.
	 */
	duplicate?: boolean
}

export interface KpkCompositionLine {
	name: string
	note: string
	value: number
	series: number[]
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
	months: string[]
	segments: KpkCompositionSegment[]
	line?: KpkCompositionLine
}

/* ──────────────────────────── metadata ──────────────────────────── */

export type KpkLinkKey = 'website' | 'docs' | 'app' | 'x'

export interface KpkMetadata {
	projectId: number
	projectName: string
	tagline: string
	asOf: ApiDate
	updatedAt: ApiIsoTimestamp
	notes: string[]
	links: Partial<Record<KpkLinkKey, string>>
}

export const useKpkMetadata = () => useTab<KpkMetadata>('metadata')

/* ──────────────────────────── overview ──────────────────────────── */

/**
 * A ledger tile. `value` and `metric` are `null` where the query behind them
 * failed, and the tile reads `—` rather than dropping out of the strip. A metric
 * with no query behind it at all — the transaction count — is a brief-stated
 * fact and is always a string.
 */
export interface KpkLedgerFact {
	value: string | null
	suffix?: string
	sub: string
	metric?: string | null
	metricLabel?: string
}

export type KpkOverviewAsOf = {
	mandates: ApiDate | null
	vaults: ApiDate | null
}

export type KpkOverviewCompKey = 'line' | 'denom' | 'chain' | 'protocol'

export interface KpkOverview {
	asOf: KpkOverviewAsOf
	tva: number
	tvaAdjusted: number | null
	tvaAdjustedLabel: string | null
	doubleCountNote: string | null
	deployedOnchain: KpkLedgerFact
	rebalancing: KpkLedgerFact
	fundsLost: { value: number; since: number; years: number[] }
	comp: Record<KpkOverviewCompKey, KpkComposition>
	refs: KpkRef[]
}

export const useKpkOverview = () => useTab<KpkOverview>('overview')

/* ──────────────────────────── treasury mandates ──────────────────────────── */

/** One denomination sleeve of a mandate: its share of the client's AUM and its alpha. */
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
	/** Annual excess return, $m. */
	excess: number | null
	yieldAum: number | null
	defiUsd: number | null
	opsUsd: number | null
	coveragePct: number | null
}

export interface KpkMandateWindow {
	label: string
	apy: number | null
	bench: number | null
	spread: number | null
	spreadBps: number | null
	excessAnnualUsd: number
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
	/** Annual excess return at the 30-day spread, $m. */
	excess: number
	windows: KpkMandateWindow[]
	scope: KpkMandateScope
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
	buckets: KpkOpsBucket[]
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
	/** Empty when the positions report is unavailable, which hides the performance section. */
	denominations: string[]
	comp: Record<string, KpkComposition>
	perf: Record<string, KpkMandatePerf>
	ops: KpkMandateOps | null
	clients: KpkMandateClient[]
	totals: { aum: number; weightedDeployedPct: number | null; excess: number | null }
	refs: KpkRef[]
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
	apyHistory?: number[]
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
	venues: string[]
	rebalancingVolume: string
	rebalancingVolumeUsd: number
	rebalancingActions: number
	rebalancingActionsLabel: string
	/** TVA-weighted, over the vaults that report it. Absent when none do. */
	liquidityPct?: number
	liquidityTarget: number
	comp: Partial<Record<KpkVaultCompKey, KpkComposition>>
	/** Last day sampled by the composition chart, `YYYY-MM-DD`. */
	compAsOf: ApiDate
	compTotal: number
	list: KpkVault[]
	doubleCountNote?: string
	totals: { tva: number; interest: number; tvaAdjusted?: number; interestAdjusted?: number }
	riskDisclaimer: string
	refs: KpkRef[]
}

export const useKpkVaults = () => useTab<KpkVaults>('vaults')
