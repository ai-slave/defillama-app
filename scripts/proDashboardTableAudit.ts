import type { DashboardStreamChunk } from '~/containers/ProDashboard/dashboardStreamContract'
import {
	getProEquitiesFilingsCacheKey,
	getProEquitiesStatementsCacheKey,
	PRO_EQUITIES_COMPANIES_QUERY_KEY,
	PRO_RWA_ASSETS_TABLE_QUERY_KEY,
	PRO_RWA_CHAINS_TABLE_QUERY_KEY
} from '~/containers/ProDashboard/tableQueryKeys'
import type { ProDashboardTableChunkType, ProDashboardTableSource } from './proDashboardTableSourcePlan'

type DashboardStreamData = DashboardStreamChunk extends infer Chunk
	? Chunk extends { data: infer Data }
		? Data
		: never
	: never

export interface ProDashboardTableAuditResult {
	expected: number
	received: number
	empty: Array<string>
	missing: Array<string>
	duplicate: Array<string>
	unexpected: Array<string>
}

function sourceIdentity(source: ProDashboardTableSource) {
	return `${source.chunkType}:${source.key}`
}

function isEmptyPayload(data: DashboardStreamData) {
	if (Array.isArray(data)) return data.length === 0
	if (!data || typeof data !== 'object') return false
	if ('rows' in data && Array.isArray(data.rows)) return data.rows.length === 0
	if ('protocols' in data && Array.isArray(data.protocols)) return data.protocols.length === 0
	return false
}

export function auditProDashboardTableSources(
	expectedSources: Array<ProDashboardTableSource>,
	chunks: Array<DashboardStreamChunk>
): ProDashboardTableAuditResult {
	const receivedCounts = new Map<string, number>()
	const empty = new Set<string>()
	const add = (
		chunkType: ProDashboardTableChunkType,
		queryKey: ReadonlyArray<unknown> | string,
		data: DashboardStreamData
	) => {
		const key = typeof queryKey === 'string' ? queryKey : JSON.stringify(queryKey)
		const identity = sourceIdentity({ chunkType, key })
		receivedCounts.set(identity, (receivedCounts.get(identity) ?? 0) + 1)
		if (isEmptyPayload(data)) empty.add(identity)
	}

	for (const chunk of chunks) {
		switch (chunk.type) {
			case 'tokenUsageData':
				add(chunk.type, chunk.key, chunk.data)
				break
			case 'unifiedTableData':
				add(chunk.type, chunk.key, chunk.data)
				break
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
