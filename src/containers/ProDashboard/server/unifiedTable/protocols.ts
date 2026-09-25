import {
	createDimensionDatasetRequestScope,
	type DimensionDatasetRequestScope
} from '~/containers/AdapterMetrics/server/datasets'
import { fetchOracleMetrics } from '~/containers/Oracles/api'
import { buildOracleNamesByProtocol } from '~/containers/Oracles/membership'
import type { UnifiedTableConfig } from '~/containers/ProDashboard/unifiedTable/config/current'
import type { ProtocolRowMembership } from '~/containers/ProDashboard/unifiedTable/config/protocolRowMembership'
import type { UnifiedRowHeaderType } from '~/containers/ProDashboard/unifiedTable/config/types'
import type {
	ProtocolAggregateTableRow,
	ProtocolChainTableRow,
	ProtocolTableMetrics,
	ProtocolTableSourceRow,
	CanonicalChainMetrics,
	ChainMetrics,
	ParentProtocolMetrics
} from '~/containers/ProDashboard/unifiedTable/contracts'
import {
	PROTOCOL_BASE_METRIC_FAMILIES,
	PROTOCOL_SUPPLEMENTAL_METRICS,
	type ProtocolBaseMetricFamily,
	type ProtocolPointMetric,
	type ProtocolSupplementalMetric
} from '~/containers/ProDashboard/unifiedTable/protocolCapabilities'
import { llamaDb } from '~/server/db/llama'
import { slug } from '~/utils'
import { toDisplayName, toInternalSlug } from '~/utils/chainNormalizer'
import { tokenIconUrl } from '~/utils/icons'
import {
	applyChainPointComparisons,
	applyProtocolPointComparisons,
	fetchProtocolPointComparisons
} from './pointComparisons'
import { fetchProtocolRowMembershipDataset, filterProtocolRowsByDatasetMembership } from './rowMembership'
import { applyProtocolSupplementalMetrics, fetchProtocolSupplementalMetrics } from './supplementalMetrics'
import { computeShare, derivePreviousValue, extractChainFilters, formatDisplayName, toPercent } from './utils'

interface ProtocolsTableResult {
	rows: Array<ProtocolTableSourceRow>
	parentMetrics: Record<string, ParentProtocolMetrics>
	chainMetrics?: Record<string, ChainMetrics>
}

type LensMetricRow = Partial<{
	tvl_base: number | null
	tvl_base_1d_pct_change: number | null
	tvl_base_7d_pct_change: number | null
	tvl_base_30d_pct_change: number | null
	tvl_base_90d_pct_change: number | null
	tvl_base_180d_pct_change: number | null
	tvl_base_365d_pct_change: number | null
	tvl_base_ytd_pct_change: number | null
	tvl_staking: number | null
	tvl_borrowed: number | null
	tvl_pool2: number | null
	tvl_treasury: number | null
	tvl_vesting: number | null
	volume_dexs_1d: number | null
	volume_dexs_7d: number | null
	volume_dexs_30d: number | null
	volume_dexs_90d: number | null
	volume_dexs_365d: number | null
	volume_dexs_1d_pct_change: number | null
	volume_dexs_7d_pct_change: number | null
	volume_dexs_30d_pct_change: number | null
	volume_dexs_alltime: number | null
	fees_1d: number | null
	fees_7d: number | null
	fees_30d: number | null
	fees_90d: number | null
	fees_180d: number | null
	fees_365d: number | null
	fees_ytd: number | null
	fees_alltime: number | null
	fees_annualised: number | null
	fees_1d_pct_change: number | null
	fees_7d_pct_change: number | null
	fees_30d_pct_change: number | null
	fees_90d_pct_change: number | null
	fees_180d_pct_change: number | null
	fees_365d_pct_change: number | null
	fees_ytd_pct_change: number | null
	holder_revenue_1d: number | null
	holder_revenue_7d: number | null
	holder_revenue_7d_pct_change: number | null
	holder_revenue_30d: number | null
	holder_revenue_30d_pct_change: number | null
	holder_revenue_1d_pct_change: number | null
	holder_revenue_90d: number | null
	holder_revenue_90d_pct_change: number | null
	holder_revenue_180d: number | null
	holder_revenue_180d_pct_change: number | null
	holder_revenue_365d: number | null
	holder_revenue_365d_pct_change: number | null
	holder_revenue_ytd: number | null
	holder_revenue_ytd_pct_change: number | null
	holder_revenue_alltime: number | null
	holder_revenue_annualised: number | null
	incentive_1d: number | null
	incentive_1d_pct_change: number | null
	incentive_7d: number | null
	incentive_7d_pct_change: number | null
	incentive_30d: number | null
	incentive_30d_pct_change: number | null
	incentive_90d: number | null
	incentive_180d: number | null
	incentive_365d: number | null
	incentive_ytd: number | null
	incentive_alltime: number | null
	incentive_annualised: number | null
	revenue_1d: number | null
	revenue_7d: number | null
	revenue_30d: number | null
	revenue_90d: number | null
	revenue_180d: number | null
	revenue_365d: number | null
	revenue_ytd: number | null
	revenue_annualised: number | null
	revenue_alltime: number | null
	revenue_1d_pct_change: number | null
	revenue_7d_pct_change: number | null
	revenue_30d_pct_change: number | null
	revenue_90d_pct_change: number | null
	revenue_180d_pct_change: number | null
	revenue_365d_pct_change: number | null
	revenue_ytd_pct_change: number | null
	volume_derivatives_1d: number | null
	volume_derivatives_7d: number | null
	volume_derivatives_30d: number | null
	volume_derivatives_90d: number | null
	volume_derivatives_365d: number | null
	volume_derivatives_alltime: number | null
	volume_derivatives_1d_pct_change: number | null
	volume_derivatives_7d_pct_change: number | null
	volume_derivatives_30d_pct_change: number | null
	volume_aggregators_1d: number | null
	volume_aggregators_7d: number | null
	volume_aggregators_30d: number | null
	volume_aggregators_90d: number | null
	volume_aggregators_365d: number | null
	volume_aggregators_alltime: number | null
	volume_aggregators_1d_pct_change: number | null
	volume_aggregators_7d_pct_change: number | null
	volume_aggregators_30d_pct_change: number | null
	volume_aggr_derivatives_1d: number | null
	volume_aggr_derivatives_7d: number | null
	volume_aggr_derivatives_30d: number | null
	volume_aggr_derivatives_1d_pct_change: number | null
	volume_aggr_derivatives_7d_pct_change: number | null
	volume_aggr_derivatives_30d_pct_change: number | null
	volume_options_1d: number | null
	volume_options_7d: number | null
	volume_options_30d: number | null
	volume_options_90d: number | null
	volume_options_365d: number | null
	volume_options_alltime: number | null
	volume_options_notional_1d: number | null
	volume_options_notional_7d: number | null
	volume_options_notional_30d: number | null
	volume_options_1d_pct_change: number | null
	volume_options_7d_pct_change: number | null
	volume_options_30d_pct_change: number | null
	mcap: number | null
	fdv: number | null
	open_interest: number | null
}>

type ProjectedLensMetricColumn = Exclude<keyof LensMetricRow, 'open_interest'>

const LENS_METRIC_COLUMNS_BY_FAMILY: Readonly<
	Partial<Record<ProtocolBaseMetricFamily, ReadonlyArray<ProjectedLensMetricColumn>>>
> = {
	tvl: [
		'tvl_base',
		'tvl_base_1d_pct_change',
		'tvl_base_7d_pct_change',
		'tvl_base_30d_pct_change',
		'tvl_base_90d_pct_change',
		'tvl_base_180d_pct_change',
		'tvl_base_365d_pct_change',
		'tvl_base_ytd_pct_change',
		'tvl_staking',
		'tvl_borrowed',
		'tvl_pool2',
		'tvl_treasury',
		'tvl_vesting'
	],
	'dex-volume': [
		'volume_dexs_1d',
		'volume_dexs_7d',
		'volume_dexs_30d',
		'volume_dexs_90d',
		'volume_dexs_365d',
		'volume_dexs_1d_pct_change',
		'volume_dexs_7d_pct_change',
		'volume_dexs_30d_pct_change',
		'volume_dexs_alltime'
	],
	fees: [
		'fees_1d',
		'fees_7d',
		'fees_30d',
		'fees_90d',
		'fees_180d',
		'fees_365d',
		'fees_ytd',
		'fees_alltime',
		'fees_annualised',
		'fees_1d_pct_change',
		'fees_7d_pct_change',
		'fees_30d_pct_change',
		'fees_90d_pct_change',
		'fees_180d_pct_change',
		'fees_365d_pct_change',
		'fees_ytd_pct_change'
	],
	'holder-revenue': [
		'holder_revenue_1d',
		'holder_revenue_7d',
		'holder_revenue_7d_pct_change',
		'holder_revenue_30d',
		'holder_revenue_30d_pct_change',
		'holder_revenue_1d_pct_change',
		'holder_revenue_90d',
		'holder_revenue_90d_pct_change',
		'holder_revenue_180d',
		'holder_revenue_180d_pct_change',
		'holder_revenue_365d',
		'holder_revenue_365d_pct_change',
		'holder_revenue_ytd',
		'holder_revenue_ytd_pct_change',
		'holder_revenue_alltime',
		'holder_revenue_annualised'
	],
	incentives: [
		'incentive_1d',
		'incentive_1d_pct_change',
		'incentive_7d',
		'incentive_7d_pct_change',
		'incentive_30d',
		'incentive_30d_pct_change',
		'incentive_90d',
		'incentive_180d',
		'incentive_365d',
		'incentive_ytd',
		'incentive_alltime',
		'incentive_annualised'
	],
	revenue: [
		'revenue_1d',
		'revenue_7d',
		'revenue_30d',
		'revenue_90d',
		'revenue_180d',
		'revenue_365d',
		'revenue_ytd',
		'revenue_annualised',
		'revenue_alltime',
		'revenue_1d_pct_change',
		'revenue_7d_pct_change',
		'revenue_30d_pct_change',
		'revenue_90d_pct_change',
		'revenue_180d_pct_change',
		'revenue_365d_pct_change',
		'revenue_ytd_pct_change'
	],
	'perps-volume': [
		'volume_derivatives_1d',
		'volume_derivatives_7d',
		'volume_derivatives_30d',
		'volume_derivatives_90d',
		'volume_derivatives_365d',
		'volume_derivatives_alltime',
		'volume_derivatives_1d_pct_change',
		'volume_derivatives_7d_pct_change',
		'volume_derivatives_30d_pct_change'
	],
	'aggregator-volume': [
		'volume_aggregators_1d',
		'volume_aggregators_7d',
		'volume_aggregators_30d',
		'volume_aggregators_90d',
		'volume_aggregators_365d',
		'volume_aggregators_alltime',
		'volume_aggregators_1d_pct_change',
		'volume_aggregators_7d_pct_change',
		'volume_aggregators_30d_pct_change'
	],
	'derivatives-aggregator-volume': [
		'volume_aggr_derivatives_1d',
		'volume_aggr_derivatives_7d',
		'volume_aggr_derivatives_30d',
		'volume_aggr_derivatives_1d_pct_change',
		'volume_aggr_derivatives_7d_pct_change',
		'volume_aggr_derivatives_30d_pct_change'
	],
	'options-volume': [
		'volume_options_1d',
		'volume_options_7d',
		'volume_options_30d',
		'volume_options_90d',
		'volume_options_365d',
		'volume_options_alltime',
		'volume_options_notional_1d',
		'volume_options_notional_7d',
		'volume_options_notional_30d',
		'volume_options_1d_pct_change',
		'volume_options_7d_pct_change',
		'volume_options_30d_pct_change'
	],
	'market-cap': ['mcap', 'fdv']
}

