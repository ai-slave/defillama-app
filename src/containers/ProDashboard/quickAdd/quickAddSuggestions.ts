import { chartNeedsGeckoId } from '../chartSource'
import { createChartConfig, createMetricConfig } from '../dashboardConfig/classicChartConfig'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import {
	CHART_TYPES,
	type ChartConfig,
	limitMultiChartItems,
	MAX_MULTI_CHART_SERIES,
	type MetricConfig,
	type MetricSubject,
	type MultiChartConfig,
	type ProDashboardChartType,
	type SectionConfig,
	type TextConfig
} from '../types'
import { buildDefaultUnifiedTableConfig } from '../useDashboardActions'
import { generateItemId } from '../utils/dashboardUtils'
import {
	getDefaultMetricAggregator,
	getSubjectMetricPriority,
	QUICK_ADD_METRIC_CHART_TYPE,
	QUICK_ADD_METRIC_WINDOW,
	type QuickAddSubjectType,
	resolveMetricForSubject
} from './metricDefaults'
import {
	findQuickAddEntity,
	QUICK_ADD_ENTITIES_PER_GROUP,
	type QuickAddEntity,
	quickAddEntityKey,
	searchQuickAddEntities,
	topQuickAddEntities
} from './quickAddIndex'
import { parseQuickAddQuery, type QuickAddCommand, type QuickAddGrouping, type QuickAddQuery } from './quickAddQuery'
import type { QuickAddRecent } from './quickAddRecents'

export type QuickAddSuggestionKind = 'chart' | 'metric' | 'multi' | 'table' | 'text' | 'section' | 'open-editor'
export type QuickAddSuggestionGroup = 'suggested' | 'recent' | 'start'
export type QuickAddSuggestionAction = 'open-editor' | 'open-editor-draft'
export type QuickAddSuggestionAfterAdd = 'close-and-focus-title'

export interface QuickAddSuggestion {
	id: string
	kind: QuickAddSuggestionKind
	title: string
	detail: string
	alreadyOnDashboard: boolean
	entity?: QuickAddEntity
	metric?: ProDashboardChartType
	group?: QuickAddSuggestionGroup
	action?: QuickAddSuggestionAction
	afterAdd?: QuickAddSuggestionAfterAdd
	build: (existingItems: ReadonlyArray<DashboardItemConfig>) => Array<DashboardItemConfig>
}

export interface QuickAddAvailability {
	loading: boolean
	error: boolean
	forProtocol: (slug: string, hasGeckoId: boolean) => Array<string>
	forChain: (name: string, hasGeckoId: boolean) => Array<string>
}

export interface BuildQuickAddSuggestionsInput {
	query: QuickAddQuery
	entities: ReadonlyArray<QuickAddEntity>
	availability: QuickAddAvailability
	existingItems: ReadonlyArray<DashboardItemConfig>
	recents: ReadonlyArray<QuickAddRecent>
}

export const QUICK_ADD_SUGGESTION_LIMIT = 8
export const QUICK_ADD_METRIC_ONLY_ENTITY_LIMIT = 3
const EMPTY_QUERY_SUGGESTED_LIMIT = 3
const EMPTY_QUERY_ENTITY_LIMIT = 4

const CHART_SHAPE_LABELS: Record<string, string> = { area: 'Area', bar: 'Bar', line: 'Line' }
const GROUPING_LABELS: Record<QuickAddGrouping, string> = { day: 'daily', week: 'weekly', month: 'monthly' }
const AVAILABILITY_PENDING_LABEL = 'checking data…'
const OPEN_EDITOR_DETAIL = 'Yields, stablecoins, RWA, SQL, custom data…'

interface MetricAvailabilityLookup {
	loading: boolean
	forEntity: (entity: QuickAddEntity) => ReadonlySet<string> | null
}

export type QuickAddExistingKind = 'chart' | 'metric'

