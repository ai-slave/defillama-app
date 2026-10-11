import type { ColumnDef } from '@tanstack/react-table'
import { Parser } from 'expr-eval'
import { formatCompactNumber, formatPercent, formatRatio, formatUsd } from '~/utils/numberFormat'
import {
	isProtocolTableMetricKey,
	UNIFIED_TABLE_COLUMN_DICTIONARY
} from '../../../unifiedTable/config/columnDictionary'
import type { CustomColumnDefinition } from '../../../unifiedTable/config/types'
import type { ProtocolTableMetrics } from '../../../unifiedTable/contracts'
import type { tableFeaturesConfig } from '../core/useUnifiedTable'
import type { ProtocolTableRow } from '../types'

const parser = new Parser()

const EXPR_CACHE_MAX_SIZE = 100
const expressionCache = new Map<string, ReturnType<typeof parser.parse>>()

function getParsedExpression(expression: string): ReturnType<typeof parser.parse> | null {
	const cached = expressionCache.get(expression)
	if (cached) return cached

	try {
		const parsed = parser.parse(expression)
		if (expressionCache.size >= EXPR_CACHE_MAX_SIZE) {
			const firstKey = expressionCache.keys().next().value
			if (firstKey) expressionCache.delete(firstKey)
		}
		expressionCache.set(expression, parsed)
		return parsed
	} catch {
		return null
	}
}

const renderDash = () => <span className="text-tertiary">-</span>

