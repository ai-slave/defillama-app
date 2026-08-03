import type {
	AdapterBreakdown,
	AdapterChainProtocol,
	IAdapterChainMetrics
} from '~/containers/AdapterMetrics/api.types'
import { getDimensionChainNameMap } from '~/containers/AdapterMetrics/chainNameMap'
import { slug } from '~/utils'
import { fetchEmissionsBreakdownAggregated } from './api'
import type { EmissionsBreakdownAggregatedResponse, EmissionsBreakdownProtocol } from './api.types'
import type {
	ChainIncentivesSummary,
	DimensionEarningsOverviewResult,
	DimensionEarningsProtocolWithEmissions,
	ProtocolEmissionsLookup,
	ProtocolEmissionsLookupEntry,
	ProtocolIncentivesSummary
} from './types'

const INCENTIVES_METHODOLOGY =
	'Tokens allocated to users through liquidity mining or incentive schemes, typically as part of governance or reward mechanisms.'

type NonEmptyArray<T> = [T, ...T[]]

function resolveInternalChainName(displayChain: string, chainNameMap: Record<string, string>) {
	return chainNameMap[displayChain] ?? null
}

function groupProtocolsByParent<T extends { parentProtocol?: string | null; defillamaId: string }>(
	protocols: T[]
): Map<string, NonEmptyArray<T>> {
	const protocolGroups = new Map<string, NonEmptyArray<T>>()

	for (const protocol of protocols) {
		const parentKey = protocol.parentProtocol || protocol.defillamaId
		const group = protocolGroups.get(parentKey)
		if (group) group.push(protocol)
		else protocolGroups.set(parentKey, [protocol])
	}

	return protocolGroups
}

function mergeBreakdowns(
	protocols: readonly AdapterChainProtocol[],
	breakdownField: 'breakdown24h' | 'breakdown30d',
	totalField: 'total24h' | 'total30d'
): AdapterBreakdown | null {
	const merged: Record<string, Record<string, number>> = {}
	for (const protocol of protocols) {
		const breakdown = protocol[breakdownField]
		if (breakdown == null) {
			// A successful adapter listing uses a missing period for zero activity. A positive
			// period without its required breakdown is still incomplete.
			if ((protocol[totalField] ?? 0) !== 0) return null
			continue
		}
		for (const chainName in breakdown) {
			const protocolData = breakdown[chainName]
			if (protocolData === undefined) continue
			const mergedChain = merged[chainName] ?? (merged[chainName] = {})
			for (const protocolName in protocolData) {
				const value = protocolData[protocolName]
				if (value === undefined) continue
				mergedChain[protocolName] = (mergedChain[protocolName] ?? 0) + value
			}
		}
	}
	return merged
}

function sumRevenueValues(values: Record<string, number> | undefined): number {
	let total = 0
	if (!values) return total
	for (const key in values) {
		const value = values[key]
		if (value !== undefined) total += value
	}
	return total
}

function sumRevenueBreakdown(breakdown: AdapterBreakdown | null | undefined): number {
	let total = 0
	if (!breakdown) return total
	for (const chain in breakdown) total += sumRevenueValues(breakdown[chain])
	return total
}

type DimensionEarningsChainSource = Pick<
	DimensionEarningsProtocolWithEmissions,
	'total24h' | 'total30d' | 'breakdown24h' | 'breakdown30d' | '_emissions'
>

function calculateChainPeriodEarnings({
	breakdown,
	totalRevenue,
	chainName,
	emission,
	hasEmissionsMatch
}: {
	breakdown: AdapterBreakdown | null | undefined
	totalRevenue: number | null
	chainName: string
	emission: number | null
	hasEmissionsMatch: boolean
}): number | null {
	if (hasEmissionsMatch && emission === null) return null

	const resolvedEmission = emission ?? 0
	if (breakdown == null) {
		return totalRevenue === 0 && resolvedEmission === 0 ? 0 : null
	}

	const chainRevenue = sumRevenueValues(breakdown[chainName])
	if (resolvedEmission === 0) return chainRevenue

	if (totalRevenue === null || totalRevenue <= 0) return null
	return chainRevenue - resolvedEmission * (chainRevenue / totalRevenue)
}