export interface ExistingDashboardSubjects {
	entryKeys: Set<string>
	orderedEntityKeys: Array<string>
}

interface QuickAddSuggestionContext {
	query: QuickAddQuery
	availability: MetricAvailabilityLookup
	existing: ExistingDashboardSubjects
}

interface QuickAddSuggestionScope {
	context: QuickAddSuggestionContext
	entities: ReadonlyArray<QuickAddEntity>
	recents: ReadonlyArray<QuickAddRecent>
}

function isGroupableChartType(type: ProDashboardChartType): boolean {
	const config = CHART_TYPES[type]
	return 'groupable' in config && config.groupable === true
}

function existingEntryKey(
	kind: QuickAddExistingKind,
	subjectType: QuickAddSubjectType,
	id: string,
	type: string
): string {
	return `${kind}:${quickAddEntityKey(subjectType, id)}:${type}`
}

function recordExistingEntry(
	existing: ExistingDashboardSubjects,
	seenEntityKeys: Set<string>,
	kind: QuickAddExistingKind,
	subjectType: QuickAddSubjectType,
	id: string,
	type: string
): void {
	existing.entryKeys.add(existingEntryKey(kind, subjectType, id, type))
	const entityKey = quickAddEntityKey(subjectType, id)
	if (seenEntityKeys.has(entityKey)) return
	seenEntityKeys.add(entityKey)
	existing.orderedEntityKeys.push(entityKey)
}

function recordExistingChart(
	existing: ExistingDashboardSubjects,
	seenEntityKeys: Set<string>,
	chart: ChartConfig
): void {
	if (chart.subjectType === 'chain')
		recordExistingEntry(existing, seenEntityKeys, 'chart', 'chain', chart.chain, chart.type)
	else recordExistingEntry(existing, seenEntityKeys, 'chart', 'protocol', chart.protocol, chart.type)
}

export function collectExistingDashboardSubjects(items: ReadonlyArray<DashboardItemConfig>): ExistingDashboardSubjects {
	const existing: ExistingDashboardSubjects = { entryKeys: new Set(), orderedEntityKeys: [] }
	const seenEntityKeys = new Set<string>()
	for (const item of items) {
		if (item.kind === 'chart') recordExistingChart(existing, seenEntityKeys, item)
		else if (item.kind === 'multi') {
			for (const chart of item.items) recordExistingChart(existing, seenEntityKeys, chart)
		} else if (item.kind === 'metric') {
			if (item.subject.itemType === 'chain') {
				recordExistingEntry(existing, seenEntityKeys, 'metric', 'chain', item.subject.chain, item.type)
			} else {
				recordExistingEntry(existing, seenEntityKeys, 'metric', 'protocol', item.subject.protocol, item.type)
			}
		}
	}
	return existing
}

function createMetricAvailabilityLookup(availability: QuickAddAvailability): MetricAvailabilityLookup {
	const cache = new Map<string, ReadonlySet<string>>()
	const unfiltered = availability.loading || availability.error
	return {
		loading: availability.loading,
		forEntity: (entity: QuickAddEntity) => {
			if (unfiltered) return null
			const cached = cache.get(entity.key)
			if (cached) return cached
			const hasGeckoId = entity.geckoId !== null
			const types =
				entity.subjectType === 'chain'
					? availability.forChain(entity.id, hasGeckoId)
					: availability.forProtocol(entity.id, hasGeckoId)
			const available: ReadonlySet<string> = new Set(types)
			cache.set(entity.key, available)
			return available
		}
	}
}

function resolveEntityMetric(
	entity: QuickAddEntity,
	type: ProDashboardChartType,
	availability: MetricAvailabilityLookup
): ProDashboardChartType | null {
	const resolved = resolveMetricForSubject(entity.subjectType, type)
	if (resolved === null) return null
	const available = availability.forEntity(entity)
	if (available === null) return resolved
	return available.has(resolved) ? resolved : null
}