export const buildLensMetricProjection = (
	alias: 'mp' | 'msp' | 'mpc' | 'mspc',
	requestedFamilies: ReadonlyArray<ProtocolBaseMetricFamily>
): string => {
	const requested = new Set(requestedFamilies)
	const projection: Array<string> = []
	for (const family of PROTOCOL_BASE_METRIC_FAMILIES) {
		if (family === 'incentives' && alias !== 'mp') continue
		for (const column of LENS_METRIC_COLUMNS_BY_FAMILY[family] ?? []) {
			if (requested.has(family)) projection.push(`${alias}.${column}`)
		}
	}
	return projection.length > 0 ? projection.join(',\n\t\t\t') : 'NULL::numeric AS no_requested_metrics'
}

type ProtocolAggregateRow = LensMetricRow & {
	protocol: string
	protocol_name: string | null
	protocol_category: string | null
	chain_slugs: Array<string> | null
	exclude_tvl_from_parent: boolean
}

type SubProtocolRow = ProtocolAggregateRow & {
	sub_protocol: string
	parent_protocol_name: string | null
}

type ProtocolChainAggregateRow = ProtocolAggregateRow & { chain_slug: string }
type SubProtocolChainRow = SubProtocolRow & { chain_slug: string }

interface ProtocolQueryOptions {
	config: UnifiedTableConfig
	rowHeaders: Array<UnifiedRowHeaderType>
	baseMetricFamilies: Array<ProtocolBaseMetricFamily>
	pointMetrics: Array<ProtocolPointMetric>
	supplementalMetrics: Array<ProtocolSupplementalMetric>
	needsOracleMembership: boolean
	rowMembership: ProtocolRowMembership
}

interface ProtocolTableRequestContext {
	oracleMetricsPromise?: ReturnType<typeof fetchOracleMetrics>
	dimensionDatasetRequestScope?: DimensionDatasetRequestScope
}

const computeMarketCapToAnnualizedMetricRatio = (
	marketCap: number | null | undefined,
	annualizedMetric: number | null | undefined
): number | null => {
	if (marketCap == null || annualizedMetric == null || annualizedMetric === 0) {
		return null
	}
	return marketCap / annualizedMetric
}

type ProtocolMetricTotals = Partial<{
	tvl_base: number | null
	volume_dexs_1d: number | null
	volume_dexs_7d: number | null
	volume_aggregators_1d: number | null
	volume_aggregators_7d: number | null
	volume_derivatives_1d: number | null
	volume_options_1d: number | null
}>

function retainReferencedParentMetrics(
	parentMetrics: Record<string, ParentProtocolMetrics>,
	rows: ReadonlyArray<ProtocolTableSourceRow>
): Record<string, ParentProtocolMetrics> {
	const referencedParents = new Set<string>()
	for (const row of rows) {
		if (row.parentProtocolId) referencedParents.add(row.parentProtocolId)
	}
	const retained: Record<string, ParentProtocolMetrics> = {}
	for (const parentId of referencedParents) {
		const metrics = parentMetrics[parentId]
		if (metrics) retained[parentId] = metrics
	}
	return retained
}

const TOTAL_DEPENDENT_METRIC_FAMILIES = new Set<ProtocolBaseMetricFamily>([
	'tvl',
	'dex-volume',
	'perps-volume',
	'aggregator-volume',
	'options-volume'
])

const PROTOCOL_METRIC_TOTALS_TTL_MS = 5 * 60 * 1000
const PROTOCOL_METRIC_TOTALS_CACHE_LIMIT = 16
const buildProtocolMetricTotalsQuery = (baseMetricFamilies: ReadonlyArray<ProtocolBaseMetricFamily>): string => {
	const requested = new Set(baseMetricFamilies)
	const columns: Array<string> = []
	const select = (family: ProtocolBaseMetricFamily, column: keyof ProtocolMetricTotals) => {
		if (requested.has(family)) columns.push(column)
	}
	select('tvl', 'tvl_base')
	select('dex-volume', 'volume_dexs_1d')
	select('dex-volume', 'volume_dexs_7d')
	select('aggregator-volume', 'volume_aggregators_1d')
	select('aggregator-volume', 'volume_aggregators_7d')
	select('perps-volume', 'volume_derivatives_1d')
	select('options-volume', 'volume_options_1d')
	return `
	SELECT
		${columns.length > 0 ? columns.join(',\n\t\t') : 'NULL::numeric AS no_requested_metrics'}
	FROM lens.metrics_total_current
`
}

interface ProtocolMetricTotalsCacheEntry {
	value: Promise<ProtocolMetricTotals>
	expiresAt: number
}

const protocolMetricTotalsCache = new Map<string, ProtocolMetricTotalsCacheEntry>()

function getProtocolMetricTotals(
	baseMetricFamilies: ReadonlyArray<ProtocolBaseMetricFamily>
): Promise<ProtocolMetricTotals> {
	const now = Date.now()
	const key = baseMetricFamilies.join('|')
	for (const [cachedKey, entry] of protocolMetricTotalsCache) {
		if (entry.expiresAt <= now) protocolMetricTotalsCache.delete(cachedKey)
	}
	const cached = protocolMetricTotalsCache.get(key)
	if (cached) {
		protocolMetricTotalsCache.delete(key)
		protocolMetricTotalsCache.set(key, cached)
		return cached.value
	}

	// Share concurrent table requests, but refresh alongside the route's five-minute cache window.
	const value = llamaDb.one<ProtocolMetricTotals>(buildProtocolMetricTotalsQuery(baseMetricFamilies)).catch((error) => {
		if (protocolMetricTotalsCache.get(key)?.value === value) protocolMetricTotalsCache.delete(key)
		throw error
	})
	protocolMetricTotalsCache.set(key, { value, expiresAt: now + PROTOCOL_METRIC_TOTALS_TTL_MS })
	if (protocolMetricTotalsCache.size > PROTOCOL_METRIC_TOTALS_CACHE_LIMIT) {
		const oldest = protocolMetricTotalsCache.keys().next()
		if (!oldest.done) protocolMetricTotalsCache.delete(oldest.value)
	}
	return value
}

export async function fetchProtocolsTable(
	options: ProtocolQueryOptions,
	context: ProtocolTableRequestContext = {}
): Promise<ProtocolsTableResult> {
	const chainFilters = extractChainFilters(options.config)
	const category = options.config.params?.category
	const rowMembership = options.rowMembership
	const dimensionDatasetRequestScope = context.dimensionDatasetRequestScope ?? createDimensionDatasetRequestScope()
	const requestedFamilySet = new Set<ProtocolBaseMetricFamily>(options.baseMetricFamilies)
	if (rowMembership.kind === 'base-metric') requestedFamilySet.add(rowMembership.family)
	const baseMetricFamilies = PROTOCOL_BASE_METRIC_FAMILIES.filter((family) => requestedFamilySet.has(family))
	const supplementalMetricSet = new Set<ProtocolSupplementalMetric>(options.supplementalMetrics)
	if (rowMembership.kind === 'supplemental-metric') supplementalMetricSet.add(rowMembership.metric)
	const supplementalMetricRequests = PROTOCOL_SUPPLEMENTAL_METRICS.filter((metric) => supplementalMetricSet.has(metric))
	const needsMetricTotals = baseMetricFamilies.some((family) => TOTAL_DEPENDENT_METRIC_FAMILIES.has(family))
	const totalsPromise = needsMetricTotals
		? getProtocolMetricTotals(baseMetricFamilies)
		: Promise.resolve<ProtocolMetricTotals>({})
	const shouldExplodeByChain = options.rowHeaders.includes('chain') || chainFilters.length > 0
	const tableDataPromise = shouldExplodeByChain
		? fetchProtocolChainTableData(chainFilters, totalsPromise, baseMetricFamilies)
		: fetchProtocolTableData(chainFilters, totalsPromise, baseMetricFamilies)
	const pointComparisonsPromise =
		options.pointMetrics.length > 0
			? fetchProtocolPointComparisons({ chainFilters, byChain: shouldExplodeByChain, metrics: options.pointMetrics })
			: null
	const supplementalMetricsPromise = fetchProtocolSupplementalMetrics(
		supplementalMetricRequests,
		shouldExplodeByChain ? { kind: 'chain', chains: chainFilters } : { kind: 'protocol' },
		dimensionDatasetRequestScope
	)
	const rowMembershipDatasetPromise = fetchProtocolRowMembershipDataset(
		rowMembership,
		shouldExplodeByChain ? { kind: 'chain', chains: chainFilters } : { kind: 'protocol' },
		dimensionDatasetRequestScope
	)
	const requestedOracleMetrics = options.needsOracleMembership
		? (context.oracleMetricsPromise ?? fetchOracleMetrics())
		: null
	const [tableData, oracleMetrics, pointComparisons, resolvedSupplementalMetrics, rowMembershipDataset] =
		await Promise.all([
			tableDataPromise,
			requestedOracleMetrics,
			pointComparisonsPromise,
			supplementalMetricsPromise,
			rowMembershipDatasetPromise
		])

	const oracleNamesByProtocolId = new Map<string, ReadonlyArray<string>>()
	if (oracleMetrics) {
		for (const [protocolName, oracleNames] of buildOracleNamesByProtocol(oracleMetrics.oracles)) {
			oracleNamesByProtocolId.set(slug(protocolName), oracleNames)
		}
	}

	const categoryRows = filterRowsByCategory(tableData.rows, category)
	const membershipRows = filterProtocolRowsByDatasetMembership(categoryRows, rowMembershipDataset)
	const pointRows = pointComparisons
		? applyProtocolPointComparisons(membershipRows, pointComparisons, options.pointMetrics)
		: membershipRows
	const supplemented = applyProtocolSupplementalMetrics(
		pointRows,
		tableData.parentMetrics,
		resolvedSupplementalMetrics,
		tableData.rows
	)
	const membershipParentMetrics =
		rowMembership.kind === 'all-protocols'
			? supplemented.parentMetrics
			: retainReferencedParentMetrics(supplemented.parentMetrics, supplemented.rows)
	const parentMetrics = applyParentOracleMembership(membershipParentMetrics, oracleNamesByProtocolId)
	const chainMetrics = pointComparisons
		? applyChainPointComparisons(tableData.chainMetrics, pointComparisons, options.pointMetrics)
		: tableData.chainMetrics

	return {
		rows: applyOracleMembership(supplemented.rows, oracleNamesByProtocolId),
		parentMetrics,
		...(chainMetrics ? { chainMetrics } : {})
	}
}

function applyParentOracleMembership(
	parentMetrics: Record<string, ParentProtocolMetrics>,
	oracleNamesByProtocolId: ReadonlyMap<string, ReadonlyArray<string>>
): Record<string, ParentProtocolMetrics> {
	if (oracleNamesByProtocolId.size === 0) return parentMetrics
	const result: Record<string, ParentProtocolMetrics> = {}
	for (const parentId in parentMetrics) {
		const metrics = parentMetrics[parentId]
		if (!metrics) continue
		const oracles = oracleNamesByProtocolId.get(slug(parentId))
		result[parentId] = oracles?.length
			? { ...metrics, oracles: [...oracles].sort((a, b) => a.localeCompare(b)) }
			: metrics
	}
	return result
}

