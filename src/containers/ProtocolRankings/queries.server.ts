import { fetchCoinPrices } from '~/api/pricing'
import type { PriceObject } from '~/api/types'
import { fetchAdapterChainMetrics } from '~/containers/AdapterMetrics/api'
import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import { getAdapterChainOverview } from '~/containers/AdapterMetrics/queries'
import type { IAdapterChainOverview } from '~/containers/AdapterMetrics/types'
import { getProtocolEmissionsLookupFromAggregated } from '~/containers/Incentives/queries'
import type { ProtocolEmissionsLookup } from '~/containers/Incentives/types'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import {
	PROTOCOL_LIST_ADDITIVE_TVL_KEYS,
	isProtocolListTvlKey,
	type ProtocolListAdditiveTvlKey,
	type ProtocolsResponse
} from '~/containers/ProtocolLists/api.types'
import { getMarketCapToAnnualizedMetricRatio, getPercentChange, slug } from '~/utils'
import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'
import {
	buildDimensionProtocolMetrics,
	type ProtocolRankingActivitySourceKey,
	type ProtocolRankingActivitySources
} from './readModel'
import type {
	IChildProtocol,
	IProtocol,
	ProtocolRankingActivityMetric,
	ProtocolRankingTvlEntry,
	ProtocolRankingTvls
} from './types'
import { protocolMatchesForkFilter, toFilterProtocol, toStrikeTvl } from './utils'

type ClassificationTvlType = 'doublecounted' | 'liquidstaking'
type ExtraTvlType = ProtocolListAdditiveTvlKey | ClassificationTvlType | 'excludeParent'
type StoredChildProtocol = {
	row: IChildProtocol
	defillamaId: string
	contributesDefaultTvl: boolean
	contributesExtraTvls: boolean
	emissionsMatched: boolean
}
type FeeMetrics = NonNullable<IChildProtocol['fees']>
type RevenueMetrics = NonNullable<IChildProtocol['revenue']>
type HoldersRevenueMetrics = NonNullable<IChildProtocol['holdersRevenue']>
type EmissionsMetrics = NonNullable<IChildProtocol['emissions']>

const CLASSIFICATION_TVL_TYPES: ReadonlyArray<ClassificationTvlType> = ['doublecounted', 'liquidstaking']
const EXTRA_TVL_TYPES: ReadonlyArray<ExtraTvlType> = [
	...PROTOCOL_LIST_ADDITIVE_TVL_KEYS,
	...CLASSIFICATION_TVL_TYPES,
	'excludeParent'
]

function isExtraTvlType(value: string): value is ExtraTvlType {
	return (
		value === 'excludeParent' || value === 'doublecounted' || value === 'liquidstaking' || isProtocolListTvlKey(value)
	)
}

function toRankingTvlEntry(entry: {
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
}): ProtocolRankingTvlEntry {
	return {
		tvl: entry.tvl,
		tvlPrevDay: entry.tvlPrevDay,
		tvlPrevWeek: entry.tvlPrevWeek,
		tvlPrevMonth: entry.tvlPrevMonth
	}
}

function getMcapTvlRatio(mcap: number | null, tvl: number | null): number | null {
	if (mcap === null || tvl === null || tvl <= 0) return null
	const ratio = mcap / tvl
	return Number.isFinite(ratio) ? ratio : null
}

function toEmissionsMetrics(entry: ProtocolEmissionsLookup[string]): EmissionsMetrics {
	return {
		total24h: entry.emissions24h,
		total7d: entry.emissions7d,
		total30d: entry.emissions30d,
		total1y: entry.emissions1y,
		monthlyAverage1y: entry.emissionsMonthlyAverage1y,
		totalAllTime: entry.emissionsAllTime
	}
}

function createZeroEmissionsMetrics(): EmissionsMetrics {
	return {
		total24h: 0,
		total7d: 0,
		total30d: 0,
		total1y: 0,
		monthlyAverage1y: 0,
		totalAllTime: 0
	}
}

function createInactiveFeesMetrics(): Omit<FeeMetrics, 'pf'> {
	return {
		total24h: 0,
		total7d: 0,
		total30d: 0,
		total1y: 0,
		annualized1y: 0,
		monthlyAverage1y: 0,
		totalAllTime: 0
	}
}

function createInactiveRevenueMetrics(): Omit<RevenueMetrics, 'ps'> {
	return {
		total24h: 0,
		total7d: 0,
		total30d: 0,
		total1y: 0,
		annualized1y: 0,
		monthlyAverage1y: 0,
		totalAllTime: 0
	}
}

function createInactiveHoldersRevenueMetrics(): HoldersRevenueMetrics {
	return {
		total24h: 0,
		total7d: 0,
		total30d: 0,
		total1y: 0,
		monthlyAverage1y: 0,
		totalAllTime: 0
	}
}

