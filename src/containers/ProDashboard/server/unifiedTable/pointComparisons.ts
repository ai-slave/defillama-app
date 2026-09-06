import type {
	CanonicalChainMetricKey,
	ChainMetrics,
	ProtocolTableMetrics,
	ProtocolTableSourceRow
} from '~/containers/ProDashboard/unifiedTable/contracts'
import type { ProtocolPointMetric } from '~/containers/ProDashboard/unifiedTable/protocolCapabilities'
import { llamaDb } from '~/server/db/llama'
import { toInternalSlug } from '~/utils/chainNormalizer'

export interface PointComparisonRow {
	entity_id: string
	chain_slug: string | null
	volume_7d_ago?: number | null
	volume_30d_ago?: number | null
	fees_7d_ago?: number | null
	fees_30d_ago?: number | null
	revenue_7d_ago?: number | null
	revenue_30d_ago?: number | null
	perps_volume_7d_ago?: number | null
	perps_volume_30d_ago?: number | null
	aggregator_volume_7d_ago?: number | null
	aggregator_volume_30d_ago?: number | null
	derivatives_aggregator_volume_7d_ago?: number | null
	derivatives_aggregator_volume_30d_ago?: number | null
	options_volume_7d_ago?: number | null
	options_volume_30d_ago?: number | null
}

type PointComparisonValueKey = Exclude<keyof PointComparisonRow, 'entity_id' | 'chain_slug'>

interface PointMetricDefinition {
	currentKey: CanonicalChainMetricKey
	previous7dKey: CanonicalChainMetricKey
	previous30dKey: CanonicalChainMetricKey
	change7dKey: CanonicalChainMetricKey
	change30dKey: CanonicalChainMetricKey
	rowPrevious7dKey: PointComparisonValueKey
	rowPrevious30dKey: PointComparisonValueKey
}

const POINT_METRIC_DEFINITIONS = {
	'dex-volume': {
		currentKey: 'volume24h',
		previous7dKey: 'volume24h7dAgo',
		previous30dKey: 'volume24h30dAgo',
		change7dKey: 'volume24hChange7dAgo',
		change30dKey: 'volume24hChange30dAgo',
		rowPrevious7dKey: 'volume_7d_ago',
		rowPrevious30dKey: 'volume_30d_ago'
	},
	fees: {
		currentKey: 'fees24h',
		previous7dKey: 'fees24h7dAgo',
		previous30dKey: 'fees24h30dAgo',
		change7dKey: 'fees24hChange7dAgo',
		change30dKey: 'fees24hChange30dAgo',
		rowPrevious7dKey: 'fees_7d_ago',
		rowPrevious30dKey: 'fees_30d_ago'
	},
	revenue: {
		currentKey: 'revenue24h',
		previous7dKey: 'revenue24h7dAgo',
		previous30dKey: 'revenue24h30dAgo',
		change7dKey: 'revenue24hChange7dAgo',
		change30dKey: 'revenue24hChange30dAgo',
		rowPrevious7dKey: 'revenue_7d_ago',
		rowPrevious30dKey: 'revenue_30d_ago'
	},
	'perps-volume': {
		currentKey: 'perpsVolume24h',
		previous7dKey: 'perpsVolume24h7dAgo',
		previous30dKey: 'perpsVolume24h30dAgo',
		change7dKey: 'perpsVolume24hChange7dAgo',
		change30dKey: 'perpsVolume24hChange30dAgo',
		rowPrevious7dKey: 'perps_volume_7d_ago',
		rowPrevious30dKey: 'perps_volume_30d_ago'
	},
	'aggregator-volume': {
		currentKey: 'aggregators_volume_24h',
		previous7dKey: 'aggregatorVolume24h7dAgo',
		previous30dKey: 'aggregatorVolume24h30dAgo',
		change7dKey: 'aggregatorVolume24hChange7dAgo',
		change30dKey: 'aggregatorVolume24hChange30dAgo',
		rowPrevious7dKey: 'aggregator_volume_7d_ago',
		rowPrevious30dKey: 'aggregator_volume_30d_ago'
	},
	'derivatives-aggregator-volume': {
		currentKey: 'derivatives_aggregators_volume_24h',
		previous7dKey: 'derivativesAggregatorVolume24h7dAgo',
		previous30dKey: 'derivativesAggregatorVolume24h30dAgo',
		change7dKey: 'derivativesAggregatorVolume24hChange7dAgo',
		change30dKey: 'derivativesAggregatorVolume24hChange30dAgo',
		rowPrevious7dKey: 'derivatives_aggregator_volume_7d_ago',
		rowPrevious30dKey: 'derivatives_aggregator_volume_30d_ago'
	},
	'options-volume': {
		currentKey: 'options_volume_24h',
		previous7dKey: 'optionsVolume24h7dAgo',
		previous30dKey: 'optionsVolume24h30dAgo',
		change7dKey: 'optionsVolume24hChange7dAgo',
		change30dKey: 'optionsVolume24hChange30dAgo',
		rowPrevious7dKey: 'options_volume_7d_ago',
		rowPrevious30dKey: 'options_volume_30d_ago'
	}
} as const satisfies Readonly<Record<ProtocolPointMetric, PointMetricDefinition>>

