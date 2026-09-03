import { buildProDashboardChainMetadataByName, getProDashboardChainMetadata } from './chainMetadata'
import {
	chartNeedsGeckoId,
	getProDashboardChartSourceQueryKey,
	type ProDashboardChartSourceQueryKey
} from './chartSource'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { ProDashboardAppMetadata, ProDashboardChartRequest } from './dataContracts'
import { buildProDashboardParentMapping, type ProDashboardProtocolCatalog } from './protocolCatalog'
import {
	type ChartConfig,
	isProDashboardChartType,
	limitMultiChartItems,
	type MetricConfig,
	type ProDashboardChartType
} from './types'

export interface ProDashboardChartSourcePlanEntry {
	queryKey: ProDashboardChartSourceQueryKey
	request: ProDashboardChartRequest
	skipReason?: string
}

type ProtocolMetadata = ProDashboardAppMetadata['protocols'][string]

// These are the same capability flags used by the Pro chart picker. Persisted
// dashboards can outlive a protocol adapter, so the stream must not call an API
// that current metadata already says the protocol does not expose.
const PROTOCOL_SOURCE_FLAGS: Partial<Record<ProDashboardChartType, readonly (keyof ProtocolMetadata)[]>> = {
	tvl: ['tvl'],
	volume: ['dexs'],
	fees: ['fees'],
	revenue: ['revenue'],
	incentives: ['emissions', 'incentives'],
	unlocks: ['emissions', 'incentives'],
	treasury: ['treasury'],
	holdersRevenue: ['holdersRevenue'],
	perps: ['perps'],
	openInterest: ['openInterest'],
	aggregators: ['dexAggregators'],
	perpsAggregators: ['perpsAggregators'],
	bridgeAggregators: ['bridgeAggregators'],
	optionsPremium: ['optionsPremiumVolume'],
	optionsNotional: ['optionsNotionalVolume'],
	activeUsers: ['activeUsers'],
	newUsers: ['newUsers'],
	txs: ['txCount'],
	gasUsed: ['gasUsed'],
	medianApy: ['yields'],
	borrowed: ['borrowed']
}

function buildProtocolMetadataBySlug(appMetadata: ProDashboardAppMetadata | null) {
	const protocolsBySlug = new Map<string, ProtocolMetadata[]>()
	const protocols = appMetadata?.protocols
	if (!protocols) return protocolsBySlug
	for (const protocolId in protocols) {
		const protocol = protocols[protocolId]
		if (protocol === undefined) continue
		if (!protocol.name) continue
		const normalizedSlug = protocol.name.toLowerCase()
		const records = protocolsBySlug.get(normalizedSlug)
		if (records) records.push(protocol)
		else protocolsBySlug.set(normalizedSlug, [protocol])
	}
	return protocolsBySlug
}

function getUnsupportedProtocolSourceReason(
	request: ProDashboardChartRequest,
	protocolsBySlug: Map<string, ProtocolMetadata[]>,
	childrenByParentSlug: ReadonlyMap<string, string[]>
): string | undefined {
	if (!request.protocol || protocolsBySlug.size === 0) return undefined
	const protocolSlug = request.protocol.toLowerCase()
	const metadata = protocolsBySlug.get(protocolSlug)
	if (!metadata) return undefined
	if (!isProDashboardChartType(request.type)) return undefined
	const requiredFlags = PROTOCOL_SOURCE_FLAGS[request.type]
	if (!requiredFlags) return undefined
	for (const protocol of metadata) {
		for (const flag of requiredFlags) {
			if (protocol[flag]) return undefined
		}
	}

	for (const childSlug of childrenByParentSlug.get(protocolSlug) ?? []) {
		const childMetadata = protocolsBySlug.get(childSlug.toLowerCase())
		// Missing child metadata is unknown, not proof that the whole parent is unsupported.
		if (!childMetadata) return undefined
		for (const protocol of childMetadata) {
			for (const flag of requiredFlags) {
				if (protocol[flag]) return undefined
			}
		}
	}
	return `protocol does not support ${request.type}`
}

function getUnsupportedChainSourceReason(
	request: ProDashboardChartRequest,
	chainsByName: Map<string, ProDashboardAppMetadata['chains'][string]>
): string | undefined {
	if (!request.chain || chainsByName.size === 0) return undefined
	const metadata = chainsByName.get(request.chain.toLowerCase())
	if (!metadata) return undefined

	switch (request.type) {
		case 'stablecoins':
			return metadata.stablecoins ? undefined : 'chain does not support stablecoin supply'
		case 'stablecoinInflows':
			return metadata.inflows ? undefined : 'chain does not support stablecoin inflows'
		case 'optionsPremium':
			return metadata.optionsPremiumVolume ? undefined : 'chain does not support options premium volume'
		case 'optionsNotional':
			return metadata.optionsNotionalVolume ? undefined : 'chain does not support options notional volume'
		case 'openInterest':
			return metadata.openInterest ? undefined : 'chain does not support open interest'
		case 'activeUsers':
			return metadata.chainActiveUsers ? undefined : 'chain does not expose an active-address pseudo-protocol'
		case 'newUsers':
			return metadata.chainNewUsers ? undefined : 'chain does not expose a new-address pseudo-protocol'
		case 'txs':
			return metadata.txCount ? undefined : 'chain does not expose transaction counts'
		case 'bridgedTvl':
			return metadata.chainAssets ? undefined : 'chain does not support bridged TVL'
		default:
			return undefined
	}
}