function createInactiveActivityMetric(): ProtocolRankingActivityMetric {
	return {
		total24h: 0,
		total7d: 0,
		total30d: 0,
		totalAllTime: 0,
		change_7dover7d: null
	}
}

function mergeTvlValue(current: number | null, incoming: number | null): number | null {
	return current === null || incoming === null ? null : current + incoming
}

function mergeTvlEntry(
	current: ProtocolRankingTvlEntry | undefined,
	incoming: ProtocolRankingTvlEntry
): ProtocolRankingTvlEntry {
	const base = current ?? {
		tvl: 0,
		tvlPrevDay: 0,
		tvlPrevWeek: 0,
		tvlPrevMonth: 0
	}
	return {
		tvl: mergeTvlValue(base.tvl, incoming.tvl),
		tvlPrevDay: mergeTvlValue(base.tvlPrevDay, incoming.tvlPrevDay),
		tvlPrevWeek: mergeTvlValue(base.tvlPrevWeek, incoming.tvlPrevWeek),
		tvlPrevMonth: mergeTvlValue(base.tvlPrevMonth, incoming.tvlPrevMonth)
	}
}

function subtractKnownValue(total: number | null, excluded: number | null): number | null {
	return total === null || excluded === null ? null : total - excluded
}

function collectParentTvlContributions(children: Array<StoredChildProtocol>): {
	defaultTvl: ProtocolRankingTvlEntry | undefined
	extraTvls: Partial<Record<ExtraTvlType, ProtocolRankingTvlEntry>>
} {
	let defaultTvl: ProtocolRankingTvlEntry | undefined
	const extraTvls: Partial<Record<ExtraTvlType, ProtocolRankingTvlEntry>> = {}

	for (const child of children) {
		if (child.row.tvl === null) continue
		if (child.contributesDefaultTvl) {
			defaultTvl = mergeTvlEntry(defaultTvl, child.row.tvl.default)
		}
		if (!child.contributesExtraTvls) continue
		for (const tvlType of EXTRA_TVL_TYPES) {
			if (tvlType === 'excludeParent' && !child.contributesDefaultTvl) continue
			const childEntry = child.row.tvl[tvlType]
			if (!childEntry) continue
			extraTvls[tvlType] = mergeTvlEntry(extraTvls[tvlType], childEntry)
		}
	}

	return { defaultTvl, extraTvls }
}

function aggregateCanonicalParentTvls(children: Array<StoredChildProtocol>): ProtocolRankingTvls | null {
	const { extraTvls, defaultTvl: collectedDefaultTvl } = collectParentTvlContributions(children)
	let defaultTvl = collectedDefaultTvl
	if (!defaultTvl) return null
	const excluded = extraTvls.excludeParent
	if (excluded) {
		defaultTvl = {
			tvl: subtractKnownValue(defaultTvl.tvl, excluded.tvl),
			tvlPrevDay: subtractKnownValue(defaultTvl.tvlPrevDay, excluded.tvlPrevDay),
			tvlPrevWeek: subtractKnownValue(defaultTvl.tvlPrevWeek, excluded.tvlPrevWeek),
			tvlPrevMonth: subtractKnownValue(defaultTvl.tvlPrevMonth, excluded.tvlPrevMonth)
		}
	}

	return { default: defaultTvl, ...extraTvls }
}

function aggregateForkParentTvls(children: Array<StoredChildProtocol>): ProtocolRankingTvls {
	const { defaultTvl, extraTvls } = collectParentTvlContributions(children)
	return {
		default: defaultTvl ?? {
			tvl: 0,
			tvlPrevDay: null,
			tvlPrevWeek: null,
			tvlPrevMonth: null
		},
		...extraTvls
	}
}

type AvailableMetricTotal = { value: number; hasValue: boolean }

function addAvailableMetricValue(total: AvailableMetricTotal, value: number | null): void {
	if (value === null) return
	total.value += value
	total.hasValue = true
}

function getAvailableMetricTotal(total: AvailableMetricTotal): number | null {
	return total.hasValue ? total.value : null
}

function aggregateFees(children: Array<StoredChildProtocol>, parentMcap: number | null): FeeMetrics | undefined {
	let hasMetric = false
	const total24h: AvailableMetricTotal = { value: 0, hasValue: false }
	const total7d: AvailableMetricTotal = { value: 0, hasValue: false }
	const total30d: AvailableMetricTotal = { value: 0, hasValue: false }
	const total1y: AvailableMetricTotal = { value: 0, hasValue: false }
	const monthlyAverage1y: AvailableMetricTotal = { value: 0, hasValue: false }
	const totalAllTime: AvailableMetricTotal = { value: 0, hasValue: false }
	let annualized1y: number | null = 0
	for (const child of children) {
		const metric = child.row.fees
		if (!metric) continue
		hasMetric = true
		addAvailableMetricValue(total24h, metric.total24h)
		addAvailableMetricValue(total7d, metric.total7d)
		addAvailableMetricValue(total30d, metric.total30d)
		addAvailableMetricValue(total1y, metric.total1y)
		addAvailableMetricValue(monthlyAverage1y, metric.monthlyAverage1y)
		addAvailableMetricValue(totalAllTime, metric.totalAllTime)
		annualized1y = mergeTvlValue(annualized1y, metric.annualized1y)
	}
	if (!hasMetric) return undefined
	return {
		total24h: getAvailableMetricTotal(total24h),
		total7d: getAvailableMetricTotal(total7d),
		total30d: getAvailableMetricTotal(total30d),
		total1y: getAvailableMetricTotal(total1y),
		annualized1y,
		monthlyAverage1y: getAvailableMetricTotal(monthlyAverage1y),
		totalAllTime: getAvailableMetricTotal(totalAllTime),
		pf: getMarketCapToAnnualizedMetricRatio(parentMcap, annualized1y)
	}
}