const POINT_SQL_DEFINITIONS: Readonly<
	Record<ProtocolPointMetric, { protocolColumn: string; chainColumn: string; alias: string }>
> = {
	'dex-volume': { protocolColumn: 'volume_dexs_1d', chainColumn: 'volume_dexs_1d', alias: 'volume' },
	fees: { protocolColumn: 'fees_1d', chainColumn: 'app_fees_1d', alias: 'fees' },
	revenue: { protocolColumn: 'revenue_1d', chainColumn: 'app_revenue_1d', alias: 'revenue' },
	'perps-volume': {
		protocolColumn: 'volume_derivatives_1d',
		chainColumn: 'volume_derivatives_1d',
		alias: 'perps_volume'
	},
	'aggregator-volume': {
		protocolColumn: 'volume_aggregators_1d',
		chainColumn: 'volume_aggregators_1d',
		alias: 'aggregator_volume'
	},
	'derivatives-aggregator-volume': {
		protocolColumn: 'volume_aggr_derivatives_1d',
		chainColumn: 'volume_aggr_derivatives_1d',
		alias: 'derivatives_aggregator_volume'
	},
	'options-volume': {
		protocolColumn: 'volume_options_1d',
		chainColumn: 'volume_options_1d',
		alias: 'options_volume'
	}
}

function pointColumns(metrics: Array<ProtocolPointMetric>, chain: boolean): string {
	const columns: Array<string> = []
	for (const metric of metrics) {
		const definition = POINT_SQL_DEFINITIONS[metric]
		const column = chain ? definition.chainColumn : definition.protocolColumn
		columns.push(`seven_days_ago.${column} AS ${definition.alias}_7d_ago`)
		columns.push(`thirty_days_ago.${column} AS ${definition.alias}_30d_ago`)
	}
	return columns.join(',\n\t\t\t')
}

const entityKey = (entityId: string, chainSlug: string | null): string =>
	chainSlug ? `${entityId}:${toInternalSlug(chainSlug)}` : entityId

const getPercentChange = (current: number | null | undefined, previous: number | null | undefined): number | null => {
	if (current == null || previous == null || previous === 0) return null
	return ((current - previous) / previous) * 100
}

function applyPointMetrics(
	metrics: ProtocolTableMetrics,
	comparison: PointComparisonRow | undefined,
	requestedMetrics: ReadonlyArray<ProtocolPointMetric>
): ProtocolTableMetrics {
	const next = { ...metrics }
	for (const metric of requestedMetrics) {
		const definition = POINT_METRIC_DEFINITIONS[metric]
		const previous7d = comparison?.[definition.rowPrevious7dKey]
		const previous30d = comparison?.[definition.rowPrevious30dKey]
		const current = metrics[definition.currentKey]
		next[definition.previous7dKey] = previous7d ?? null
		next[definition.previous30dKey] = previous30d ?? null
		next[definition.change7dKey] = getPercentChange(current, previous7d)
		next[definition.change30dKey] = getPercentChange(current, previous30d)
	}
	return next
}

export interface ProtocolPointComparisonData {
	protocols: ReadonlyMap<string, PointComparisonRow>
	chains: ReadonlyMap<string, PointComparisonRow>
}

async function fetchAggregatePointComparisons(metrics: Array<ProtocolPointMetric>): Promise<Array<PointComparisonRow>> {
	return llamaDb.any<PointComparisonRow>(`
		SELECT
			latest.protocol AS entity_id,
			NULL::text AS chain_slug,
			${pointColumns(metrics, false)}
		FROM lens.metrics_protocol_daily latest
		LEFT JOIN lens.metrics_protocol_daily seven_days_ago
			ON seven_days_ago.protocol = latest.protocol AND seven_days_ago.date = latest.date - 7
		LEFT JOIN lens.metrics_protocol_daily thirty_days_ago
			ON thirty_days_ago.protocol = latest.protocol AND thirty_days_ago.date = latest.date - 30
		WHERE latest.is_latest_date
		UNION ALL
		SELECT
			latest.sub_protocol AS entity_id,
			NULL::text AS chain_slug,
			${pointColumns(metrics, false)}
		FROM lens.metrics_sub_protocol_daily latest
		LEFT JOIN lens.metrics_sub_protocol_daily seven_days_ago
			ON seven_days_ago.sub_protocol = latest.sub_protocol AND seven_days_ago.date = latest.date - 7
		LEFT JOIN lens.metrics_sub_protocol_daily thirty_days_ago
			ON thirty_days_ago.sub_protocol = latest.sub_protocol AND thirty_days_ago.date = latest.date - 30
		WHERE latest.is_latest_date AND latest.sub_protocol != latest.protocol
	`)
}

