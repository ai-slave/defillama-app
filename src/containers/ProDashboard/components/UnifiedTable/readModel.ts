import { toInternalSlug } from '~/utils/chainNormalizer'
import { FILTERED_SHARE_METRIC_KEYS, type FilteredShareMetricKey } from '../../unifiedTable/config/filteredShareColumns'
import type { CustomColumnDefinition, UnifiedRowHeaderType } from '../../unifiedTable/config/types'
import {
	EMPTY_CANONICAL_CHAIN_METRICS,
	type ChainMetrics,
	type ParentProtocolMetrics,
	type ProtocolTableMetrics,
	type ProtocolTableSourceRow
} from '../../unifiedTable/contracts'
import type {
	ProtocolTableFilteredShares,
	ProtocolTableGroupRow,
	ProtocolTableLeafRow,
	ProtocolTableRow
} from './types'
import { aggregateMetrics, FULL_PROTOCOL_AGGREGATION_PLAN, type ProtocolAggregationPlan } from './utils/aggregation'
import { compileCustomColumns, type CompiledCustomColumn } from './utils/customColumns'

const UNKNOWN_LABELS: Record<UnifiedRowHeaderType, string> = {
	protocol: 'Unknown Protocol',
	'parent-protocol': 'Independent',
	chain: 'All Chains',
	category: 'Other'
}

const CHAIN_METRIC_KEYS = new Set<keyof ProtocolTableMetrics>([
	'stablesMcap',
	'bridgedTvl',
	'tvlShare',
	'stablesShare',
	'volume24hShare'
])
const EMPTY_FILTERED_SHARES: ProtocolTableFilteredShares = Object.freeze({})

interface GroupIdentity {
	key: string
	label: string
	groupKind: ProtocolTableGroupRow['groupKind']
	iconUrl: string | null
	isSelfGroup: boolean
}

interface ReadModelSources {
	parentMetrics: Readonly<Record<string, ParentProtocolMetrics>>
	chainMetrics: Readonly<Record<string, ChainMetrics>>
	chainMetricScope: 'canonical' | 'group' | 'partial'
	aggregationPlan: ProtocolAggregationPlan
}

interface CustomAggregationState {
	firstRowId: string
	firstValues: Readonly<Record<string, number | null>>
	sumValues: Readonly<Partial<Record<string, number | null>>>
}

type NonEmptyRows = [ProtocolTableSourceRow, ...Array<ProtocolTableSourceRow>]
type CustomAggregationStore = Map<ProtocolTableRow, CustomAggregationState>

export interface BuildProtocolTableReadModelOptions extends Pick<ReadModelSources, 'parentMetrics' | 'chainMetrics'> {
	rows: Array<ProtocolTableSourceRow>
	rowHeaders: Array<UnifiedRowHeaderType>
	customColumns: ReadonlyArray<CustomColumnDefinition>
	chainMetricScope?: ReadModelSources['chainMetricScope']
	aggregationPlan?: ProtocolAggregationPlan
}

export interface ProtocolTableReadModel {
	rows: Array<ProtocolTableRow>
	leaves: Array<ProtocolTableLeafRow>
}

function rowMatchesSearch(
	row: ProtocolTableSourceRow,
	term: string,
	parentMetrics: Readonly<Record<string, ParentProtocolMetrics>>
): boolean {
	if (row.name.toLowerCase().includes(term) || row.displayName.toLowerCase().includes(term)) return true
	if (row.category?.toLowerCase().includes(term)) return true
	for (const chain of row.chains) if (chain.toLowerCase().includes(term)) return true
	for (const oracle of row.oracles) if (oracle.toLowerCase().includes(term)) return true
	if (row.parentProtocolName?.toLowerCase().includes(term)) return true
	if (row.parentProtocolId) {
		for (const oracle of parentMetrics[row.parentProtocolId]?.oracles ?? []) {
			if (oracle.toLowerCase().includes(term)) return true
		}
	}
	return false
}

export function filterProtocolTableSourceRows(
	rows: Array<ProtocolTableSourceRow>,
	searchTerm: string,
	parentMetrics: Readonly<Record<string, ParentProtocolMetrics>>
): Array<ProtocolTableSourceRow> {
	const term = searchTerm.trim().toLowerCase()
	if (!term) return rows
	return rows.filter((row) => rowMatchesSearch(row, term, parentMetrics))
}

const keyFromValue = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

