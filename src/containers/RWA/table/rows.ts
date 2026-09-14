import type { IRWAAssetFlowSummary, IRWAFlowSummaryResponse, RWAFlowWindow, RWAOverviewDisplayRow } from '../api.types'
import {
	getRwaDisplayedDefiActiveTvl,
	getRwaDisplayedDefiActiveTvlByChain,
	getRwaDisplayedDefiActiveTvlByProtocol
} from '../filterState'
import { getChainShares, type RWAChainShare } from './chains'
import {
	RWA_CHANGE_PERIODS,
	RWA_DEFAULT_CHANGE_PERIOD,
	type RWAChangePeriod,
	type RWAValueWithPrior,
	toValueWithPrior
} from './change'

export type RWAChange = {
	activeMcap: RWAValueWithPrior
	onChainMcap: RWAValueWithPrior
	defiActiveTvl: RWAValueWithPrior
}
export type RWAChanges = Record<RWAChangePeriod, RWAChange>

export type RWATableMetrics = {
	activeMcap: number | null
	onChainMcap: number | null
	defiActiveTvl: number | null
	/** Per period, summed over the rows that have both a current value and a prior. */
	change: RWAChanges
	netFlow7d: number | null
	netFlow30d: number | null
	price: number | null
	/** Perps: mark price move over 24h, in percent. */
	priceChange24h: number | null
	openInterest: number | null
	/** Perps: open interest now and 24h ago. */
	openInterestChange24h: RWAValueWithPrior
	volume24h: number | null
	volume7d: number | null
	volume30d: number | null
	/** Perps: funding annualised from the venue interval, in percent. */
	fundingApr: number | null
	/** Perps: the raw rate per interval and the interval, for the tooltip. */
	fundingRate: number | null
	fundingIntervalHours: number | null
	/** Perps: mark over index minus one, in percent. */
	premium: number | null
	maxLeverage: number | null
	protocolFees24h: number | null
	chains: Array<RWAChainShare>
	assetCount: number
	issuerCount: number
	chainCount: number
}

export type RWALeafBreakdowns = {
	activeMcap: Array<[string, number]> | null
	onChainMcap: Array<[string, number]> | null
	/** By protocol; null when it cannot be split. */
	defiActiveTvl: Array<[string, number]> | null
	defiActiveTvlByChain: Array<[string, number]>
}

export type RWALeafFlows = Partial<Record<RWAFlowWindow, IRWAAssetFlowSummary>>

export type RWALeafRow = {
	kind: 'leaf'
	id: string
	asset: RWAOverviewDisplayRow
	/** The chain this row is sliced to, under Group by Chain. */
	chainScope: string | null
	/** The period the change columns read. It lives on the row so a period switch builds new rows, which resets the table's cell cache. */
	period: RWAChangePeriod
	metrics: RWATableMetrics
	breakdowns: RWALeafBreakdowns
	flows: RWALeafFlows
}

export type RWAGroupIcon = { kind: 'chain'; name: string } | { kind: 'src'; src: string } | null

/** Text columns a group row lists for its children. */
export const RWA_GROUP_DISTINCT_KEYS = [
	'assetGroup',
	'venueType',
	'platform',
	'category',
	'assetClass',
	'accessModel',
	'type',
	'rwaClassification',
	'issuer'
] as const
export type RWAGroupDistinctKey = (typeof RWA_GROUP_DISTINCT_KEYS)[number]
export type RWAGroupDistinct = Record<RWAGroupDistinctKey, Array<string>>

export const RWA_FLAG_KEYS = [
	'redeemable',
	'attestations',
	'cexListed',
	'kycForMintRedeem',
	'kycAllowlistedWhitelistedToTransferHold',
	'transferable',
	'selfCustody'
] as const
export type RWAFlagKey = (typeof RWA_FLAG_KEYS)[number]
/** Yes count over the children that have an answer. */
export type RWAFlagTally = { yes: number; known: number }
export type RWAGroupFlags = Record<RWAFlagKey, RWAFlagTally>

export type RWAGroupRow = {
	kind: 'group'
	id: string
	label: string
	href: string | null
	icon: RWAGroupIcon
	period: RWAChangePeriod
	metrics: RWATableMetrics
	distinct: RWAGroupDistinct
	flags: RWAGroupFlags
	children: Array<RWALeafRow>
}

/** A perps market without categories reads RWA Perp. */
export function getRwaCategoryLabels(asset: RWAOverviewDisplayRow): Array<string> {
	if (asset.category && asset.category.length > 0) return asset.category
	return asset.kind === 'perps' ? ['RWA Perp'] : []
}

export type RWATableRow = RWALeafRow | RWAGroupRow

export type RWALeafRowOptions = {
	flowSummary?: IRWAFlowSummaryResponse | undefined
	includeBridgeTvl: boolean
	/** The period the change columns read; the table's default when a caller has no period switch. */
	period?: RWAChangePeriod
}

export function emptyRwaTableMetrics(): RWATableMetrics {
	return {
		activeMcap: null,
		onChainMcap: null,
		defiActiveTvl: null,
		change: emptyRwaChanges(),
		netFlow7d: null,
		netFlow30d: null,
		price: null,
		priceChange24h: null,
		openInterest: null,
		openInterestChange24h: { current: null, prior: null },
		volume24h: null,
		volume7d: null,
		volume30d: null,
		fundingApr: null,
		fundingRate: null,
		fundingIntervalHours: null,
		premium: null,
		maxLeverage: null,
		protocolFees24h: null,
		chains: [],
		assetCount: 0,
		issuerCount: 0,
		chainCount: 0
	}
}

export function emptyRwaChange(): RWAChange {
	const none = { current: null, prior: null }
	return { activeMcap: none, onChainMcap: none, defiActiveTvl: none }
}

