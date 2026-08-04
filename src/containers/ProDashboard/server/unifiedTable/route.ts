import type { NextApiRequest, NextApiResponse } from 'next'
import {
	UNIFIED_TABLE_CONFIG_VERSION,
	type UnifiedTableConfig
} from '~/containers/ProDashboard/unifiedTable/config/current'
import { sanitizeUnifiedTableRowHeaders } from '~/containers/ProDashboard/unifiedTable/config/layoutPolicy'
import {
	parseProtocolRowMembershipKey,
	type ProtocolRowMembership
} from '~/containers/ProDashboard/unifiedTable/config/protocolRowMembership'
import type { UnifiedRowHeaderType } from '~/containers/ProDashboard/unifiedTable/config/types'
import {
	createLegacyProtocolsUnifiedTableResponse,
	createProtocolsUnifiedTableResponse
} from '~/containers/ProDashboard/unifiedTable/contracts'
import {
	PROTOCOL_BASE_METRIC_FAMILIES,
	isProtocolPointMetric,
	isProtocolBaseMetricFamily,
	isProtocolSupplementalMetric,
	type ProtocolBaseMetricFamily,
	type ProtocolPointMetric,
	type ProtocolSupplementalMetric
} from '~/containers/ProDashboard/unifiedTable/protocolCapabilities'
import { toRawArrayParam } from '~/utils/routerQuery'
import { recordRouteRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'
import { fetchProtocolsTable } from './protocols'

const MAX_CHAIN_FILTERS = 100
const MAX_CHAIN_NAME_LENGTH = 200

interface ParsedUnifiedTableQuery {
	config: UnifiedTableConfig
	baseMetricFamilies: ProtocolBaseMetricFamily[]
	pointMetrics: ProtocolPointMetric[]
	supplementalMetrics: ProtocolSupplementalMetric[]
	needsOracleMembership: boolean
	rowMembership: ProtocolRowMembership
	usesLegacyContract: boolean
}

export const parseUnifiedTableQuery = (query: NextApiRequest['query']): ParsedUnifiedTableQuery | null => {
	const strategy = Array.isArray(query.strategy) ? query.strategy[0] : query.strategy
	if (strategy !== 'protocols') return null

	const chains = toRawArrayParam(query['chains[]'])
	if (chains.length > MAX_CHAIN_FILTERS) return null
	if (chains.some((c) => c.length > MAX_CHAIN_NAME_LENGTH)) return null

	const category = Array.isArray(query.category) ? query.category[0] : query.category
	if (category && category.length > MAX_CHAIN_NAME_LENGTH) return null
	const usesLegacyContract =
		query['baseMetricFamilies[]'] === undefined &&
		query['pointMetrics[]'] === undefined &&
		query['supplementalMetrics[]'] === undefined &&
		query.oracleMembership === undefined &&
		query.rowMembership === undefined
	const requestedBaseMetricFamilies = toRawArrayParam(query['baseMetricFamilies[]'])
	if (!requestedBaseMetricFamilies.every(isProtocolBaseMetricFamily)) return null
	const requestedBaseMetricFamilySet = new Set(requestedBaseMetricFamilies)
	const baseMetricFamilies = usesLegacyContract
		? [...PROTOCOL_BASE_METRIC_FAMILIES]
		: PROTOCOL_BASE_METRIC_FAMILIES.filter((family) => requestedBaseMetricFamilySet.has(family))
	const requestedPointMetrics = toRawArrayParam(query['pointMetrics[]'])
	if (!requestedPointMetrics.every(isProtocolPointMetric)) return null
	const pointMetrics = Array.from(new Set(requestedPointMetrics))
	const requestedSupplementalMetrics = toRawArrayParam(query['supplementalMetrics[]'])
	if (!requestedSupplementalMetrics.every(isProtocolSupplementalMetric)) return null
	const supplementalMetrics = Array.from(new Set(requestedSupplementalMetrics))
	const rowMembershipParam = Array.isArray(query.rowMembership) ? query.rowMembership[0] : query.rowMembership
	const rowMembership = parseProtocolRowMembershipKey(rowMembershipParam ?? 'all-protocols')
	if (!rowMembership) return null

	const config: UnifiedTableConfig = {
		id: `unified-table-${Date.now()}`,
		kind: 'unified-table',
		configVersion: UNIFIED_TABLE_CONFIG_VERSION,
		strategy,
		rowHeaders: [],
		params: chains.length > 0 || category ? { chains, category: category || null } : null
	}

	return {
		config,
		baseMetricFamilies,
		pointMetrics,
		supplementalMetrics,
		needsOracleMembership: usesLegacyContract || query.oracleMembership === 'true',
		rowMembership,
		usesLegacyContract
	}
}

export async function unifiedTableHandler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET'])
		return res.status(405).json({ error: 'Method Not Allowed' })
	}

	const parsed = parseUnifiedTableQuery(req.query)
	if (!parsed) {
		return res.status(400).json({ error: 'Invalid unified table configuration' })
	}
	const {
		config,
		baseMetricFamilies,
		pointMetrics,
		supplementalMetrics,
		needsOracleMembership,
		rowMembership,
		usesLegacyContract
	} = parsed

	const rowHeadersFromQuery = toRawArrayParam(req.query['rowHeaders[]']).filter(
		(value): value is UnifiedRowHeaderType =>
			value === 'parent-protocol' || value === 'protocol' || value === 'chain' || value === 'category'
	)

	const rowHeaders = sanitizeUnifiedTableRowHeaders(
		rowHeadersFromQuery.length > 0 ? rowHeadersFromQuery : config.rowHeaders
	)

	try {
		const result = await fetchProtocolsTable({
			config,
			rowHeaders,
			baseMetricFamilies,
			pointMetrics,
			supplementalMetrics,
			needsOracleMembership,
			rowMembership
		})

		res.setHeader('Cache-Control', 'public, max-age=300')
		return res
			.status(200)
			.json(
				usesLegacyContract
					? createLegacyProtocolsUnifiedTableResponse(result)
					: createProtocolsUnifiedTableResponse(result)
			)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		return res.status(500).json({ error: 'Failed to load unified table data' })
	}
}

export const unifiedTableApiHandler = withApiRouteTelemetry(
	'/api/public/pro-dashboard/unified-table/[strategy]',
	unifiedTableHandler
)
