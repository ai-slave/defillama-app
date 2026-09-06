import type { CustomTimePeriod, TimePeriod } from './dashboardTypes'
import type { ChartBuilderConfig, DashboardGrouping } from './types'

export interface ChartBuilderCsvRequest {
	config: ChartBuilderConfig['config']
	grouping: DashboardGrouping
	timePeriod: TimePeriod
	customTimePeriod: CustomTimePeriod | null
	filename: string
}

function requireObject(value: unknown, name: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`${name} must be an object`)
	}
	return value as Record<string, unknown>
}

function requireString(value: unknown, name: string, maxLength = 200): string {
	if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
		throw new Error(`${name} must be a non-empty string of at most ${maxLength} characters`)
	}
	return value
}

function optionalString(value: unknown, name: string): string | undefined {
	if (value === undefined) return undefined
	return requireString(value, name)
}

function stringList(value: unknown, name: string, maxItems: number): Array<string> {
	if (!Array.isArray(value) || value.length > maxItems) {
		throw new Error(`${name} must be an array of at most ${maxItems} strings`)
	}
	const result = new Array<string>(value.length)
	for (let index = 0; index < value.length; index++) {
		result[index] = requireString(value[index], `${name}[${index}]`)
	}
	return result
}

function optionalStringList(value: unknown, name: string, maxItems: number): Array<string> | undefined {
	if (value === undefined) return undefined
	return stringList(value, name, maxItems)
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
	if (value === undefined) return undefined
	if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`)
	return value
}

function filterMode(value: unknown, name: string): 'include' | 'exclude' {
	if (value === 'include' || value === 'exclude') return value
	throw new Error(`${name} must be include or exclude`)
}

function metric(value: unknown): ChartBuilderConfig['config']['metric'] {
	switch (value) {
		case 'fees':
		case 'revenue':
		case 'volume':
		case 'perps':
		case 'open-interest':
		case 'options-notional':
		case 'options-premium':
		case 'bridge-aggregators':
		case 'dex-aggregators':
		case 'perps-aggregators':
		case 'user-fees':
		case 'holders-revenue':
		case 'protocol-revenue':
		case 'supply-side-revenue':
		case 'tvl':
		case 'stablecoins':
		case 'chain-fees':
		case 'chain-revenue':
			return value
		default:
			throw new Error('Unsupported Chart Builder metric')
	}
}

function chartType(value: unknown): ChartBuilderConfig['config']['chartType'] {
	if (value === 'stackedBar' || value === 'stackedArea' || value === 'line' || value === 'treemap') return value
	throw new Error('Unsupported Chart Builder chart type')
}

function optionalTreemapValue(value: unknown): ChartBuilderConfig['config']['treemapValue'] {
	switch (value) {
		case undefined:
		case 'latest':
		case 'sum7d':
		case 'sum30d':
			return value
		default:
			throw new Error('Unsupported treemap value')
	}
}

function grouping(value: unknown): DashboardGrouping {
	if (value === 'day' || value === 'week' || value === 'month' || value === 'quarter' || value === 'year') {
		return value
	}
	throw new Error('Unsupported Chart Builder grouping')
}

function timePeriod(value: unknown): TimePeriod {
	if (
		value === '30d' ||
		value === '90d' ||
		value === '365d' ||
		value === 'ytd' ||
		value === '3y' ||
		value === 'all' ||
		value === 'custom'
	) {
		return value
	}
	throw new Error('Unsupported dashboard time period')
}

function customTimePeriod(value: unknown): CustomTimePeriod | null {
	if (value === null || value === undefined) return null
	const input = requireObject(value, 'customTimePeriod')
	if (input.type === 'relative') {
		if (typeof input.relativeDays !== 'number' || !Number.isFinite(input.relativeDays) || input.relativeDays <= 0) {
			throw new Error('customTimePeriod.relativeDays must be a positive number')
		}
		return { type: 'relative', relativeDays: input.relativeDays }
	}
	if (input.type === 'absolute') {
		if (
			typeof input.startDate !== 'number' ||
			!Number.isFinite(input.startDate) ||
			typeof input.endDate !== 'number' ||
			!Number.isFinite(input.endDate) ||
			input.endDate < input.startDate
		) {
			throw new Error('customTimePeriod requires a valid startDate and endDate')
		}
		return { type: 'absolute', startDate: input.startDate, endDate: input.endDate }
	}
	throw new Error('Unsupported custom time period')
}

function parseConfig(value: unknown): ChartBuilderConfig['config'] {
	const input = requireObject(value, 'config')
	const mode = input.mode
	if (mode !== 'chains' && mode !== 'protocol') throw new Error('Unsupported Chart Builder mode')
	const parsedMetric = metric(input.metric)
	const displayAs = input.displayAs
	if (displayAs !== 'timeSeries' && displayAs !== 'percentage') {
		throw new Error('Unsupported Chart Builder display mode')
	}
	const treemapValue = optionalTreemapValue(input.treemapValue)
	if (typeof input.limit !== 'number' || !Number.isInteger(input.limit) || input.limit < 0 || input.limit > 20) {
		throw new Error('config.limit must be an integer between 0 and 20')
	}

	const protocol = optionalString(input.protocol, 'config.protocol')
	const chainOnlyMetric =
		parsedMetric === 'stablecoins' || parsedMetric === 'chain-fees' || parsedMetric === 'chain-revenue'
	if (chainOnlyMetric && mode !== 'protocol') {
		throw new Error(`${parsedMetric} can only be grouped by chain`)
	}
	if (chainOnlyMetric && protocol && protocol.toLowerCase() !== 'all') {
		throw new Error(`${parsedMetric} does not support a protocol selection`)
	}
	const chainCategories = optionalStringList(input.chainCategories, 'config.chainCategories', 25)
	const protocolCategories = optionalStringList(input.protocolCategories, 'config.protocolCategories', 25)
	const hideOthers = optionalBoolean(input.hideOthers, 'config.hideOthers')
	const groupByParent = optionalBoolean(input.groupByParent, 'config.groupByParent')
	const config: ChartBuilderConfig['config'] = {
		metric: parsedMetric,
		mode,
		chainFilterMode: filterMode(input.chainFilterMode, 'config.chainFilterMode'),
		categoryFilterMode: filterMode(input.categoryFilterMode, 'config.categoryFilterMode'),
		chainCategoryFilterMode: filterMode(input.chainCategoryFilterMode, 'config.chainCategoryFilterMode'),
		protocolCategoryFilterMode: filterMode(input.protocolCategoryFilterMode, 'config.protocolCategoryFilterMode'),
		chains: stringList(input.chains, 'config.chains', 50),
		categories: stringList(input.categories, 'config.categories', 25),
		groupBy: 'protocol',
		limit: input.limit,
		chartType: chartType(input.chartType),
		displayAs
	}
	if (protocol !== undefined) config.protocol = protocol
	if (chainCategories !== undefined) config.chainCategories = chainCategories
	if (protocolCategories !== undefined) config.protocolCategories = protocolCategories
	if (treemapValue !== undefined) config.treemapValue = treemapValue
	if (hideOthers !== undefined) config.hideOthers = hideOthers
	if (groupByParent !== undefined) config.groupByParent = groupByParent
	return config
}

export function parseChartBuilderCsvRequest(value: unknown): ChartBuilderCsvRequest {
	const input = requireObject(value, 'request')
	return {
		config: parseConfig(input.config),
		grouping: grouping(input.grouping),
		timePeriod: timePeriod(input.timePeriod),
		customTimePeriod: customTimePeriod(input.customTimePeriod),
		filename: requireString(input.filename, 'filename', 240)
	}
}