function resolveRevenueTotal(
	breakdown: AdapterBreakdown | null | undefined,
	totalEarnings: number | null | undefined,
	emission: number | null,
	hasEmissionsMatch: boolean
): number | null {
	if (breakdown != null) return sumRevenueBreakdown(breakdown)
	if (hasEmissionsMatch && emission === null) return null
	return (totalEarnings ?? 0) + (emission ?? 0)
}

function calculateEstimatedDimensionProtocolChainEarnings(
	protocol: DimensionEarningsChainSource,
	chainName: string,
	totalRevenue24h = resolveRevenueTotal(
		protocol.breakdown24h,
		protocol.total24h,
		protocol._emissions?.emission24h ?? null,
		protocol._emissions !== undefined
	),
	totalRevenue30d = resolveRevenueTotal(
		protocol.breakdown30d,
		protocol.total30d,
		protocol._emissions?.emission30d ?? null,
		protocol._emissions !== undefined
	)
): { total24h: number | null; total30d: number | null } | undefined {
	if (protocol.breakdown24h?.[chainName] === undefined && protocol.breakdown30d?.[chainName] === undefined) {
		return undefined
	}

	const emissions = protocol._emissions
	const hasEmissionsMatch = emissions !== undefined
	return {
		total24h: calculateChainPeriodEarnings({
			breakdown: protocol.breakdown24h,
			totalRevenue: totalRevenue24h,
			chainName,
			emission: emissions?.emission24h ?? null,
			hasEmissionsMatch
		}),
		total30d: calculateChainPeriodEarnings({
			breakdown: protocol.breakdown30d,
			totalRevenue: totalRevenue30d,
			chainName,
			emission: emissions?.emission30d ?? null,
			hasEmissionsMatch
		})
	}
}

export function getEstimatedDimensionProtocolChainEarnings(
	protocol: DimensionEarningsChainSource,
	chainName: string
): { total24h: number | null; total30d: number | null } | undefined {
	return calculateEstimatedDimensionProtocolChainEarnings(protocol, chainName)
}

export function forEachEstimatedDimensionProtocolChainEarnings(
	protocol: DimensionEarningsChainSource,
	visit: (chainName: string, total24h: number | null, total30d: number | null) => void
): void {
	const chainNames = new Set<string>()
	for (const chainName in protocol.breakdown24h ?? {}) chainNames.add(chainName)
	for (const chainName in protocol.breakdown30d ?? {}) chainNames.add(chainName)
	const hasEmissionsMatch = protocol._emissions !== undefined
	const totalRevenue24h = resolveRevenueTotal(
		protocol.breakdown24h,
		protocol.total24h,
		protocol._emissions?.emission24h ?? null,
		hasEmissionsMatch
	)
	const totalRevenue30d = resolveRevenueTotal(
		protocol.breakdown30d,
		protocol.total30d,
		protocol._emissions?.emission30d ?? null,
		hasEmissionsMatch
	)

	for (const chainName of chainNames) {
		const earnings = calculateEstimatedDimensionProtocolChainEarnings(
			protocol,
			chainName,
			totalRevenue24h,
			totalRevenue30d
		)
		if (earnings) visit(chainName, earnings.total24h, earnings.total30d)
	}
}

function aggregateDimensionProtocolVersions(
	protocolVersions: NonEmptyArray<AdapterChainProtocol>
): AdapterChainProtocol {
	let total24h = 0
	let total7d = 0
	let total30d = 0
	let total1y = 0
	let totalAllTime = 0
	const chains = new Set<string>()

	for (const protocol of protocolVersions) {
		total24h += protocol.total24h ?? 0
		total7d += protocol.total7d ?? 0
		total30d += protocol.total30d ?? 0
		total1y += protocol.total1y ?? 0
		totalAllTime += protocol.totalAllTime ?? 0
		for (const chain of protocol.chains) chains.add(chain)
	}

	const aggregatedRevenue = {
		total24h,
		total7d,
		total30d,
		total1y,
		totalAllTime
	}

	const mergedBreakdown24h = mergeBreakdowns(protocolVersions, 'breakdown24h', 'total24h')
	const mergedBreakdown30d = mergeBreakdowns(protocolVersions, 'breakdown30d', 'total30d')

	const parentProtocol = protocolVersions[0]
	const groupedName = parentProtocol.linkedProtocols?.[0] || parentProtocol.parentProtocol || parentProtocol.name

	return {
		...parentProtocol,
		name: groupedName,
		displayName: groupedName,
		slug: slug(groupedName),
		...aggregatedRevenue,
		chains: Array.from(chains),
		breakdown24h: mergedBreakdown24h,
		breakdown30d: mergedBreakdown30d
	}
}

