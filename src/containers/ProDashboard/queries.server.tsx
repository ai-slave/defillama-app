import { CONFIG_API, FEATURES_SERVER } from '~/constants'
import { fetchChainsList } from '~/containers/Chains/api'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { sumSeriesByTimestamp } from '~/utils/breakdowns'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import { isProtocolTokenChartType, normalizeUnlocksDataType } from './chartSource'
import type { CustomTimePeriod, Dashboard, TimePeriod } from './dashboardTypes'
import type { ProDashboardAppMetadata, ProDashboardChartRequest } from './dataContracts'
import {
	buildProDashboardProtocolCatalog,
	type ProDashboardProtocolCatalog,
	type ProDashboardProtocolRelations
} from './protocolCatalog'
import { filterDataByTimePeriod } from './queries'
import { createServerAuthorizedFetch } from './server/auth'
import { fetchPfPsChartData, fetchPfPsProtocols } from './server/pfPsQueries'
import ChainCharts from './services/ChainCharts'
import ProtocolCharts from './services/ProtocolCharts'
import {
	isProDashboardChartType,
	type DashboardItemConfig,
	type ProDashboardChartType,
	type YieldsChartConfig
} from './types'

export async function fetchDashboardConfig(dashboardId: string, authToken: string | null): Promise<Dashboard | null> {
	try {
		const url = `${FEATURES_SERVER}/dashboards/${dashboardId}?_=${Date.now()}`
		const fetchFn = authToken ? createServerAuthorizedFetch(authToken) : fetch
		const response = await fetchFn(url)
		if (!response.ok) return null
		return (await response.json()) as Dashboard
	} catch {
		return null
	}
}

export async function fetchDashboardConfigWithStatus(
	dashboardId: string,
	authToken: string | null
): Promise<{ dashboard: Dashboard | null; status: number }> {
	try {
		const url = `${FEATURES_SERVER}/dashboards/${dashboardId}?_=${Date.now()}`
		const fetchFn = authToken ? createServerAuthorizedFetch(authToken) : fetch
		const response = await fetchFn(url)
		if (!response.ok) return { dashboard: null, status: response.status }
		return { dashboard: (await response.json()) as Dashboard, status: response.status }
	} catch {
		return { dashboard: null, status: 500 }
	}
}

export async function fetchProtocolsAndChains(): Promise<ProDashboardProtocolCatalog | null> {
	try {
		const [protocolsData, chainsData] = await Promise.all([fetchProtocols(), fetchChainsList()])
		return buildProDashboardProtocolCatalog(protocolsData, chainsData)
	} catch {
		return null
	}
}

export async function fetchAppMetadata(): Promise<ProDashboardAppMetadata | null> {
	try {
		const [protocols, chains, pfPs] = await Promise.all([
			fetchWithPoolingOnServer(`${CONFIG_API}/smol/appMetadata-protocols.json`).then(async (response) =>
				response.ok ? ((await response.json()) as ProDashboardAppMetadata['protocols']) : null
			),
			fetchWithPoolingOnServer(`${CONFIG_API}/smol/appMetadata-chains.json`).then(async (response) =>
				response.ok ? ((await response.json()) as ProDashboardAppMetadata['chains']) : null
			),
			fetchPfPsProtocols().catch(() => ({ pf: [] as string[], ps: [] as string[] }))
		])

		if (!protocols || !chains) return null
		return { protocols, chains, pfPs }
	} catch {
		return null
	}
}

export function extractYieldsItems(items: DashboardItemConfig[]): YieldsChartConfig[] {
	return items.filter((item): item is YieldsChartConfig => item.kind === 'yields')
}
type ProtocolChartFetcher = (
	item: string,
	geckoId?: string | null,
	dataType?: string,
	protocolSymbol?: string | null
) => Promise<[number, number][]>

