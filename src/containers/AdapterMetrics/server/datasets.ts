import { fetchAdapterChainMetrics } from '~/containers/AdapterMetrics/api'
import type { AdapterBreakdown, IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import { getDimensionChainNameMap } from '~/containers/AdapterMetrics/chainNameMap'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import {
	isDimensionDatasetType,
	type DimensionDatasetProtocol,
	type DimensionDatasetResult,
	type DimensionDatasetType
} from '~/containers/AdapterMetrics/datasetTypes'
import {
	deriveMetricChanges,
	mergeEarningsMetricPeriods,
	mergeMetricPeriods
} from '~/containers/AdapterMetrics/metricPeriods'
import type { IAdapterChainOverview } from '~/containers/AdapterMetrics/types'
import type { EmissionsBreakdownProtocol } from '~/containers/Incentives/api.types'
import {
	forEachEstimatedDimensionProtocolChainEarnings,
	getDimensionAdapterChainEarningsOverview
} from '~/containers/Incentives/queries'
import { slug } from '~/utils'
import { mapWithConcurrency } from '~/utils/async'
import { toInternalSlug } from '~/utils/chainNormalizer'
import type { IChainMetadata } from '~/utils/metadata/types'

type DimensionDatasetAllSourceProtocol = IAdapterChainOverview['protocols'][number] & {
	_emissions?: EmissionsBreakdownProtocol
}

interface DimensionDatasetAllSource {
	allChains: string[]
	protocols: DimensionDatasetAllSourceProtocol[]
}

type DimensionDatasetRequestScheduler = <Result>(request: () => Promise<Result>) => Promise<Result>

export interface DimensionDatasetRequestScope {
	earningsRequests: Map<string, Promise<DimensionDatasetAllSource>>
	metricRequests: Map<string, Promise<IAdapterChainMetrics>>
	scheduleRequest: DimensionDatasetRequestScheduler
}

export const DIMENSION_DATASET_REQUEST_CONCURRENCY = 8

function createRequestScheduler(limit: number): DimensionDatasetRequestScheduler {
	let activeRequests = 0
	const pendingRequests: Array<() => void> = []

	return async <Result>(request: () => Promise<Result>): Promise<Result> => {
		if (activeRequests < limit) {
			activeRequests += 1
		} else {
			await new Promise<void>((start) => pendingRequests.push(start))
		}
		try {
			return await request()
		} finally {
			const nextRequest = pendingRequests.shift()
			if (nextRequest) nextRequest()
			else activeRequests -= 1
		}
	}
}

export function createDimensionDatasetRequestScope(): DimensionDatasetRequestScope {
	return {
		earningsRequests: new Map(),
		metricRequests: new Map(),
		scheduleRequest: createRequestScheduler(DIMENSION_DATASET_REQUEST_CONCURRENCY)
	}
}

function fetchAdapterChainMetricsOnce(
	requestScope: DimensionDatasetRequestScope,
	{
		adapterType,
		chain,
		dataType
	}: {
		adapterType: `${ADAPTER_TYPES}`
		chain: string
		dataType?: `${ADAPTER_DATA_TYPES}`
	}
): Promise<IAdapterChainMetrics> {
	const requestKey = [adapterType, chain, dataType ?? ''].join('|')
	let request = requestScope.metricRequests.get(requestKey)
	if (!request) {
		request = requestScope.scheduleRequest(() =>
			fetchAdapterChainMetrics({
				adapterType,
				chain,
				...(dataType === undefined ? {} : { dataType })
			})
		)
		requestScope.metricRequests.set(requestKey, request)
	}
	return request
}

type DimensionDatasetChainProtocol = DimensionDatasetProtocol & { chain: string }

function toDimensionDatasetProtocol(
	protocol: DimensionDatasetAllSourceProtocol | IAdapterChainOverview['protocols'][number],
	dataType: DimensionDatasetOptions['dataType']
): DimensionDatasetProtocol {
	const normalized: DimensionDatasetProtocol = {
		name: protocol.name,
		displayName: protocol.displayName,
		defillamaId: protocol.defillamaId,
		category: protocol.category,
		logo: protocol.logo,
		slug: protocol.slug,
		...('parentProtocol' in protocol && protocol.parentProtocol !== undefined
			? { parentProtocol: protocol.parentProtocol }
			: {}),
		chains: protocol.chains,
		total24h: protocol.total24h ?? null,
		total48hto24h: protocol.total48hto24h ?? null,
		total7d: protocol.total7d ?? null,
		total14dto7d: protocol.total14dto7d ?? null,
		total30d: protocol.total30d ?? null,
		total60dto30d: protocol.total60dto30d ?? null,
		total7DaysAgo: protocol.total7DaysAgo ?? null,
		total30DaysAgo: protocol.total30DaysAgo ?? null,
		total1y: protocol.total1y ?? null,
		annualized1y: protocol.annualized1y ?? null,
		totalAllTime: protocol.totalAllTime ?? null,
		change_1d: protocol.change_1d ?? null,
		change_7d: protocol.change_7d ?? null,
		change_1m: protocol.change_1m ?? null,
		change_7dover7d: protocol.change_7dover7d ?? null,
		change_30dover30d: protocol.change_30dover30d ?? null
	}

	if (dataType === ADAPTER_DATA_TYPES.DAILY_EARNINGS) {
		return {
			...normalized,
			total24h: protocol.total24h ?? null,
			total30d: protocol.total30d ?? null,
			change_1d: null,
			change_7d: null,
			change_1m: null,
			change_7dover7d: null,
			change_30dover30d: null
		}
	}

	return deriveMetricChanges(normalized)
}

function sumBreakdownValues(values: Record<string, number> | undefined): number {
	let total = 0
	if (!values) return total
	for (const key in values) {
		const value = values[key]
		if (value !== undefined) total += value
	}
	return total
}

function sumAvailableBreakdownValues(breakdown: AdapterBreakdown | null | undefined, chain: string): number | null {
	return breakdown == null ? null : sumBreakdownValues(breakdown[chain])
}

function buildDimensionToInternalChainMap(
	chainNameMap: Readonly<Record<string, string>>,
	canonicalDisplayChains: readonly string[],
	dimensionChains: ReadonlySet<string>
): Record<string, string> {
	type Candidate = { canonical: string | null; fallback: string | null; ambiguousFallback: boolean }
	const canonicalDisplays = new Set(canonicalDisplayChains)
	const candidates = new Map<string, Candidate>()
	for (const displayChain in chainNameMap) {
		const dimensionChain = chainNameMap[displayChain]
		if (dimensionChain === undefined) continue
		const internalChain = toInternalSlug(displayChain)
		const candidate = candidates.get(dimensionChain) ?? {
			canonical: null,
			fallback: null,
			ambiguousFallback: false
		}
		if (canonicalDisplays.has(displayChain)) {
			if (candidate.canonical !== null && candidate.canonical !== internalChain) {
				throw new Error(`Ambiguous canonical chain mapping for Dimensions key ${dimensionChain}`)
			}
			candidate.canonical = internalChain
		} else if (candidate.fallback === null) {
			candidate.fallback = internalChain
		} else if (candidate.fallback !== internalChain) {
			candidate.ambiguousFallback = true
		}
		candidates.set(dimensionChain, candidate)
	}

	const dimensionToInternalChain: Record<string, string> = {}
	for (const dimensionChain of dimensionChains) {
		const candidate = candidates.get(dimensionChain)
		if (!candidate) continue
		if (candidate.canonical !== null) dimensionToInternalChain[dimensionChain] = candidate.canonical
		else if (!candidate.ambiguousFallback && candidate.fallback !== null) {
			dimensionToInternalChain[dimensionChain] = candidate.fallback
		} else {
			throw new Error(`No canonical chain mapping for ambiguous Dimensions key ${dimensionChain}`)
		}
	}
	return dimensionToInternalChain
}

function toBatchedChainBreakdownProtocol(
	protocol: DimensionDatasetProtocol,
	chain: string,
	total24h: number | null,
	total30d: number | null
): DimensionDatasetChainProtocol {
	return {
		...protocol,
		chain,
		chains: [chain],
		total24h,
		total48hto24h: null,
		total7d: null,
		total14dto7d: null,
		total30d,
		total60dto30d: null,
		total7DaysAgo: null,
		total30DaysAgo: null,
		total1y: null,
		annualized1y: null,
		totalAllTime: null,
		change_1d: null,
		change_7d: null,
		change_1m: null,
		change_7dover7d: null,
		change_30dover30d: null
	}
}

function buildBatchedChainBreakdown(
	source: DimensionDatasetAllSourceProtocol,
	protocol: DimensionDatasetProtocol,
	dataType: DimensionDatasetOptions['dataType'],
	dimensionToInternalChain: Readonly<Record<string, string>>
): Record<string, DimensionDatasetChainProtocol> {
	const breakdown: Record<string, DimensionDatasetChainProtocol> = {}
	const addChainPeriods = (dimensionChain: string, total24h: number | null, total30d: number | null) => {
		const internalChain =
			dimensionToInternalChain[dimensionChain] ?? (dimensionChain === 'chain_global' ? dimensionChain : undefined)
		if (internalChain === undefined) return
		const existing = breakdown[internalChain]
		const mergedTotal24h =
			existing === undefined
				? total24h
				: existing.total24h == null || total24h === null
					? null
					: existing.total24h + total24h
		const mergedTotal30d =
			existing === undefined
				? total30d
				: existing.total30d == null || total30d === null
					? null
					: existing.total30d + total30d
		breakdown[internalChain] = toBatchedChainBreakdownProtocol(protocol, internalChain, mergedTotal24h, mergedTotal30d)
	}
	if (dataType === ADAPTER_DATA_TYPES.DAILY_EARNINGS) {
		forEachEstimatedDimensionProtocolChainEarnings(source, addChainPeriods)
		return breakdown
	}

	const chainNames = new Set<string>()
	for (const chain in source.breakdown24h ?? {}) chainNames.add(chain)
	for (const chain in source.breakdown30d ?? {}) chainNames.add(chain)
	for (const chain of chainNames) {
		addChainPeriods(
			chain,
			sumAvailableBreakdownValues(source.breakdown24h, chain),
			sumAvailableBreakdownValues(source.breakdown30d, chain)
		)
	}
	return breakdown
}

function toChainBreakdownProtocol(protocol: DimensionDatasetProtocol, chain: string): DimensionDatasetChainProtocol {
	return {
		...protocol,
		chain
	}
}

interface SelectedEarningsChain {
	displayName: string
	internalSlug: string
}

function projectSelectedEarningsDataset({
	protocols,
	selectedChains,
	unavailableChains,
	withChainBreakdown
}: {
	protocols: DimensionDatasetProtocol[]
	selectedChains: SelectedEarningsChain[]
	unavailableChains: string[]
	withChainBreakdown: boolean
}): DimensionDatasetResult {
	const selectedProtocols = new Map<string, DimensionDatasetProtocol>()
	for (const protocol of protocols) {
		for (const selectedChain of selectedChains) {
			const chainProtocol = protocol.chainBreakdown?.[selectedChain.internalSlug]
			if (!chainProtocol) continue
			const key = chainProtocol.defillamaId ?? chainProtocol.slug ?? chainProtocol.name
			let aggregate = selectedProtocols.get(key)
			if (aggregate) {
				mergeEarningsMetricPeriods(aggregate, chainProtocol)
				aggregate.chains.push(selectedChain.displayName)
			} else {
				aggregate = { ...chainProtocol, chains: [selectedChain.displayName] }
				selectedProtocols.set(key, aggregate)
			}
			if (withChainBreakdown) {
				const chainBreakdown = aggregate.chainBreakdown ?? (aggregate.chainBreakdown = {})
				chainBreakdown[selectedChain.internalSlug] = toChainBreakdownProtocol(chainProtocol, selectedChain.displayName)
			}
		}
	}

	const projectedProtocols: DimensionDatasetProtocol[] = []
	for (const protocol of selectedProtocols.values()) projectedProtocols.push(protocol)
	projectedProtocols.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
	return unavailableChains.length > 0
		? { status: 'partial', protocols: projectedProtocols, unavailableChains }
		: { status: 'complete', protocols: projectedProtocols }
}

interface DimensionDatasetOptions {
	adapterType: `${ADAPTER_TYPES}`
	route: string
	metricName: string
	chains?: string[]
	dataType?: `${ADAPTER_DATA_TYPES}` | 'dailyEarnings'
	chainGuard?: keyof IChainMetadata
	withChainBreakdown?: boolean
}

export async function fetchDimensionDataset(
	options: DimensionDatasetOptions,
	requestScope: DimensionDatasetRequestScope = createDimensionDatasetRequestScope()
): Promise<DimensionDatasetResult> {
	const { adapterType, chains, dataType, chainGuard, withChainBreakdown } = options
	const isEarnings = dataType === ADAPTER_DATA_TYPES.DAILY_EARNINGS
	const chainList: string[] = []
	const selectedChains = new Set<string>()
	for (const chain of chains ?? []) {
		const identity = chain.trim().toLowerCase()
		if (!identity || selectedChains.has(identity)) continue
		selectedChains.add(identity)
		chainList.push(chain.trim())
	}
	const allChains = chainList.length === 0 || selectedChains.has('all')

	if (allChains) {
		let request: Promise<DimensionDatasetAllSource>
		if (isEarnings) {
			const requestKey = [adapterType, 'All', dataType ?? ''].join('|')
			const cachedEarningsRequest = requestScope.earningsRequests.get(requestKey)
			if (cachedEarningsRequest) {
				request = cachedEarningsRequest
			} else {
				request = fetchAdapterChainMetricsOnce(requestScope, {
					adapterType,
					chain: 'All',
					dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE
				}).then(async (overviewData) => {
					const earnings = await getDimensionAdapterChainEarningsOverview({
						chain: 'All',
						overviewData,
						totalDataChart: []
					})
					if (earnings.status === 'unavailable') {
						throw new Error('Earnings are unavailable because emissions data could not be loaded')
					}
					return earnings.overview
				})
				requestScope.earningsRequests.set(requestKey, request)
			}
		} else {
			request = fetchAdapterChainMetricsOnce(requestScope, {
				adapterType,
				chain: 'All',
				...(dataType === undefined ? {} : { dataType })
			})
		}
		const [data, chainNameMap] = await Promise.all([
			request,
			withChainBreakdown ? getDimensionChainNameMap() : Promise.resolve<Record<string, string> | null>(null)
		])
		let dimensionToInternalChain: Record<string, string> = {}
		if (withChainBreakdown) {
			if (chainNameMap === null) {
				throw new Error('Adapter chain breakdown unavailable because the Dimensions chain-name map could not be loaded')
			}
			const dimensionChains = new Set<string>()
			for (const protocol of data.protocols) {
				for (const chain in protocol.breakdown24h ?? {}) dimensionChains.add(chain)
				for (const chain in protocol.breakdown30d ?? {}) dimensionChains.add(chain)
			}
			dimensionToInternalChain = buildDimensionToInternalChainMap(chainNameMap, data.allChains, dimensionChains)
		}
		const protocols: DimensionDatasetProtocol[] = []
		for (const sourceProtocol of data.protocols) {
			const protocol = toDimensionDatasetProtocol(sourceProtocol, dataType)
			if (withChainBreakdown) {
				protocol.chainBreakdown = buildBatchedChainBreakdown(
					sourceProtocol,
					protocol,
					dataType,
					dimensionToInternalChain
				)
			}
			protocols.push(protocol)
		}
		return {
			status: 'complete',
			protocols: protocols.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
		}
	}

	if (dataType === ADAPTER_DATA_TYPES.DAILY_EARNINGS) {
		const [metadataCache, chainNameMap] = await Promise.all([
			import('~/utils/metadata').then((m) => m.default),
			getDimensionChainNameMap()
		])
		const selectedEarningsChains: SelectedEarningsChain[] = []
		const unavailableChains: string[] = []
		for (const chainName of chainList) {
			const chainData = metadataCache.chainMetadata[slug(chainName)]
			if (!chainData || (chainGuard && !chainData[chainGuard]) || !chainNameMap?.[chainData.name]) {
				unavailableChains.push(chainData?.name ?? chainName)
				continue
			}
			selectedEarningsChains.push({ displayName: chainData.name, internalSlug: toInternalSlug(chainData.name) })
		}
		if (selectedEarningsChains.length === 0) {
			return { status: 'partial', protocols: [], unavailableChains }
		}

		try {
			const allEarnings = await fetchDimensionDataset(
				{
					...options,
					withChainBreakdown: true,
					chains: []
				},
				requestScope
			)
			return projectSelectedEarningsDataset({
				protocols: allEarnings.protocols,
				selectedChains: selectedEarningsChains,
				unavailableChains,
				withChainBreakdown: withChainBreakdown === true
			})
		} catch (error) {
			console.info('Selected-chain Earnings data unavailable', error)
			return {
				status: 'partial',
				protocols: [],
				unavailableChains: [...unavailableChains, ...selectedEarningsChains.map((chain) => chain.displayName)]
			}
		}
	}

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const allProtocolsMap = new Map<string, DimensionDatasetProtocol>()
	const unavailableChains: string[] = []
	const chainResults = await mapWithConcurrency(chainList, 8, async (chainName) => {
		const chainSlug = slug(chainName)
		const chainData = metadataCache.chainMetadata[chainSlug]
		if (!chainData) return { chainName, canonicalChainName: chainName, data: null }
		if (chainGuard && !chainData[chainGuard]) {
			return { chainName, canonicalChainName: chainData.name, data: null }
		}

		try {
			const request = fetchAdapterChainMetricsOnce(requestScope, {
				adapterType,
				chain: chainData.name,
				...(dataType === undefined ? {} : { dataType })
			})
			const data = await request
			return { chainName, canonicalChainName: chainData.name, data }
		} catch (error) {
			console.info(`Chain metrics data not found ${adapterType} : chain:${chainName}`, error)
			return { chainName, canonicalChainName: chainData.name, data: null }
		}
	})

	for (const result of chainResults) {
		const { chainName, canonicalChainName, data } = result
		if (!data) {
			unavailableChains.push(canonicalChainName)
			continue
		}

		for (const sourceProtocol of data.protocols) {
			const protocol = toDimensionDatasetProtocol(sourceProtocol, dataType)
			const key = protocol.defillamaId ?? protocol.slug ?? protocol.name
			const existing = allProtocolsMap.get(key)
			let aggregate: DimensionDatasetProtocol
			if (existing) {
				mergeMetricPeriods(existing, protocol)
				if (!existing.chains.includes(chainName)) existing.chains.push(chainName)
				aggregate = existing
			} else {
				aggregate = {
					...protocol,
					chains: [chainName]
				}
				allProtocolsMap.set(key, aggregate)
			}

			if (withChainBreakdown) {
				const chainBreakdown = aggregate.chainBreakdown ?? (aggregate.chainBreakdown = {})
				chainBreakdown[chainName.trim().toLowerCase()] = toChainBreakdownProtocol(protocol, chainName)
			}
		}
	}

	const protocols: DimensionDatasetProtocol[] = []
	for (const protocol of allProtocolsMap.values()) protocols.push(protocol)

	const sortedProtocols = protocols.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))

	return unavailableChains.length > 0
		? { status: 'partial', protocols: sortedProtocols, unavailableChains }
		: { status: 'complete', protocols: sortedProtocols }
}