function aggregateRevenue(children: Array<StoredChildProtocol>, parentMcap: number | null): RevenueMetrics | undefined {
	let hasMetric = false
	const total24h: AvailableMetricTotal = { value: 0, hasValue: false }
	const total7d: AvailableMetricTotal = { value: 0, hasValue: false }
	const total30d: AvailableMetricTotal = { value: 0, hasValue: false }
	const total1y: AvailableMetricTotal = { value: 0, hasValue: false }
	const monthlyAverage1y: AvailableMetricTotal = { value: 0, hasValue: false }
	const totalAllTime: AvailableMetricTotal = { value: 0, hasValue: false }
	let annualized1y: number | null = 0
	for (const child of children) {
		const metric = child.row.revenue
		if (!metric) continue
		hasMetric = true
		addAvailableMetricValue(total24h, metric.total24h)
		addAvailableMetricValue(total7d, metric.total7d)
		addAvailableMetricValue(total30d, metric.total30d)
		addAvailableMetricValue(total1y, metric.total1y)
		addAvailableMetricValue(monthlyAverage1y, metric.monthlyAverage1y)
		addAvailableMetricValue(totalAllTime, metric.totalAllTime)
		annualized1y = mergeTvlValue(annualized1y, metric.annualized1y)
	}
	if (!hasMetric) return undefined
	return {
		total24h: getAvailableMetricTotal(total24h),
		total7d: getAvailableMetricTotal(total7d),
		total30d: getAvailableMetricTotal(total30d),
		total1y: getAvailableMetricTotal(total1y),
		annualized1y,
		monthlyAverage1y: getAvailableMetricTotal(monthlyAverage1y),
		totalAllTime: getAvailableMetricTotal(totalAllTime),
		ps: getMarketCapToAnnualizedMetricRatio(parentMcap, annualized1y)
	}
}

function aggregateHoldersRevenue(children: Array<StoredChildProtocol>): HoldersRevenueMetrics | undefined {
	let hasMetric = false
	const total24h: AvailableMetricTotal = { value: 0, hasValue: false }
	const total7d: AvailableMetricTotal = { value: 0, hasValue: false }
	const total30d: AvailableMetricTotal = { value: 0, hasValue: false }
	const total1y: AvailableMetricTotal = { value: 0, hasValue: false }
	const monthlyAverage1y: AvailableMetricTotal = { value: 0, hasValue: false }
	const totalAllTime: AvailableMetricTotal = { value: 0, hasValue: false }
	for (const child of children) {
		const metric = child.row.holdersRevenue
		if (!metric) continue
		hasMetric = true
		addAvailableMetricValue(total24h, metric.total24h)
		addAvailableMetricValue(total7d, metric.total7d)
		addAvailableMetricValue(total30d, metric.total30d)
		addAvailableMetricValue(total1y, metric.total1y)
		addAvailableMetricValue(monthlyAverage1y, metric.monthlyAverage1y)
		addAvailableMetricValue(totalAllTime, metric.totalAllTime)
	}
	if (!hasMetric) return undefined
	return {
		total24h: getAvailableMetricTotal(total24h),
		total7d: getAvailableMetricTotal(total7d),
		total30d: getAvailableMetricTotal(total30d),
		total1y: getAvailableMetricTotal(total1y),
		monthlyAverage1y: getAvailableMetricTotal(monthlyAverage1y),
		totalAllTime: getAvailableMetricTotal(totalAllTime)
	}
}