const renderUsd = (value: number | null | undefined) => {
	if (value == null) return renderDash()
	return (
		<span className="text-secondary">
			{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		</span>
	)
}

const renderNumber = (value: number | null | undefined) => {
	if (value == null) return renderDash()
	return (
		<span className="text-secondary">
			{formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		</span>
	)
}

const renderPercent = (value: number | null | undefined) => {
	if (value == null) return renderDash()
	return <span className="text-secondary">{formatPercent(value, { input: 'percent' })}</span>
}

const renderRatio = (value: number | null | undefined) => {
	if (value == null) return renderDash()
	return (
		<span className="text-secondary">{`${formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}x`}</span>
	)
}

export function generateCustomColumnId(): string {
	return `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export function isCustomColumnId(id: string): boolean {
	return id.startsWith('custom_')
}

export function getOrderedCustomColumnIds(
	columnOrder: Array<string>,
	customColumns: Array<CustomColumnDefinition>
): Array<string> {
	const validCustomIds = new Set(customColumns.map((c) => c.id))
	const idsFromOrder = columnOrder.filter((id) => isCustomColumnId(id) && validCustomIds.has(id))
	const seen = new Set(idsFromOrder)

	for (const { id } of customColumns) {
		if (seen.has(id)) continue
		idsFromOrder.push(id)
		seen.add(id)
	}

	return idsFromOrder
}

export function getExpressionVariables(expression: string): Array<string> {
	const expr = getParsedExpression(expression)
	if (!expr) return []
	return expr.variables()
}

export interface CompiledCustomColumn {
	id: string
	aggregation: CustomColumnDefinition['aggregation']
	usesChainMetric: boolean
	evaluate: (metrics: ProtocolTableMetrics) => number | null
}

export function compileExpression(expression: string): {
	variables: ReadonlyArray<keyof ProtocolTableMetrics>
	evaluate: (metrics: ProtocolTableMetrics) => number | null
} {
	const expr = getParsedExpression(expression)
	if (!expr) return { variables: [], evaluate: () => null }

	const variables: Array<keyof ProtocolTableMetrics> = []
	for (const variable of expr.variables()) {
		if (!isProtocolTableMetricKey(variable)) return { variables: [], evaluate: () => null }
		variables.push(variable)
	}
	const context: Record<string, number> = {}
	for (const variable of variables) context[variable] = 0

	return {
		variables,
		evaluate: (metrics) => {
			try {
				for (const variable of variables) {
					const value = metrics[variable]
					if (value == null || Number.isNaN(value)) return null
					context[variable] = value
				}
				const result = expr.evaluate(context)
				return typeof result === 'number' && !Number.isNaN(result) && Number.isFinite(result) ? result : null
			} catch {
				return null
			}
		}
	}
}

export function compileCustomColumns(
	definitions: ReadonlyArray<CustomColumnDefinition>,
	chainMetricKeys: ReadonlySet<keyof ProtocolTableMetrics>
): Array<CompiledCustomColumn> {
	return definitions.map((definition) => {
		const expression = compileExpression(definition.expression)
		return {
			id: definition.id,
			aggregation: definition.aggregation,
			usesChainMetric: expression.variables.some((variable) => chainMetricKeys.has(variable)),
			evaluate: expression.evaluate
		}
	})
}

export function validateExpression(expression: string): { isValid: boolean; error?: string } {
	if (!expression || !expression.trim()) {
		return { isValid: false, error: 'Expression cannot be empty' }
	}

	const expr = getParsedExpression(expression)
	if (!expr) {
		return { isValid: false, error: 'Invalid expression syntax' }
	}

	try {
		const usedVars = expr.variables()
		const availableVars = getAvailableVariables()
		const availableKeys = new Set(availableVars.map((v) => v.key))

		const unknownVars = usedVars.filter((v) => !availableKeys.has(v))
		if (unknownVars.length > 0) {
			return {
				isValid: false,
				error: `Unknown variable${unknownVars.length > 1 ? 's' : ''}: ${unknownVars.join(', ')}`
			}
		}

		const testContext: Record<string, number> = {}
		for (const v of availableVars) {
			testContext[v.key] = 100
		}
		expr.evaluate(testContext)
		return { isValid: true }
	} catch {
		// Variables are checked above, so a throw here is the evaluator's or the engine's own text ("x is not a
		// function"), not something the person typing the expression can act on.
		return { isValid: false, error: 'Invalid expression' }
	}
}

export function validateCustomColumnOnLoad(def: CustomColumnDefinition): { isValid: boolean; error?: string } {
	if (!def.expression) {
		return { isValid: false, error: 'Missing expression' }
	}
	return validateExpression(def.expression)
}

interface AvailableVariable {
	key: string
	name: string
	group: string
	format: CustomColumnDefinition['format']
}

let ALL_VARIABLES_CACHE: Array<AvailableVariable> | null = null

function getAllVariables(): Array<AvailableVariable> {
	if (ALL_VARIABLES_CACHE) return ALL_VARIABLES_CACHE

	const variables: Array<AvailableVariable> = []
	for (const col of UNIFIED_TABLE_COLUMN_DICTIONARY) {
		if (!isProtocolTableMetricKey(col.id)) continue
		variables.push({
			key: col.id,
			name: col.header,
			group: col.group,
			format:
				col.render === 'usd' || col.render === 'percent' || col.render === 'ratio' || col.render === 'number'
					? col.render
					: 'number'
		})
	}
	ALL_VARIABLES_CACHE = variables
	return ALL_VARIABLES_CACHE
}

interface GetAvailableVariablesOptions {
	groups?: Array<string>
	keys?: Array<string>
}

export function getAvailableVariables(options?: GetAvailableVariablesOptions): Array<AvailableVariable> {
	const all = getAllVariables()
	if (!options) return all

	const { groups, keys } = options
	const groupSet = groups ? new Set(groups) : null
	const keySet = keys ? new Set(keys) : null

	return all.filter((v) => {
		if (groupSet && !groupSet.has(v.group)) return false
		if (keySet && !keySet.has(v.key)) return false
		return true
	})
}

export const SAMPLE_METRICS: ProtocolTableMetrics = {
	tvl: 1_500_000_000,
	change1d: 1.35,
	change7d: 7.14,
	change1m: 25.0,
	bridgedTvl: 800_000_000,
	stablesMcap: 500_000_000,
	tvlShare: 12.5,
	stablesShare: 8.2,

	volume24h: 50_000_000,
	volume_7d: 350_000_000,
	volume_30d: 1_500_000_000,
	cumulativeVolume: 50_000_000_000,
	volumeChange_1d: 5.2,
	volume24hChange7dAgo: 18.4,
	volume24hChange30dAgo: -4.1,
	volumeChange7dOver7d: 12.8,
	volumeChange30dOver30d: -3.5,
	volumeDominance_24h: 8.5,
	volumeMarketShare7d: 7.2,
	volume24hShare: 15.3,

	fees24h: 250_000,
	fees_7d: 1_750_000,
	fees_30d: 7_500_000,
	fees_1y: 90_000_000,
	average_1y: 7_500_000,
	cumulativeFees: 500_000_000,
	holderRevenue_24h: 50_000,
	holderRevenue_7d: 350_000,
	holdersRevenue30d: 1_500_000,
	feesChange_1d: 3.2,
	fees24hChange7dAgo: 9.4,
	fees24hChange30dAgo: 14.2,
	feesChange7dOver7d: 8.5,
	feesChange30dOver30d: 15.0,

	revenue24h: 150_000,
	revenue_7d: 1_050_000,
	revenue_30d: 4_500_000,
	revenue_1y: 54_000_000,
	average_revenue_1y: 4_500_000,
	cumulativeRevenue: 650_000_000,
	revenueChange_1d: 2.8,
	revenue24hChange7dAgo: 7.1,
	revenue24hChange30dAgo: 11.7,
	revenueChange7dOver7d: 6.3,
	revenueChange30dOver30d: 12.0,

	perpsVolume24h: 20_000_000,
	perps_volume_7d: 140_000_000,
	perps_volume_30d: 600_000_000,
	perps_volume_change_1d: 4.5,
	perpsVolume24hChange7dAgo: 13.5,
	perpsVolume24hChange30dAgo: -1.8,
	perpsVolumeChange7dOver7d: 10.2,
	perpsVolumeChange30dOver30d: -2.1,
	perps_volume_dominance_24h: 5.8,
	openInterest: 100_000_000,

	aggregators_volume_24h: 15_000_000,
	aggregators_volume_7d: 105_000_000,
	aggregators_volume_30d: 450_000_000,
	aggregators_volume_change_1d: 6.1,
	aggregatorVolume24hChange7dAgo: 16.8,
	aggregatorVolume24hChange30dAgo: 3.7,
	aggregatorVolumeChange7dOver7d: 14.3,
	aggregators_volume_dominance_24h: 3.2,
	aggregators_volume_marketShare7d: 2.8,

	derivatives_aggregators_volume_24h: 8_000_000,
	derivatives_aggregators_volume_7d: 56_000_000,
	derivatives_aggregators_volume_30d: 240_000_000,
	derivatives_aggregators_volume_change_1d: 7.2,
	derivativesAggregatorVolume24hChange7dAgo: 12.4,
	derivativesAggregatorVolume24hChange30dAgo: 17.3,
	derivativesAggregatorVolumeChange7dOver7d: 11.5,
	derivativesAggregatorVolumeChange30dOver30d: 18.0,

	options_volume_24h: 5_000_000,
	options_volume_7d: 35_000_000,
	options_volume_30d: 150_000_000,
	options_volume_change_1d: 8.3,
	optionsVolume24hChange7dAgo: 19.6,
	optionsVolume24hChange30dAgo: 6.4,
	optionsVolumeChange7dOver7d: 15.7,
	options_volume_dominance_24h: 2.1,

	mcap: 2_000_000_000,
	fdv: 3_000_000_000,
	mcaptvl: 1.33,
	pf: 22.0,
	ps: 36.5
}

const getRenderer = (format: CustomColumnDefinition['format']) => {
	switch (format) {
		case 'usd':
			return renderUsd
		case 'percent':
			return renderPercent
		case 'ratio':
			return renderRatio
		case 'number':
		default:
			return renderNumber
	}
}

export function createCustomColumnDef({
	definition
}: {
	definition: CustomColumnDefinition
}): ColumnDef<typeof tableFeaturesConfig, ProtocolTableRow> {
	const renderer = getRenderer(definition.format)

	return {
		id: definition.id,
		header: definition.name,
		accessorFn: (row) => row.customValues[definition.id] ?? undefined,
		meta: { align: 'end' as const },
		cell: ({ row }) => renderer(row.original.customValues[definition.id] ?? null)
	}
}

export function formatPreviewNumber(
	value: number | null | undefined,
	format: CustomColumnDefinition['format'] = 'number'
): string {
	if (value == null) return '-'

	if (format === 'percent') {
		return `${formatPercent(value, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
	}

	if (format === 'ratio') {
		return `${formatRatio(value)}x`
	}

	const fractionDigits = Math.abs(value) < 1 && value !== 0 ? 4 : 2
	const precision = {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	}
	return format === 'usd' ? formatUsd(value, { compact: true, ...precision }) : formatCompactNumber(value, precision)
}

export function getDefaultAggregation(expression: string): CustomColumnDefinition['aggregation'] {
	const vars = getExpressionVariables(expression)
	const hasRatioVars = vars.some((v) => ['mcaptvl', 'pf', 'ps'].includes(v))
	const hasDivision = expression.includes('/')

	if (hasRatioVars || hasDivision) {
		return 'recalculate'
	}
	return 'sum'
}
