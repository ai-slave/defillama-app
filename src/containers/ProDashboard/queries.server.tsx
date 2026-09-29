import { CONFIG_API, FEATURES_SERVER } from '~/constants'
import { fetchChainsList } from '~/containers/Chains/api'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { sumSeriesByTimestamp } from '~/utils/breakdowns'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import { isProtocolTokenChartType } from './chartSource'
import { migrateDashboardConfig } from './dashboardConfig/migrate'
import type { PersistedDashboard } from './dashboardConfig/persisted'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { CustomTimePeriod, Dashboard, TimePeriod } from './dashboardTypes'
import type { ProDashboardAppMetadata, ProDashboardChartRequest } from './dataContracts'
import { getOpenInterestChartProtocols } from './openInterestChartProtocols'
import {
	buildProDashboardProtocolCatalog,
	type ProDashboardProtocolCatalog,
	type ProDashboardProtocolRelations,
	type ProProtocolCatalogSourceRow
} from './protocolCatalog'
import { filterDataByTimePeriod } from './queries'
import { createServerAuthorizedFetch } from './server/auth'
import { fetchPfPsChartData, fetchPfPsProtocols } from './server/pfPsQueries'
import { fetchProChainChartData } from './services/ChainCharts'
import { fetchProProtocolChartData } from './services/ProtocolCharts'
import { isProDashboardChartType, type YieldsChartConfig } from './types'

export async function fetchDashboardConfig(dashboardId: string, authToken: string | null): Promise<Dashboard | null> {
	try {
		const url = `${FEATURES_SERVER}/dashboards/${dashboardId}?_=${Date.now()}`
		const fetchFn = authToken ? createServerAuthorizedFetch(authToken) : fetch
		const response = await fetchFn(url)
		if (!response.ok) return null
		const dashboard: PersistedDashboard = await response.json()
		return migrateDashboardConfig(dashboard)
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
		const dashboard: PersistedDashboard = await response.json()
		return { dashboard: migrateDashboardConfig(dashboard), status: response.status }
	} catch {
		return { dashboard: null, status: 500 }
	}
}

export async function fetchProtocolsAndChains(
	protocolCatalogSourcePromise?: Promise<Array<ProProtocolCatalogSourceRow>>,
	protocolsDataPromise: Promise<ProtocolsResponse> = fetchProtocols()
): Promise<ProDashboardProtocolCatalog | null> {
	try {
		const sourcePromise =
			protocolCatalogSourcePromise ??
			import('./server/protocolCatalogSource').then(({ fetchProProtocolCatalogSourceRows }) =>
				fetchProProtocolCatalogSourceRows()
			)
		const [protocolCatalogSource, protocolsData, chainsData] = await Promise.all([
			sourcePromise,
			protocolsDataPromise,
			fetchChainsList()
		])
		return buildProDashboardProtocolCatalog(protocolCatalogSource, protocolsData, chainsData)
	} catch {
		return null
	}
}

export async function fetchAppMetadata(): Promise<ProDashboardAppMetadata | null> {
	try {
		const [protocols, chains, pfPs] = await Promise.all([
			fetchWithPoolingOnServer(`${CONFIG_API}/smol/appMetadata-protocols.json`).then(
				async (response): Promise<ProDashboardAppMetadata['protocols'] | null> => (response.ok ? response.json() : null)
			),
			fetchWithPoolingOnServer(`${CONFIG_API}/smol/appMetadata-chains.json`).then(
				async (response): Promise<ProDashboardAppMetadata['chains'] | null> => (response.ok ? response.json() : null)
			),
			fetchPfPsProtocols().catch(() => ({ pf: [], ps: [] }))
		])

		if (!protocols || !chains) return null
		return { protocols, chains, pfPs }
	} catch {
		return null
	}
}

export function extractYieldsItems(items: Array<DashboardItemConfig>): Array<YieldsChartConfig> {
	return items.filter((item): item is YieldsChartConfig => item.kind === 'yields')
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('timeout')), ms)
		promise.then(
			(value) => {
				clearTimeout(timeout)
				resolve(value)
			},
			(error: unknown) => {
				clearTimeout(timeout)
				reject(error)
			}
		)
	})
}

export async function fetchSingleChartData(
	chart: ProDashboardChartRequest,
	timePeriod: TimePeriod,
	customTimePeriod: CustomTimePeriod | null,
	protocolRelations?: ProDashboardProtocolRelations
): Promise<Array<[number, number]>> {
	if (!isProDashboardChartType(chart.type)) return []
	const itemType = chart.subjectType
	const item = chart.subjectType === 'protocol' ? chart.protocol : chart.chain
	const fetchProtocol = (protocol: string, geckoId?: string | null) =>
		fetchProProtocolChartData(chart.type, protocol, {
			...(geckoId !== undefined ? { geckoId } : {}),
			...(chart.dataType !== undefined ? { dataType: chart.dataType } : {}),
			fetchRatio: fetchPfPsChartData
		})

	if (isProtocolTokenChartType(chart.type) && chart.geckoId) {
		const data = await fetchProtocol(item, chart.geckoId)
		return filterDataByTimePeriod(data, timePeriod || 'all', customTimePeriod)
	}

	if (itemType === 'chain') {
		const data = await fetchProChainChartData(chart.type, item, chart.geckoId ?? undefined, chart.chainAssetId)
		return filterDataByTimePeriod(data, timePeriod || 'all', customTimePeriod)
	}

	if (isProtocolTokenChartType(chart.type)) return []

	const openInterestProtocols = protocolRelations
		? getOpenInterestChartProtocols(chart.type, item, protocolRelations)
		: null
	if (openInterestProtocols) {
		const childSeries = await Promise.all(openInterestProtocols.map((protocol) => fetchProtocol(protocol)))
		const data = Array.from(sumSeriesByTimestamp(childSeries).entries()).sort((a, b) => a[0] - b[0])
		return filterDataByTimePeriod(data, timePeriod || 'all', customTimePeriod)
	}

	const parent = protocolRelations?.protocolsBySlug.get(item)
	const children = parent ? (protocolRelations?.childrenByParentId.get(parent.id) ?? []) : []

	let data: Array<[number, number]>
	try {
		data = await fetchProtocol(item, chart.geckoId)
	} catch (error) {
		if (children.length === 0) throw error
		data = []
	}

	if (data.length === 0 && children.length > 0) {
		// Parent totals are only valid when every canonical child resolves. Streaming a
		// partial sum would seed React Query with an understated value as if it were complete.
		const childSeries = await Promise.all(children.map((child) => fetchProtocol(child.slug, child.geckoId)))
		data = Array.from(sumSeriesByTimestamp(childSeries).entries()).sort((a, b) => a[0] - b[0])
	}

	return filterDataByTimePeriod(data, timePeriod || 'all', customTimePeriod)
}