async function fetchProtocolTableData(
	chainFilters: Array<string>,
	totalsPromise: Promise<ProtocolMetricTotals>,
	baseMetricFamilies: ReadonlyArray<ProtocolBaseMetricFamily>
): Promise<ProtocolsTableResult> {
	const [parentRows, childRows] = await Promise.all([
		fetchProtocolAggregateRows(chainFilters, totalsPromise, baseMetricFamilies),
		fetchSubProtocolRows(chainFilters, totalsPromise, baseMetricFamilies)
	])

	const parentProtocolIds = new Set<string>()
	const subProtocolIds = new Set<string>()
	for (const row of childRows) {
		if (row.parentProtocolId) parentProtocolIds.add(row.parentProtocolId)
		subProtocolIds.add(row.protocolId)
	}
	const uniqueRows = new Map<string, ProtocolTableSourceRow>()
	for (const row of parentRows) {
		if (row.protocolId && (parentProtocolIds.has(row.protocolId) || subProtocolIds.has(row.protocolId))) continue
		if (!uniqueRows.has(row.id)) uniqueRows.set(row.id, row)
	}
	for (const row of childRows) if (!uniqueRows.has(row.id)) uniqueRows.set(row.id, row)

	return {
		rows: Array.from(uniqueRows.values()),
		parentMetrics: buildParentMetrics(parentRows, childRows)
	}
}

function buildParentMetrics(
	parentRows: Array<ProtocolTableSourceRow>,
	childRows: Array<ProtocolTableSourceRow>
): Record<string, ParentProtocolMetrics> {
	const childProtocolIdsByParent = new Map<string, Set<string>>()
	const childProtocolIdsByParentChain = new Map<string, Map<string, Set<string>>>()
	for (const row of childRows) {
		if (!row.parentProtocolId) continue
		const childIds = childProtocolIdsByParent.get(row.parentProtocolId) ?? new Set<string>()
		childIds.add(row.protocolId)
		childProtocolIdsByParent.set(row.parentProtocolId, childIds)
		if (!row.chain) continue
		const chainSlug = toInternalSlug(row.chain)
		const childIdsByChain = childProtocolIdsByParentChain.get(row.parentProtocolId) ?? new Map<string, Set<string>>()
		const chainChildIds = childIdsByChain.get(chainSlug) ?? new Set<string>()
		chainChildIds.add(row.protocolId)
		childIdsByChain.set(chainSlug, chainChildIds)
		childProtocolIdsByParentChain.set(row.parentProtocolId, childIdsByChain)
	}

	type ParentMetricAccumulator = {
		mcap: number | null
		fdv: number | null
		openInterest: number | null
		openInterestByChain: Record<string, number | null>
		hasOpenInterest: boolean
		hasIncentives: boolean
		incentives: Pick<
			ProtocolTableMetrics,
			| 'emissions24h'
			| 'emissions7d'
			| 'emissions30d'
			| 'emissions90d'
			| 'emissions180d'
			| 'emissions1y'
			| 'emissionsYtd'
			| 'cumulativeEmissions'
			| 'emissionsAnnualized1y'
			| 'emissionsPrev24h'
			| 'emissionsPrev7d'
			| 'emissionsPrev30d'
		>
	}
	const accumulators = new Map<string, ParentMetricAccumulator>()
	for (const row of parentRows) {
		if (!childProtocolIdsByParent.has(row.protocolId)) continue
		const accumulator = accumulators.get(row.protocolId) ?? {
			mcap: null,
			fdv: null,
			openInterest: null,
			openInterestByChain: {},
			hasOpenInterest: false,
			hasIncentives: false,
			incentives: {
				emissions24h: null,
				emissions7d: null,
				emissions30d: null,
				emissions90d: null,
				emissions180d: null,
				emissions1y: null,
				emissionsYtd: null,
				cumulativeEmissions: null,
				emissionsAnnualized1y: null,
				emissionsPrev24h: null,
				emissionsPrev7d: null,
				emissionsPrev30d: null
			}
		}
		accumulator.mcap ??= row.metrics.mcap ?? null
		accumulator.fdv ??= row.metrics.fdv ?? null
		if (Object.hasOwn(row.metrics, 'openInterest')) {
			accumulator.hasOpenInterest = true
			const openInterest = row.metrics.openInterest
			if (openInterest != null) accumulator.openInterest = (accumulator.openInterest ?? 0) + openInterest
			if (row.chain) accumulator.openInterestByChain[toInternalSlug(row.chain)] = openInterest ?? null
		}
		if (row.chain === null && Object.hasOwn(row.metrics, 'emissions30d')) {
			accumulator.hasIncentives = true
			accumulator.incentives = {
				emissions24h: row.metrics.emissions24h ?? null,
				emissions7d: row.metrics.emissions7d ?? null,
				emissions30d: row.metrics.emissions30d ?? null,
				emissions90d: row.metrics.emissions90d ?? null,
				emissions180d: row.metrics.emissions180d ?? null,
				emissions1y: row.metrics.emissions1y ?? null,
				emissionsYtd: row.metrics.emissionsYtd ?? null,
				cumulativeEmissions: row.metrics.cumulativeEmissions ?? null,
				emissionsAnnualized1y: row.metrics.emissionsAnnualized1y ?? null,
				emissionsPrev24h: row.metrics.emissionsPrev24h ?? null,
				emissionsPrev7d: row.metrics.emissionsPrev7d ?? null,
				emissionsPrev30d: row.metrics.emissionsPrev30d ?? null
			}
		}
		accumulators.set(row.protocolId, accumulator)
	}

	const parentMetrics: Record<string, ParentProtocolMetrics> = {}
	for (const [parentId, accumulator] of accumulators) {
		const childProtocolIdsByChain: Record<string, Array<string>> = {}
		for (const [chainSlug, childIds] of childProtocolIdsByParentChain.get(parentId) ?? []) {
			childProtocolIdsByChain[chainSlug] = Array.from(childIds)
		}
		const openInterestMetricsByChain: Record<string, Pick<ProtocolTableMetrics, 'openInterest'>> = {}
		for (const chainSlug in accumulator.openInterestByChain) {
			const openInterest = accumulator.openInterestByChain[chainSlug]
			if (openInterest === undefined) throw new Error(`Missing parent open interest for ${parentId} on ${chainSlug}`)
			openInterestMetricsByChain[chainSlug] = { openInterest }
		}
		const supplements: NonNullable<ParentProtocolMetrics['supplements']> = {}
		if (accumulator.hasOpenInterest) {
			supplements.openInterest = {
				childProtocolIds: Array.from(childProtocolIdsByParent.get(parentId) ?? []),
				childProtocolIdsByChain,
				metrics: { openInterest: accumulator.openInterest },
				metricsByChain: openInterestMetricsByChain
			}
		}
		if (accumulator.hasIncentives) {
			supplements.incentives = {
				childProtocolIds: Array.from(childProtocolIdsByParent.get(parentId) ?? []),
				metrics: accumulator.incentives
			}
		}
		parentMetrics[parentId] = {
			mcap: accumulator.mcap,
			fdv: accumulator.fdv,
			...(Object.keys(supplements).length > 0 ? { supplements } : {})
		}
	}
	return parentMetrics
}

function applyOracleMembership(
	rows: Array<ProtocolTableSourceRow>,
	oracleNamesByProtocolId: ReadonlyMap<string, ReadonlyArray<string>>
): Array<ProtocolTableSourceRow> {
	if (oracleNamesByProtocolId.size === 0) return rows
	return rows.map((row) => {
		const oracles = oracleNamesByProtocolId.get(row.protocolId)
		return oracles?.length ? { ...row, oracles: [...oracles] } : row
	})
}

function filterRowsByCategory(
	rows: Array<ProtocolTableSourceRow>,
	category: string | null | undefined
): Array<ProtocolTableSourceRow> {
	if (!category) return rows
	const normalizedCategory = formatDisplayName(category).toLowerCase()
	return rows.filter((row) => row.category?.toLowerCase() === normalizedCategory)
}

