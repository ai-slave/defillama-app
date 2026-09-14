import type { Dashboard } from '../dashboardTypes'

export const TRENDING_TAGS = ['DeFi', 'Stablecoins', 'Yields', 'L2', 'Fees', 'Revenue', 'RWA', 'Perps'] as const

export const DISCOVERY_TAG_LIMIT = 8
const DISCOVERY_TAG_MIN_DASHBOARDS = 2
const DISCOVERY_TAG_FALLBACK_THRESHOLD = 4

export function flattenDiscoveryCategories(
	categories: Record<string, { dashboards: ReadonlyArray<Dashboard> }>
): Array<Dashboard> {
	return Object.values(categories).flatMap((category) => category.dashboards)
}

export function rankDiscoveryTags(
	dashboards: ReadonlyArray<Pick<Dashboard, 'id' | 'tags'>>,
	limit = DISCOVERY_TAG_LIMIT
): Array<string> {
	const seenDashboards = new Set<string>()
	const stats = new Map<string, { count: number; forms: Map<string, number> }>()
	for (const dashboard of dashboards) {
		if (seenDashboards.has(dashboard.id)) continue
		seenDashboards.add(dashboard.id)
		const tagsInDashboard = new Set<string>()
		for (const rawTag of dashboard.tags ?? []) {
			if (typeof rawTag !== 'string') continue
			const form = rawTag.trim()
			if (!form) continue
			const key = form.toLowerCase()
			if (tagsInDashboard.has(key)) continue
			tagsInDashboard.add(key)
			const entry = stats.get(key) ?? { count: 0, forms: new Map() }
			entry.count++
			entry.forms.set(form, (entry.forms.get(form) ?? 0) + 1)
			stats.set(key, entry)
		}
	}
	const qualified = Array.from(stats.entries())
		.filter(([, entry]) => entry.count >= DISCOVERY_TAG_MIN_DASHBOARDS)
		.sort(([keyA, a], [keyB, b]) => b.count - a.count || keyA.localeCompare(keyB))
	if (qualified.length < DISCOVERY_TAG_FALLBACK_THRESHOLD) return [...TRENDING_TAGS].slice(0, limit)
	return qualified.slice(0, limit).map(([, entry]) => {
		let best = ''
		let bestCount = -1
		for (const [form, count] of entry.forms) {
			if (count > bestCount) {
				best = form
				bestCount = count
			}
		}
		return best
	})
}