function entityMetricsInPriorityOrder(
	entity: QuickAddEntity,
	availability: MetricAvailabilityLookup
): Array<ProDashboardChartType> {
	const available = availability.forEntity(entity)
	const ordered: Array<ProDashboardChartType> = []
	for (const type of getSubjectMetricPriority(entity.subjectType)) {
		if (available !== null && !available.has(type)) continue
		ordered.push(type)
	}
	return ordered
}

function isAlreadyOnDashboard(
	existing: ExistingDashboardSubjects,
	kind: QuickAddExistingKind,
	entity: QuickAddEntity,
	type: ProDashboardChartType
): boolean {
	return existing.entryKeys.has(existingEntryKey(kind, entity.subjectType, entity.id, type))
}

function withPendingLabel(detail: string, loading: boolean): string {
	return loading ? `${detail} · ${AVAILABILITY_PENDING_LABEL}` : detail
}

function buildQuickAddChartConfig(
	entity: QuickAddEntity,
	type: ProDashboardChartType,
	query: QuickAddQuery
): ChartConfig | null {
	const grouping = isGroupableChartType(type) ? (query.grouping ?? 'day') : undefined
	const geckoId = chartNeedsGeckoId(type, entity.subjectType) ? entity.geckoId : null
	const shared = {
		id: generateItemId(type, entity.id),
		kind: 'chart' as const,
		type,
		...(grouping === undefined ? {} : { grouping }),
		...(geckoId === null ? {} : { geckoId }),
		...(type === 'unlocks' ? { dataType: 'documented' as const } : {}),
		...(query.cumulative ? { showCumulative: true } : {}),
		colSpan: 1 as const
	}
	return entity.subjectType === 'chain'
		? createChartConfig({ ...shared, subjectType: 'chain', chain: entity.id })
		: createChartConfig({ ...shared, subjectType: 'protocol', protocol: entity.id })
}

function buildQuickAddMetricConfig(entity: QuickAddEntity, type: ProDashboardChartType): MetricConfig | null {
	const geckoId = chartNeedsGeckoId(type, entity.subjectType) ? entity.geckoId : null
	const subject: MetricSubject =
		entity.subjectType === 'chain'
			? { itemType: 'chain', chain: entity.id, ...(geckoId === null ? {} : { geckoId }) }
			: { itemType: 'protocol', protocol: entity.id, ...(geckoId === null ? {} : { geckoId }) }
	return createMetricConfig({
		id: generateItemId('metric', entity.id),
		kind: 'metric',
		subject,
		type,
		aggregator: getDefaultMetricAggregator(type),
		window: QUICK_ADD_METRIC_WINDOW,
		compare: { mode: 'previous_value', format: 'percent' },
		chartType: QUICK_ADD_METRIC_CHART_TYPE,
		colSpan: 0.5
	})
}

function buildQuickAddMultiConfig(
	entities: ReadonlyArray<QuickAddEntity>,
	metricByEntityKey: ReadonlyMap<string, ProDashboardChartType>,
	name: string,
	query: QuickAddQuery
): MultiChartConfig | null {
	const items: Array<ChartConfig> = []
	for (const entity of entities) {
		const type = metricByEntityKey.get(entity.key)
		if (type === undefined) continue
		const chart = buildQuickAddChartConfig(entity, type, query)
		if (chart) items.push(chart)
	}
	if (items.length < 2) return null
	return {
		id: generateItemId('multi', ''),
		kind: 'multi',
		name,
		items: limitMultiChartItems(items),
		grouping: query.grouping ?? 'day',
		colSpan: 1
	}
}