interface IndexedEmission {
	index: number
	protocol: EmissionsBreakdownProtocol
}

interface DimensionEmissionIndex {
	byIdentity: Map<string, IndexedEmission>
	byName: Map<string, IndexedEmission>
}

function buildDimensionEmissionIndex(emissionsData: EmissionsBreakdownAggregatedResponse): DimensionEmissionIndex {
	const byIdentity = new Map<string, IndexedEmission>()
	const byName = new Map<string, IndexedEmission>()
	for (const [index, protocol] of emissionsData.protocols.entries()) {
		const indexed = { index, protocol }
		if (!byIdentity.has(protocol.defillamaId)) byIdentity.set(protocol.defillamaId, indexed)
		for (const linkedId of protocol.linked) {
			if (!byIdentity.has(linkedId)) byIdentity.set(linkedId, indexed)
		}
		if (!byName.has(protocol.name)) byName.set(protocol.name, indexed)
	}
	return { byIdentity, byName }
}

function findMatchedEmissionForDimensionProtocol(
	protocolVersions: NonEmptyArray<AdapterChainProtocol>,
	emissionIndex: DimensionEmissionIndex
): EmissionsBreakdownProtocol | undefined {
	const parentKey = protocolVersions[0].parentProtocol || protocolVersions[0].defillamaId
	let matched = emissionIndex.byIdentity.get(parentKey)
	for (const protocol of protocolVersions) {
		const candidate = emissionIndex.byIdentity.get(protocol.defillamaId)
		if (candidate && (!matched || candidate.index < matched.index)) matched = candidate
	}

	// Chain category entries sometimes only match by protocol name.
	if (!matched && protocolVersions.length === 1 && protocolVersions[0].category === 'Chain') {
		const protocol = protocolVersions[0]
		const nameMatch = emissionIndex.byName.get(protocol.name)
		const displayNameMatch = emissionIndex.byName.get(protocol.displayName)
		if (!nameMatch) matched = displayNameMatch
		else if (!displayNameMatch || nameMatch.index < displayNameMatch.index) matched = nameMatch
		else matched = displayNameMatch
	}

	return matched?.protocol
}

function calculateDimensionProtocolEarnings(
	protocolData: AdapterChainProtocol,
	emissions?: EmissionsBreakdownProtocol
): DimensionEarningsProtocolWithEmissions {
	const subtractEmissions = (
		revenue: number | null | undefined,
		emission: number | null,
		hasEmissionsMatch: boolean
	): number | null => (hasEmissionsMatch && emission === null ? null : (revenue ?? 0) - (emission ?? 0))
	const hasEmissionsMatch = emissions !== undefined
	return {
		...protocolData,
		total24h: subtractEmissions(protocolData.total24h, emissions?.emission24h ?? null, hasEmissionsMatch),
		total7d: subtractEmissions(protocolData.total7d, emissions?.emission7d ?? null, hasEmissionsMatch),
		total30d: subtractEmissions(protocolData.total30d, emissions?.emission30d ?? null, hasEmissionsMatch),
		total1y: subtractEmissions(protocolData.total1y, emissions?.emissions1y ?? null, hasEmissionsMatch),
		totalAllTime: subtractEmissions(protocolData.totalAllTime, emissions?.emissionsAllTime ?? null, hasEmissionsMatch),
		// The emissions payload has no comparison-period values, so revenue changes cannot be presented as earnings changes.
		total48hto24h: null,
		total14dto7d: null,
		total60dto30d: null,
		total7DaysAgo: null,
		total30DaysAgo: null,
		annualized1y: null,
		change_1d: null,
		change_7d: null,
		change_1m: null,
		change_7dover7d: null,
		change_30dover30d: null,
		...(emissions !== undefined ? { _emissions: emissions } : {})
	}
}