type DimensionDatasetSpecShape<DatasetType extends DimensionDatasetType> = {
	datasetType: DatasetType
	options: Omit<DimensionDatasetOptions, 'chains'>
}

export const DIMENSION_DATASET_SPEC_BY_TYPE = {
	dexs: {
		datasetType: 'dexs',
		options: { adapterType: ADAPTER_TYPES.DEXS, route: 'dexs', metricName: 'DEX Volume' }
	},
	perps: {
		datasetType: 'perps',
		options: { adapterType: ADAPTER_TYPES.PERPS, route: 'perps', metricName: 'Perp Volume' }
	},
	aggregators: {
		datasetType: 'aggregators',
		options: {
			adapterType: ADAPTER_TYPES.AGGREGATORS,
			route: 'dex-aggregators',
			metricName: 'DEX Aggregator Volume'
		}
	},
	fees: {
		datasetType: 'fees',
		options: { adapterType: ADAPTER_TYPES.FEES, route: 'fees', metricName: 'Fees' }
	},
	revenue: {
		datasetType: 'revenue',
		options: {
			adapterType: ADAPTER_TYPES.FEES,
			route: 'revenue',
			metricName: 'Revenue',
			dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE
		}
	},
	earnings: {
		datasetType: 'earnings',
		options: {
			adapterType: ADAPTER_TYPES.FEES,
			route: 'earnings',
			metricName: 'Earnings',
			dataType: ADAPTER_DATA_TYPES.DAILY_EARNINGS,
			chainGuard: 'fees'
		}
	},
	'holders-revenue': {
		datasetType: 'holders-revenue',
		options: {
			adapterType: ADAPTER_TYPES.FEES,
			route: 'holders-revenue',
			metricName: 'Holders Revenue',
			dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE,
			chainGuard: 'fees'
		}
	},
	options: {
		datasetType: 'options',
		options: {
			adapterType: ADAPTER_TYPES.OPTIONS,
			route: 'options',
			metricName: 'Options Volume'
		}
	},
	'bridge-aggregators': {
		datasetType: 'bridge-aggregators',
		options: {
			adapterType: ADAPTER_TYPES.BRIDGE_AGGREGATORS,
			route: 'bridge-aggregators',
			metricName: 'Bridge Aggregator Volume'
		}
	}
} as const satisfies { [DatasetType in DimensionDatasetType]: DimensionDatasetSpecShape<DatasetType> }

export type DimensionDatasetSpec = (typeof DIMENSION_DATASET_SPEC_BY_TYPE)[DimensionDatasetType]

export function getDimensionDatasetSpec<T extends DimensionDatasetType>(
	datasetType: T
): (typeof DIMENSION_DATASET_SPEC_BY_TYPE)[T]
export function getDimensionDatasetSpec(datasetType: string): DimensionDatasetSpec | undefined
export function getDimensionDatasetSpec(datasetType: string): DimensionDatasetSpec | undefined {
	return isDimensionDatasetType(datasetType) ? DIMENSION_DATASET_SPEC_BY_TYPE[datasetType] : undefined
}