function createChartSuggestion(
	entity: QuickAddEntity,
	type: ProDashboardChartType,
	context: QuickAddSuggestionContext,
	group?: QuickAddSuggestionGroup
): QuickAddSuggestion {
	const config = CHART_TYPES[type]
	const details = [`${CHART_SHAPE_LABELS[config.chartType] ?? 'Line'} chart`]
	if (isGroupableChartType(type)) details.push(GROUPING_LABELS[context.query.grouping ?? 'day'])
	if (context.query.cumulative) details.push('cumulative')
	return {
		id: `chart:${entity.key}:${type}`,
		kind: 'chart',
		title: `${entity.name} · ${config.title}`,
		detail: withPendingLabel(details.join(' · '), context.availability.loading),
		alreadyOnDashboard: isAlreadyOnDashboard(context.existing, 'chart', entity, type),
		entity,
		metric: type,
		...(group === undefined ? {} : { group }),
		build: () => {
			const chart = buildQuickAddChartConfig(entity, type, context.query)
			return chart ? [chart] : []
		}
	}
}

function createMetricSuggestion(
	entity: QuickAddEntity,
	type: ProDashboardChartType,
	context: QuickAddSuggestionContext,
	group?: QuickAddSuggestionGroup
): QuickAddSuggestion {
	const config = CHART_TYPES[type]
	const detail = `Metric card · ${QUICK_ADD_METRIC_WINDOW} ${getDefaultMetricAggregator(type)}`
	return {
		id: `metric:${entity.key}:${type}`,
		kind: 'metric',
		title: `${entity.name} · ${config.title}`,
		detail: withPendingLabel(detail, context.availability.loading),
		alreadyOnDashboard: isAlreadyOnDashboard(context.existing, 'metric', entity, type),
		entity,
		metric: type,
		...(group === undefined ? {} : { group }),
		build: () => {
			const metric = buildQuickAddMetricConfig(entity, type)
			return metric ? [metric] : []
		}
	}
}

function createMultiSuggestion(
	entities: ReadonlyArray<QuickAddEntity>,
	metricByEntityKey: ReadonlyMap<string, ProDashboardChartType>,
	context: QuickAddSuggestionContext
): QuickAddSuggestion | null {
	const series = entities.slice(0, MAX_MULTI_CHART_SERIES)
	const [leadEntity] = series
	if (leadEntity === undefined) return null
	const leadType = metricByEntityKey.get(leadEntity.key)
	if (leadType === undefined) return null
	const names: Array<string> = []
	const keys: Array<string> = []
	for (const entity of series) {
		names.push(entity.name)
		keys.push(entity.key)
	}
	const title = `${names.join(' vs ')} · ${CHART_TYPES[leadType].title}`
	return {
		id: `multi:${keys.join('+')}:${leadType}`,
		kind: 'multi',
		title,
		detail: withPendingLabel(`${series.length} series`, context.availability.loading),
		alreadyOnDashboard: false,
		entity: leadEntity,
		metric: leadType,
		build: () => {
			const multi = buildQuickAddMultiConfig(series, metricByEntityKey, title, context.query)
			return multi ? [multi] : []
		}
	}
}

function createTableSuggestion(group?: QuickAddSuggestionGroup): QuickAddSuggestion {
	return {
		id: 'table:unified',
		kind: 'table',
		title: 'Top protocols table',
		detail: 'Table · protocols ranked by TVL',
		alreadyOnDashboard: false,
		...(group === undefined ? {} : { group }),
		build: () => [buildDefaultUnifiedTableConfig()]
	}
}

function createTextSuggestion(group?: QuickAddSuggestionGroup): QuickAddSuggestion {
	return {
		id: 'text:block',
		kind: 'text',
		title: 'Text block',
		detail: 'Note · title and rich text',
		alreadyOnDashboard: false,
		action: 'open-editor-draft',
		...(group === undefined ? {} : { group }),
		build: () => {
			const text: TextConfig = { id: generateItemId('text', ''), kind: 'text', content: '', colSpan: 1 }
			return [text]
		}
	}
}