function aggregateEmissions(children: Array<StoredChildProtocol>): EmissionsMetrics | undefined {
	let total24h: number | null = 0
	let total7d: number | null = 0
	let total30d: number | null = 0
	let total1y: number | null = 0
	let monthlyAverage1y: number | null = 0
	let totalAllTime: number | null = 0
	let hasMatchedEmissions = false
	for (const child of children) {
		if (!child.emissionsMatched) continue
		const metric = child.row.emissions
		if (!metric) continue
		hasMatchedEmissions = true
		total24h = mergeTvlValue(total24h, metric.total24h)
		total7d = mergeTvlValue(total7d, metric.total7d)
		total30d = mergeTvlValue(total30d, metric.total30d)
		total1y = mergeTvlValue(total1y, metric.total1y)
		monthlyAverage1y = mergeTvlValue(monthlyAverage1y, metric.monthlyAverage1y)
		totalAllTime = mergeTvlValue(totalAllTime, metric.totalAllTime)
	}
	if (!hasMatchedEmissions) return undefined
	return {
		total24h,
		total7d,
		total30d,
		total1y,
		monthlyAverage1y,
		totalAllTime
	}
}

function aggregateActivityMetric(
	children: Array<StoredChildProtocol>,
	metricKey: ProtocolRankingActivitySourceKey
): ProtocolRankingActivityMetric | undefined {
	let hasMetric = false
	const total24h: AvailableMetricTotal = { value: 0, hasValue: false }
	const total7d: AvailableMetricTotal = { value: 0, hasValue: false }
	const total30d: AvailableMetricTotal = { value: 0, hasValue: false }
	const totalAllTime: AvailableMetricTotal = { value: 0, hasValue: false }
	let previous7d = 0
	let hasChangeInput = false
	let changeIsIncomplete = false
	for (const child of children) {
		const metric = child.row[metricKey]
		if (!metric) continue
		hasMetric = true
		addAvailableMetricValue(total24h, metric.total24h)
		addAvailableMetricValue(total7d, metric.total7d)
		addAvailableMetricValue(total30d, metric.total30d)
		addAvailableMetricValue(totalAllTime, metric.totalAllTime)
		if (metric.total7d === null) continue
		if (metric.total7d === 0 && metric.change_7dover7d === null) continue
		const previous7dRatio = metric.change_7dover7d === null ? null : 1 + metric.change_7dover7d / 100
		if (previous7dRatio === null || previous7dRatio <= 0) {
			changeIsIncomplete = true
			continue
		}
		hasChangeInput = true
		previous7d += metric.total7d / previous7dRatio
	}
	if (!hasMetric) return undefined
	const total7dValue = getAvailableMetricTotal(total7d)
	return {
		total24h: getAvailableMetricTotal(total24h),
		total7d: total7dValue,
		total30d: getAvailableMetricTotal(total30d),
		totalAllTime: getAvailableMetricTotal(totalAllTime),
		change_7dover7d:
			changeIsIncomplete || !hasChangeInput || total7dValue === null ? null : getPercentChange(total7dValue, previous7d)
	}
}

/**
 * The expensive multi-adapter aggregation behind the rankings snapshot. It has
 * two callers: the snapshot builder in `server/tableData.server.ts`, and Forks,
 * whose fork filter must run before parent aggregation. Other pages read the
 * rankings snapshot, or join `fetchProtocols` with their own domain data.
 */