const baseMetricsMapping = (
	row: ProtocolAggregateRow,
	totals: ProtocolMetricTotals,
	requested: ReadonlySet<ProtocolBaseMetricFamily>
): ProtocolTableMetrics => {
	const metrics: ProtocolTableMetrics = {}

	if (requested.has('tvl')) {
		const tvl = row.tvl_base ?? null
		metrics.tvl = tvl
		metrics.tvlPrevDay = derivePreviousValue(tvl, row.tvl_base_1d_pct_change)
		metrics.tvlPrevWeek = derivePreviousValue(tvl, row.tvl_base_7d_pct_change)
		metrics.tvlPrevMonth = derivePreviousValue(tvl, row.tvl_base_30d_pct_change)
		metrics.tvlPrev90d = derivePreviousValue(tvl, row.tvl_base_90d_pct_change)
		metrics.tvlPrev180d = derivePreviousValue(tvl, row.tvl_base_180d_pct_change)
		metrics.tvlPrevYear = derivePreviousValue(tvl, row.tvl_base_365d_pct_change)
		metrics.tvlPrevYtd = derivePreviousValue(tvl, row.tvl_base_ytd_pct_change)
		metrics.change1d = toPercent(row.tvl_base_1d_pct_change)
		metrics.change7d = toPercent(row.tvl_base_7d_pct_change)
		metrics.change1m = toPercent(row.tvl_base_30d_pct_change)
		metrics.change90d = toPercent(row.tvl_base_90d_pct_change)
		metrics.change180d = toPercent(row.tvl_base_180d_pct_change)
		metrics.change1y = toPercent(row.tvl_base_365d_pct_change)
		metrics.changeYtd = toPercent(row.tvl_base_ytd_pct_change)
		metrics.stakingTvl = row.tvl_staking ?? null
		metrics.borrowedTvl = row.tvl_borrowed ?? null
		metrics.pool2Tvl = row.tvl_pool2 ?? null
		metrics.treasuryTvl = row.tvl_treasury ?? null
		metrics.vestingTvl = row.tvl_vesting ?? null
	}

	if (requested.has('dex-volume')) {
		const volume24h = row.volume_dexs_1d ?? null
		const volume7d = row.volume_dexs_7d ?? null
		metrics.volume24h = volume24h
		metrics.volume_7d = volume7d
		metrics.volume_30d = row.volume_dexs_30d ?? null
		metrics.volume_90d = row.volume_dexs_90d ?? null
		metrics.volume_1y = row.volume_dexs_365d ?? null
		metrics.cumulativeVolume = row.volume_dexs_alltime ?? null
		metrics.volumeChange_1d = toPercent(row.volume_dexs_1d_pct_change)
		metrics.volumeChange7dOver7d = toPercent(row.volume_dexs_7d_pct_change)
		metrics.volumeChange30dOver30d = toPercent(row.volume_dexs_30d_pct_change)
		metrics.volumeDominance_24h = computeShare(volume24h, totals.volume_dexs_1d)
		metrics.volumeMarketShare7d = computeShare(volume7d, totals.volume_dexs_7d)
	}

	if (requested.has('fees')) {
		metrics.fees24h = row.fees_1d ?? null
		metrics.fees_7d = row.fees_7d ?? null
		metrics.fees_30d = row.fees_30d ?? null
		metrics.fees_90d = row.fees_90d ?? null
		metrics.fees_180d = row.fees_180d ?? null
		metrics.fees_1y = row.fees_365d ?? null
		metrics.fees_ytd = row.fees_ytd ?? null
		metrics.feesAnnualized1y = row.fees_annualised ?? null
		metrics.average_1y = row.fees_annualised != null ? row.fees_annualised / 12 : null
		metrics.cumulativeFees = row.fees_alltime ?? null
		metrics.feesChange_1d = toPercent(row.fees_1d_pct_change)
		metrics.feesChange7dOver7d = toPercent(row.fees_7d_pct_change)
		metrics.feesChange30dOver30d = toPercent(row.fees_30d_pct_change)
		metrics.feesChange90dOver90d = toPercent(row.fees_90d_pct_change)
		metrics.feesChange180dOver180d = toPercent(row.fees_180d_pct_change)
		metrics.feesChange1yOver1y = toPercent(row.fees_365d_pct_change)
		metrics.feesChangeYtd = toPercent(row.fees_ytd_pct_change)
	}

	if (requested.has('holder-revenue')) {
		metrics.holderRevenue_24h = row.holder_revenue_1d ?? null
		metrics.holderRevenue_7d = row.holder_revenue_7d ?? null
		metrics.holdersRevenue30d = row.holder_revenue_30d ?? null
		metrics.holderRevenue_90d = row.holder_revenue_90d ?? null
		metrics.holderRevenue_180d = row.holder_revenue_180d ?? null
		metrics.holderRevenue_1y = row.holder_revenue_365d ?? null
		metrics.holderRevenue_ytd = row.holder_revenue_ytd ?? null
		metrics.cumulativeHolderRevenue = row.holder_revenue_alltime ?? null
		metrics.holderRevenueAnnualized1y = row.holder_revenue_annualised ?? null
		metrics.holderRevenueChange_1d = toPercent(row.holder_revenue_1d_pct_change)
		metrics.holderRevenueChange7dOver7d = toPercent(row.holder_revenue_7d_pct_change)
		metrics.holderRevenueChange30dOver30d = toPercent(row.holder_revenue_30d_pct_change)
		metrics.holderRevenueChange90dOver90d = toPercent(row.holder_revenue_90d_pct_change)
		metrics.holderRevenueChange180dOver180d = toPercent(row.holder_revenue_180d_pct_change)
		metrics.holderRevenueChange1yOver1y = toPercent(row.holder_revenue_365d_pct_change)
		metrics.holderRevenueChangeYtd = toPercent(row.holder_revenue_ytd_pct_change)
	}

	if (requested.has('incentives')) {
		metrics.emissions24h = row.incentive_1d ?? null
		metrics.emissions7d = row.incentive_7d ?? null
		metrics.emissions30d = row.incentive_30d ?? null
		metrics.emissions90d = row.incentive_90d ?? null
		metrics.emissions180d = row.incentive_180d ?? null
		metrics.emissions1y = row.incentive_365d ?? null
		metrics.emissionsYtd = row.incentive_ytd ?? null
		metrics.cumulativeEmissions = row.incentive_alltime ?? null
		metrics.emissionsAnnualized1y = row.incentive_annualised ?? null
		metrics.emissionsPrev24h = derivePreviousValue(row.incentive_1d ?? null, row.incentive_1d_pct_change)
		metrics.emissionsPrev7d = derivePreviousValue(row.incentive_7d ?? null, row.incentive_7d_pct_change)
		metrics.emissionsPrev30d = derivePreviousValue(row.incentive_30d ?? null, row.incentive_30d_pct_change)
		metrics.emissionsChange1d = toPercent(row.incentive_1d_pct_change)
		metrics.emissionsChange7dOver7d = toPercent(row.incentive_7d_pct_change)
		metrics.emissionsChange30dOver30d = toPercent(row.incentive_30d_pct_change)
	}

	if (requested.has('revenue')) {
		metrics.revenue24h = row.revenue_1d ?? null
		metrics.revenue_7d = row.revenue_7d ?? null
		metrics.revenue_30d = row.revenue_30d ?? null
		metrics.revenue_90d = row.revenue_90d ?? null
		metrics.revenue_180d = row.revenue_180d ?? null
		metrics.revenue_1y = row.revenue_365d ?? null
		metrics.revenue_ytd = row.revenue_ytd ?? null
		metrics.revenueAnnualized1y = row.revenue_annualised ?? null
		metrics.average_revenue_1y = row.revenue_annualised != null ? row.revenue_annualised / 12 : null
		metrics.cumulativeRevenue = row.revenue_alltime ?? null
		metrics.revenueChange_1d = toPercent(row.revenue_1d_pct_change)
		metrics.revenueChange7dOver7d = toPercent(row.revenue_7d_pct_change)
		metrics.revenueChange30dOver30d = toPercent(row.revenue_30d_pct_change)
		metrics.revenueChange90dOver90d = toPercent(row.revenue_90d_pct_change)
		metrics.revenueChange180dOver180d = toPercent(row.revenue_180d_pct_change)
		metrics.revenueChange1yOver1y = toPercent(row.revenue_365d_pct_change)
		metrics.revenueChangeYtd = toPercent(row.revenue_ytd_pct_change)
	}

	if (requested.has('perps-volume')) {
		const perps24h = row.volume_derivatives_1d ?? null
		metrics.perpsVolume24h = perps24h
		metrics.perps_volume_7d = row.volume_derivatives_7d ?? null
		metrics.perps_volume_30d = row.volume_derivatives_30d ?? null
		metrics.perps_volume_90d = row.volume_derivatives_90d ?? null
		metrics.perps_volume_1y = row.volume_derivatives_365d ?? null
		metrics.cumulativePerpsVolume = row.volume_derivatives_alltime ?? null
		metrics.perps_volume_change_1d = toPercent(row.volume_derivatives_1d_pct_change)
		metrics.perpsVolumeChange7dOver7d = toPercent(row.volume_derivatives_7d_pct_change)
		metrics.perpsVolumeChange30dOver30d = toPercent(row.volume_derivatives_30d_pct_change)
		metrics.perps_volume_dominance_24h = computeShare(perps24h, totals.volume_derivatives_1d)
	}

	if (requested.has('aggregator-volume')) {
		metrics.aggregators_volume_24h = row.volume_aggregators_1d ?? null
		metrics.aggregators_volume_7d = row.volume_aggregators_7d ?? null
		metrics.aggregators_volume_30d = row.volume_aggregators_30d ?? null
		metrics.aggregators_volume_90d = row.volume_aggregators_90d ?? null
		metrics.aggregators_volume_1y = row.volume_aggregators_365d ?? null
		metrics.cumulativeAggregatorVolume = row.volume_aggregators_alltime ?? null
		metrics.aggregators_volume_change_1d = toPercent(row.volume_aggregators_1d_pct_change)
		metrics.aggregatorVolumeChange7dOver7d = toPercent(row.volume_aggregators_7d_pct_change)
		metrics.aggregatorVolumeChange30dOver30d = toPercent(row.volume_aggregators_30d_pct_change)
		metrics.aggregators_volume_dominance_24h = computeShare(row.volume_aggregators_1d, totals.volume_aggregators_1d)
		metrics.aggregators_volume_marketShare7d = computeShare(row.volume_aggregators_7d, totals.volume_aggregators_7d)
	}

	if (requested.has('derivatives-aggregator-volume')) {
		metrics.derivatives_aggregators_volume_24h = row.volume_aggr_derivatives_1d ?? null
		metrics.derivatives_aggregators_volume_7d = row.volume_aggr_derivatives_7d ?? null
		metrics.derivatives_aggregators_volume_30d = row.volume_aggr_derivatives_30d ?? null
		metrics.derivatives_aggregators_volume_change_1d = toPercent(row.volume_aggr_derivatives_1d_pct_change)
		metrics.derivativesAggregatorVolumeChange7dOver7d = toPercent(row.volume_aggr_derivatives_7d_pct_change)
		metrics.derivativesAggregatorVolumeChange30dOver30d = toPercent(row.volume_aggr_derivatives_30d_pct_change)
	}

	if (requested.has('options-volume')) {
		metrics.options_volume_24h = row.volume_options_1d ?? null
		metrics.options_volume_7d = row.volume_options_7d ?? null
		metrics.options_volume_30d = row.volume_options_30d ?? null
		metrics.options_volume_90d = row.volume_options_90d ?? null
		metrics.options_volume_1y = row.volume_options_365d ?? null
		metrics.cumulativeOptionsVolume = row.volume_options_alltime ?? null
		metrics.optionsNotionalVolume24h = row.volume_options_notional_1d ?? null
		metrics.optionsNotionalVolume7d = row.volume_options_notional_7d ?? null
		metrics.optionsNotionalVolume30d = row.volume_options_notional_30d ?? null
		metrics.options_volume_change_1d = toPercent(row.volume_options_1d_pct_change)
		metrics.optionsVolumeChange7dOver7d = toPercent(row.volume_options_7d_pct_change)
		metrics.optionsVolumeChange30dOver30d = toPercent(row.volume_options_30d_pct_change)
		metrics.options_volume_dominance_24h = computeShare(row.volume_options_1d, totals.volume_options_1d)
	}

	if (requested.has('open-interest')) metrics.openInterest = row.open_interest ?? null
	if (requested.has('market-cap')) {
		metrics.mcap = row.mcap ?? null
		metrics.fdv = row.fdv ?? null
		if (requested.has('tvl')) {
			metrics.mcaptvl = row.mcap != null && row.tvl_base != null && row.tvl_base > 0 ? row.mcap / row.tvl_base : null
		}
		if (requested.has('fees')) metrics.pf = computeMarketCapToAnnualizedMetricRatio(row.mcap, row.fees_annualised)
		if (requested.has('revenue')) {
			metrics.ps = computeMarketCapToAnnualizedMetricRatio(row.mcap, row.revenue_annualised)
		}
	}

	return metrics
}

function getCanonicalChainDisplayName(chain: string): string {
	const canonicalName = toDisplayName(chain)
	return canonicalName === chain ? formatDisplayName(chain) || chain : canonicalName
}

type ProtocolRowParentIdentity =
	| { parentSlug: null; parentDisplayName?: never }
	| { parentSlug: string; parentDisplayName: string | null }

type ProtocolRowBuildOptions = ProtocolRowParentIdentity & {
	slug: string
	displayName: string | null
	category: string | null
	requestedMetricFamilies: ReadonlySet<ProtocolBaseMetricFamily>
}

const buildBaseRow = (
	row: ProtocolAggregateRow,
	totals: ProtocolMetricTotals,
	options: ProtocolRowBuildOptions & { chainSlugs: Array<string> | null }
): ProtocolAggregateTableRow => {
	const metrics = baseMetricsMapping(row, totals, options.requestedMetricFamilies)
	const displayName = options.displayName ?? (formatDisplayName(options.slug) || options.slug)
	const parentDisplayName = options.parentSlug
		? (options.parentDisplayName ?? (formatDisplayName(options.parentSlug) || options.parentSlug))
		: null

	return {
		rowType: 'protocol',
		id: `protocol-${options.slug}`,
		name: displayName,
		displayName,
		protocolId: options.slug,
		logo: tokenIconUrl(options.slug),
		category: options.category ? formatDisplayName(options.category) : null,
		chains: options.chainSlugs ? options.chainSlugs.map(getCanonicalChainDisplayName) : [],
		oracles: [],
		parentProtocolId: options.parentSlug ?? null,
		parentProtocolName: parentDisplayName,
		parentProtocolLogo: options.parentSlug ? tokenIconUrl(options.parentSlug) : null,
		...(row.exclude_tvl_from_parent ? { excludeTvlFromParent: true } : null),
		metrics,
		chain: null
	}
}

