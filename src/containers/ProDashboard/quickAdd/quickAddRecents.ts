import { getStorageJSON, setStorageJSON } from '~/contexts/localStorageStore'
import { isProDashboardChartType, type ProDashboardChartType } from '../types'
import type { QuickAddSubjectType } from './metricDefaults'

export type QuickAddRecentKind = 'chart' | 'metric' | 'multi' | 'table' | 'text' | 'section'

export interface QuickAddRecent {
	subjectType: QuickAddSubjectType
	id: string
	name: string
	metric?: ProDashboardChartType
	kind: QuickAddRecentKind
}

export const QUICK_ADD_RECENTS_STORAGE_KEY = 'pro-dashboard-quick-add-recents'
export const QUICK_ADD_RECENTS_LIMIT = 8

const RECENT_KINDS: ReadonlySet<string> = new Set<QuickAddRecentKind>([
	'chart',
	'metric',
	'multi',
	'table',
	'text',
	'section'
])

function isQuickAddRecentKind(value: string): value is QuickAddRecentKind {
	return RECENT_KINDS.has(value)
}

export function quickAddRecentKey(recent: QuickAddRecent): string {
	return `${recent.kind}:${recent.subjectType}:${recent.id}:${recent.metric ?? ''}`
}

function parseQuickAddRecent(value: unknown): QuickAddRecent | null {
	if (typeof value !== 'object' || value === null) return null
	const { subjectType, id, name, kind, metric } = value as Record<keyof QuickAddRecent, unknown>
	if (subjectType !== 'protocol' && subjectType !== 'chain') return null
	if (typeof id !== 'string' || id.length === 0) return null
	if (typeof name !== 'string' || name.length === 0) return null
	if (typeof kind !== 'string' || !isQuickAddRecentKind(kind)) return null
	const validMetric = typeof metric === 'string' && isProDashboardChartType(metric) ? metric : undefined
	return {
		subjectType,
		id,
		name,
		kind,
		...(validMetric === undefined ? {} : { metric: validMetric })
	}
}

export function readQuickAddRecents(): Array<QuickAddRecent> {
	const stored = getStorageJSON<unknown>(QUICK_ADD_RECENTS_STORAGE_KEY, [])
	if (!Array.isArray(stored)) return []
	const recents: Array<QuickAddRecent> = []
	const seen = new Set<string>()
	for (const value of stored) {
		const recent = parseQuickAddRecent(value)
		if (recent === null) continue
		const key = quickAddRecentKey(recent)
		if (seen.has(key)) continue
		seen.add(key)
		recents.push(recent)
		if (recents.length === QUICK_ADD_RECENTS_LIMIT) break
	}
	return recents
}

export function pushQuickAddRecent(recent: QuickAddRecent): Array<QuickAddRecent> {
	const key = quickAddRecentKey(recent)
	const next: Array<QuickAddRecent> = [recent]
	for (const existing of readQuickAddRecents()) {
		if (quickAddRecentKey(existing) === key) continue
		next.push(existing)
		if (next.length === QUICK_ADD_RECENTS_LIMIT) break
	}
	setStorageJSON(QUICK_ADD_RECENTS_STORAGE_KEY, next)
	return next
}