function getGroupIdentity(row: ProtocolTableSourceRow, header: UnifiedRowHeaderType): GroupIdentity {
	if (header === 'parent-protocol') {
		if (row.parentProtocolId) {
			return {
				key: `parent:${row.parentProtocolId}`,
				label: row.parentProtocolName ?? UNKNOWN_LABELS['parent-protocol'],
				groupKind: 'parent',
				iconUrl: row.parentProtocolLogo,
				isSelfGroup: false
			}
		}
		return {
			key: `parent:self-${row.protocolId}`,
			label: row.displayName,
			groupKind: 'protocol',
			iconUrl: row.logo,
			isSelfGroup: true
		}
	}

	if (header === 'protocol') {
		return {
			key: `protocol:${row.protocolId}`,
			label: row.displayName,
			groupKind: 'protocol',
			iconUrl: row.logo,
			isSelfGroup: false
		}
	}

	if (header === 'chain') {
		const label = row.chain ?? UNKNOWN_LABELS.chain
		return {
			key: `chain:${keyFromValue(label) || 'all'}`,
			label,
			groupKind: 'chain',
			iconUrl: null,
			isSelfGroup: false
		}
	}

	const label = row.category ?? UNKNOWN_LABELS.category
	return {
		key: `category:${keyFromValue(label) || 'other'}`,
		label,
		groupKind: 'category',
		iconUrl: null,
		isSelfGroup: false
	}
}

function collectMetadata(rows: ReadonlyArray<ProtocolTableSourceRow>): {
	category: string | null
	chains: Array<string>
	oracles: Array<string>
} {
	const chains = new Set<string>()
	const oracles = new Set<string>()
	let category = rows[0]?.category ?? null

	for (const row of rows) {
		if (row.category !== category) category = null
		for (const chain of row.chains) chains.add(chain)
		for (const oracle of row.oracles) oracles.add(oracle)
	}

	return {
		category,
		chains: Array.from(chains).sort((a, b) => a.localeCompare(b)),
		oracles: Array.from(oracles).sort((a, b) => a.localeCompare(b))
	}
}

function mergeCanonicalChainMetrics(
	metrics: ProtocolTableMetrics,
	source: ChainMetrics,
	plan: ProtocolAggregationPlan
): ProtocolTableMetrics {
	const merged = { ...metrics }
	Object.assign(merged, source.availability === 'available' ? source.metrics : EMPTY_CANONICAL_CHAIN_METRICS)
	if (plan.includeMcapTvl) {
		merged.mcaptvl = merged.mcap != null && merged.tvl != null && merged.tvl > 0 ? merged.mcap / merged.tvl : null
	} else Reflect.deleteProperty(merged, 'mcaptvl')
	if (plan.includePf) {
		merged.pf =
			merged.mcap != null && merged.feesAnnualized1y != null && merged.feesAnnualized1y !== 0
				? merged.mcap / merged.feesAnnualized1y
				: null
	} else Reflect.deleteProperty(merged, 'pf')
	if (plan.includePs) {
		merged.ps =
			merged.mcap != null && merged.revenueAnnualized1y != null && merged.revenueAnnualized1y !== 0
				? merged.mcap / merged.revenueAnnualized1y
				: null
	} else Reflect.deleteProperty(merged, 'ps')
	return merged
}

function buildLeafCustomValues(
	row: ProtocolTableSourceRow,
	columns: ReadonlyArray<CompiledCustomColumn>
): { customValues: Record<string, number | null>; customAggregation: CustomAggregationState } {
	const evaluatedValues: Record<string, number | null> = {}
	const sumValues: Partial<Record<string, number | null>> = {}
	let hasChainMetric = false
	for (const column of columns) {
		const value = column.evaluate(row.metrics)
		evaluatedValues[column.id] = value
		if (column.aggregation === 'sum') sumValues[column.id] = value
		if (column.usesChainMetric) hasChainMetric = true
	}

	const customValues = hasChainMetric ? { ...evaluatedValues } : evaluatedValues
	if (hasChainMetric) {
		for (const column of columns) if (column.usesChainMetric) customValues[column.id] = null
	}

	return {
		customValues,
		customAggregation: {
			firstRowId: row.id,
			firstValues: evaluatedValues,
			sumValues
		}
	}
}

function mergeCustomAggregation(
	children: ReadonlyArray<ProtocolTableRow>,
	store: CustomAggregationStore,
	columns: ReadonlyArray<CompiledCustomColumn>
): CustomAggregationState {
	const sumValues: Record<string, number | null> = {}
	for (const column of columns) if (column.aggregation === 'sum') sumValues[column.id] = null

	let first: CustomAggregationState | null = null
	for (const child of children) {
		const aggregation = store.get(child)
		if (!aggregation) throw new Error(`Missing custom aggregation for ${child.id}`)
		if (!first || aggregation.firstRowId < first.firstRowId) first = aggregation
		for (const column of columns) {
			if (column.aggregation !== 'sum') continue
			const value = aggregation.sumValues[column.id]
			if (value == null) continue
			sumValues[column.id] = (sumValues[column.id] ?? 0) + value
		}
	}
	if (!first) throw new Error('Cannot aggregate custom columns without child rows')

	return { firstRowId: first.firstRowId, firstValues: first.firstValues, sumValues }
}