const buildChainRow = (
	row: ProtocolAggregateRow,
	totals: ProtocolMetricTotals,
	options: ProtocolRowBuildOptions & { chainSlug: string }
): ProtocolChainTableRow => {
	const chainName = getCanonicalChainDisplayName(options.chainSlug)
	const displayName = options.displayName ?? (formatDisplayName(options.slug) || options.slug)
	return {
		rowType: 'protocol-chain',
		id: `protocol-${options.slug}-${options.chainSlug}`,
		name: displayName,
		displayName,
		protocolId: options.slug,
		logo: tokenIconUrl(options.slug),
		category: options.category ? formatDisplayName(options.category) : null,
		chains: [chainName],
		oracles: [],
		parentProtocolId: options.parentSlug,
		parentProtocolName: options.parentSlug
			? (options.parentDisplayName ?? (formatDisplayName(options.parentSlug) || options.parentSlug))
			: null,
		parentProtocolLogo: options.parentSlug ? tokenIconUrl(options.parentSlug) : null,
		...(row.exclude_tvl_from_parent ? { excludeTvlFromParent: true } : null),
		metrics: baseMetricsMapping(row, totals, options.requestedMetricFamilies),
		chain: chainName
	}
}

const fetchProtocolAggregateRows = async (
	chainFilters: Array<string>,
	totalsPromise: Promise<ProtocolMetricTotals>,
	baseMetricFamilies: ReadonlyArray<ProtocolBaseMetricFamily>
): Promise<Array<ProtocolTableSourceRow>> => {
	const requestedMetricFamilies = new Set(baseMetricFamilies)
	const includeOpenInterest = requestedMetricFamilies.has('open-interest')
	const conditions: Array<string> = []
	const values: Array<Array<string>> = []

	if (chainFilters.length > 0) {
		conditions.push(
			`EXISTS (
				SELECT 1
				FROM unnest(COALESCE(chains.chain_slugs, ARRAY[]::text[])) AS chain_slug(value)
				WHERE chain_slug.value = ANY($${values.length + 1})
			)`
		)
		values.push(chainFilters)
	}
	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
	const openInterestCte = includeOpenInterest
		? `,
		open_interest AS (
			SELECT
				protocol,
				SUM(open_interest) AS open_interest
			FROM lens.open_interest_current
			GROUP BY protocol
		),
		protocol_anchor AS (
			SELECT protocol FROM lens.metrics_protocol_current
			UNION
			SELECT protocol FROM open_interest
		)`
		: ''
	const openInterestSelect = includeOpenInterest ? 'oi.open_interest' : 'NULL::numeric AS open_interest'
	const chainMetaSource = includeOpenInterest
		? `(SELECT protocol, lower(chain) AS chain FROM lens.metrics_protocol_by_chain_current
			UNION
			SELECT protocol, lower(chain) AS chain FROM lens.open_interest_current) protocol_chains`
		: 'lens.metrics_protocol_by_chain_current'
	const protocolSource = includeOpenInterest
		? `protocol_anchor anchor
		LEFT JOIN lens.metrics_protocol_current mp ON mp.protocol = anchor.protocol`
		: 'lens.metrics_protocol_current mp'
	const protocolIdentity = includeOpenInterest ? 'anchor.protocol' : 'mp.protocol'
	const openInterestJoin = includeOpenInterest ? `LEFT JOIN open_interest oi ON oi.protocol = ${protocolIdentity}` : ''
	const metricProjection = buildLensMetricProjection('mp', baseMetricFamilies)

	const [rows, totals] = await Promise.all([
		llamaDb.any<ProtocolAggregateRow>(
			`
		WITH chain_meta AS (
			SELECT
				protocol,
				array_remove(array_agg(DISTINCT lower(chain) ORDER BY lower(chain)), NULL) AS chain_slugs
			FROM ${chainMetaSource}
			GROUP BY protocol
		),
		category_meta AS (
			SELECT
				protocol,
				MIN(category) AS category
			FROM lens.metrics_sub_protocol_current
			GROUP BY protocol
		)
		${openInterestCte}
		SELECT
			${protocolIdentity} AS protocol,
			metadata.name AS protocol_name,
			cat.category AS protocol_category,
			chains.chain_slugs,
			${metricProjection},
			${openInterestSelect},
			FALSE AS exclude_tvl_from_parent
		FROM ${protocolSource}
		LEFT JOIN dim.protocol metadata ON metadata.slug = ${protocolIdentity}
		LEFT JOIN chain_meta chains ON chains.protocol = ${protocolIdentity}
		LEFT JOIN category_meta cat ON cat.protocol = ${protocolIdentity}
		${openInterestJoin}
		${whereClause}
	`,
			values
		),
		totalsPromise
	])

	return rows.map((row) =>
		buildBaseRow(row, totals, {
			slug: row.protocol,
			displayName: row.protocol_name,
			parentSlug: null,
			category: row.protocol_category,
			chainSlugs: row.chain_slugs,
			requestedMetricFamilies
		})
	)
}

const fetchSubProtocolRows = async (
	chainFilters: Array<string>,
	totalsPromise: Promise<ProtocolMetricTotals>,
	baseMetricFamilies: ReadonlyArray<ProtocolBaseMetricFamily>
): Promise<Array<ProtocolTableSourceRow>> => {
	const requestedMetricFamilies = new Set(baseMetricFamilies)
	const includeOpenInterest = requestedMetricFamilies.has('open-interest')
	const conditions: Array<string> = []
	const values: Array<Array<string>> = []

	if (chainFilters.length > 0) {
		conditions.push(
			`EXISTS (
				SELECT 1
				FROM unnest(COALESCE(chains.chain_slugs, ARRAY[]::text[])) AS chain_slug(value)
				WHERE chain_slug.value = ANY($${values.length + 1})
			)`
		)
		values.push(chainFilters)
	}
	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
	const openInterestCte = includeOpenInterest
		? `,
		open_interest AS (
			SELECT
				sub_protocol,
				protocol,
				SUM(open_interest) AS open_interest
			FROM lens.open_interest_current
			WHERE sub_protocol IS NOT NULL
			GROUP BY sub_protocol, protocol
		),
		sub_protocol_anchor AS (
			SELECT sub_protocol, protocol FROM lens.metrics_sub_protocol_current
			UNION
			SELECT sub_protocol, protocol FROM open_interest
		)`
		: ''
	const openInterestSelect = includeOpenInterest ? 'oi.open_interest' : 'NULL::numeric AS open_interest'
	const chainMetaSource = includeOpenInterest
		? `(SELECT sub_protocol, lower(chain) AS chain
			FROM lens.metrics_sub_protocol_by_chain_current
			UNION
			SELECT sub_protocol, lower(chain) AS chain
			FROM lens.open_interest_current
			WHERE sub_protocol IS NOT NULL) sub_protocol_chains`
		: 'lens.metrics_sub_protocol_by_chain_current'
	const subProtocolSource = includeOpenInterest
		? `sub_protocol_anchor anchor
		LEFT JOIN lens.metrics_sub_protocol_current msp ON msp.sub_protocol = anchor.sub_protocol AND msp.protocol = anchor.protocol`
		: 'lens.metrics_sub_protocol_current msp'
	const subProtocolIdentity = includeOpenInterest ? 'anchor.sub_protocol' : 'msp.sub_protocol'
	const parentProtocolIdentity = includeOpenInterest ? 'anchor.protocol' : 'msp.protocol'
	const openInterestJoin = includeOpenInterest
		? `LEFT JOIN open_interest oi ON oi.sub_protocol = ${subProtocolIdentity} AND oi.protocol = ${parentProtocolIdentity}`
		: ''
	const metricProjection = buildLensMetricProjection('msp', baseMetricFamilies)

	const [rows, totals] = await Promise.all([
		llamaDb.any<SubProtocolRow>(
			`
		WITH chain_meta AS (
			SELECT
				sub_protocol,
				array_remove(array_agg(DISTINCT lower(chain) ORDER BY lower(chain)), NULL) AS chain_slugs
			FROM ${chainMetaSource}
			GROUP BY sub_protocol
		)
		${openInterestCte}
		SELECT
			${subProtocolIdentity} AS sub_protocol,
			${parentProtocolIdentity} AS protocol,
			metadata.name AS protocol_name,
			parent_metadata.name AS parent_protocol_name,
			msp.category AS protocol_category,
			chains.chain_slugs,
			${metricProjection},
			${openInterestSelect},
			COALESCE(metadata.exclude_tvl_from_parent, FALSE) AS exclude_tvl_from_parent
		FROM ${subProtocolSource}
		LEFT JOIN chain_meta chains ON chains.sub_protocol = ${subProtocolIdentity}
		${openInterestJoin}
		LEFT JOIN dim.protocol metadata ON metadata.slug = ${subProtocolIdentity}
		LEFT JOIN dim.protocol parent_metadata ON parent_metadata.slug = ${parentProtocolIdentity}
		${whereClause}
	`,
			values
		),
		totalsPromise
	])

	const normalizedRows: Array<ProtocolTableSourceRow> = []
	for (const row of rows) {
		if (!row.sub_protocol || !row.protocol || row.sub_protocol === row.protocol) continue
		normalizedRows.push(
			buildBaseRow(row, totals, {
				slug: row.sub_protocol,
				displayName: row.protocol_name,
				parentSlug: row.protocol,
				parentDisplayName: row.parent_protocol_name,
				category: row.protocol_category,
				chainSlugs: row.chain_slugs,
				requestedMetricFamilies
			})
		)
	}
	return normalizedRows
}

const fetchProtocolChainTableData = async (
	chainFilters: Array<string>,
	totalsPromise: Promise<ProtocolMetricTotals>,
	baseMetricFamilies: ReadonlyArray<ProtocolBaseMetricFamily>
): Promise<ProtocolsTableResult> => {
	const [parentChainRows, subProtocolChainRows, chainMetrics] = await Promise.all([
		fetchParentProtocolsByChain(chainFilters, totalsPromise, baseMetricFamilies),
		fetchSubProtocolsByChain(chainFilters, totalsPromise, baseMetricFamilies),
		fetchChainMetricsForGrouping(chainFilters, totalsPromise, baseMetricFamilies)
	])

	const parentProtocolIds = new Set<string>()
	const subProtocolIds = new Set<string>()
	for (const row of subProtocolChainRows) {
		if (row.parentProtocolId) parentProtocolIds.add(row.parentProtocolId)
		subProtocolIds.add(row.protocolId)
	}
	const uniqueRows = new Map<string, ProtocolTableSourceRow>()
	const addRow = (row: ProtocolTableSourceRow) => {
		const chainSlug = row.chain ? toInternalSlug(row.chain) : null
		if (chainSlug && !chainMetrics[chainSlug]) chainMetrics[chainSlug] = { availability: 'unavailable' }
		if (!uniqueRows.has(row.id)) uniqueRows.set(row.id, row)
	}
	for (const row of parentChainRows) {
		if (row.protocolId && (parentProtocolIds.has(row.protocolId) || subProtocolIds.has(row.protocolId))) continue
		addRow(row)
	}
	for (const row of subProtocolChainRows) addRow(row)

	return {
		rows: Array.from(uniqueRows.values()),
		parentMetrics: buildParentMetrics(parentChainRows, subProtocolChainRows),
		chainMetrics
	}
}

