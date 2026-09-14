import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { DashboardVariableKind } from '../dashboardTypes'
import type { DashboardBindableField, DashboardItemBindings } from '../types'

type BindableFieldSpec = DashboardVariableKind | 'by-subject'

export const DASHBOARD_ITEM_BINDABLE_FIELDS = {
	chart: { subject: 'by-subject' },
	multi: {},
	metric: { subject: 'by-subject' },
	'unified-table': { chains: 'chain' },
	builder: { chains: 'chain', protocol: 'protocol' },
	stablecoins: { chain: 'chain' },
	'advanced-tvl': { protocol: 'protocol' },
	'advanced-borrowed': { protocol: 'protocol' },
	'income-statement': { protocol: 'protocol' },
	'unlocks-schedule': { protocol: 'protocol' },
	'unlocks-pie': { protocol: 'protocol' },
	'dataset-table': {},
	text: {},
	yields: {},
	'stablecoin-asset': {},
	'llamaai-chart': {},
	'rwa-overview': {},
	'rwa-asset': {},
	sql: {},
	section: {},
	'custom-data': {}
} satisfies Record<DashboardItemConfig['kind'], Partial<Record<DashboardBindableField, BindableFieldSpec>>>

export type BindableDashboardItem = Extract<DashboardItemConfig, { bindings?: DashboardItemBindings }>

export function isBindableDashboardItem(item: DashboardItemConfig): item is BindableDashboardItem {
	return Object.keys(DASHBOARD_ITEM_BINDABLE_FIELDS[item.kind]).length > 0
}

function subjectVariableKind(item: DashboardItemConfig): DashboardVariableKind | null {
	if (item.kind === 'chart') return item.subjectType
	if (item.kind === 'metric') return item.subject.itemType
	return null
}

export function getBindableFieldVariableKind(
	item: DashboardItemConfig,
	field: DashboardBindableField
): DashboardVariableKind | null {
	const fields: Partial<Record<DashboardBindableField, BindableFieldSpec>> = DASHBOARD_ITEM_BINDABLE_FIELDS[item.kind]
	const spec = fields[field]
	if (spec === undefined) return null
	if (spec === 'by-subject') return subjectVariableKind(item)
	if (item.kind === 'builder' && field === 'protocol' && item.config.mode !== 'protocol') return null
	return spec
}

export function getBindableFields(item: DashboardItemConfig): Array<DashboardBindableField> {
	const result: Array<DashboardBindableField> = []
	for (const field of Object.keys(DASHBOARD_ITEM_BINDABLE_FIELDS[item.kind]) as Array<DashboardBindableField>) {
		if (getBindableFieldVariableKind(item, field) !== null) result.push(field)
	}
	return result
}

export function sanitizeDashboardItemBindings(
	item: DashboardItemConfig,
	bindings: unknown
): DashboardItemBindings | undefined {
	if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) return undefined
	const allowed = Object.keys(DASHBOARD_ITEM_BINDABLE_FIELDS[item.kind]) as Array<DashboardBindableField>
	const sanitized: DashboardItemBindings = {}
	let hasBinding = false
	for (const field of allowed) {
		const variableId = (bindings as Record<string, unknown>)[field]
		if (typeof variableId !== 'string' || !variableId) continue
		sanitized[field] = variableId
		hasBinding = true
	}
	return hasBinding ? sanitized : undefined
}

export function getDashboardItemBoundVariableIds(item: DashboardItemConfig): Array<string> {
	const ids: Array<string> = []
	const collect = (bindings: DashboardItemBindings | undefined) => {
		for (const variableId of Object.values(bindings ?? {})) {
			if (variableId && !ids.includes(variableId)) ids.push(variableId)
		}
	}
	if (item.kind === 'multi') {
		for (const chart of item.items) collect(chart.bindings)
	} else if ('bindings' in item) {
		collect(item.bindings)
	}
	return ids
}

export function getDashboardItemBindings(item: DashboardItemConfig): DashboardItemBindings {
	if (item.kind === 'multi') {
		const merged: DashboardItemBindings = {}
		for (const chart of item.items) {
			if (!chart.bindings) continue
			for (const field of Object.keys(chart.bindings) as Array<DashboardBindableField>) {
				const variableId = chart.bindings[field]
				if (variableId && merged[field] === undefined) merged[field] = variableId
			}
		}
		return merged
	}
	return 'bindings' in item && item.bindings ? item.bindings : {}
}