function buildGroupCustomValues({
	columns,
	metrics,
	header,
	aggregation
}: {
	columns: ReadonlyArray<CompiledCustomColumn>
	metrics: ProtocolTableMetrics
	header: UnifiedRowHeaderType
	aggregation: CustomAggregationState
}): Record<string, number | null> {
	const values: Record<string, number | null> = {}
	for (const column of columns) {
		if (column.usesChainMetric && header !== 'chain') values[column.id] = null
		else if (column.aggregation === 'recalculate') values[column.id] = column.evaluate(metrics)
		else if (column.aggregation === 'none') values[column.id] = null
		else if (column.aggregation === 'first') values[column.id] = aggregation.firstValues[column.id] ?? null
		else values[column.id] = aggregation.sumValues[column.id] ?? null
	}
	return values
}

function buildLeaf(
	row: ProtocolTableSourceRow,
	customColumns: ReadonlyArray<CompiledCustomColumn>,
	customAggregations: CustomAggregationStore | null
): ProtocolTableLeafRow {
	const custom = customAggregations ? { ...buildLeafCustomValues(row, customColumns), store: customAggregations } : null
	const leaf: ProtocolTableLeafRow = {
		...row,
		nodeType: 'leaf',
		filteredShares: EMPTY_FILTERED_SHARES,
		customValues: custom?.customValues ?? {}
	}
	if (custom) custom.store.set(leaf, custom.customAggregation)
	return leaf
}

function buildGroup({
	identity,
	header,
	rows,
	children,
	path,
	sources,
	customColumns,
	customAggregations
}: {
	identity: GroupIdentity
	header: UnifiedRowHeaderType
	rows: NonEmptyRows
	children: Array<ProtocolTableRow>
	path: string
	sources: ReadModelSources
	customColumns: ReadonlyArray<CompiledCustomColumn>
	customAggregations: CustomAggregationStore | null
}): ProtocolTableGroupRow {
	const metadata = collectMetadata(rows)
	let metrics = aggregateMetrics(rows, {
		excludeParentTvl: header === 'parent-protocol',
		marketValueScope: header === 'protocol' ? 'protocol' : 'economic-entity',
		parentMetrics: sources.parentMetrics,
		aggregationPlan: sources.aggregationPlan
	})

	if (header === 'chain') {
		switch (sources.chainMetricScope) {
			case 'canonical': {
				const canonical = sources.chainMetrics[toInternalSlug(identity.label)]
				if (!canonical) throw new Error(`Missing canonical metrics for grouped chain ${identity.label}`)
				metrics = mergeCanonicalChainMetrics(metrics, canonical, sources.aggregationPlan)
				break
			}
			case 'partial':
				metrics = mergeCanonicalChainMetrics(metrics, { availability: 'unavailable' }, sources.aggregationPlan)
				break
			case 'group':
				break
		}
	}

	const directParentOracles =
		header === 'parent-protocol' && identity.groupKind === 'parent'
			? sources.parentMetrics[rows[0].parentProtocolId ?? '']?.oracles
			: undefined
	const oracles = directParentOracles
		? Array.from(new Set([...metadata.oracles, ...directParentOracles])).sort((a, b) => a.localeCompare(b))
		: metadata.oracles

	const custom = customAggregations
		? {
				aggregation: mergeCustomAggregation(children, customAggregations, customColumns),
				store: customAggregations
			}
		: null
	const group: ProtocolTableGroupRow = {
		nodeType: 'group',
		id: `group:${path}:${identity.key}`,
		header,
		groupKind: identity.groupKind,
		isSelfGroup: identity.isSelfGroup,
		name: identity.label,
		displayName: identity.label,
		logo: identity.iconUrl,
		category: metadata.category,
		chains: metadata.chains,
		oracles,
		metrics,
		filteredShares: EMPTY_FILTERED_SHARES,
		customValues: custom
			? buildGroupCustomValues({ columns: customColumns, metrics, header, aggregation: custom.aggregation })
			: {},
		subRows: children
	}
	if (custom) custom.store.set(group, custom.aggregation)
	return group
}