function createSectionSuggestion(group?: QuickAddSuggestionGroup): QuickAddSuggestion {
	return {
		id: 'section:heading',
		kind: 'section',
		title: 'Section',
		detail: 'Heading · groups the cards below it',
		alreadyOnDashboard: false,
		afterAdd: 'close-and-focus-title',
		...(group === undefined ? {} : { group }),
		build: () => {
			const section: SectionConfig = {
				id: generateItemId('section', ''),
				kind: 'section',
				title: 'New section',
				displayAs: 'heading'
			}
			return [section]
		}
	}
}

function createOpenEditorSuggestion(): QuickAddSuggestion {
	return {
		id: 'open-editor',
		kind: 'open-editor',
		title: 'All card types…',
		detail: OPEN_EDITOR_DETAIL,
		alreadyOnDashboard: false,
		action: 'open-editor',
		build: () => []
	}
}

function createCommandSuggestion(command: QuickAddCommand, group?: QuickAddSuggestionGroup): QuickAddSuggestion {
	if (command === 'text') return createTextSuggestion(group)
	if (command === 'section') return createSectionSuggestion(group)
	return createTableSuggestion(group)
}

function buildEntityMetricSuggestions(
	primary: QuickAddEntity,
	matched: ReadonlyArray<QuickAddEntity>,
	scope: QuickAddSuggestionScope
): Array<QuickAddSuggestion> {
	const { context } = scope
	const suggestions: Array<QuickAddSuggestion> = []
	const wantsMetricCard = context.query.form === 'metric'
	const metrics = entityMetricsInPriorityOrder(primary, context.availability).slice(0, QUICK_ADD_ENTITIES_PER_GROUP)
	for (const type of metrics) {
		suggestions.push(
			wantsMetricCard ? createMetricSuggestion(primary, type, context) : createChartSuggestion(primary, type, context)
		)
	}
	for (const entity of matched) {
		if (entity.key === primary.key) continue
		const [topType] = entityMetricsInPriorityOrder(entity, context.availability)
		if (topType === undefined) continue
		suggestions.push(createChartSuggestion(entity, topType, context))
	}
	return suggestions
}

function buildSingleEntitySuggestions(
	matched: ReadonlyArray<QuickAddEntity>,
	scope: QuickAddSuggestionScope
): Array<QuickAddSuggestion> {
	const { context } = scope
	const [primary] = matched
	if (primary === undefined) return []
	const queryMetric = context.query.metric
	if (queryMetric === null) return buildEntityMetricSuggestions(primary, matched, scope)
	let leadEntity: QuickAddEntity | null = null
	let leadType: ProDashboardChartType | null = null
	for (const entity of matched) {
		const resolved = resolveEntityMetric(entity, queryMetric, context.availability)
		if (resolved === null) continue
		leadEntity = entity
		leadType = resolved
		break
	}
	if (leadEntity === null || leadType === null) return buildEntityMetricSuggestions(primary, matched, scope)
	const wantsMetricCard = context.query.form === 'metric'
	const suggestions: Array<QuickAddSuggestion> = [
		wantsMetricCard
			? createMetricSuggestion(leadEntity, leadType, context)
			: createChartSuggestion(leadEntity, leadType, context),
		wantsMetricCard
			? createChartSuggestion(leadEntity, leadType, context)
			: createMetricSuggestion(leadEntity, leadType, context)
	]
	for (const entity of matched) {
		if (entity.key === leadEntity.key) continue
		const resolved = resolveEntityMetric(entity, queryMetric, context.availability)
		if (resolved === null) continue
		suggestions.push(createChartSuggestion(entity, resolved, context))
	}
	return suggestions
}