const fetchParentProtocolsByChain = async (
	chainFilters: Array<string>,
	totalsPromise: Promise<ProtocolMetricTotals>,
	baseMetricFamilies: ReadonlyArray<ProtocolBaseMetricFamily>
): Promise<Array<ProtocolChainTableRow>> => {
	const requestedMetricFamilies = new Set(baseMetricFamilies)
	const includeOpenInterest = requestedMetricFamilies.has('open-interest')
	const openInterestCte = includeOpenInterest
		? `,
		open_interest AS (
			SELECT
				protocol,
				lower(chain) AS chain,
				SUM(open_interest) AS open_interest
			FROM lens.open_interest_current
			GROUP BY protocol, lower(chain)
		),
		protocol_chain_anchor AS (
			SELECT protocol, lower(chain) AS chain FROM lens.metrics_protocol_by_chain_current
			UNION
			SELECT protocol, chain FROM open_interest
		)`
		: ''
	const openInterestSelect = includeOpenInterest ? 'oi.open_interest' : 'NULL::numeric AS open_interest'
	const protocolChainSource = includeOpenInterest
		? `protocol_chain_anchor anchor
		LEFT JOIN lens.metrics_protocol_by_chain_current mpc
			ON mpc.protocol = anchor.protocol AND lower(mpc.chain) = anchor.chain`
		: 'lens.metrics_protocol_by_chain_current mpc'
	const protocolIdentity = includeOpenInterest ? 'anchor.protocol' : 'mpc.protocol'
	const chainIdentity = includeOpenInterest ? 'anchor.chain' : 'mpc.chain'
	const openInterestJoin = includeOpenInterest
		? `LEFT JOIN open_interest oi ON oi.protocol = ${protocolIdentity} AND oi.chain = ${chainIdentity}`
		: ''
	const metricProjection = buildLensMetricProjection('mpc', baseMetricFamilies)
	const [rows, totals] = await Promise.all([
		llamaDb.any<ProtocolChainAggregateRow>(
			`
		WITH category_meta AS (
			SELECT
				protocol,
				MIN(category) AS category
			FROM lens.metrics_sub_protocol_current
			GROUP BY protocol
		)
		${openInterestCte}
		SELECT
			${protocolIdentity} AS protocol,
			metadata.name AS protocol_name,
			cat.category AS protocol_category,
			ARRAY[lower(${chainIdentity})] AS chain_slugs,
			${chainIdentity} AS chain_slug,
			${metricProjection},
			${openInterestSelect},
			FALSE AS exclude_tvl_from_parent
		FROM ${protocolChainSource}
		LEFT JOIN dim.protocol metadata ON metadata.slug = ${protocolIdentity}
		LEFT JOIN category_meta cat ON cat.protocol = ${protocolIdentity}
		${openInterestJoin}
		WHERE (COALESCE(cardinality($1::text[]), 0) = 0 OR lower(${chainIdentity}) = ANY($1))
	`,
			[chainFilters]
		),
		totalsPromise
	])

	return rows.map((row) => {
		return buildChainRow(row, totals, {
			slug: row.protocol,
			displayName: row.protocol_name,
			parentSlug: null,
			category: row.protocol_category,
			chainSlug: row.chain_slug,
			requestedMetricFamilies
		})
	})
}

const fetchSubProtocolsByChain = async (
	chainFilters: Array<string>,
	totalsPromise: Promise<ProtocolMetricTotals>,
	baseMetricFamilies: ReadonlyArray<ProtocolBaseMetricFamily>
): Promise<Array<ProtocolChainTableRow>> => {
	const requestedMetricFamilies = new Set(baseMetricFamilies)
	const includeOpenInterest = requestedMetricFamilies.has('open-interest')
	const openInterestCte = includeOpenInterest
		? `WITH open_interest AS (
			SELECT
				sub_protocol,
				protocol,
				lower(chain) AS chain,
				SUM(open_interest) AS open_interest
			FROM lens.open_interest_current
			WHERE sub_protocol IS NOT NULL
			GROUP BY sub_protocol, protocol, lower(chain)
		),
		sub_protocol_chain_anchor AS (
			SELECT sub_protocol, protocol, lower(chain) AS chain FROM lens.metrics_sub_protocol_by_chain_current
			UNION
			SELECT sub_protocol, protocol, chain FROM open_interest
		)`
		: ''
	const openInterestSelect = includeOpenInterest ? 'oi.open_interest' : 'NULL::numeric AS open_interest'
	const subProtocolChainSource = includeOpenInterest
		? `sub_protocol_chain_anchor anchor
		LEFT JOIN lens.metrics_sub_protocol_by_chain_current mspc
			ON mspc.sub_protocol = anchor.sub_protocol
			AND mspc.protocol = anchor.protocol
			AND lower(mspc.chain) = anchor.chain
		LEFT JOIN lens.metrics_sub_protocol_current msp
			ON msp.sub_protocol = anchor.sub_protocol AND msp.protocol = anchor.protocol`
		: 'lens.metrics_sub_protocol_by_chain_current mspc'
	const subProtocolIdentity = includeOpenInterest ? 'anchor.sub_protocol' : 'mspc.sub_protocol'
	const parentProtocolIdentity = includeOpenInterest ? 'anchor.protocol' : 'mspc.protocol'
	const chainIdentity = includeOpenInterest ? 'anchor.chain' : 'mspc.chain'
	const categoryExpression = includeOpenInterest ? 'COALESCE(mspc.category, msp.category)' : 'mspc.category'
	const openInterestJoin = includeOpenInterest
		? `LEFT JOIN open_interest oi
			ON oi.sub_protocol = ${subProtocolIdentity}
			AND oi.protocol = ${parentProtocolIdentity}
			AND oi.chain = ${chainIdentity}`
		: ''
	const metricProjection = buildLensMetricProjection('mspc', baseMetricFamilies)
	const [rows, totals] = await Promise.all([
		llamaDb.any<SubProtocolChainRow>(
			`
		${openInterestCte}
		SELECT
			${subProtocolIdentity} AS sub_protocol,
			${parentProtocolIdentity} AS protocol,
			metadata.name AS protocol_name,
			parent_metadata.name AS parent_protocol_name,
			${categoryExpression} AS protocol_category,
			ARRAY[lower(${chainIdentity})] AS chain_slugs,
			${chainIdentity} AS chain_slug,
			${metricProjection},
			${openInterestSelect},
			COALESCE(metadata.exclude_tvl_from_parent, FALSE) AS exclude_tvl_from_parent
		FROM ${subProtocolChainSource}
		${openInterestJoin}
		LEFT JOIN dim.protocol metadata ON metadata.slug = ${subProtocolIdentity}
		LEFT JOIN dim.protocol parent_metadata ON parent_metadata.slug = ${parentProtocolIdentity}
		WHERE
			${subProtocolIdentity} != ${parentProtocolIdentity}
			AND (COALESCE(cardinality($1::text[]), 0) = 0 OR lower(${chainIdentity}) = ANY($1))
	`,
			[chainFilters]
		),
		totalsPromise
	])

	return rows.map((row) => {
		return buildChainRow(row, totals, {
			slug: row.sub_protocol,
			displayName: row.protocol_name,
			parentSlug: row.protocol,
			parentDisplayName: row.parent_protocol_name,
			category: row.protocol_category,
			chainSlug: row.chain_slug,
			requestedMetricFamilies
		})
	})
}

type ChainMetricsRow = { chain: string } & Partial<{
	protocol_count: number | null
	tvl_base: number | null
	tvl_base_1d_pct_change: number | null
	tvl_base_7d_pct_change: number | null
	tvl_base_30d_pct_change: number | null
	tvl_base_90d_pct_change: number | null
	tvl_base_180d_pct_change: number | null
	tvl_base_365d_pct_change: number | null
	tvl_base_ytd_pct_change: number | null
	tvl_staking: number | null
	tvl_borrowed: number | null
	tvl_pool2: number | null
	tvl_treasury: number | null
	tvl_vesting: number | null
	volume_dexs_1d: number | null
	volume_dexs_7d: number | null
	volume_dexs_30d: number | null
	volume_dexs_90d: number | null
	volume_dexs_365d: number | null
	volume_dexs_1d_pct_change: number | null
	volume_dexs_7d_pct_change: number | null
	volume_dexs_30d_pct_change: number | null
	volume_dexs_alltime: number | null
	app_fees_1d: number | null
	app_fees_7d: number | null
	app_fees_30d: number | null
	app_fees_90d: number | null
	app_fees_180d: number | null
	app_fees_365d: number | null
	app_fees_ytd: number | null
	app_fees_alltime: number | null
	app_fees_annualised: number | null
	app_fees_1d_pct_change: number | null
	app_fees_7d_pct_change: number | null
	app_fees_30d_pct_change: number | null
	app_fees_90d_pct_change: number | null
	app_fees_180d_pct_change: number | null
	app_fees_365d_pct_change: number | null
	app_fees_ytd_pct_change: number | null
	chain_fees_1d: number | null
	chain_fees_7d: number | null
	chain_fees_30d: number | null
	chain_fees_1d_pct_change: number | null
	chain_fees_7d_pct_change: number | null
	chain_fees_30d_pct_change: number | null
	chain_rev_1d: number | null
	chain_rev_7d: number | null
	chain_rev_30d: number | null
	chain_rev_1d_pct_change: number | null
	chain_rev_7d_pct_change: number | null
	chain_rev_30d_pct_change: number | null
	app_revenue_1d: number | null
	app_revenue_7d: number | null
	app_revenue_30d: number | null
	app_revenue_90d: number | null
	app_revenue_180d: number | null
	app_revenue_365d: number | null
	app_revenue_ytd: number | null
	app_revenue_alltime: number | null
	app_revenue_annualised: number | null
	app_revenue_1d_pct_change: number | null
	app_revenue_7d_pct_change: number | null
	app_revenue_30d_pct_change: number | null
	app_revenue_90d_pct_change: number | null
	app_revenue_180d_pct_change: number | null
	app_revenue_365d_pct_change: number | null
	app_revenue_ytd_pct_change: number | null
	chain_revenue_1d: number | null
	chain_revenue_7d: number | null
	chain_revenue_30d: number | null
	chain_revenue_1d_pct_change: number | null
	chain_revenue_7d_pct_change: number | null
	chain_revenue_30d_pct_change: number | null
	incentive_1d: number | null
	incentive_1d_pct_change: number | null
	incentive_7d: number | null
	incentive_7d_pct_change: number | null
	incentive_30d: number | null
	incentive_30d_pct_change: number | null
	incentive_90d: number | null
	incentive_180d: number | null
	incentive_365d: number | null
	incentive_ytd: number | null
	incentive_alltime: number | null
	incentive_annualised: number | null
	volume_derivatives_1d: number | null
	volume_derivatives_7d: number | null
	volume_derivatives_30d: number | null
	volume_derivatives_90d: number | null
	volume_derivatives_365d: number | null
	volume_derivatives_alltime: number | null
	volume_derivatives_1d_pct_change: number | null
	volume_derivatives_7d_pct_change: number | null
	volume_derivatives_30d_pct_change: number | null
	volume_aggregators_1d: number | null
	volume_aggregators_7d: number | null
	volume_aggregators_30d: number | null
	volume_aggregators_90d: number | null
	volume_aggregators_365d: number | null
	volume_aggregators_alltime: number | null
	volume_aggregators_1d_pct_change: number | null
	volume_aggregators_7d_pct_change: number | null
	volume_aggregators_30d_pct_change: number | null
	volume_aggr_derivatives_1d: number | null
	volume_aggr_derivatives_7d: number | null
	volume_aggr_derivatives_30d: number | null
	volume_aggr_derivatives_1d_pct_change: number | null
	volume_aggr_derivatives_7d_pct_change: number | null
	volume_aggr_derivatives_30d_pct_change: number | null
	volume_options_1d: number | null
	volume_options_7d: number | null
	volume_options_30d: number | null
	volume_options_90d: number | null
	volume_options_365d: number | null
	volume_options_alltime: number | null
	volume_options_notional_1d: number | null
	volume_options_notional_7d: number | null
	volume_options_notional_30d: number | null
	volume_options_1d_pct_change: number | null
	volume_options_7d_pct_change: number | null
	volume_options_30d_pct_change: number | null
	open_interest: number | null
	bridged_tvl: number | null
	stables_mcap: number | null
	total_stables_mcap: number | null
}>