function buildDimensionEarningsProtocols(
	data: { protocols: AdapterChainProtocol[] },
	emissionsData: EmissionsBreakdownAggregatedResponse
): DimensionEarningsProtocolWithEmissions[] {
	const protocolGroups = groupProtocolsByParent(data.protocols)
	const emissionIndex = buildDimensionEmissionIndex(emissionsData)
	const processedData: DimensionEarningsProtocolWithEmissions[] = []

	for (const [_parentKey, protocolVersions] of protocolGroups) {
		const emissions = findMatchedEmissionForDimensionProtocol(protocolVersions, emissionIndex)
		if (protocolVersions.length === 1) {
			processedData.push(calculateDimensionProtocolEarnings(protocolVersions[0], emissions))
		} else {
			const aggregatedProtocol = aggregateDimensionProtocolVersions(protocolVersions)
			processedData.push(calculateDimensionProtocolEarnings(aggregatedProtocol, emissions))
		}
	}

	return processedData
}

export async function getDimensionAdapterChainEarningsOverview({
	chain,
	overviewData,
	totalDataChart
}: {
	chain: string
	overviewData: IAdapterChainMetrics
	totalDataChart: Array<[number, number]>
}): Promise<DimensionEarningsOverviewResult> {
	const isChainSpecific = chain !== '' && chain !== 'All'
	const [emissionsData, chainNameMap] = await Promise.all([
		fetchEmissionsBreakdownAggregated(),
		isChainSpecific ? getDimensionChainNameMap() : Promise.resolve<Record<string, string>>({})
	])
	if (emissionsData === null || chainNameMap === null) return { status: 'unavailable' }

	const earningsData = buildDimensionEarningsProtocols(overviewData, emissionsData)

	let filteredEarningsData = earningsData
	let chainSpecificTotal24h: number | null = 0
	let chainSpecificTotal7d: number | null = null
	let chainSpecificTotal30d: number | null = 0
	let chainSpecificTotal1y: number | null = null
	let chainSpecificTotalAllTime: number | null = null

	if (isChainSpecific) {
		const internalChainName = resolveInternalChainName(chain, chainNameMap)
		if (internalChainName === null) return { status: 'unavailable' }

		filteredEarningsData = []
		for (const protocol of earningsData) {
			const estimatedChainEarnings = getEstimatedDimensionProtocolChainEarnings(protocol, internalChainName)
			if (!estimatedChainEarnings) continue

			chainSpecificTotal24h =
				chainSpecificTotal24h === null || estimatedChainEarnings.total24h === null
					? null
					: chainSpecificTotal24h + estimatedChainEarnings.total24h
			chainSpecificTotal30d =
				chainSpecificTotal30d === null || estimatedChainEarnings.total30d === null
					? null
					: chainSpecificTotal30d + estimatedChainEarnings.total30d

			filteredEarningsData.push({
				...protocol,
				total24h: estimatedChainEarnings.total24h,
				total7d: null,
				total30d: estimatedChainEarnings.total30d,
				total1y: null,
				totalAllTime: null
			})
		}
	} else {
		chainSpecificTotal7d = 0
		chainSpecificTotal1y = 0
		chainSpecificTotalAllTime = 0
		for (const protocol of earningsData) {
			chainSpecificTotal24h =
				chainSpecificTotal24h == null || protocol.total24h == null ? null : chainSpecificTotal24h + protocol.total24h
			chainSpecificTotal7d =
				chainSpecificTotal7d == null || protocol.total7d == null ? null : chainSpecificTotal7d + protocol.total7d
			chainSpecificTotal30d =
				chainSpecificTotal30d == null || protocol.total30d == null ? null : chainSpecificTotal30d + protocol.total30d
			chainSpecificTotal1y =
				chainSpecificTotal1y == null || protocol.total1y == null ? null : chainSpecificTotal1y + protocol.total1y
			chainSpecificTotalAllTime =
				chainSpecificTotalAllTime == null || protocol.totalAllTime == null
					? null
					: chainSpecificTotalAllTime + protocol.totalAllTime
		}
		filteredEarningsData = earningsData
	}

	return {
		status: 'available',
		overview: {
			...overviewData,
			totalDataChart,
			chain,
			total24h: chainSpecificTotal24h,
			total48hto24h: null,
			total7d: chainSpecificTotal7d,
			total14dto7d: null,
			total30d: chainSpecificTotal30d,
			total60dto30d: null,
			total7DaysAgo: null,
			total30DaysAgo: null,
			total1y: chainSpecificTotal1y,
			annualized1y: null,
			totalAllTime: chainSpecificTotalAllTime,
			change_1d: null,
			change_7d: null,
			change_1m: null,
			change_7dover7d: null,
			change_30dover30d: null,
			protocols: filteredEarningsData
		}
	}
}

