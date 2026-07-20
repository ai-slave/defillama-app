import type { DashboardStreamChunk } from '~/containers/ProDashboard/dashboardStreamContract'
import {
	getProEquitiesFilingsCacheKey,
	getProEquitiesStatementsCacheKey,
	getProLegacyTableChainQueryKey,
	getProRwaChainAssetsTableQueryKey,
	PRO_EQUITIES_COMPANIES_QUERY_KEY,
	PRO_RWA_ASSETS_TABLE_QUERY_KEY,
	PRO_RWA_CHAINS_TABLE_QUERY_KEY,
	PROTOCOLS_LIST_QUERY_KEY
} from '~/containers/ProDashboard/tableQueryKeys'
import type { ProDashboardTableChunkType, ProDashboardTableSource } from '~/containers/ProDashboard/tableSourcePlan'

export interface ProDashboardTableAuditResult {
	expected: number
	received: number
	empty: string[]
	missing: string[]
	duplicate: string[]
	unexpected: string[]
}

function sourceIdentity(source: ProDashboardTableSource) {
	return `${source.chunkType}:${source.key}`
}

function isEmptyPayload(data: unknown) {
	if (Array.isArray(data)) return data.length === 0
	if (!data || typeof data !== 'object') return false
	if ('rows' in data && Array.isArray(data.rows)) return data.rows.length === 0
	if ('protocols' in data && Array.isArray(data.protocols)) return data.protocols.length === 0
	return false
}

export function auditProDashboardTableSources(
	expectedSources: ProDashboardTableSource[],
	chunks: DashboardStreamChunk[]
): ProDashboardTableAuditResult {
	const receivedCounts = new Map<string, number>()
	const empty = new Set<string>()
	const add = (chunkType: ProDashboardTableChunkType, queryKey: readonly unknown[] | string, data: unknown) => {
		const key = typeof queryKey === 'string' ? queryKey : JSON.stringify(queryKey)
		const identity = sourceIdentity({ chunkType, key })
		receivedCounts.set(identity, (receivedCounts.get(identity) ?? 0) + 1)
		if (isEmptyPayload(data)) empty.add(identity)
	}

	for (const chunk of chunks) {
		switch (chunk.type) {
			case 'tableData':
				if (chunk.data.protocolsList) add('tableData', PROTOCOLS_LIST_QUERY_KEY, chunk.data.protocolsList)
				for (const chain in chunk.data.volumeByChain) {
					add('tableData', getProLegacyTableChainQueryKey('volume', chain), chunk.data.volumeByChain[chain])
				}
				for (const chain in chunk.data.feesByChain) {
					add('tableData', getProLegacyTableChainQueryKey('fees', chain), chunk.data.feesByChain[chain])
				}
				for (const chain in chunk.data.perpsByChain) {
					add('tableData', getProLegacyTableChainQueryKey('perps', chain), chunk.data.perpsByChain[chain])
				}
				for (const chain in chunk.data.openInterestByChain) {
					add(
						'tableData',
						getProLegacyTableChainQueryKey('open-interest', chain),
						chunk.data.openInterestByChain[chain]
					)
				}
				for (const key in chunk.data.datasetsByQueryKey) {
					add('tableData', key, chunk.data.datasetsByQueryKey[key])
				}
				for (const key in chunk.data.tokenUsageByQueryKey) {
					add('tableData', key, chunk.data.tokenUsageByQueryKey[key])
				}
				break
			case 'unifiedTableData':
			case 'dimensionDatasetData':
			case 'cexAnalyticsData':
			case 'chainsDatasetData':
			case 'yieldsDatasetData':
			case 'stablecoinsTableData':
				add(chunk.type, chunk.key, chunk.data)
				break
			case 'rwaAssetsTableData':
				add(chunk.type, PRO_RWA_ASSETS_TABLE_QUERY_KEY, chunk.data)
				break
			case 'rwaChainsTableData':
				add(chunk.type, PRO_RWA_CHAINS_TABLE_QUERY_KEY, chunk.data)
				break
			case 'rwaChainAssetsTableData':
				add(chunk.type, getProRwaChainAssetsTableQueryKey(chunk.chain), chunk.data)
				break
			case 'equitiesCompaniesData':
				add(chunk.type, PRO_EQUITIES_COMPANIES_QUERY_KEY, chunk.data)
				break
			case 'equitiesStatementsData':
				add(chunk.type, getProEquitiesStatementsCacheKey(chunk.ticker), chunk.data)
				break
			case 'equitiesFilingsData':
				add(chunk.type, getProEquitiesFilingsCacheKey(chunk.ticker), chunk.data)
				break
		}
	}

	const expected = new Set(expectedSources.map(sourceIdentity))
	const missing = Array.from(expected).filter((identity) => !receivedCounts.has(identity))
	const duplicate = Array.from(receivedCounts)
		.filter(([, count]) => count > 1)
		.map(([identity]) => identity)
	const unexpected = Array.from(receivedCounts.keys()).filter((identity) => !expected.has(identity))

	return {
		expected: expected.size,
		received: receivedCounts.size,
		empty: Array.from(empty),
		missing,
		duplicate,
		unexpected
	}
}
