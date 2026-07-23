export interface ChartRepairTarget {
	dashboardId: string
	itemId: string
}

const CHART_REPAIR_TARGET_KEY = 'llamaai-chart-repair-target'

export function parseChartRepairTarget(value: string | null): ChartRepairTarget | null {
	if (!value) return null
	try {
		const parsed = JSON.parse(value) as Partial<ChartRepairTarget>
		return typeof parsed.dashboardId === 'string' &&
			parsed.dashboardId &&
			typeof parsed.itemId === 'string' &&
			parsed.itemId
			? { dashboardId: parsed.dashboardId, itemId: parsed.itemId }
			: null
	} catch {
		return null
	}
}

export function readChartRepairTarget(): ChartRepairTarget | null {
	return typeof window === 'undefined'
		? null
		: parseChartRepairTarget(window.sessionStorage.getItem(CHART_REPAIR_TARGET_KEY))
}

export function storeChartRepairTarget(target: ChartRepairTarget): void {
	window.sessionStorage.setItem(CHART_REPAIR_TARGET_KEY, JSON.stringify(target))
}

export function clearChartRepairTarget(): void {
	window.sessionStorage.removeItem(CHART_REPAIR_TARGET_KEY)
}

export function buildChartRepairHref(title: string, reasonCode?: string): string {
	const reason = reasonCode?.replaceAll('_', ' ') || 'the saved replay can no longer produce valid chart data'
	const prompt = `Regenerate a chart to replace "${title}" on my dashboard. The previous chart failed because ${reason}. Ask me for any missing source or metric details before generating the replacement.`
	return `/ai/chat?prompt=${encodeURIComponent(prompt)}`
}