export const getProtocolsByChain = async ({
	chain,
	chainMetadata,
	protocolMetadata,
	shouldFetchDexs,
	shouldFetchPerps,
	includeExtendedMetrics = false,
	fork = null
}: {
	chain: string
	chainMetadata: Record<string, IChainMetadata>
	protocolMetadata: Record<string, IProtocolMetadata>
	shouldFetchDexs?: boolean
	shouldFetchPerps?: boolean
	includeExtendedMetrics?: boolean
	fork?: string | null
}) => {
	const currentChainMetadata: IChainMetadata | undefined =
		chain === 'All'
			? {
					name: 'All',
					stablecoins: true,
					fees: true,
					dexs: true,
					perps: true,
					normalizedVolume: true,
					activeLiquidity: true,
					openInterest: true,
					optionsPremiumVolume: true,
					optionsNotionalVolume: true,
					dexAggregators: true,
					perpsAggregators: true,
					bridgeAggregators: true,
					id: 'all'
				}
			: chainMetadata[slug(chain)]

	if (!currentChainMetadata) return null
	const shouldFetchDexsForChain = shouldFetchDexs ?? currentChainMetadata.dexs ?? false
	const shouldFetchPerpsForChain = shouldFetchPerps ?? currentChainMetadata.perps ?? false

	const normalizedFork = fork ? slug(fork) : null

	const [
		protocols,
		fees,
		revenue,
		holdersRevenue,
		dexs,
		emissionsProtocols,
		perps,
		normalizedVolume,
		activeLiquidity,
		openInterest,
		optionsPremiumVolume,
		optionsNotionalVolume,
		dexAggregators,
		perpsAggregators,
		bridgeAggregators
	]: [
		ProtocolsResponse,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null,
		IAdapterChainOverview | null,
		ProtocolEmissionsLookup | null,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null,
		IAdapterChainMetrics | null
	] = await Promise.all([
		fetchProtocols(),
		currentChainMetadata.fees
			? fetchAdapterChainMetrics({
					adapterType: 'fees',
					chain: currentChainMetadata.name
				}).catch(() => null)
			: Promise.resolve(null),
		currentChainMetadata.fees
			? fetchAdapterChainMetrics({
					adapterType: 'fees',
					chain: currentChainMetadata.name,
					dataType: 'dailyRevenue'
				}).catch(() => null)
			: Promise.resolve(null),
		currentChainMetadata.fees
			? fetchAdapterChainMetrics({
					adapterType: 'fees',
					chain: currentChainMetadata.name,
					dataType: 'dailyHoldersRevenue'
				}).catch(() => null)
			: Promise.resolve(null),
		shouldFetchDexsForChain
			? getAdapterChainOverview({
					adapterType: 'dexs',
					chain: currentChainMetadata.name,
					excludeTotalDataChart: false
				}).catch(() => null)
			: Promise.resolve(null),
		chain === 'All'
			? getProtocolEmissionsLookupFromAggregated().catch((error) => {
					console.log(error)
					return null
				})
			: Promise.resolve(null),
		includeExtendedMetrics && shouldFetchPerpsForChain
			? fetchAdapterChainMetrics({
					adapterType: 'derivatives',
					chain: currentChainMetadata.name
				}).catch(() => null)
			: Promise.resolve(null),
		includeExtendedMetrics && currentChainMetadata.normalizedVolume
			? fetchAdapterChainMetrics({
					adapterType: 'normalized-volume',
					chain: currentChainMetadata.name
				}).catch(() => null)
			: Promise.resolve(null),
		includeExtendedMetrics && currentChainMetadata.activeLiquidity
			? fetchAdapterChainMetrics({
					adapterType: 'normalized-volume',
					chain: currentChainMetadata.name,
					dataType: 'dailyActiveLiquidity'
				}).catch(() => null)
			: Promise.resolve(null),
		includeExtendedMetrics && currentChainMetadata.openInterest
			? fetchAdapterChainMetrics({
					adapterType: 'open-interest',
					chain: currentChainMetadata.name,
					dataType: 'openInterestAtEnd'
				}).catch(() => null)
			: Promise.resolve(null),
		includeExtendedMetrics && currentChainMetadata.optionsPremiumVolume
			? fetchAdapterChainMetrics({
					adapterType: 'options',
					chain: currentChainMetadata.name,
					dataType: 'dailyPremiumVolume'
				}).catch(() => null)
			: Promise.resolve(null),
		includeExtendedMetrics && currentChainMetadata.optionsNotionalVolume
			? fetchAdapterChainMetrics({
					adapterType: 'options',
					chain: currentChainMetadata.name,
					dataType: 'dailyNotionalVolume'
				}).catch(() => null)
			: Promise.resolve(null),
		includeExtendedMetrics && currentChainMetadata.dexAggregators
			? fetchAdapterChainMetrics({
					adapterType: 'aggregators',
					chain: currentChainMetadata.name
				}).catch(() => null)
			: Promise.resolve(null),
		includeExtendedMetrics && currentChainMetadata.perpsAggregators
			? fetchAdapterChainMetrics({
					adapterType: 'aggregator-derivatives',
					chain: currentChainMetadata.name
				}).catch(() => null)
			: Promise.resolve(null),
		includeExtendedMetrics && currentChainMetadata.bridgeAggregators
			? fetchAdapterChainMetrics({
					adapterType: 'bridge-aggregators',
					chain: currentChainMetadata.name
				}).catch(() => null)
			: Promise.resolve(null)
	])

	const activity: ProtocolRankingActivitySources = {}
	if (dexs) activity.dexs = dexs
	if (perps) activity.perps = perps
	if (normalizedVolume) activity.normalizedVolume = normalizedVolume
	if (activeLiquidity) activity.activeLiquidity = activeLiquidity
	if (openInterest) activity.openInterest = openInterest
	if (optionsPremiumVolume) activity.optionsPremiumVolume = optionsPremiumVolume
	if (optionsNotionalVolume) activity.optionsNotionalVolume = optionsNotionalVolume
	if (dexAggregators) activity.dexAggregators = dexAggregators
	if (perpsAggregators) activity.perpsAggregators = perpsAggregators
	if (bridgeAggregators) activity.bridgeAggregators = bridgeAggregators

	const input: ProtocolRankingInput = {
		chainName: currentChainMetadata.name,
		normalizedFork,
		protocolMetadata,
		protocols,
		fees,
		revenue,
		holdersRevenue,
		emissions: emissionsProtocols,
		activity
	}
	const selection = selectRankingProtocols(input)
	const prices: Record<string, PriceObject> =
		selection.priceIds.length > 0 ? await fetchCoinPrices(selection.priceIds).catch(() => ({})) : {}

	return {
		protocols: buildProtocolRankings(input, selection, prices),
		chains: protocols.chains,
		fees,
		dexs,
		perps,
		emissionsData: emissionsProtocols
	}
}