function toChartRequest(chart: ChartConfig): ProDashboardChartRequest {
	return {
		type: chart.type,
		...(chart.subjectType === 'protocol'
			? { subjectType: 'protocol', protocol: chart.protocol }
			: { subjectType: 'chain', chain: chart.chain }),
		...(chart.geckoId !== undefined ? { geckoId: chart.geckoId } : {}),
		...(chart.dataType !== undefined ? { dataType: chart.dataType } : {})
	}
}

function toMetricRequest(
	metric: MetricConfig,
	protocolsBySlug: Map<string, ProDashboardProtocolCatalog['protocols'][number]>,
	chainsByName: Map<string, ProDashboardProtocolCatalog['chains'][number]>
): ProDashboardChartRequest {
	const itemType = metric.subject.itemType
	const item = itemType === 'protocol' ? metric.subject.protocol : metric.subject.chain

	const protocol = itemType === 'protocol' ? protocolsBySlug.get(item) : undefined
	const chain = itemType === 'chain' ? chainsByName.get(item) : undefined
	return {
		type: metric.type,
		...(itemType === 'protocol' ? { subjectType: 'protocol', protocol: item } : { subjectType: 'chain', chain: item }),
		geckoId: metric.subject.geckoId ?? protocol?.geckoId ?? chain?.gecko_id ?? null
	}
}

/** Build each network source once, then seed every card through its shared query key. */
export function buildProDashboardChartSourcePlan(
	items: DashboardItemConfig[],
	catalog: ProDashboardProtocolCatalog | null,
	appMetadata: ProDashboardAppMetadata | null = null
): ProDashboardChartSourcePlanEntry[] {
	const protocolsBySlug = new Map<string, ProDashboardProtocolCatalog['protocols'][number]>()
	for (const protocol of catalog?.protocols ?? []) protocolsBySlug.set(protocol.slug, protocol)
	const chainsByName = new Map<string, ProDashboardProtocolCatalog['chains'][number]>()
	for (const chain of catalog?.chains ?? []) chainsByName.set(chain.name, chain)
	const chainMetadataByName = buildProDashboardChainMetadataByName(appMetadata?.chains)
	const protocolMetadataBySlug = buildProtocolMetadataBySlug(appMetadata)
	const childrenByParentSlug = buildProDashboardParentMapping(catalog?.protocols ?? [])

	const plan = new Map<string, ProDashboardChartSourcePlanEntry>()
	const addRequest = (inputRequest: ProDashboardChartRequest) => {
		const chainMetadata =
			inputRequest.subjectType === 'chain'
				? getProDashboardChainMetadata(chainMetadataByName, inputRequest.chain)
				: undefined
		const request =
			inputRequest.type === 'bridgedTvl' && chainMetadata
				? { ...inputRequest, chainAssetId: chainMetadata.id }
				: inputRequest
		const itemType = request.subjectType
		// Missing catalog metadata must remain an unseeded query so the client can retry it.
		if (chartNeedsGeckoId(request.type, itemType) && !request.geckoId) return
		const queryKey = getProDashboardChartSourceQueryKey(request)
		const serializedKey = JSON.stringify(queryKey)
		if (!plan.has(serializedKey)) {
			const skipReason =
				(itemType === 'protocol' && catalog && !protocolsBySlug.has(request.protocol)
					? 'protocol is not in the canonical Pro catalog'
					: undefined) ??
				getUnsupportedProtocolSourceReason(request, protocolMetadataBySlug, childrenByParentSlug) ??
				getUnsupportedChainSourceReason(request, chainMetadataByName)
			plan.set(serializedKey, {
				queryKey,
				request,
				...(skipReason !== undefined ? { skipReason } : {})
			})
		}
	}

	for (const item of items) {
		if (item.kind === 'chart') {
			addRequest(toChartRequest(item))
			continue
		}
		if (item.kind === 'multi') {
			for (const chart of limitMultiChartItems(item.items)) {
				addRequest(toChartRequest(chart))
			}
			continue
		}
		if (item.kind === 'metric') {
			const request = toMetricRequest(item, protocolsBySlug, chainsByName)
			addRequest(request)
		}
	}

	return Array.from(plan.values())
}
