import {
	chartNeedsGeckoId,
	getProDashboardChartSourceQueryKey,
	type ProDashboardChartSourceQueryKey
} from './chartSource'
import type { ProDashboardAppMetadata, ProDashboardChartRequest } from './dataContracts'
import type { ProDashboardProtocolCatalog } from './protocolCatalog'
import {
	type ChartConfig,
	type DashboardItemConfig,
	limitMultiChartItems,
	type MetricConfig,
	type ProDashboardChartType
} from './types'

export interface ProDashboardChartSourcePlanEntry {
	queryKey: ProDashboardChartSourceQueryKey
	request: ProDashboardChartRequest
	skipReason?: string
}

function buildChainMetadataByName(appMetadata: ProDashboardAppMetadata | null) {
	const chainsByName = new Map<string, ProDashboardAppMetadata['chains'][string]>()
	for (const key in appMetadata?.chains ?? {}) {
		const chain = appMetadata!.chains[key]
		chainsByName.set(key.toLowerCase(), chain)
		chainsByName.set(chain.name.toLowerCase(), chain)
	}
	return chainsByName
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
	liquidity: ['liquidity'],
	treasury: ['treasury'],
	holdersRevenue: ['holdersRevenue'],
	bribes: ['bribeRevenue'],
	tokenTax: ['tokenTax'],
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
	for (const key in appMetadata?.protocols ?? {}) {
		const protocol = appMetadata!.protocols[key]
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
	protocolsBySlug: Map<string, ProtocolMetadata[]>
): string | undefined {
	if (!request.protocol || protocolsBySlug.size === 0) return undefined
	const metadata = protocolsBySlug.get(request.protocol.toLowerCase())
	if (!metadata) return undefined
	const requiredFlags = PROTOCOL_SOURCE_FLAGS[request.type as ProDashboardChartType]
	if (!requiredFlags) return undefined

	for (const protocol of metadata) {
		for (const flag of requiredFlags) {
			if (protocol[flag]) return undefined
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
		case 'options':
		case 'optionsPremium':
			return metadata.optionsPremiumVolume ? undefined : 'chain does not support options premium volume'
		case 'optionsNotional':
			return metadata.optionsNotionalVolume ? undefined : 'chain does not support options notional volume'
		case 'users':
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

function toChartRequest(
	chart: Pick<ChartConfig, 'type' | 'protocol' | 'chain' | 'geckoId' | 'dataType'>,
	protocolSymbol?: string
): ProDashboardChartRequest {
	return {
		type: chart.type,
		protocol: chart.protocol,
		chain: chart.chain,
		geckoId: chart.geckoId,
		dataType: chart.dataType,
		protocolSymbol
	}
}

function toMetricRequest(
	metric: MetricConfig,
	protocolsBySlug: Map<string, ProDashboardProtocolCatalog['protocols'][number]>,
	chainsByName: Map<string, ProDashboardProtocolCatalog['chains'][number]>
): ProDashboardChartRequest | null {
	const itemType = metric.subject.itemType
	const item = itemType === 'protocol' ? metric.subject.protocol : metric.subject.chain
	if (!item) return null

	const protocol = itemType === 'protocol' ? protocolsBySlug.get(item) : undefined
	const chain = itemType === 'chain' ? chainsByName.get(item) : undefined
	return {
		type: metric.type,
		protocol: itemType === 'protocol' ? item : '',
		chain: itemType === 'chain' ? item : '',
		geckoId: metric.subject.geckoId ?? protocol?.geckoId ?? chain?.gecko_id ?? null,
		protocolSymbol: protocol?.symbol
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
	const chainMetadataByName = buildChainMetadataByName(appMetadata)
	const protocolMetadataBySlug = buildProtocolMetadataBySlug(appMetadata)

	const plan = new Map<string, ProDashboardChartSourcePlanEntry>()
	const addRequest = (request: ProDashboardChartRequest) => {
		const itemType = request.protocol ? 'protocol' : 'chain'
		// Missing catalog metadata must remain an unseeded query so the client can retry it.
		if (chartNeedsGeckoId(request.type, itemType) && !request.geckoId) return
		if (itemType === 'protocol' && request.type === 'liquidity' && !request.protocolSymbol) return
		const queryKey = getProDashboardChartSourceQueryKey(request)
		const serializedKey = JSON.stringify(queryKey)
		if (!plan.has(serializedKey)) {
			plan.set(serializedKey, {
				queryKey,
				request,
				skipReason:
					getUnsupportedProtocolSourceReason(request, protocolMetadataBySlug) ??
					getUnsupportedChainSourceReason(request, chainMetadataByName)
			})
		}
	}

	for (const item of items) {
		if (item.kind === 'chart') {
			addRequest(toChartRequest(item, protocolsBySlug.get(item.protocol)?.symbol))
			continue
		}
		if (item.kind === 'multi') {
			for (const chart of limitMultiChartItems(item.items)) {
				addRequest(toChartRequest(chart, protocolsBySlug.get(chart.protocol)?.symbol))
			}
			continue
		}
		if (item.kind === 'metric') {
			const request = toMetricRequest(item, protocolsBySlug, chainsByName)
			if (request) addRequest(request)
		}
	}

	return Array.from(plan.values())
}