/** Upstream data one rankings table is built from. `chainName` 'All' means every chain. */
export type ProtocolRankingInput = {
	chainName: string
	normalizedFork: string | null
	protocolMetadata: Record<string, IProtocolMetadata>
	protocols: ProtocolsResponse
	fees: IAdapterChainMetrics | null
	revenue: IAdapterChainMetrics | null
	holdersRevenue: IAdapterChainMetrics | null
	/** null when the emissions source was not requested or failed; rows then carry no emissions. */
	emissions: ProtocolEmissionsLookup | null
	/** Only the activity sources that loaded; each key becomes a row metric. */
	activity: ProtocolRankingActivitySources
}

export type ProtocolRankingSelection = {
	eligibleProtocols: Array<{ protocol: ProtocolsResponse['protocols'][number]; metadata: IProtocolMetadata }>
	/** `coingecko:<id>` keys for eligible protocols and their parents, fetched before rows are built. */
	priceIds: Array<string>
}

export function selectRankingProtocols({
	chainName,
	normalizedFork,
	protocolMetadata,
	protocols
}: ProtocolRankingInput): ProtocolRankingSelection {
	const parentProtocolsMap = new Map<string, ProtocolsResponse['parentProtocols'][number]>()
	for (const parentProtocol of protocols.parentProtocols) parentProtocolsMap.set(parentProtocol.id, parentProtocol)
	const eligibleProtocols: ProtocolRankingSelection['eligibleProtocols'] = []
	for (const protocol of protocols.protocols) {
		if (protocol.defillamaId.startsWith('chain#')) continue
		const metadata = protocolMetadata[protocol.defillamaId]
		if (!metadata) continue
		if (!protocolMatchesForkFilter({ protocol, normalizedFork })) continue
		if (
			!toFilterProtocol({
				protocolMetadata: metadata,
				protocolData: protocol,
				chainDisplayName: chainName
			})
		) {
			continue
		}
		eligibleProtocols.push({ protocol, metadata })
	}

	const geckoIds = new Set<string>()
	for (const { protocol } of eligibleProtocols) {
		if (protocol.geckoId) {
			geckoIds.add(`coingecko:${protocol.geckoId}`)
		}

		if (protocol.parentProtocol) {
			const parentProtocol = parentProtocolsMap.get(protocol.parentProtocol)
			if (parentProtocol?.gecko_id) {
				geckoIds.add(`coingecko:${parentProtocol.gecko_id}`)
			}
		}
	}

	return { eligibleProtocols, priceIds: Array.from(geckoIds) }
}