async function fetchChainPointComparisons(
	chainFilters: Array<string>,
	metrics: Array<ProtocolPointMetric>
): Promise<{
	protocols: Array<PointComparisonRow>
	chains: Array<PointComparisonRow>
}> {
	const filter = `COALESCE(cardinality($1::text[]), 0) = 0 OR lower(latest.chain) = ANY($1)`
	const [protocols, chains] = await Promise.all([
		llamaDb.any<PointComparisonRow>(
			`
			SELECT
				latest.protocol AS entity_id,
				latest.chain AS chain_slug,
				${pointColumns(metrics, false)}
			FROM lens.metrics_protocol_by_chain_daily latest
			LEFT JOIN lens.metrics_protocol_by_chain_daily seven_days_ago
				ON seven_days_ago.protocol = latest.protocol
				AND seven_days_ago.chain = latest.chain
				AND seven_days_ago.date = latest.date - 7
			LEFT JOIN lens.metrics_protocol_by_chain_daily thirty_days_ago
				ON thirty_days_ago.protocol = latest.protocol
				AND thirty_days_ago.chain = latest.chain
				AND thirty_days_ago.date = latest.date - 30
			WHERE latest.is_latest_date AND (${filter})
			UNION ALL
			SELECT
				latest.sub_protocol AS entity_id,
				latest.chain AS chain_slug,
				${pointColumns(metrics, false)}
			FROM lens.metrics_sub_protocol_by_chain_daily latest
			LEFT JOIN lens.metrics_sub_protocol_by_chain_daily seven_days_ago
				ON seven_days_ago.sub_protocol = latest.sub_protocol
				AND seven_days_ago.chain = latest.chain
				AND seven_days_ago.date = latest.date - 7
			LEFT JOIN lens.metrics_sub_protocol_by_chain_daily thirty_days_ago
				ON thirty_days_ago.sub_protocol = latest.sub_protocol
				AND thirty_days_ago.chain = latest.chain
				AND thirty_days_ago.date = latest.date - 30
			WHERE latest.is_latest_date AND latest.sub_protocol != latest.protocol AND (${filter})
		`,
			[chainFilters]
		),
		llamaDb.any<PointComparisonRow>(
			`
			SELECT
				latest.chain AS entity_id,
				latest.chain AS chain_slug,
				${pointColumns(metrics, true)}
			FROM lens.metrics_chain_daily latest
			LEFT JOIN lens.metrics_chain_daily seven_days_ago
				ON seven_days_ago.chain = latest.chain AND seven_days_ago.date = latest.date - 7
			LEFT JOIN lens.metrics_chain_daily thirty_days_ago
				ON thirty_days_ago.chain = latest.chain AND thirty_days_ago.date = latest.date - 30
			WHERE latest.is_latest_date AND (${filter})
		`,
			[chainFilters]
		)
	])
	return { protocols, chains }
}

export async function fetchProtocolPointComparisons({
	chainFilters,
	byChain,
	metrics
}: {
	chainFilters: Array<string>
	byChain: boolean
	metrics: Array<ProtocolPointMetric>
}): Promise<ProtocolPointComparisonData> {
	const data = byChain
		? await fetchChainPointComparisons(chainFilters, metrics)
		: { protocols: await fetchAggregatePointComparisons(metrics), chains: [] }
	const protocols = new Map<string, PointComparisonRow>()
	for (const row of data.protocols) protocols.set(entityKey(row.entity_id, row.chain_slug), row)
	const chains = new Map<string, PointComparisonRow>()
	for (const row of data.chains) chains.set(toInternalSlug(row.entity_id), row)
	return { protocols, chains }
}

export function applyProtocolPointComparisons(
	rows: Array<ProtocolTableSourceRow>,
	comparisons: ProtocolPointComparisonData,
	pointMetrics: Array<ProtocolPointMetric>
): Array<ProtocolTableSourceRow> {
	return rows.map((row) => {
		const comparison = comparisons.protocols.get(entityKey(row.protocolId, row.chain))
		return comparison ? { ...row, metrics: applyPointMetrics(row.metrics, comparison, pointMetrics) } : row
	})
}

export function applyChainPointComparisons(
	chainMetrics: Record<string, ChainMetrics> | undefined,
	comparisons: ProtocolPointComparisonData,
	pointMetrics: Array<ProtocolPointMetric>
): Record<string, ChainMetrics> | undefined {
	if (!chainMetrics) return undefined
	const result: Record<string, ChainMetrics> = {}
	for (const chainSlug in chainMetrics) {
		const state = chainMetrics[chainSlug]
		if (!state || state.availability === 'unavailable') {
			if (state) result[chainSlug] = state
			continue
		}
		const comparison = comparisons.chains.get(toInternalSlug(chainSlug))
		result[chainSlug] = {
			availability: 'available',
			metrics: applyPointMetrics(state.metrics, comparison, pointMetrics)
		}
	}
	return result
}