function buildComparisonSuggestions(
	groups: ReadonlyArray<Array<QuickAddEntity>>,
	scope: QuickAddSuggestionScope
): Array<QuickAddSuggestion> {
	const { context } = scope
	const leads: Array<QuickAddEntity> = []
	for (const group of groups) {
		const [lead] = group
		if (lead) leads.push(lead)
	}
	const requested = context.query.metric
	const metricByEntityKey = new Map<string, ProDashboardChartType>()
	const series: Array<QuickAddEntity> = []
	for (const entity of leads) {
		const resolved =
			requested === null
				? entityMetricsInPriorityOrder(entity, context.availability)[0]
				: resolveEntityMetric(entity, requested, context.availability)
		if (resolved === null || resolved === undefined) continue
		metricByEntityKey.set(entity.key, resolved)
		series.push(entity)
	}
	const suggestions: Array<QuickAddSuggestion> = []
	const multi = series.length >= 2 ? createMultiSuggestion(series, metricByEntityKey, context) : null
	if (multi) suggestions.push(multi)
	for (const entity of series) {
		const type = metricByEntityKey.get(entity.key)
		if (type === undefined) continue
		suggestions.push(createChartSuggestion(entity, type, context))
	}
	return suggestions
}

function buildMetricOnlySuggestions(scope: QuickAddSuggestionScope): Array<QuickAddSuggestion> {
	const { context, entities, recents } = scope
	const queryMetric = context.query.metric
	if (queryMetric === null) return []
	const candidates: Array<QuickAddEntity> = []
	const seenKeys = new Set<string>()
	const addCandidate = (entity: QuickAddEntity | undefined) => {
		if (entity === undefined || seenKeys.has(entity.key)) return
		seenKeys.add(entity.key)
		candidates.push(entity)
	}
	for (const key of context.existing.orderedEntityKeys) {
		addCandidate(entities.find((entity) => entity.key === key))
	}
	for (const recent of recents) {
		addCandidate(findQuickAddEntity(entities, recent.subjectType, recent.id))
	}
	for (const entity of topQuickAddEntities(entities, QUICK_ADD_METRIC_ONLY_ENTITY_LIMIT)) addCandidate(entity)
	const suggestions: Array<QuickAddSuggestion> = []
	for (const entity of candidates) {
		const resolved = resolveEntityMetric(entity, queryMetric, context.availability)
		if (resolved === null) continue
		suggestions.push(
			context.query.form === 'metric'
				? createMetricSuggestion(entity, resolved, context)
				: createChartSuggestion(entity, resolved, context)
		)
		if (suggestions.length === QUICK_ADD_ENTITIES_PER_GROUP) break
	}
	return suggestions
}

function demoteAlreadyOnDashboard(suggestions: ReadonlyArray<QuickAddSuggestion>): Array<QuickAddSuggestion> {
	const queuesByKind = new Map<QuickAddSuggestionKind, Array<QuickAddSuggestion>>()
	for (const suggestion of suggestions) {
		const queue = queuesByKind.get(suggestion.kind)
		if (queue) queue.push(suggestion)
		else queuesByKind.set(suggestion.kind, [suggestion])
	}
	for (const [kind, queue] of queuesByKind) {
		const fresh: Array<QuickAddSuggestion> = []
		const demoted: Array<QuickAddSuggestion> = []
		for (const suggestion of queue) {
			if (suggestion.alreadyOnDashboard) demoted.push(suggestion)
			else fresh.push(suggestion)
		}
		queuesByKind.set(kind, [...fresh, ...demoted])
	}
	const takenByKind = new Map<QuickAddSuggestionKind, number>()
	const ordered: Array<QuickAddSuggestion> = []
	for (const suggestion of suggestions) {
		const taken = takenByKind.get(suggestion.kind) ?? 0
		takenByKind.set(suggestion.kind, taken + 1)
		const next = queuesByKind.get(suggestion.kind)?.[taken]
		if (next) ordered.push(next)
	}
	return ordered
}

