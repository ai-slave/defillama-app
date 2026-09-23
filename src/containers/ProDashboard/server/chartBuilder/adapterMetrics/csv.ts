import type { Writable } from 'node:stream'
import type { ChartBuilderCsvRequest } from '~/containers/ProDashboard/chartBuilderCsvContract'
import { getTimePeriodBounds } from '~/containers/ProDashboard/timePeriod'
import { normalizeCacheList } from '~/server/api/cacheKey'
import { toSlug } from '~/utils/breakdowns'
import { serializeCsvRow } from '~/utils/csv'
import { getCsvPeriodCells, getCsvPeriodHeaders, getGroupedTimestampSec } from '../../../utils'
import { disambiguateCsvLabels, percentageValues, writeCsvChunk } from '../csvStream'
import { normalizeLegacyChartBuilderChains } from '../filters'
import { parseAdapterChartBuilderMetric } from './breakdowns/config'
import {
	getAdapterMetricProtocolBase,
	getProtocolLookup,
	type ProtocolBreakdownBase,
	type ProtocolLookup
} from './breakdowns/protocolSeries'

type AdapterCsvEntity = { key: string; label: string }

function timestampInScope(timestamp: number, bounds: { start: number; end: number } | null): boolean {
	return bounds === null || (timestamp >= bounds.start && timestamp <= bounds.end)
}

function categoryForProtocol(name: string, lookup: ProtocolLookup): string {
	return lookup.protocolCategories.get(name) ?? lookup.protocolCategoriesBySlug.get(toSlug(name)) ?? ''
}

function protocolMatchesCategory(
	name: string,
	categories: Set<string>,
	mode: 'include' | 'exclude',
	lookup: ProtocolLookup
): boolean {
	if (categories.size === 0) return true
	const category = categoryForProtocol(name, lookup)
	return mode === 'include' ? categories.has(category) : !categories.has(category)
}

function entityForProtocol(name: string, groupByParent: boolean, lookup: ProtocolLookup): AdapterCsvEntity {
	if (!groupByParent) return { key: `protocol:${name}`, label: name }
	const parentId = lookup.protocolToParentId.get(name)
	if (!parentId) return { key: `protocol:${name}`, label: name }
	return { key: `parent:${parentId}`, label: lookup.parentIdToName.get(parentId) ?? name }
}

export function buildAdapterCsvEntities(
	base: ProtocolBreakdownBase,
	request: ChartBuilderCsvRequest,
	lookup: ProtocolLookup
): Array<AdapterCsvEntity> {
	const categories = new Set(normalizeCacheList(request.config.categories, { lowercase: true }))
	const bounds = getTimePeriodBounds(request.timePeriod, request.customTimePeriod)
	const byKey = new Map<string, AdapterCsvEntity>()
	for (const [timestamp, protocols] of base.totalDataChartBreakdown) {
		if (!timestampInScope(timestamp, bounds)) continue
		for (const name in protocols) {
			if (!protocolMatchesCategory(name, categories, request.config.categoryFilterMode, lookup)) continue
			const entity = entityForProtocol(name, request.config.groupByParent === true, lookup)
			byKey.set(entity.key, entity)
		}
	}
	const entities = Array.from(byKey.values()).sort(
		(left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key)
	)
	return disambiguateCsvLabels(entities)
}

export async function writeAdapterMetricProtocolCsv(
	request: ChartBuilderCsvRequest,
	base: ProtocolBreakdownBase,
	lookup: ProtocolLookup,
	output: Writable
): Promise<number> {
	const entities = buildAdapterCsvEntities(base, request, lookup)
	if (entities.length === 0) return 0
	return request.config.chartType === 'treemap'
		? writeTreemap(request, base, lookup, entities, output)
		: writeTimeSeries(request, base, lookup, entities, output)
}

function addDayValues(
	values: Array<number>,
	protocols: Record<string, number>,
	entityIndex: Map<string, number>,
	categories: Set<string>,
	request: ChartBuilderCsvRequest,
	lookup: ProtocolLookup
) {
	for (const name in protocols) {
		if (!protocolMatchesCategory(name, categories, request.config.categoryFilterMode, lookup)) continue
		const index = entityIndex.get(entityForProtocol(name, request.config.groupByParent === true, lookup).key)
		if (index === undefined) continue
		const value = protocols[name]
		if (value === undefined) throw new Error(`Missing adapter protocol value for ${name}`)
		values[index] += value
	}
}

