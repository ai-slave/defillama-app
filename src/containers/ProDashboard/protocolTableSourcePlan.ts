import type { SortingState } from '@tanstack/react-table'
import { COLUMN_PRESETS, DEFAULT_SORTING } from './components/ProTable/proTable.constants'
import type { ProtocolsTableConfig, TableFilters } from './types'

export const PROTOCOL_TABLE_METRIC_SOURCES = [
	'volume',
	'fees',
	'perps',
	'openInterest',
	'earnings',
	'aggregators',
	'bridgeAggregators',
	'options'
] as const

export type ProtocolTableMetricSource = (typeof PROTOCOL_TABLE_METRIC_SOURCES)[number]
export type ProtocolTableSource = 'protocols' | ProtocolTableMetricSource

interface ProtocolTableCustomColumnInput {
	id: string
	expression: string
	isValid: boolean
}

export interface ProtocolTableSourcePlanInput {
	columnOrder?: string[]
	columnVisibility?: Record<string, boolean>
	customColumns?: ProtocolTableCustomColumnInput[]
	activePresetId?: string | null
	sorting?: SortingState
	activeDatasetMetric?: string | null
	filters?: TableFilters
}

export interface ProtocolTableSourcePlan {
	sources: ProtocolTableSource[]
	enabled: Record<ProtocolTableSource, boolean>
}

const FILTER_SOURCE_BY_KEY: Readonly<Record<string, ProtocolTableMetricSource>> = {
	hasVolume: 'volume',
	hasFees: 'fees',
	hasRevenue: 'fees',
	hasHolderRevenue: 'fees',
	hasTreasuryRevenue: 'fees',
	hasPerps: 'perps',
	hasOpenInterest: 'openInterest',
	hasOptions: 'options',
	hasAggregators: 'aggregators'
}

const getColumnSource = (rawColumnId: string): ProtocolTableMetricSource | null => {
	const columnId = rawColumnId.endsWith('_share') ? rawColumnId.slice(0, -'_share'.length) : rawColumnId

	if (columnId.startsWith('bridge_aggregators_') || columnId.startsWith('bridgeAggregators')) return 'bridgeAggregators'
	if (columnId.startsWith('aggregators_') || columnId.startsWith('aggregatorsVolume')) return 'aggregators'
	if (columnId.startsWith('options_') || columnId.startsWith('optionsVolume')) return 'options'
	if (columnId.startsWith('earnings')) return 'earnings'
	if (columnId.startsWith('perps_') || columnId.startsWith('perpsVolume')) return 'perps'
	if (columnId === 'openInterest') return 'openInterest'
	if (columnId.startsWith('volume') || columnId === 'cumulativeVolume') return 'volume'
	if (
		columnId.startsWith('fees') ||
		columnId.startsWith('revenue') ||
		columnId.startsWith('holder') ||
		columnId.startsWith('treasuryRevenue') ||
		columnId.startsWith('supplySideRevenue') ||
		columnId.startsWith('userFees') ||
		columnId === 'cumulativeFees' ||
		columnId === 'average_1y' ||
		columnId === 'average_revenue_1y' ||
		columnId === 'pf' ||
		columnId === 'ps' ||
		columnId === 'pfRatio'
	) {
		return 'fees'
	}

	return null
}

const getVisibleColumnIds = (input: ProtocolTableSourcePlanInput): Set<string> => {
	const visible = new Set<string>()
	const columnOrder = input.columnOrder ?? []
	const columnVisibility = input.columnVisibility ?? {}
	const visibilityKeys = Object.keys(columnVisibility)

	if (visibilityKeys.length > 0) {
		for (const columnId of visibilityKeys) {
			if (columnVisibility[columnId]) visible.add(columnId)
		}
		for (const columnId of columnOrder) {
			if (!Object.hasOwn(columnVisibility, columnId)) visible.add(columnId)
		}
		return visible
	}

	if (columnOrder.length > 0) return new Set(columnOrder)

	const preset =
		COLUMN_PRESETS.find((candidate) => candidate.id === input.activePresetId) ??
		COLUMN_PRESETS.find((candidate) => candidate.id === 'essential')
	for (const columnId of preset?.columns ?? []) visible.add(columnId)
	return visible
}

const getInitialSorting = (input: ProtocolTableSourcePlanInput): SortingState => {
	if (input.sorting) return input.sorting
	const hasSavedColumns = (input.columnOrder?.length ?? 0) > 0 || Object.keys(input.columnVisibility ?? {}).length > 0
	if (!hasSavedColumns) {
		const preset = COLUMN_PRESETS.find((candidate) => candidate.id === input.activePresetId)
		if (preset?.sort?.length) return preset.sort
	}
	return DEFAULT_SORTING
}

const addExpressionDependencies = (expression: string, addColumn: (columnId: string) => void) => {
	for (const identifier of expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) addColumn(identifier)
}

export function resolveProtocolTableSourcePlan(input: ProtocolTableSourcePlanInput): ProtocolTableSourcePlan {
	const enabled = Object.fromEntries(
		(['protocols', ...PROTOCOL_TABLE_METRIC_SOURCES] as const).map((source) => [source, source === 'protocols'])
	) as Record<ProtocolTableSource, boolean>
	const addColumn = (columnId: string) => {
		const source = getColumnSource(columnId)
		if (source) enabled[source] = true
	}

	const visibleColumnIds = getVisibleColumnIds(input)
	for (const columnId of visibleColumnIds) addColumn(columnId)
	const sorting = getInitialSorting(input)
	for (const sort of sorting) addColumn(sort.id)
	if (input.activeDatasetMetric) addColumn(input.activeDatasetMetric)

	const requiredCustomColumnIds = new Set(visibleColumnIds)
	for (const sort of sorting) requiredCustomColumnIds.add(sort.id)
	if (input.activeDatasetMetric) requiredCustomColumnIds.add(input.activeDatasetMetric)
	for (const column of input.customColumns ?? []) {
		if (!column.isValid || !requiredCustomColumnIds.has(column.id)) continue
		addExpressionDependencies(column.expression, addColumn)
	}

	for (const [filterKey, value] of Object.entries(input.filters ?? {})) {
		if (value == null || value === false || value === '' || (Array.isArray(value) && value.length === 0)) continue
		const explicitSource = FILTER_SOURCE_BY_KEY[filterKey]
		if (explicitSource) {
			enabled[explicitSource] = true
			continue
		}
		addColumn(filterKey.replace(/(?:Min|Max)$/, ''))
	}

	return {
		sources: (Object.keys(enabled) as ProtocolTableSource[]).filter((source) => enabled[source]),
		enabled
	}
}

export const resolveProtocolTableConfigSourcePlan = (config: ProtocolsTableConfig): ProtocolTableSourcePlan =>
	resolveProtocolTableSourcePlan({
		columnOrder: config.columnOrder,
		columnVisibility: config.columnVisibility,
		customColumns: config.customColumns,
		activePresetId: config.activePresetId,
		filters: config.filters
	})