function buildSearchSuggestions(scope: QuickAddSuggestionScope): Array<QuickAddSuggestion> {
	const { context, entities } = scope
	if (context.query.command !== null) return [createCommandSuggestion(context.query.command)]
	const groups: Array<Array<QuickAddEntity>> = []
	for (const terms of context.query.entityGroups) {
		const matched = searchQuickAddEntities(entities, terms, QUICK_ADD_ENTITIES_PER_GROUP)
		if (matched.length > 0) groups.push(matched)
	}
	if (groups.length >= 2) return demoteAlreadyOnDashboard(buildComparisonSuggestions(groups, scope))
	const [matched] = groups
	if (matched === undefined) return demoteAlreadyOnDashboard(buildMetricOnlySuggestions(scope))
	return demoteAlreadyOnDashboard(buildSingleEntitySuggestions(matched, scope))
}

function buildEmptyQuerySuggestions(scope: QuickAddSuggestionScope): Array<QuickAddSuggestion> {
	const { context, entities, recents } = scope
	const suggestions: Array<QuickAddSuggestion> = []
	for (const key of context.existing.orderedEntityKeys) {
		if (suggestions.length === EMPTY_QUERY_SUGGESTED_LIMIT) break
		const entity = entities.find((candidate) => candidate.key === key)
		if (entity === undefined) continue
		for (const type of entityMetricsInPriorityOrder(entity, context.availability)) {
			if (isAlreadyOnDashboard(context.existing, 'chart', entity, type)) continue
			suggestions.push(createChartSuggestion(entity, type, context, 'suggested'))
			break
		}
	}
	for (const recent of recents) {
		if (suggestions.length === EMPTY_QUERY_ENTITY_LIMIT) break
		if (recent.kind === 'table' || recent.kind === 'text' || recent.kind === 'section') {
			suggestions.push(createCommandSuggestion(recent.kind, 'recent'))
			continue
		}
		const entity = findQuickAddEntity(entities, recent.subjectType, recent.id)
		if (entity === undefined) continue
		const type =
			recent.metric === undefined
				? entityMetricsInPriorityOrder(entity, context.availability)[0]
				: resolveMetricForSubject(entity.subjectType, recent.metric)
		if (type === null || type === undefined) continue
		suggestions.push(
			recent.kind === 'metric'
				? createMetricSuggestion(entity, type, context, 'recent')
				: createChartSuggestion(entity, type, context, 'recent')
		)
	}
	suggestions.push(createTableSuggestion('start'), createTextSuggestion('start'), createSectionSuggestion('start'))
	return suggestions
}

function limitQuickAddSuggestions(suggestions: ReadonlyArray<QuickAddSuggestion>): Array<QuickAddSuggestion> {
	const limited: Array<QuickAddSuggestion> = []
	const seenIds = new Set<string>()
	for (const suggestion of suggestions) {
		if (seenIds.has(suggestion.id)) continue
		seenIds.add(suggestion.id)
		limited.push(suggestion)
		if (limited.length === QUICK_ADD_SUGGESTION_LIMIT - 1) break
	}
	return limited
}

export function isQuickAddQueryEmpty(query: QuickAddQuery): boolean {
	return query.entityTerms.length === 0 && query.metric === null && query.command === null
}

export function buildLeadingQuickAddSuggestion(
	raw: string,
	inputs: Omit<BuildQuickAddSuggestionsInput, 'query'>
): QuickAddSuggestion | undefined {
	return buildQuickAddSuggestions({ query: parseQuickAddQuery(raw), ...inputs })[0]
}

export function buildQuickAddSuggestions(input: BuildQuickAddSuggestionsInput): Array<QuickAddSuggestion> {
	const context: QuickAddSuggestionContext = {
		query: input.query,
		availability: createMetricAvailabilityLookup(input.availability),
		existing: collectExistingDashboardSubjects(input.existingItems)
	}
	const scope: QuickAddSuggestionScope = { context, entities: input.entities, recents: input.recents }
	const suggestions = isQuickAddQueryEmpty(input.query)
		? buildEmptyQuerySuggestions(scope)
		: buildSearchSuggestions(scope)
	const limited = limitQuickAddSuggestions(suggestions)
	limited.push(createOpenEditorSuggestion())
	return limited
}