type ProjectedChainMetricColumn = Exclude<
	keyof ChainMetricsRow,
	'chain' | 'open_interest' | 'bridged_tvl' | 'stables_mcap' | 'total_stables_mcap'
>

const CHAIN_METRIC_COLUMNS_BY_FAMILY: Readonly<
	Partial<Record<ProtocolBaseMetricFamily, ReadonlyArray<ProjectedChainMetricColumn>>>
> = {
	'protocol-count': ['protocol_count'],
	tvl: [
		'tvl_base',
		'tvl_base_1d_pct_change',
		'tvl_base_7d_pct_change',
		'tvl_base_30d_pct_change',
		'tvl_base_90d_pct_change',
		'tvl_base_180d_pct_change',
		'tvl_base_365d_pct_change',
		'tvl_base_ytd_pct_change',
		'tvl_staking',
		'tvl_borrowed',
		'tvl_pool2',
		'tvl_treasury',
		'tvl_vesting'
	],
	'dex-volume': [
		'volume_dexs_1d',
		'volume_dexs_7d',
		'volume_dexs_30d',
		'volume_dexs_90d',
		'volume_dexs_365d',
		'volume_dexs_1d_pct_change',
		'volume_dexs_7d_pct_change',
		'volume_dexs_30d_pct_change',
		'volume_dexs_alltime'
	],
	fees: [
		'app_fees_1d',
		'app_fees_7d',
		'app_fees_30d',
		'app_fees_90d',
		'app_fees_180d',
		'app_fees_365d',
		'app_fees_ytd',
		'app_fees_alltime',
		'app_fees_annualised',
		'app_fees_1d_pct_change',
		'app_fees_7d_pct_change',
		'app_fees_30d_pct_change',
		'app_fees_90d_pct_change',
		'app_fees_180d_pct_change',
		'app_fees_365d_pct_change',
		'app_fees_ytd_pct_change',
		'chain_fees_1d',
		'chain_fees_7d',
		'chain_fees_30d',
		'chain_fees_1d_pct_change',
		'chain_fees_7d_pct_change',
		'chain_fees_30d_pct_change',
		'chain_rev_1d',
		'chain_rev_7d',
		'chain_rev_30d',
		'chain_rev_1d_pct_change',
		'chain_rev_7d_pct_change',
		'chain_rev_30d_pct_change'
	],
	incentives: [
		'incentive_1d',
		'incentive_1d_pct_change',
		'incentive_7d',
		'incentive_7d_pct_change',
		'incentive_30d',
		'incentive_30d_pct_change',
		'incentive_90d',
		'incentive_180d',
		'incentive_365d',
		'incentive_ytd',
		'incentive_alltime',
		'incentive_annualised'
	],
	revenue: [
		'app_revenue_1d',
		'app_revenue_7d',
		'app_revenue_30d',
		'app_revenue_90d',
		'app_revenue_180d',
		'app_revenue_365d',
		'app_revenue_ytd',
		'app_revenue_alltime',
		'app_revenue_annualised',
		'app_revenue_1d_pct_change',
		'app_revenue_7d_pct_change',
		'app_revenue_30d_pct_change',
		'app_revenue_90d_pct_change',
		'app_revenue_180d_pct_change',
		'app_revenue_365d_pct_change',
		'app_revenue_ytd_pct_change',
		'chain_revenue_1d',
		'chain_revenue_7d',
		'chain_revenue_30d',
		'chain_revenue_1d_pct_change',
		'chain_revenue_7d_pct_change',
		'chain_revenue_30d_pct_change'
	],
	'perps-volume': [
		'volume_derivatives_1d',
		'volume_derivatives_7d',
		'volume_derivatives_30d',
		'volume_derivatives_90d',
		'volume_derivatives_365d',
		'volume_derivatives_alltime',
		'volume_derivatives_1d_pct_change',
		'volume_derivatives_7d_pct_change',
		'volume_derivatives_30d_pct_change'
	],
	'aggregator-volume': [
		'volume_aggregators_1d',
		'volume_aggregators_7d',
		'volume_aggregators_30d',
		'volume_aggregators_90d',
		'volume_aggregators_365d',
		'volume_aggregators_alltime',
		'volume_aggregators_1d_pct_change',
		'volume_aggregators_7d_pct_change',
		'volume_aggregators_30d_pct_change'
	],
	'derivatives-aggregator-volume': [
		'volume_aggr_derivatives_1d',
		'volume_aggr_derivatives_7d',
		'volume_aggr_derivatives_30d',
		'volume_aggr_derivatives_1d_pct_change',
		'volume_aggr_derivatives_7d_pct_change',
		'volume_aggr_derivatives_30d_pct_change'
	],
	'options-volume': [
		'volume_options_1d',
		'volume_options_7d',
		'volume_options_30d',
		'volume_options_90d',
		'volume_options_365d',
		'volume_options_alltime',
		'volume_options_notional_1d',
		'volume_options_notional_7d',
		'volume_options_notional_30d',
		'volume_options_1d_pct_change',
		'volume_options_7d_pct_change',
		'volume_options_30d_pct_change'
	]
}

const buildChainMetricProjection = (requestedFamilies: ReadonlyArray<ProtocolBaseMetricFamily>): Array<string> => {
	const requested = new Set(requestedFamilies)
	const projection: Array<string> = []
	for (const family of PROTOCOL_BASE_METRIC_FAMILIES) {
		for (const column of CHAIN_METRIC_COLUMNS_BY_FAMILY[family] ?? []) {
			if (requested.has(family)) projection.push(`mc.${column}`)
		}
	}
	return projection
}