/** Builds ranking rows, grouping children under their parent, sorted by default TVL. */
export function buildProtocolRankings(
	{
		chainName,
		normalizedFork,
		protocolMetadata,
		protocols: { parentProtocols },
		fees,
		revenue,
		holdersRevenue,
		emissions: emissionsProtocols,
		activity
	}: ProtocolRankingInput,
	{ eligibleProtocols }: ProtocolRankingSelection,
	protocolTokenPrices: Record<string, PriceObject>
): Array<IProtocol> {
	const activityMetricKeys = Object.keys(activity) as Array<ProtocolRankingActivitySourceKey>
	const dimensionProtocols = buildDimensionProtocolMetrics({
		fees,
		revenue,
		holdersRevenue,
		activity
	})
	const protocolsStore: Record<string, IProtocol> = {}

	const parentStore: Record<string, Array<StoredChildProtocol>> = {}

	for (const { protocol, metadata } of eligibleProtocols) {
		const selectedChainTvl = chainName === 'All' ? undefined : protocol.chainTvls[chainName]
		const defaultTvl: ProtocolRankingTvlEntry =
			chainName === 'All'
				? {
						tvl: protocol.tvl,
						tvlPrevDay: protocol.tvlPrevDay,
						tvlPrevWeek: protocol.tvlPrevWeek,
						tvlPrevMonth: protocol.tvlPrevMonth
					}
				: {
						tvl: selectedChainTvl?.tvl ?? null,
						tvlPrevDay: selectedChainTvl?.tvlPrevDay ?? null,
						tvlPrevWeek: selectedChainTvl?.tvlPrevWeek ?? null,
						tvlPrevMonth: selectedChainTvl?.tvlPrevMonth ?? null
					}
		const contributesDefaultTvl = protocol.category !== 'Bridge' && defaultTvl.tvl !== null
		const tvls: ProtocolRankingTvls = {
			default:
				normalizedFork && defaultTvl.tvl === null
					? {
							tvl: 0,
							tvlPrevDay: defaultTvl.tvlPrevDay,
							tvlPrevWeek: defaultTvl.tvlPrevWeek,
							tvlPrevMonth: defaultTvl.tvlPrevMonth
						}
					: defaultTvl
		}

		const tvlChange =
			tvls.default.tvl != null
				? {
						change1d: getPercentChange(tvls.default.tvl, tvls.default.tvlPrevDay),
						change7d: getPercentChange(tvls.default.tvl, tvls.default.tvlPrevWeek),
						change1m: getPercentChange(tvls.default.tvl, tvls.default.tvlPrevMonth)
					}
				: null

		for (const chainKey in protocol.chainTvls) {
			const chainTvl = protocol.chainTvls[chainKey]
			if (!chainTvl) continue
			if (chainName === 'All') {
				if (isExtraTvlType(chainKey)) {
					tvls[chainKey] = toRankingTvlEntry(chainTvl)
				}
			} else {
				const chainPrefix = `${chainName}-`
				if (!chainKey.startsWith(chainPrefix)) continue
				const tvlType = chainKey.slice(chainPrefix.length)
				if (isExtraTvlType(tvlType)) tvls[tvlType] = toRankingTvlEntry(chainTvl)
			}
		}

		const childMcapTvl = protocol.category === 'Bridge' ? null : getMcapTvlRatio(protocol.mcap, tvls.default.tvl)

		const displayName = metadata.displayName
		const metadataChains = metadata.chains
		if (!displayName || !metadataChains) continue
		const hasDisplayTvl =
			protocol.category !== 'Bridge' && (chainName !== 'All' || protocol.tvl != null || normalizedFork !== null)
		const childRow: IChildProtocol = {
			id: protocol.defillamaId,
			name: displayName,
			slug: slug(displayName),
			logo: protocol.logo,
			chains: metadataChains,
			category: protocol.category,
			tvl: hasDisplayTvl ? tvls : null,
			tvlChange: hasDisplayTvl ? tvlChange : null,
			mcap: protocol.mcap,
			tokenPrice: protocol.geckoId ? (protocolTokenPrices[`coingecko:${protocol.geckoId}`]?.price ?? null) : null,
			mcaptvl: childMcapTvl,
			strikeTvl:
				protocol.category !== 'Bridge'
					? toStrikeTvl(protocol, {
							liquidstaking: tvls.liquidstaking !== undefined,
							doublecounted: tvls.doublecounted !== undefined
						})
					: false
		}

		if (protocol.deprecated) {
			childRow.deprecated = true
		}

		const dimensionProtocol = dimensionProtocols[protocol.defillamaId]
		if (fees !== null) {
			const feesMetrics = dimensionProtocol?.fees ?? createInactiveFeesMetrics()
			childRow.fees = {
				total24h: feesMetrics.total24h,
				total7d: feesMetrics.total7d,
				total30d: feesMetrics.total30d,
				total1y: feesMetrics.total1y,
				annualized1y: feesMetrics.annualized1y,
				monthlyAverage1y: feesMetrics.monthlyAverage1y,
				totalAllTime: feesMetrics.totalAllTime,
				pf: protocol.mcap != null ? getMarketCapToAnnualizedMetricRatio(protocol.mcap, feesMetrics.annualized1y) : null
			}
		}

		if (revenue !== null) {
			const revenueMetrics = dimensionProtocol?.revenue ?? createInactiveRevenueMetrics()
			childRow.revenue = {
				total24h: revenueMetrics.total24h,
				total7d: revenueMetrics.total7d,
				total30d: revenueMetrics.total30d,
				total1y: revenueMetrics.total1y,
				annualized1y: revenueMetrics.annualized1y,
				monthlyAverage1y: revenueMetrics.monthlyAverage1y,
				totalAllTime: revenueMetrics.totalAllTime,
				ps:
					protocol.mcap != null ? getMarketCapToAnnualizedMetricRatio(protocol.mcap, revenueMetrics.annualized1y) : null
			}
		}

		if (holdersRevenue !== null) {
			childRow.holdersRevenue = dimensionProtocol?.holdersRevenue ?? createInactiveHoldersRevenueMetrics()
		}

		for (const metricKey of activityMetricKeys) {
			const metric = dimensionProtocol?.[metricKey]
			if (metric) childRow[metricKey] = metric
			else if (metricKey === 'dexs') childRow.dexs = createInactiveActivityMetric()
		}

		const emissionsMatch = emissionsProtocols?.[protocol.defillamaId] ?? emissionsProtocols?.[displayName]
		let emissionsMatched = false

		if (emissionsMatch) {
			emissionsMatched = true
			childRow.emissions = toEmissionsMetrics(emissionsMatch)
		} else if (emissionsProtocols !== null) {
			childRow.emissions = createZeroEmissionsMetrics()
		}

		if (protocol.parentProtocol && protocolMetadata[protocol.parentProtocol]) {
			const childStore: StoredChildProtocol = {
				row: childRow,
				defillamaId: protocol.defillamaId,
				// Fork members can display default zero without contributing to parent default history.
				contributesDefaultTvl,
				contributesExtraTvls: protocol.category !== 'Bridge' && (protocol.tvl !== null || normalizedFork !== null),
				emissionsMatched
			}
			const siblings = parentStore[protocol.parentProtocol]
			if (siblings) siblings.push(childStore)
			else parentStore[protocol.parentProtocol] = [childStore]
		} else {
			protocolsStore[protocol.defillamaId] = childRow
		}
	}

	const storeChildrenUngrouped = (children: Array<StoredChildProtocol>) => {
		for (const child of children) protocolsStore[child.defillamaId] = child.row
	}

	// A parent row only represents a real group. Chain and fork filters can leave one eligible child.
	for (const parentId in parentStore) {
		const children = parentStore[parentId]
		if (children?.length === 1) {
			storeChildrenUngrouped(children)
			delete parentStore[parentId]
		}
	}

	for (const parentProtocol of parentProtocols) {
		const childProtocols = parentStore[parentProtocol.id]
		if (!childProtocols || childProtocols.length <= 1) continue

		const parentMetadata = protocolMetadata[parentProtocol.id]
		if (!parentMetadata?.displayName) {
			storeChildrenUngrouped(childProtocols)
			delete parentStore[parentProtocol.id]
			continue
		}

		const parentTvl = normalizedFork
			? aggregateForkParentTvls(childProtocols)
			: aggregateCanonicalParentTvls(childProtocols)
		const parentFees = aggregateFees(childProtocols, parentProtocol.mcap)
		const parentRevenue = aggregateRevenue(childProtocols, parentProtocol.mcap)
		const parentHoldersRevenue = aggregateHoldersRevenue(childProtocols)
		const parentActivity = {} as Partial<Record<ProtocolRankingActivitySourceKey, ProtocolRankingActivityMetric>>
		for (const metricKey of activityMetricKeys) {
			const metric = aggregateActivityMetric(childProtocols, metricKey)
			if (metric) parentActivity[metricKey] = metric
		}
		let parentEmissions = aggregateEmissions(childProtocols)
		if (!parentEmissions) {
			const parentEmissionsMatch = emissionsProtocols?.[parentMetadata.displayName]
			if (parentEmissionsMatch) {
				parentEmissions = toEmissionsMetrics(parentEmissionsMatch)
			}
			if (!parentEmissions && emissionsProtocols !== null) {
				parentEmissions = createZeroEmissionsMetrics()
			}
		}

		const categorySet = new Set<string>()
		const chainsSet = new Set<string>()
		let parentStrikeTvl = false
		for (const child of childProtocols) {
			if (child.row.category) categorySet.add(child.row.category)
			for (const childChain of child.row.chains) chainsSet.add(childChain)
			if (child.row.strikeTvl) parentStrikeTvl = true
		}
		let parentCategory: string | null = null
		if (categorySet.size === 1) {
			for (const category of categorySet) parentCategory = category
		}

		const parentTvlChange =
			parentTvl?.default.tvl != null
				? {
						change1d: getPercentChange(parentTvl.default.tvl, parentTvl.default.tvlPrevDay),
						change7d: getPercentChange(parentTvl.default.tvl, parentTvl.default.tvlPrevWeek),
						change1m: getPercentChange(parentTvl.default.tvl, parentTvl.default.tvlPrevMonth)
					}
				: null
		const parentProtocolTvl = parentTvl?.default.tvl ?? null
		const parentMcapTvl = getMcapTvlRatio(parentProtocol.mcap, parentProtocolTvl)
		const publicChildren: Array<IChildProtocol> = []
		for (const child of childProtocols) publicChildren.push(child.row)
		const parentRow: IProtocol = {
			id: parentProtocol.id,
			name: parentMetadata.displayName,
			slug: slug(parentMetadata.displayName),
			logo: parentProtocol.logo,
			category: parentCategory,
			childProtocols: publicChildren,
			chains: Array.from(chainsSet),
			tvl: parentTvl,
			tvlChange: parentTvlChange,
			strikeTvl: parentStrikeTvl,
			mcap: parentProtocol.mcap,
			tokenPrice: parentProtocol.gecko_id
				? (protocolTokenPrices[`coingecko:${parentProtocol.gecko_id}`]?.price ?? null)
				: null,
			mcaptvl: parentMcapTvl,
			...(parentFees ? { fees: parentFees } : {}),
			...(parentRevenue ? { revenue: parentRevenue } : {}),
			...parentActivity,
			...(parentHoldersRevenue ? { holdersRevenue: parentHoldersRevenue } : {}),
			...(parentEmissions ? { emissions: parentEmissions } : {})
		}
		protocolsStore[parentProtocol.id] = parentRow
		delete parentStore[parentProtocol.id]
	}

	// If lite/protocols2 references an unknown parent, preserve its children as ordinary rows.
	for (const parentId in parentStore) {
		const children = parentStore[parentId]
		if (children) storeChildrenUngrouped(children)
	}

	return Object.values(protocolsStore).sort((a, b) => (b.tvl?.default?.tvl ?? 0) - (a.tvl?.default?.tvl ?? 0))
}
