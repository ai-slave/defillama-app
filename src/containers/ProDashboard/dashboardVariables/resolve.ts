import { DASHBOARD_ITEM_KIND_SUMMARY_LABELS } from '../components/dashboardItemKindSummary'
import { createChartConfig, createMetricConfig } from '../dashboardConfig/classicChartConfig'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { DashboardVariable, DashboardVariableKind } from '../dashboardTypes'
import type { ProDashboardProtocolCatalog } from '../protocolCatalog'
import type {
	ChartConfig,
	DashboardBindableField,
	DashboardItemBindings,
	MetricConfig,
	MultiChartConfig,
	Protocol
} from '../types'
import { getProDashboardChartTypeConfig } from '../types'
import { getBindableFieldVariableKind, getBindableFields, isBindableDashboardItem } from './bindableFields'

export const DASHBOARD_VARIABLE_VALUE_PATTERN = /^[A-Za-z0-9 ._()&'+-]{1,64}$/
export const ALL_CHAINS_VARIABLE_VALUE = 'All'
export const VARIABLE_QUERY_PREFIX = 'var-'

export interface DashboardVariableCatalog {
	hasChain: (name: string) => boolean
	getProtocol: (slug: string) => Pick<Protocol, 'name' | 'slug'> | undefined
}

export interface ParameterUnavailable {
	variableId: string
	reason: string
}

export interface DashboardResolution {
	items: Array<DashboardItemConfig>
	unavailableByItemId: ReadonlyMap<string, ParameterUnavailable>
}

export interface VariableBindingTarget {
	itemId: string
	field: DashboardBindableField
	subItemId?: string
}

export interface ParameterCandidate {
	kind: DashboardVariableKind
	value: string
	count: number
}

const EMPTY_UNAVAILABLE: ReadonlyMap<string, ParameterUnavailable> = new Map()

export function createVariableCatalog(catalog: ProDashboardProtocolCatalog | null): DashboardVariableCatalog | null {
	if (!catalog) return null
	const chains = new Set(catalog.chains.map((chain) => chain.name))
	const protocols = new Map(catalog.protocols.map((protocol) => [protocol.slug, protocol]))
	return { hasChain: (name) => chains.has(name), getProtocol: (slug) => protocols.get(slug) }
}

export function isValidVariableValue(
	kind: DashboardVariableKind,
	value: string,
	catalog: DashboardVariableCatalog | null
): boolean {
	if (!DASHBOARD_VARIABLE_VALUE_PATTERN.test(value)) return false
	if (!catalog) return true
	if (kind === 'chain') return value === ALL_CHAINS_VARIABLE_VALUE || catalog.hasChain(value)
	return catalog.getProtocol(value) !== undefined
}

export function getEffectiveVariableValues(
	variables: ReadonlyArray<DashboardVariable>,
	overrides: Readonly<Record<string, string>>,
	catalog: DashboardVariableCatalog | null
): Record<string, string> {
	const values: Record<string, string> = {}
	for (const variable of variables) {
		const override = overrides[variable.id]
		values[variable.id] =
			override !== undefined && isValidVariableValue(variable.kind, override, catalog) ? override : variable.value
	}
	return values
}

export function readVariableOverridesFromQuery(
	query: Readonly<Record<string, string | Array<string> | undefined>>
): Record<string, string> {
	const overrides: Record<string, string> = {}
	for (const key in query) {
		if (!key.startsWith(VARIABLE_QUERY_PREFIX)) continue
		const raw = query[key]
		const value = Array.isArray(raw) ? raw[0] : raw
		if (typeof value !== 'string' || !DASHBOARD_VARIABLE_VALUE_PATTERN.test(value)) continue
		overrides[key.slice(VARIABLE_QUERY_PREFIX.length)] = value
	}
	return overrides
}

function describeItem(item: DashboardItemConfig): string {
	const kindLabel = DASHBOARD_ITEM_KIND_SUMMARY_LABELS[item.kind].one
	if (!('type' in item) || typeof item.type !== 'string') return kindLabel
	return `${getProDashboardChartTypeConfig(item.type)?.title ?? item.type} ${kindLabel}`
}

function variableById(variables: ReadonlyArray<DashboardVariable>) {
	return new Map(variables.map((variable) => [variable.id, variable]))
}

function protocolName(catalog: DashboardVariableCatalog | null, slug: string): string {
	return catalog?.getProtocol(slug)?.name ?? slug
}

function unavailableProtocol(catalog: DashboardVariableCatalog | null, slug: string, variableId: string) {
	return catalog && !catalog.getProtocol(slug)
		? { variableId, reason: `${slug} is not in the DefiLlama protocol catalog` }
		: undefined
}

function resolveChartSubject(chart: ChartConfig, kind: DashboardVariableKind, value: string): ChartConfig | null {
	const { chain: _chain, protocol: _protocol, subjectType: _subjectType, geckoId: _geckoId, ...rest } = chart
	if (kind === 'chain') {
		if (chart.subjectType === 'chain' && chart.chain === value) return chart
		return createChartConfig({ ...rest, subjectType: 'chain', chain: value })
	}
	if (chart.subjectType === 'protocol' && chart.protocol === value) return chart
	return createChartConfig({ ...rest, subjectType: 'protocol', protocol: value })
}

function resolveMetricSubject(metric: MetricConfig, kind: DashboardVariableKind, value: string): MetricConfig | null {
	const current = metric.subject
	if (kind === 'chain') {
		if (current.itemType === 'chain' && current.chain === value) return metric
		return createMetricConfig({ ...metric, subject: { itemType: 'chain', chain: value } })
	}
	if (current.itemType === 'protocol' && current.protocol === value) return metric
	return createMetricConfig({ ...metric, subject: { itemType: 'protocol', protocol: value } })
}

function boundVariable(
	bindings: DashboardItemBindings | undefined,
	field: DashboardBindableField,
	variables: ReadonlyMap<string, DashboardVariable>,
	values: Readonly<Record<string, string>>
): { variable: DashboardVariable; value: string } | null {
	const variableId = bindings?.[field]
	if (!variableId) return null
	const variable = variables.get(variableId)
	const value = values[variableId]
	if (!variable || value === undefined) return null
	return { variable, value }
}

export function resolveDashboardItem(
	item: DashboardItemConfig,
	variables: ReadonlyArray<DashboardVariable> | ReadonlyMap<string, DashboardVariable>,
	values: Readonly<Record<string, string>>,
	catalog: DashboardVariableCatalog | null
): { item: DashboardItemConfig; unavailable?: ParameterUnavailable } {
	if (!isBindableDashboardItem(item) || !item.bindings) return { item }
	const variableMap = variables instanceof Map ? variables : variableById(variables as ReadonlyArray<DashboardVariable>)
	const describe = (kind: DashboardVariableKind, value: string, variableId: string) => ({
		variableId,
		reason: `${describeItem(item)} isn't available for ${kind === 'protocol' ? protocolName(catalog, value) : value}`
	})

	switch (item.kind) {
		case 'chart': {
			const bound = boundVariable(item.bindings, 'subject', variableMap, values)
			if (!bound) return { item }
			const resolved = resolveChartSubject(item, bound.variable.kind, bound.value)
			if (!resolved) return { item, unavailable: describe(bound.variable.kind, bound.value, bound.variable.id) }
			const unavailable =
				resolved.subjectType === 'protocol'
					? unavailableProtocol(catalog, resolved.protocol, bound.variable.id)
					: undefined
			return { item: resolved, ...(unavailable ? { unavailable } : {}) }
		}
		case 'metric': {
			const bound = boundVariable(item.bindings, 'subject', variableMap, values)
			if (!bound) return { item }
			const resolved = resolveMetricSubject(item, bound.variable.kind, bound.value)
			if (!resolved) return { item, unavailable: describe(bound.variable.kind, bound.value, bound.variable.id) }
			const unavailable =
				resolved.subject.itemType === 'protocol'
					? unavailableProtocol(catalog, resolved.subject.protocol, bound.variable.id)
					: undefined
			return { item: resolved, ...(unavailable ? { unavailable } : {}) }
		}
		case 'unified-table': {
			const bound = boundVariable(item.bindings, 'chains', variableMap, values)
			if (!bound || bound.variable.kind !== 'chain') return { item }
			const chains = item.params?.chains
			if (chains && chains.length === 1 && chains[0] === bound.value) return { item }
			return { item: { ...item, params: { ...item.params, chains: [bound.value] } } }
		}
		case 'builder': {
			let next = item
			const chainBound = boundVariable(item.bindings, 'chains', variableMap, values)
			if (chainBound && chainBound.variable.kind === 'chain') {
				const chains = chainBound.value === ALL_CHAINS_VARIABLE_VALUE ? [] : [chainBound.value]
				if (next.config.chains.length !== chains.length || next.config.chains[0] !== chains[0]) {
					next = { ...next, config: { ...next.config, chains } }
				}
			}
			const protocolBound = boundVariable(item.bindings, 'protocol', variableMap, values)
			if (protocolBound && protocolBound.variable.kind === 'protocol' && next.config.mode === 'protocol') {
				if (next.config.protocol !== protocolBound.value) {
					next = { ...next, config: { ...next.config, protocol: protocolBound.value } }
				}
				const unavailable = unavailableProtocol(catalog, protocolBound.value, protocolBound.variable.id)
				if (unavailable) return { item: next, unavailable }
			}
			return { item: next }
		}
		case 'stablecoins': {
			const bound = boundVariable(item.bindings, 'chain', variableMap, values)
			if (!bound || bound.variable.kind !== 'chain' || item.chain === bound.value) return { item }
			return { item: { ...item, chain: bound.value } }
		}
		case 'advanced-tvl':
		case 'advanced-borrowed':
		case 'income-statement':
		case 'unlocks-schedule':
		case 'unlocks-pie': {
			const bound = boundVariable(item.bindings, 'protocol', variableMap, values)
			if (!bound || bound.variable.kind !== 'protocol') return { item }
			const unavailable = unavailableProtocol(catalog, bound.value, bound.variable.id)
			if (item.protocol === bound.value) return { item, ...(unavailable ? { unavailable } : {}) }
			return {
				item: { ...item, protocol: bound.value, protocolName: protocolName(catalog, bound.value) },
				...(unavailable ? { unavailable } : {})
			}
		}
		default:
			return { item }
	}
}

export function dashboardHasBindings(items: ReadonlyArray<DashboardItemConfig>): boolean {
	for (const item of items) {
		if ('bindings' in item && item.bindings && Object.keys(item.bindings).length > 0) return true
		if (item.kind === 'multi' && item.items.some((chart) => chart.bindings && Object.keys(chart.bindings).length > 0)) {
			return true
		}
	}
	return false
}

export function resolveDashboardItems(
	items: Array<DashboardItemConfig>,
	variables: ReadonlyArray<DashboardVariable>,
	overrides: Readonly<Record<string, string>>,
	catalog: DashboardVariableCatalog | null
): DashboardResolution {
	if (variables.length === 0 || !dashboardHasBindings(items)) return { items, unavailableByItemId: EMPTY_UNAVAILABLE }
	const values = getEffectiveVariableValues(variables, overrides, catalog)
	const variableMap = variableById(variables)
	const unavailableByItemId = new Map<string, ParameterUnavailable>()
	let changed = false
	const resolvedItems = items.map((item) => {
		if (item.kind === 'multi') {
			let chartsChanged = false
			const charts = item.items.map((chart) => {
				const resolved = resolveDashboardItem(chart, variableMap, values, catalog)
				if (resolved.unavailable && !unavailableByItemId.has(item.id)) {
					unavailableByItemId.set(item.id, resolved.unavailable)
				}
				if (resolved.item !== chart) chartsChanged = true
				return resolved.item as ChartConfig
			})
			if (!chartsChanged) return item
			changed = true
			return { ...item, items: charts }
		}
		const resolved = resolveDashboardItem(item, variableMap, values, catalog)
		if (resolved.unavailable) unavailableByItemId.set(item.id, resolved.unavailable)
		if (resolved.item !== item) changed = true
		return resolved.item
	})
	return { items: changed ? resolvedItems : items, unavailableByItemId }
}

export function applyVariableValuesToItems(
	items: Array<DashboardItemConfig>,
	variables: ReadonlyArray<DashboardVariable>,
	catalog: DashboardVariableCatalog | null
): Array<DashboardItemConfig> {
	return resolveDashboardItems(items, variables, {}, catalog).items
}

export function getItemFieldLiteral(
	item: DashboardItemConfig,
	field: DashboardBindableField
): { kind: DashboardVariableKind; value: string } | null {
	switch (item.kind) {
		case 'chart':
			if (field !== 'subject') return null
			return item.subjectType === 'chain'
				? { kind: 'chain', value: item.chain }
				: { kind: 'protocol', value: item.protocol }
		case 'metric':
			if (field !== 'subject') return null
			return item.subject.itemType === 'chain'
				? { kind: 'chain', value: item.subject.chain }
				: { kind: 'protocol', value: item.subject.protocol }
		case 'unified-table': {
			if (field !== 'chains') return null
			const chains = item.params?.chains ?? []
			return chains.length === 1 && chains[0] !== undefined ? { kind: 'chain', value: chains[0] } : null
		}
		case 'builder':
			if (field === 'chains') {
				const chain = item.config.chains[0]
				return item.config.chains.length === 1 && chain !== undefined ? { kind: 'chain', value: chain } : null
			}
			if (field === 'protocol') {
				return item.config.mode === 'protocol' && item.config.protocol
					? { kind: 'protocol', value: item.config.protocol }
					: null
			}
			return null
		case 'stablecoins':
			return field === 'chain' ? { kind: 'chain', value: item.chain } : null
		case 'advanced-tvl':
		case 'advanced-borrowed':
		case 'income-statement':
		case 'unlocks-schedule':
		case 'unlocks-pie':
			return field === 'protocol' ? { kind: 'protocol', value: item.protocol } : null
		default:
			return null
	}
}

function matchingMultiSubject(
	item: MultiChartConfig,
	kind: DashboardVariableKind,
	value: string
): VariableBindingTarget | null {
	for (const chart of item.items) {
		if (chart.bindings?.subject) continue
		const literal = getItemFieldLiteral(chart, 'subject')
		if (literal && literal.kind === kind && literal.value === value) {
			return { itemId: item.id, field: 'subject', subItemId: chart.id }
		}
	}
	return null
}

export function suggestVariableBindings(
	items: ReadonlyArray<DashboardItemConfig>,
	kind: DashboardVariableKind,
	value: string
): Array<VariableBindingTarget> {
	const targets: Array<VariableBindingTarget> = []
	for (const item of items) {
		if (item.kind === 'multi') {
			const target = matchingMultiSubject(item, kind, value)
			if (target) targets.push(target)
			continue
		}
		if (!isBindableDashboardItem(item)) continue
		for (const field of getBindableFields(item)) {
			if (item.bindings?.[field]) continue
			const literal = getItemFieldLiteral(item, field)
			if (literal && literal.kind === kind && literal.value === value) targets.push({ itemId: item.id, field })
		}
	}
	return targets
}

export function getBindableFieldsForKind(
	item: DashboardItemConfig,
	kind: DashboardVariableKind
): Array<DashboardBindableField> {
	return getBindableFields(item).filter((field) => getBindableFieldVariableKind(item, field) === kind)
}

export function listCompatibleBindings(
	items: ReadonlyArray<DashboardItemConfig>,
	kind: DashboardVariableKind,
	value: string
): Array<VariableBindingTarget> {
	const targets: Array<VariableBindingTarget> = []
	for (const item of items) {
		if (item.kind === 'multi') {
			const target = matchingMultiSubject(item, kind, value)
			if (target) targets.push(target)
			continue
		}
		if (!isBindableDashboardItem(item)) continue
		for (const field of getBindableFieldsForKind(item, kind)) {
			if (item.bindings?.[field]) continue
			targets.push({ itemId: item.id, field })
		}
	}
	return targets
}

export function bindDashboardItems(
	items: Array<DashboardItemConfig>,
	targets: ReadonlyArray<VariableBindingTarget>,
	variableId: string
): Array<DashboardItemConfig> {
	if (targets.length === 0) return items
	const targetsByItem = new Map<string, Array<VariableBindingTarget>>()
	for (const target of targets) {
		const itemTargets = targetsByItem.get(target.itemId)
		if (itemTargets) itemTargets.push(target)
		else targetsByItem.set(target.itemId, [target])
	}
	let changed = false
	const next = items.map((item) => {
		const itemTargets = targetsByItem.get(item.id)
		if (!itemTargets) return item
		if (item.kind === 'multi') {
			const subItemId = itemTargets.find((target) => target.subItemId !== undefined)?.subItemId
			if (subItemId === undefined) return item
			const bound = setDashboardItemBinding(item, 'subject', variableId, subItemId)
			if (bound === item) return item
			changed = true
			return bound
		}
		if (!isBindableDashboardItem(item)) return item
		const bindings: DashboardItemBindings = { ...item.bindings }
		for (const target of itemTargets) bindings[target.field] = variableId
		changed = true
		return { ...item, bindings }
	})
	return changed ? next : items
}

function setChartSubjectBinding(chart: ChartConfig, variableId: string | null): ChartConfig {
	if ((chart.bindings?.subject ?? null) === variableId) return chart
	if (variableId) return { ...chart, bindings: { ...chart.bindings, subject: variableId } }
	const { bindings: previous, ...rest } = chart
	const bindings: DashboardItemBindings = { ...previous }
	delete bindings.subject
	return (Object.keys(bindings).length > 0 ? { ...rest, bindings } : rest) as ChartConfig
}

export function setDashboardItemBinding<Item extends DashboardItemConfig>(
	item: Item,
	field: DashboardBindableField,
	variableId: string | null,
	subItemId?: string
): Item {
	if (item.kind === 'multi') {
		if (subItemId === undefined || field !== 'subject') return item
		if (!item.items.some((chart) => chart.id === subItemId)) return item
		let changed = false
		const charts = item.items.map((chart) => {
			const next =
				chart.id === subItemId
					? setChartSubjectBinding(chart, variableId)
					: variableId !== null && chart.bindings?.subject === variableId
						? setChartSubjectBinding(chart, null)
						: chart
			if (next !== chart) changed = true
			return next
		})
		return changed ? ({ ...item, items: charts } as Item) : item
	}
	if (!isBindableDashboardItem(item)) return item
	const { bindings: previous, ...rest } = item
	const bindings: DashboardItemBindings = { ...previous }
	if (variableId) bindings[field] = variableId
	else delete bindings[field]
	return (Object.keys(bindings).length > 0 ? { ...rest, bindings } : rest) as Item
}

export function unbindDashboardVariable(
	items: Array<DashboardItemConfig>,
	variableId: string
): Array<DashboardItemConfig> {
	let changed = false
	const strip = <Item extends DashboardItemConfig>(item: Item): Item => {
		if (!('bindings' in item) || !item.bindings) return item
		const entries = Object.entries(item.bindings).filter(([, id]) => id !== variableId)
		if (entries.length === Object.keys(item.bindings).length) return item
		changed = true
		const { bindings: _bindings, ...rest } = item
		return (entries.length > 0 ? { ...rest, bindings: Object.fromEntries(entries) } : rest) as Item
	}
	const next = items.map((item) => {
		if (item.kind === 'multi') {
			const charts = item.items.map(strip)
			return charts.some((chart, index) => chart !== item.items[index]) ? { ...item, items: charts } : item
		}
		return strip(item)
	})
	return changed ? next : items
}

export function detectParameterCandidates(items: ReadonlyArray<DashboardItemConfig>): Array<ParameterCandidate> {
	const counts = new Map<string, ParameterCandidate>()
	const count = (literal: { kind: DashboardVariableKind; value: string }) => {
		const key = `${literal.kind}:${literal.value}`
		const candidate = counts.get(key)
		if (candidate) candidate.count++
		else counts.set(key, { ...literal, count: 1 })
	}
	for (const item of items) {
		if (item.kind === 'multi') {
			const counted = new Set<string>()
			for (const chart of item.items) {
				if (chart.bindings?.subject) continue
				const literal = getItemFieldLiteral(chart, 'subject')
				if (!literal || literal.value === ALL_CHAINS_VARIABLE_VALUE) continue
				const key = `${literal.kind}:${literal.value}`
				if (counted.has(key)) continue
				counted.add(key)
				count(literal)
			}
			continue
		}
		if (!isBindableDashboardItem(item)) continue
		for (const field of getBindableFields(item)) {
			if (item.bindings?.[field]) continue
			const literal = getItemFieldLiteral(item, field)
			if (!literal || literal.value === ALL_CHAINS_VARIABLE_VALUE) continue
			count(literal)
		}
	}
	return Array.from(counts.values())
		.filter((candidate) => candidate.count >= 2)
		.sort((a, b) => b.count - a.count)
}

export function slugifyVariableId(label: string, taken: ReadonlySet<string>): string {
	const base =
		label
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 24) || 'param'
	let id = base
	let counter = 2
	while (taken.has(id)) id = `${base}-${counter++}`
	return id
}