function buildLevel({
	rows,
	rowHeaders,
	depth,
	path,
	sources,
	customColumns,
	customAggregations,
	leaves
}: {
	rows: Array<ProtocolTableSourceRow>
	rowHeaders: Array<UnifiedRowHeaderType>
	depth: number
	path: string
	sources: ReadModelSources
	customColumns: ReadonlyArray<CompiledCustomColumn>
	customAggregations: CustomAggregationStore | null
	leaves: Array<ProtocolTableLeafRow>
}): Array<ProtocolTableRow> {
	const header = rowHeaders[depth]
	if (!header) {
		const result: Array<ProtocolTableLeafRow> = []
		for (const row of rows) {
			const leaf = buildLeaf(row, customColumns, customAggregations)
			leaves.push(leaf)
			result.push(leaf)
		}
		return result
	}

	const groups = new Map<string, { identity: GroupIdentity; rows: NonEmptyRows }>()
	for (const row of rows) {
		const identity = getGroupIdentity(row, header)
		const group = groups.get(identity.key)
		if (group) group.rows.push(row)
		else groups.set(identity.key, { identity, rows: [row] })
	}

	const result: Array<ProtocolTableRow> = []
	for (const group of groups.values()) {
		const groupPath = `${path}/${group.identity.key}`
		const children = buildLevel({
			rows: group.rows,
			rowHeaders,
			depth: depth + 1,
			path: groupPath,
			sources,
			customColumns,
			customAggregations,
			leaves
		})
		const onlyChild = children[0]
		const isRedundantProtocolGroup =
			header === 'protocol' && group.rows.length === 1 && children.length === 1 && onlyChild?.nodeType === 'leaf'
		if (
			isRedundantProtocolGroup ||
			(header === 'parent-protocol' && group.identity.isSelfGroup && children.length === 1 && onlyChild)
		) {
			result.push(onlyChild)
			continue
		}
		result.push(
			buildGroup({
				identity: group.identity,
				header,
				rows: group.rows,
				children,
				path,
				sources,
				customColumns,
				customAggregations
			})
		)
	}
	return result
}

export function setProtocolTableFilteredShares(
	rows: Array<ProtocolTableRow>,
	metricKeys: ReadonlyArray<FilteredShareMetricKey> = FILTERED_SHARE_METRIC_KEYS
): void {
	if (metricKeys.length === 0) return

	const totals: Partial<Record<FilteredShareMetricKey, number>> = {}
	for (const row of rows) {
		for (const key of metricKeys) {
			const value = row.metrics[key]
			if (value != null && value > 0) totals[key] = (totals[key] ?? 0) + value
		}
	}

	const visit = (row: ProtocolTableRow) => {
		const shares: ProtocolTableFilteredShares = {}
		for (const key of metricKeys) {
			const value = row.metrics[key]
			const total = totals[key]
			shares[key] = value != null && value > 0 && total != null && total > 0 ? (value / total) * 100 : null
		}
		row.filteredShares = shares
		if (row.nodeType === 'group') {
			for (const child of row.subRows) visit(child)
		}
	}

	for (const row of rows) visit(row)
}

export function collectProtocolTableLeaves(rows: Array<ProtocolTableRow>): Array<ProtocolTableLeafRow> {
	const leaves: Array<ProtocolTableLeafRow> = []
	const visit = (row: ProtocolTableRow): void => {
		if (row.nodeType === 'leaf') leaves.push(row)
		else for (const child of row.subRows) visit(child)
	}
	for (const row of rows) visit(row)
	return leaves
}

export function buildProtocolTableReadModel({
	rows,
	rowHeaders,
	parentMetrics,
	chainMetrics,
	customColumns,
	chainMetricScope,
	aggregationPlan = FULL_PROTOCOL_AGGREGATION_PLAN
}: BuildProtocolTableReadModelOptions): ProtocolTableReadModel {
	const leaves: Array<ProtocolTableLeafRow> = []
	const compiledCustomColumns = compileCustomColumns(customColumns, CHAIN_METRIC_KEYS)
	const customAggregations: CustomAggregationStore | null = compiledCustomColumns.length > 0 ? new Map() : null
	const readRows = buildLevel({
		rows,
		rowHeaders,
		depth: 0,
		path: 'root',
		sources: {
			parentMetrics,
			chainMetrics,
			chainMetricScope: chainMetricScope ?? (rowHeaders[0] === 'chain' ? 'canonical' : 'group'),
			aggregationPlan
		},
		customColumns: compiledCustomColumns,
		customAggregations,
		leaves
	})
	return { rows: readRows, leaves }
}
