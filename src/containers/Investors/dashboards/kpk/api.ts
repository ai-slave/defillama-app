import { useQuery } from '@tanstack/react-query'
import { readInvestorApiJson, type ApiDate, type ApiIsoTimestamp } from '../../api.types'

/**
 * Wire contract for the ir-server `kpk` adapter (projectId 8), proxied through
 * `/api/public/kpk/<tab>`. Four independent fetchFns, one query each.
 *
 * Every monetary field is in **$m** unless its name ends in `Usd` or it arrives
 * pre-formatted as a string. `transform.ts` does the conversion once.
 *
 * `overview` and `mandates` are still partly placeholder upstream and ship a
 * `notice` string describing exactly which figures are not sourced yet; the tab
 * renders it as a banner. When a tab goes live the field disappears — hence the
 * optional type, not a flag we maintain here.
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
}

/** The stacked-area payload every breakdown on every tab uses. */
export interface KpkComposition {
	title: string
	/** $m */
	total: number
	/** Month labels, e.g. `"Sept 25"` — not dates; the chart plots them as categories. */
	months: string[]
	segments: KpkCompositionSegment[]
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

/** A ledger tile whose headline is a brief-stated fact rather than a measured number. */
export interface KpkLedgerFact {
	value: string
	suffix?: string
	sub: string
	metric?: string
	metricLabel?: string
}

export type KpkOverviewCompKey = 'line' | 'denom' | 'chain' | 'protocol'

export interface KpkOverview {
	notice?: string
	/** $m */
	tva: number
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
	/** Alpha over benchmark in bps, or null where the sleeve is empty. */
	alpha: number | null
}

export interface KpkMandateClient {
	name: string
	/** $m */
	aum: number
	deployedPct: number
	usd: KpkMandateSleeve
	eth: KpkMandateSleeve
	since: string
	url?: string
	share: number
	/** AUM-weighted alpha across both sleeves, bps. */
	alphaBps: number
	/** Annual excess return, $m. */
	excess: number
}

export interface KpkMandatePerf {
	bench: number
	benchLabel: string
	/** Annual excess return for this denomination, $m. */
	excess: number
	windows: Array<{ label: string; apy: number; spread: number; spreadBps: number }>
}

export interface KpkMandates {
	notice?: string
	/** $m */
	aum: number
	clientCount: number
	/** Pre-formatted cumulative deployment, e.g. `"$8.03bn"`. Absent on a Dune outage. */
	deployedOnchain?: string
	deployedOnchainUsd?: number
	denominations: string[]
	comp: Record<string, KpkComposition>
	perf: Record<string, KpkMandatePerf>
	clients: KpkMandateClient[]
	totals: { aum: number; weightedDeployedPct: number; excess: number }
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
	liq?: number
	bench?: number
	benchName?: string
	apyHistory?: number[]
	url?: string
	spreadBps: number | null
	belowTarget: boolean
	health: 'ok' | 'watch' | 'unknown'
}

export type KpkVaultCompKey = 'venue' | 'chain' | 'asset'

export interface KpkVaults {
	/** $m */
	tva: number
	count: number
	venues: string[]
	rebalancingVolume: string
	rebalancingVolumeUsd: number
	rebalancingActions: number
	rebalancingActionsLabel: string
	/** TVA-weighted, over the vaults that report it. Absent when none do. */
	liquidityPct?: number
	liquidityTarget: number
	comp: Record<KpkVaultCompKey, KpkComposition>
	/** Last day sampled by the composition chart, `YYYY-MM-DD`. */
	compAsOf: ApiDate
	compTotal: number
	list: KpkVault[]
	totals: { tva: number; interest: number }
	riskDisclaimer: string
	refs: KpkRef[]
}

export const useKpkVaults = () => useTab<KpkVaults>('vaults')