export function emptyRwaChanges(): RWAChanges {
	return { '1d': emptyRwaChange(), '7d': emptyRwaChange(), '1m': emptyRwaChange() }
}

export function buildRwaLeafRows(assets: Array<RWAOverviewDisplayRow>, options: RWALeafRowOptions): Array<RWALeafRow> {
	const period = options.period ?? RWA_DEFAULT_CHANGE_PERIOD
	return assets.map((asset) =>
		asset.kind === 'spot' ? buildSpotLeafRow(asset, options, period) : buildPerpsLeafRow(asset, period)
	)
}

export function getRwaTableSubRows(row: RWATableRow): Array<RWALeafRow> | undefined {
	return row.kind === 'group' ? row.children : undefined
}

function buildSpotLeafRow(
	asset: Extract<RWAOverviewDisplayRow, { kind: 'spot' }>,
	options: RWALeafRowOptions,
	period: RWAChangePeriod
): RWALeafRow {
	const flows = getAssetFlows(asset.canonicalMarketId, options.flowSummary)
	const chains = getChainShares(asset.onChainMcap?.breakdown)
	const activeMcap = asset.activeMcap?.total ?? null
	const onChainMcap = asset.onChainMcap?.total ?? null
	// No DeFi data is unknown, not zero; the old helper reads a missing value as 0.
	const defiActiveTvl =
		asset.defiActiveTvl == null ? null : getRwaDisplayedDefiActiveTvl(asset, options.includeBridgeTvl)
	const change = {} as RWAChanges
	for (const changePeriod of RWA_CHANGE_PERIODS) {
		const prior = asset.priors?.[changePeriod]
		const defiPrior = prior?.defiActiveTvl ?? null
		const bridgePrior = options.includeBridgeTvl ? 0 : (prior?.bridgeTvl ?? 0)
		change[changePeriod] = {
			activeMcap: toValueWithPrior(activeMcap, prior?.activeMcap),
			onChainMcap: toValueWithPrior(onChainMcap, prior?.onChainMcap),
			defiActiveTvl: toValueWithPrior(defiActiveTvl, defiPrior == null ? null : defiPrior - bridgePrior)
		}
	}

	return {
		kind: 'leaf',
		id: asset.id,
		asset,
		chainScope: null,
		period,
		metrics: {
			...emptyRwaTableMetrics(),
			activeMcap,
			onChainMcap,
			defiActiveTvl,
			change,
			netFlow7d: flows['7d']?.flow ?? null,
			netFlow30d: flows['30d']?.flow ?? null,
			price: asset.price,
			chains,
			assetCount: 1,
			issuerCount: asset.issuer ? 1 : 0,
			chainCount: chains.length
		},
		breakdowns: {
			activeMcap: asset.activeMcap?.breakdown ?? null,
			onChainMcap: asset.onChainMcap?.breakdown ?? null,
			defiActiveTvl: getRwaDisplayedDefiActiveTvlByProtocol(asset, options.includeBridgeTvl),
			defiActiveTvlByChain: getRwaDisplayedDefiActiveTvlByChain(asset, options.includeBridgeTvl)
		},
		flows
	}
}

function buildPerpsLeafRow(
	asset: Extract<RWAOverviewDisplayRow, { kind: 'perps' }>,
	period: RWAChangePeriod
): RWALeafRow {
	return {
		kind: 'leaf',
		id: asset.id,
		asset,
		chainScope: null,
		period,
		metrics: {
			...emptyRwaTableMetrics(),
			price: asset.price,
			priceChange24h: asset.priceChange24h ?? null,
			openInterest: asset.openInterest,
			openInterestChange24h: {
				current: asset.openInterest,
				prior: priorFromPercentChange(asset.openInterest, asset.openInterestChange24h ?? null)
			},
			volume24h: asset.volume24h,
			volume7d: asset.volume7d ?? null,
			volume30d: asset.volume30d,
			fundingApr: annualiseFundingRate(asset.fundingRate ?? null, asset.fundingIntervalHours ?? null),
			fundingRate: asset.fundingRate ?? null,
			fundingIntervalHours: asset.fundingIntervalHours ?? null,
			premium: asset.premium == null ? null : asset.premium * 100,
			maxLeverage: asset.maxLeverage ?? null,
			protocolFees24h: asset.protocolFees24h ?? null,
			assetCount: 1,
			issuerCount: asset.issuer ? 1 : 0
		},
		breakdowns: { activeMcap: null, onChainMcap: null, defiActiveTvl: null, defiActiveTvlByChain: [] },
		flows: {}
	}
}

function getAssetFlows(canonicalMarketId: string, flowSummary: IRWAFlowSummaryResponse | undefined): RWALeafFlows {
	const flows: RWALeafFlows = {}
	if (!flowSummary) return flows
	const flow7d = flowSummary.windows['7d'].asset[canonicalMarketId]
	const flow30d = flowSummary.windows['30d'].asset[canonicalMarketId]
	if (flow7d) flows['7d'] = flow7d
	if (flow30d) flows['30d'] = flow30d
	return flows
}

/** The value 24h ago implied by a percent change. */
export function priorFromPercentChange(current: number | null, change: number | null): number | null {
	if (current == null || change == null || change <= -100) return null
	return current / (1 + change / 100)
}

export const HOURS_PER_YEAR = 24 * 365

/** Per-interval funding as a yearly percent, so 1h and 8h venues compare. */
export function annualiseFundingRate(rate: number | null, intervalHours: number | null): number | null {
	if (rate == null || intervalHours == null || intervalHours <= 0) return null
	return rate * (HOURS_PER_YEAR / intervalHours) * 100
}
