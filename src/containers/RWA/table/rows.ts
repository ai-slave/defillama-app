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

/**
 * A perps 24h change: both sides for the group sum, the percent the cell shows (the API's own on a market) and the
 * markets a group leaves out because they fell to zero, where yesterday's value cannot be rebuilt.
 */
export type RWAPerpsChange = RWAValueWithPrior & { percent: number | null; dropped: number }

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
	openInterestChange24h: RWAPerpsChange
	volume24h: number | null
	volume7d: number | null
	volume30d: number | null
	/** Perps: funding annualized from the venue interval, in percent. */
	fundingApr: number | null
	/** Perps: the raw rate per interval and the interval, for the tooltip. */
	fundingRate: number | null
	fundingIntervalHours: number | null
	/** Perps: mark over index minus one, in percent. */
	premium: number | null
	maxLeverage: number | null
	protocolFees24h: number | null
	/** Perps: 24h volume now and a day before. */
	volume24hChange24h: RWAPerpsChange
	volumeAllTime: number | null
	oraclePrice: number | null
	midPrice: number | null
	previousDayPrice: number | null
	protocolFees7d: number | null
	protocolFees30d: number | null
	protocolFeesAllTime: number | null
	/** Perps: fractions, open-interest weighted on a group row. */
	makerFeeRate: number | null
	takerFeeRate: number | null
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
	'issuer',
	'asset',
	'pair',
	'marginAsset',
	'fundingInterval'
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
		openInterestChange24h: { current: null, prior: null, percent: null, dropped: 0 },
		volume24h: null,
		volume7d: null,
		volume30d: null,
		fundingApr: null,
		fundingRate: null,
		fundingIntervalHours: null,
		premium: null,
		maxLeverage: null,
		protocolFees24h: null,
		volume24hChange24h: { current: null, prior: null, percent: null, dropped: 0 },
		volumeAllTime: null,
		oraclePrice: null,
		midPrice: null,
		previousDayPrice: null,
		protocolFees7d: null,
		protocolFees30d: null,
		protocolFeesAllTime: null,
		makerFeeRate: null,
		takerFeeRate: null,
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
	const volume24h = asset.volume24h
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
			openInterestChange24h: toPerpsChange(asset.openInterest, asset.openInterestChange24h ?? null),
			volume24h,
			volume24hChange24h: toPerpsChange(volume24h, asset.volume24hChange24h ?? null),
			volume7d: asset.volume7d ?? null,
			volume30d: asset.volume30d,
			fundingApr: annualizeFundingRate(asset.fundingRate ?? null, asset.fundingIntervalHours ?? null),
			fundingRate: asset.fundingRate ?? null,
			fundingIntervalHours: asset.fundingIntervalHours ?? null,
			premium: asset.premium == null ? null : asset.premium * 100,
			maxLeverage: asset.maxLeverage ?? null,
			protocolFees24h: asset.protocolFees24h ?? null,
			volumeAllTime: asset.volumeAllTime ?? null,
			oraclePrice: asset.oraclePrice ?? null,
			midPrice: asset.midPrice ?? null,
			previousDayPrice: asset.previousDayPrice ?? null,
			protocolFees7d: asset.protocolFees7d ?? null,
			protocolFees30d: asset.protocolFees30d ?? null,
			protocolFeesAllTime: asset.protocolFeesAllTime ?? null,
			makerFeeRate: asset.makerFeeRate ?? null,
			takerFeeRate: asset.takerFeeRate ?? null,
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

/** A market's change as the API sends it; at -100% the value 24h ago cannot be rebuilt, so it counts as a drop. */
function toPerpsChange(current: number | null, percent: number | null): RWAPerpsChange {
	const dropped = percent != null && percent <= -100
	const prior = current == null || percent == null || dropped ? null : current / (1 + percent / 100)
	return { current, prior, percent, dropped: dropped ? 1 : 0 }
}

export const HOURS_PER_YEAR = 24 * 365

/** Per-interval funding as a yearly percent, so 1h and 8h venues compare. */
export function annualizeFundingRate(rate: number | null, intervalHours: number | null): number | null {
	if (rate == null || intervalHours == null || intervalHours <= 0) return null
	return rate * (HOURS_PER_YEAR / intervalHours) * 100
}