const mapCanonicalChainMetrics = (
	row: ChainMetricsRow,
	totals: ProtocolMetricTotals,
	requested: ReadonlySet<ProtocolBaseMetricFamily>
): CanonicalChainMetrics => {
	const metrics: CanonicalChainMetrics = {}

	if (requested.has('tvl')) {
		const tvl = row.tvl_base ?? null
		metrics.tvl = tvl
		metrics.tvlPrevDay = derivePreviousValue(tvl, row.tvl_base_1d_pct_change)
		metrics.tvlPrevWeek = derivePreviousValue(tvl, row.tvl_base_7d_pct_change)
		metrics.tvlPrevMonth = derivePreviousValue(tvl, row.tvl_base_30d_pct_change)
		metrics.tvlPrev90d = derivePreviousValue(tvl, row.tvl_base_90d_pct_change)
		metrics.tvlPrev180d = derivePreviousValue(tvl, row.tvl_base_180d_pct_change)
		metrics.tvlPrevYear = derivePreviousValue(tvl, row.tvl_base_365d_pct_change)
		metrics.tvlPrevYtd = derivePreviousValue(tvl, row.tvl_base_ytd_pct_change)
		metrics.change1d = toPercent(row.tvl_base_1d_pct_change)
		metrics.change7d = toPercent(row.tvl_base_7d_pct_change)
		metrics.change1m = toPercent(row.tvl_base_30d_pct_change)
		metrics.change90d = toPercent(row.tvl_base_90d_pct_change)
		metrics.change180d = toPercent(row.tvl_base_180d_pct_change)
		metrics.change1y = toPercent(row.tvl_base_365d_pct_change)
		metrics.changeYtd = toPercent(row.tvl_base_ytd_pct_change)
		metrics.stakingTvl = row.tvl_staking ?? null
		metrics.borrowedTvl = row.tvl_borrowed ?? null
		metrics.pool2Tvl = row.tvl_pool2 ?? null
		metrics.treasuryTvl = row.tvl_treasury ?? null
		metrics.vestingTvl = row.tvl_vesting ?? null
		metrics.tvlShare = computeShare(tvl, totals.tvl_base)
	}

	if (requested.has('dex-volume')) {
		const volume24h = row.volume_dexs_1d ?? null
		const volume7d = row.volume_dexs_7d ?? null
		metrics.volume24h = volume24h
		metrics.volume_7d = volume7d
		metrics.volume_30d = row.volume_dexs_30d ?? null
		metrics.volume_90d = row.volume_dexs_90d ?? null
		metrics.volume_1y = row.volume_dexs_365d ?? null
		metrics.cumulativeVolume = row.volume_dexs_alltime ?? null
		metrics.volumeChange_1d = toPercent(row.volume_dexs_1d_pct_change)
		metrics.volumeChange7dOver7d = toPercent(row.volume_dexs_7d_pct_change)
		metrics.volumeChange30dOver30d = toPercent(row.volume_dexs_30d_pct_change)
		metrics.volumeDominance_24h = computeShare(volume24h, totals.volume_dexs_1d)
		metrics.volumeMarketShare7d = computeShare(volume7d, totals.volume_dexs_7d)
		metrics.volume24hShare = computeShare(volume24h, totals.volume_dexs_1d)
	}

	if (requested.has('fees')) {
		const feesAnnualized1y = row.app_fees_annualised ?? null
		metrics.fees24h = row.app_fees_1d ?? null
		metrics.fees_7d = row.app_fees_7d ?? null
		metrics.fees_30d = row.app_fees_30d ?? null
		metrics.fees_90d = row.app_fees_90d ?? null
		metrics.fees_180d = row.app_fees_180d ?? null
		metrics.fees_1y = row.app_fees_365d ?? null
		metrics.fees_ytd = row.app_fees_ytd ?? null
		metrics.feesAnnualized1y = feesAnnualized1y
		metrics.average_1y = feesAnnualized1y == null ? null : feesAnnualized1y / 12
		metrics.cumulativeFees = row.app_fees_alltime ?? null
		metrics.feesChange_1d = toPercent(row.app_fees_1d_pct_change)
		metrics.feesChange7dOver7d = toPercent(row.app_fees_7d_pct_change)
		metrics.feesChange30dOver30d = toPercent(row.app_fees_30d_pct_change)
		metrics.feesChange90dOver90d = toPercent(row.app_fees_90d_pct_change)
		metrics.feesChange180dOver180d = toPercent(row.app_fees_180d_pct_change)
		metrics.feesChange1yOver1y = toPercent(row.app_fees_365d_pct_change)
		metrics.feesChangeYtd = toPercent(row.app_fees_ytd_pct_change)
		metrics.chainFees24h = row.chain_fees_1d ?? null
		metrics.chainFees7d = row.chain_fees_7d ?? null
		metrics.chainFees30d = row.chain_fees_30d ?? null
		metrics.chainFeesChange1d = toPercent(row.chain_fees_1d_pct_change)
		metrics.chainFeesChange7dOver7d = toPercent(row.chain_fees_7d_pct_change)
		metrics.chainFeesChange30dOver30d = toPercent(row.chain_fees_30d_pct_change)
		metrics.chainRev24h = row.chain_rev_1d ?? null
		metrics.chainRev7d = row.chain_rev_7d ?? null
		metrics.chainRev30d = row.chain_rev_30d ?? null
		metrics.chainRevChange1d = toPercent(row.chain_rev_1d_pct_change)
		metrics.chainRevChange7dOver7d = toPercent(row.chain_rev_7d_pct_change)
		metrics.chainRevChange30dOver30d = toPercent(row.chain_rev_30d_pct_change)
	}

	if (requested.has('incentives')) {
		metrics.emissions24h = row.incentive_1d ?? null
		metrics.emissions7d = row.incentive_7d ?? null
		metrics.emissions30d = row.incentive_30d ?? null
		metrics.emissions90d = row.incentive_90d ?? null
		metrics.emissions180d = row.incentive_180d ?? null
		metrics.emissions1y = row.incentive_365d ?? null
		metrics.emissionsYtd = row.incentive_ytd ?? null
		metrics.cumulativeEmissions = row.incentive_alltime ?? null
		metrics.emissionsAnnualized1y = row.incentive_annualised ?? null
		metrics.emissionsPrev24h = derivePreviousValue(row.incentive_1d ?? null, row.incentive_1d_pct_change)
		metrics.emissionsPrev7d = derivePreviousValue(row.incentive_7d ?? null, row.incentive_7d_pct_change)
		metrics.emissionsPrev30d = derivePreviousValue(row.incentive_30d ?? null, row.incentive_30d_pct_change)
		metrics.emissionsChange1d = toPercent(row.incentive_1d_pct_change)
		metrics.emissionsChange7dOver7d = toPercent(row.incentive_7d_pct_change)
		metrics.emissionsChange30dOver30d = toPercent(row.incentive_30d_pct_change)
	}

	if (requested.has('revenue')) {
		const revenueAnnualized1y = row.app_revenue_annualised ?? null
		metrics.revenue24h = row.app_revenue_1d ?? null
		metrics.revenue_7d = row.app_revenue_7d ?? null
		metrics.revenue_30d = row.app_revenue_30d ?? null
		metrics.revenue_90d = row.app_revenue_90d ?? null
		metrics.revenue_180d = row.app_revenue_180d ?? null
		metrics.revenue_1y = row.app_revenue_365d ?? null
		metrics.revenue_ytd = row.app_revenue_ytd ?? null
		metrics.revenueAnnualized1y = revenueAnnualized1y
		metrics.average_revenue_1y = revenueAnnualized1y == null ? null : revenueAnnualized1y / 12
		metrics.cumulativeRevenue = row.app_revenue_alltime ?? null
		metrics.revenueChange_1d = toPercent(row.app_revenue_1d_pct_change)
		metrics.revenueChange7dOver7d = toPercent(row.app_revenue_7d_pct_change)
		metrics.revenueChange30dOver30d = toPercent(row.app_revenue_30d_pct_change)
		metrics.revenueChange90dOver90d = toPercent(row.app_revenue_90d_pct_change)
		metrics.revenueChange180dOver180d = toPercent(row.app_revenue_180d_pct_change)
		metrics.revenueChange1yOver1y = toPercent(row.app_revenue_365d_pct_change)
		metrics.revenueChangeYtd = toPercent(row.app_revenue_ytd_pct_change)
		metrics.chainRevenue24h = row.chain_revenue_1d ?? null
		metrics.chainRevenue7d = row.chain_revenue_7d ?? null
		metrics.chainRevenue30d = row.chain_revenue_30d ?? null
		metrics.chainRevenueChange1d = toPercent(row.chain_revenue_1d_pct_change)
		metrics.chainRevenueChange7dOver7d = toPercent(row.chain_revenue_7d_pct_change)
		metrics.chainRevenueChange30dOver30d = toPercent(row.chain_revenue_30d_pct_change)
	}

	if (requested.has('perps-volume')) {
		const perpsVolume24h = row.volume_derivatives_1d ?? null
		metrics.perpsVolume24h = perpsVolume24h
		metrics.perps_volume_7d = row.volume_derivatives_7d ?? null
		metrics.perps_volume_30d = row.volume_derivatives_30d ?? null
		metrics.perps_volume_90d = row.volume_derivatives_90d ?? null
		metrics.perps_volume_1y = row.volume_derivatives_365d ?? null
		metrics.cumulativePerpsVolume = row.volume_derivatives_alltime ?? null
		metrics.perps_volume_change_1d = toPercent(row.volume_derivatives_1d_pct_change)
		metrics.perpsVolumeChange7dOver7d = toPercent(row.volume_derivatives_7d_pct_change)
		metrics.perpsVolumeChange30dOver30d = toPercent(row.volume_derivatives_30d_pct_change)
		metrics.perps_volume_dominance_24h = computeShare(perpsVolume24h, totals.volume_derivatives_1d)
	}

	if (requested.has('aggregator-volume')) {
		metrics.aggregators_volume_24h = row.volume_aggregators_1d ?? null
		metrics.aggregators_volume_7d = row.volume_aggregators_7d ?? null
		metrics.aggregators_volume_30d = row.volume_aggregators_30d ?? null
		metrics.aggregators_volume_90d = row.volume_aggregators_90d ?? null
		metrics.aggregators_volume_1y = row.volume_aggregators_365d ?? null
		metrics.cumulativeAggregatorVolume = row.volume_aggregators_alltime ?? null
		metrics.aggregators_volume_change_1d = toPercent(row.volume_aggregators_1d_pct_change)
		metrics.aggregatorVolumeChange7dOver7d = toPercent(row.volume_aggregators_7d_pct_change)
		metrics.aggregatorVolumeChange30dOver30d = toPercent(row.volume_aggregators_30d_pct_change)
		metrics.aggregators_volume_dominance_24h = computeShare(row.volume_aggregators_1d, totals.volume_aggregators_1d)
		metrics.aggregators_volume_marketShare7d = computeShare(row.volume_aggregators_7d, totals.volume_aggregators_7d)
	}

	if (requested.has('derivatives-aggregator-volume')) {
		metrics.derivatives_aggregators_volume_24h = row.volume_aggr_derivatives_1d ?? null
		metrics.derivatives_aggregators_volume_7d = row.volume_aggr_derivatives_7d ?? null
		metrics.derivatives_aggregators_volume_30d = row.volume_aggr_derivatives_30d ?? null
		metrics.derivatives_aggregators_volume_change_1d = toPercent(row.volume_aggr_derivatives_1d_pct_change)
		metrics.derivativesAggregatorVolumeChange7dOver7d = toPercent(row.volume_aggr_derivatives_7d_pct_change)
		metrics.derivativesAggregatorVolumeChange30dOver30d = toPercent(row.volume_aggr_derivatives_30d_pct_change)
	}

	if (requested.has('options-volume')) {
		metrics.options_volume_24h = row.volume_options_1d ?? null
		metrics.options_volume_7d = row.volume_options_7d ?? null
		metrics.options_volume_30d = row.volume_options_30d ?? null
		metrics.options_volume_90d = row.volume_options_90d ?? null
		metrics.options_volume_1y = row.volume_options_365d ?? null
		metrics.cumulativeOptionsVolume = row.volume_options_alltime ?? null
		metrics.optionsNotionalVolume24h = row.volume_options_notional_1d ?? null
		metrics.optionsNotionalVolume7d = row.volume_options_notional_7d ?? null
		metrics.optionsNotionalVolume30d = row.volume_options_notional_30d ?? null
		metrics.options_volume_change_1d = toPercent(row.volume_options_1d_pct_change)
		metrics.optionsVolumeChange7dOver7d = toPercent(row.volume_options_7d_pct_change)
		metrics.optionsVolumeChange30dOver30d = toPercent(row.volume_options_30d_pct_change)
		metrics.options_volume_dominance_24h = computeShare(row.volume_options_1d, totals.volume_options_1d)
	}

	if (requested.has('open-interest')) metrics.openInterest = row.open_interest ?? null
	if (requested.has('bridged-tvl')) metrics.bridgedTvl = row.bridged_tvl ?? null
	if (requested.has('stablecoins')) {
		metrics.stablesMcap = row.stables_mcap ?? null
		metrics.stablesShare = computeShare(row.stables_mcap, row.total_stables_mcap)
	}
	if (requested.has('protocol-count')) metrics.protocolCount = row.protocol_count ?? null

	return metrics
}

const fetchChainMetricsForGrouping = async (
	chainFilters: Array<string>,
	totalsPromise: Promise<ProtocolMetricTotals>,
	baseMetricFamilies: ReadonlyArray<ProtocolBaseMetricFamily>
): Promise<Record<string, ChainMetrics>> => {
	const requestedFamilies = new Set(baseMetricFamilies)
	const includeOpenInterest = requestedFamilies.has('open-interest')
	const includeBridgedTvl = requestedFamilies.has('bridged-tvl')
	const includeStablecoins = requestedFamilies.has('stablecoins')
	const conditions: Array<string> = []
	const values: Array<Array<string>> = []

	const chainIdentity = includeOpenInterest ? 'anchor.chain' : 'mc.chain'
	if (chainFilters.length > 0) {
		conditions.push(`lower(${chainIdentity}) = ANY($${values.length + 1})`)
		values.push(chainFilters)
	}

	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
	const chainSource = includeOpenInterest
		? `chain_anchor anchor
		LEFT JOIN lens.metrics_chain_current mc ON lower(mc.chain) = anchor.chain`
		: 'lens.metrics_chain_current mc'
	const openInterestJoin = includeOpenInterest ? `LEFT JOIN open_interest oi ON oi.chain = ${chainIdentity}` : ''
	const bridgedTvlJoin = includeBridgedTvl
		? `LEFT JOIN bridged_tvl ON lower(bridged_tvl.chain) = lower(${chainIdentity})`
		: ''
	const stablecoinsJoin = includeStablecoins
		? `LEFT JOIN stablecoin_supply ON lower(stablecoin_supply.chain) = lower(${chainIdentity})
		CROSS JOIN total_stablecoin_supply`
		: ''
	const ctes = [
		includeBridgedTvl
			? `bridged_tvl AS (
			SELECT chain, SUM(tvl) AS bridged_tvl
			FROM lens.bridged_token_tvl_current
			GROUP BY chain
		)`
			: null,
		includeStablecoins
			? `stablecoin_supply AS (
			SELECT chain, SUM(mcap) AS stables_mcap
			FROM lens.stablecoin_supply_current
			GROUP BY chain
		),
		total_stablecoin_supply AS (
			SELECT SUM(mcap) AS total_stables_mcap
			FROM lens.stablecoin_supply_current
		)`
			: null,
		includeOpenInterest
			? `open_interest AS (
			SELECT
				lower(chain) AS chain,
				SUM(open_interest) AS open_interest
			FROM lens.open_interest_current
			GROUP BY lower(chain)
		),
		chain_anchor AS (
			SELECT lower(chain) AS chain FROM lens.metrics_chain_current
			UNION
			SELECT chain FROM open_interest
		)`
			: null
	].filter((cte): cte is string => cte !== null)
	const withClause = ctes.length > 0 ? `WITH ${ctes.join(',\n\t\t')}` : ''
	const requestedMetricProjection = [
		...buildChainMetricProjection(baseMetricFamilies),
		includeOpenInterest ? 'oi.open_interest' : null,
		includeBridgedTvl ? 'bridged_tvl.bridged_tvl' : null,
		includeStablecoins ? 'stablecoin_supply.stables_mcap' : null,
		includeStablecoins ? 'total_stablecoin_supply.total_stables_mcap' : null
	].filter((projection): projection is string => projection !== null)
	const metricProjection =
		requestedMetricProjection.length > 0
			? requestedMetricProjection.join(',\n\t\t\t')
			: 'NULL::numeric AS no_requested_metrics'

	const [rows, totals] = await Promise.all([
		llamaDb.any<ChainMetricsRow>(
			`
		${withClause}
		SELECT
			${chainIdentity} AS chain,
			${metricProjection}
		FROM ${chainSource}
		${openInterestJoin}
		${bridgedTvlJoin}
		${stablecoinsJoin}
		${whereClause}
		`,
			values
		),
		totalsPromise
	])

	const result: Record<string, ChainMetrics> = {}
	for (const row of rows) {
		const chainSlug = toInternalSlug(row.chain)
		result[chainSlug] = {
			availability: 'available',
			metrics: mapCanonicalChainMetrics(row, totals, requestedFamilies)
		}
	}

	return result
}