const protocolChartFetchers: Partial<Record<ProDashboardChartType, ProtocolChartFetcher>> = {
	tvl: (item) => ProtocolCharts.tvl(item),
	volume: (item) => ProtocolCharts.volume(item),
	fees: (item) => ProtocolCharts.fees(item),
	revenue: (item) => ProtocolCharts.revenue(item),
	holdersRevenue: (item) => ProtocolCharts.holdersRevenue(item),
	bribes: (item) => ProtocolCharts.bribes(item),
	tokenTax: (item) => ProtocolCharts.tokenTax(item),
	perps: (item) => ProtocolCharts.perps(item),
	openInterest: (item) => ProtocolCharts.openInterest(item),
	aggregators: (item) => ProtocolCharts.aggregators(item),
	perpsAggregators: (item) => ProtocolCharts.perpsAggregators(item),
	bridgeAggregators: (item) => ProtocolCharts.bridgeAggregators(item),
	optionsPremium: (item) => ProtocolCharts.optionsPremium(item),
	optionsNotional: (item) => ProtocolCharts.optionsNotional(item),
	activeUsers: (item) => ProtocolCharts.activeUsers(item),
	newUsers: (item) => ProtocolCharts.newUsers(item),
	txs: (item) => ProtocolCharts.txs(item),
	gasUsed: (item) => ProtocolCharts.gasUsed(item),
	liquidity: (item, _geckoId, _dataType, protocolSymbol) => ProtocolCharts.liquidity(item, protocolSymbol),
	treasury: (item) => ProtocolCharts.treasury(item),
	incentives: (item) => ProtocolCharts.incentives(item),
	unlocks: (item, _, dataType) => ProtocolCharts.unlocks(item, normalizeUnlocksDataType(dataType)),
	tokenMcap: (item, geckoId) => ProtocolCharts.tokenMcap(item, geckoId!),
	tokenPrice: (item, geckoId) => ProtocolCharts.tokenPrice(item, geckoId!),
	tokenVolume: (item, geckoId) => ProtocolCharts.tokenVolume(item, geckoId!),
	medianApy: (item) => ProtocolCharts.medianApy(item),
	borrowed: (item) => ProtocolCharts.borrowed(item),
	pfRatio: (item) => fetchPfPsChartData(item, 'pf'),
	psRatio: (item) => fetchPfPsChartData(item, 'ps')
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

export async function fetchSingleChartData(
	chart: ProDashboardChartRequest,
	timePeriod: TimePeriod,
	customTimePeriod: CustomTimePeriod | null,
	protocolRelations?: ProDashboardProtocolRelations
): Promise<[number, number][]> {
	const itemType = chart.protocol ? 'protocol' : 'chain'
	const item = chart.protocol || chart.chain

	if (isProtocolTokenChartType(chart.type) && chart.geckoId) {
		const fetcher = isProDashboardChartType(chart.type) ? protocolChartFetchers[chart.type] : undefined
		if (!fetcher) return []
		const data = await fetcher(item ?? '', chart.geckoId, chart.dataType, chart.protocolSymbol)
		return filterDataByTimePeriod(data, timePeriod || 'all', customTimePeriod)
	}

	if (!item) return []

	if (itemType === 'chain') {
		const data = await ChainCharts.getData(chart.type, item, chart.geckoId)
		return filterDataByTimePeriod(data, timePeriod || 'all', customTimePeriod)
	}

	const fetcher = isProDashboardChartType(chart.type) ? protocolChartFetchers[chart.type] : undefined
	if (!fetcher) return []
	if (isProtocolTokenChartType(chart.type)) return []

	const parent = protocolRelations?.protocolsBySlug.get(item)
	const children = parent ? (protocolRelations?.childrenByParentId.get(parent.id) ?? []) : []

	let data: [number, number][]
	try {
		data = await fetcher(item, chart.geckoId, chart.dataType, chart.protocolSymbol ?? parent?.symbol)
	} catch (error) {
		if (children.length === 0) throw error
		data = []
	}

	if (data.length === 0 && children.length > 0) {
		const childResults = await Promise.allSettled(
			children.map((child) => fetcher(child.slug, child.geckoId, chart.dataType, child.symbol))
		)
		const childSeries: [number, number][][] = []
		for (const result of childResults) {
			if (result.status === 'fulfilled' && result.value.length > 0) childSeries.push(result.value)
		}
		data = Array.from(sumSeriesByTimestamp(childSeries).entries()).sort((a, b) => a[0] - b[0])
	}

	return filterDataByTimePeriod(data, timePeriod || 'all', customTimePeriod)
}