async function writeTreemap(
	request: ChartBuilderCsvRequest,
	base: ProtocolBreakdownBase,
	lookup: ProtocolLookup,
	entities: Array<AdapterCsvEntity>,
	output: Writable
): Promise<number> {
	const bounds = getTimePeriodBounds(request.timePeriod, request.customTimePeriod)
	const completedBefore = Math.floor(Date.now() / 86_400_000) * 86_400
	let anchor = -1
	for (const [timestamp] of base.totalDataChartBreakdown) {
		if (timestamp < completedBefore && timestampInScope(timestamp, bounds)) anchor = timestamp
	}
	if (anchor < 0) return 0
	const mode = request.config.metric === 'open-interest' ? 'latest' : (request.config.treemapValue ?? 'latest')
	const windowStart = mode === 'sum7d' ? anchor - 7 * 86_400 + 1 : mode === 'sum30d' ? anchor - 30 * 86_400 + 1 : anchor
	const categories = new Set(normalizeCacheList(request.config.categories, { lowercase: true }))
	const entityIndex = new Map(entities.map((entity, index) => [entity.key, index]))
	const values = new Array<number>(entities.length).fill(0)
	for (const [timestamp, protocols] of base.totalDataChartBreakdown) {
		if (timestamp < windowStart || timestamp > anchor) continue
		if (mode === 'latest' && timestamp !== anchor) continue
		addDayValues(values, protocols, entityIndex, categories, request, lookup)
	}
	const label = mode === 'latest' ? 'Last day (1d)' : mode === 'sum7d' ? 'Sum 7d' : 'Sum 30d'
	await writeCsvChunk(output, `${serializeCsvRow(['Name', label])}\n`)
	let rows = 0
	for (let index = 0; index < entities.length; index++) {
		const entity = entities[index]
		const value = values[index]
		if (!entity || value === undefined || value <= 0) continue
		await writeCsvChunk(output, `${serializeCsvRow([entity.label, value])}\n`)
		rows++
	}
	return rows
}

async function writeTimeSeries(
	request: ChartBuilderCsvRequest,
	base: ProtocolBreakdownBase,
	lookup: ProtocolLookup,
	entities: Array<AdapterCsvEntity>,
	output: Writable
): Promise<number> {
	const categories = new Set(normalizeCacheList(request.config.categories, { lowercase: true }))
	const bounds = getTimePeriodBounds(request.timePeriod, request.customTimePeriod)
	const entityIndex = new Map(entities.map((entity, index) => [entity.key, index]))
	const useLastValue = request.config.metric === 'open-interest'
	let groupTimestamp = -1
	let groupValues = new Array<number>(entities.length).fill(0)
	let rows = 0
	await writeCsvChunk(
		output,
		`${serializeCsvRow([...getCsvPeriodHeaders(request.grouping), ...entities.map((entity) => entity.label)])}\n`
	)

	const flush = async () => {
		if (groupTimestamp < 0) return
		const values = request.config.displayAs === 'percentage' ? percentageValues(groupValues) : groupValues
		await writeCsvChunk(
			output,
			`${serializeCsvRow([...getCsvPeriodCells(groupTimestamp, request.grouping), ...values])}\n`
		)
		rows++
	}

	for (const [timestamp, protocols] of base.totalDataChartBreakdown) {
		if (!timestampInScope(timestamp, bounds)) continue
		const nextGroupTimestamp = getGroupedTimestampSec(timestamp, request.grouping)
		if (groupTimestamp !== nextGroupTimestamp) {
			await flush()
			groupTimestamp = nextGroupTimestamp
			groupValues = new Array<number>(entities.length).fill(0)
		} else if (useLastValue) {
			groupValues.fill(0)
		}
		addDayValues(groupValues, protocols, entityIndex, categories, request, lookup)
	}
	await flush()
	return rows
}

export async function streamAdapterMetricProtocolCsv(
	request: ChartBuilderCsvRequest,
	output: Writable
): Promise<number> {
	if (request.config.mode !== 'chains') throw new Error('Adapter protocol CSV requires Group by Protocol mode')
	const metric = parseAdapterChartBuilderMetric(request.config.metric)
	if (!metric) throw new Error(`Unsupported adapter metric: ${request.config.metric}`)
	const chains = normalizeLegacyChartBuilderChains(request.config.chains)
	const [base, lookup] = await Promise.all([
		getAdapterMetricProtocolBase(metric, chains.length > 0 ? chains : ['all'], request.config.chainFilterMode),
		getProtocolLookup()
	])
	if (base.chainResultsCount === 0 && request.config.chainFilterMode === 'include') return 0
	return writeAdapterMetricProtocolCsv(request, base, lookup, output)
}