const AI_UNKNOWN_KINDS: ReadonlySet<DashboardItemConfig['kind']> = new Set(['section', 'custom-data'])

function sameSubjectLiteral(previous: DashboardItemConfig, next: DashboardItemConfig): boolean {
	if (previous.kind !== next.kind) return false
	if (!isBindableDashboardItem(previous) || !isBindableDashboardItem(next)) return false
	const boundFields = Object.keys(previous.bindings ?? {}) as Array<DashboardBindableField>
	for (const field of boundFields) {
		const before = getItemFieldLiteral(previous, field)
		const after = getItemFieldLiteral(next, field)
		if (before === null || after === null) {
			if (before !== after) return false
			continue
		}
		if (before.kind !== after.kind || before.value !== after.value) return false
	}
	return true
}

function restoreMultiChartBindings(previous: MultiChartConfig, next: MultiChartConfig): MultiChartConfig {
	const previousCharts = new Map(previous.items.map((chart) => [chart.id, chart]))
	let changed = false
	const charts = next.items.map((chart) => {
		const before = previousCharts.get(chart.id)
		if (!before || !before.bindings || chart.bindings || !sameSubjectLiteral(before, chart)) return chart
		changed = true
		return { ...chart, bindings: before.bindings }
	})
	return changed ? { ...next, items: charts } : next
}