export function extractChainIncentivesFromAggregatedEmissions({
	emissionsData,
	chainName
}: {
	emissionsData: EmissionsBreakdownAggregatedResponse | null
	chainName: string
}): ChainIncentivesSummary | null {
	if (!emissionsData) return null
	const protocolData = emissionsData.protocols.find((item) => item.chain === chainName)
	if (!protocolData) return null

	return {
		emissions24h: protocolData.emission24h ?? null,
		emissions7d: protocolData.emission7d ?? null,
		emissions30d: protocolData.emission30d ?? null
	}
}

export async function getChainIncentivesFromAggregatedEmissions(
	chainName: string
): Promise<ChainIncentivesSummary | null> {
	const emissionsData = await fetchEmissionsBreakdownAggregated()
	return extractChainIncentivesFromAggregatedEmissions({ emissionsData, chainName })
}

export function buildProtocolEmissionsLookup(
	emissionsData: EmissionsBreakdownAggregatedResponse | null
): ProtocolEmissionsLookup {
	const lookup: ProtocolEmissionsLookup = {}
	if (!emissionsData?.protocols) return lookup

	for (const emissionProtocol of emissionsData.protocols) {
		if (
			emissionProtocol.emission24h == null &&
			emissionProtocol.emission7d == null &&
			emissionProtocol.emission30d == null &&
			emissionProtocol.emissions1y == null &&
			emissionProtocol.emissionsMonthlyAverage1y == null &&
			emissionProtocol.emissionsAllTime == null
		) {
			continue
		}

		const key = emissionProtocol.defillamaId || emissionProtocol.name
		const entry: ProtocolEmissionsLookupEntry = {
			emissions24h: emissionProtocol.emission24h ?? null,
			emissions7d: emissionProtocol.emission7d ?? null,
			emissions30d: emissionProtocol.emission30d ?? null,
			emissions1y: emissionProtocol.emissions1y ?? null,
			emissionsMonthlyAverage1y: emissionProtocol.emissionsMonthlyAverage1y ?? null,
			emissionsAllTime: emissionProtocol.emissionsAllTime ?? null,
			name: emissionProtocol.name
		}

		lookup[key] = entry
	}

	return lookup
}

export async function getProtocolEmissionsLookupFromAggregated(): Promise<ProtocolEmissionsLookup> {
	const emissionsData = await fetchEmissionsBreakdownAggregated()
	return buildProtocolEmissionsLookup(emissionsData)
}

export function extractProtocolIncentivesFromAggregatedEmissions({
	emissionsData,
	protocolId,
	protocolDisplayName
}: {
	emissionsData: EmissionsBreakdownAggregatedResponse | null
	protocolId: string
	protocolDisplayName: string
}): ProtocolIncentivesSummary | null {
	if (!emissionsData) return null

	const protocolEmissionsData = emissionsData.protocols.find((item) =>
		protocolId.startsWith('parent#') ? item.name === protocolDisplayName : item.defillamaId === protocolId
	)

	if (!protocolEmissionsData) return null

	return {
		emissions24h: protocolEmissionsData.emission24h ?? null,
		emissions7d: protocolEmissionsData.emission7d ?? null,
		emissions30d: protocolEmissionsData.emission30d ?? null,
		emissions1y: protocolEmissionsData.emissions1y ?? null,
		emissionsAllTime: protocolEmissionsData.emissionsAllTime ?? null,
		emissionsMonthlyAverage1y: protocolEmissionsData.emissionsMonthlyAverage1y ?? null,
		methodology: INCENTIVES_METHODOLOGY
	}
}

export async function getProtocolIncentivesFromAggregatedEmissions({
	protocolId,
	protocolDisplayName
}: {
	protocolId: string
	protocolDisplayName: string
}): Promise<ProtocolIncentivesSummary | null> {
	const emissionsData = await fetchEmissionsBreakdownAggregated()
	return extractProtocolIncentivesFromAggregatedEmissions({
		emissionsData,
		protocolId,
		protocolDisplayName
	})
}