export function restoreItemsAfterIterate(
	previousItems: ReadonlyArray<DashboardItemConfig>,
	nextItems: ReadonlyArray<DashboardItemConfig>
): Array<DashboardItemConfig> {
	const previousById = new Map(previousItems.map((item) => [item.id, item]))
	const nextIds = new Set(nextItems.map((item) => item.id))
	const restored: Array<DashboardItemConfig> = nextItems.map((item) => {
		const previous = previousById.get(item.id)
		if (!previous) return item
		if (AI_UNKNOWN_KINDS.has(previous.kind)) return previous
		if (previous.kind === 'multi' && item.kind === 'multi') return restoreMultiChartBindings(previous, item)
		if (isBindableDashboardItem(previous) && previous.bindings && sameSubjectLiteral(previous, item)) {
			return { ...item, bindings: previous.bindings } as DashboardItemConfig
		}
		return item
	})
	for (let index = 0; index < previousItems.length; index++) {
		const previous = previousItems[index]
		if (!previous || nextIds.has(previous.id) || !AI_UNKNOWN_KINDS.has(previous.kind)) continue
		let insertAt = restored.length
		for (let cursor = index + 1; cursor < previousItems.length; cursor++) {
			const follower = previousItems[cursor]
			const position = follower ? restored.findIndex((item) => item.id === follower.id) : -1
			if (position !== -1) {
				insertAt = position
				break
			}
		}
		restored.splice(insertAt, 0, previous)
	}
	return restored
}

export function stripCustomDataRows(items: ReadonlyArray<DashboardItemConfig>): Array<DashboardItemConfig> {
	return items.map((item) => {
		if (item.kind !== 'custom-data' || item.rows === undefined) return item
		const { rows: _rows, ...rest } = item
		return rest
	})
}
