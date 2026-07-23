import type {
	ChartArtifactRefs,
	ChartConfiguration,
	ChartDataByKey,
	ChartDataSeries,
	DashboardArtifactOutcome,
	DashboardChartData,
	DashboardItem
} from './types'

export function normalizeChartArtifactRefs(value: unknown): ChartArtifactRefs | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
	const refs: ChartArtifactRefs = {}
	for (const [chartId, candidate] of Object.entries(value)) {
		if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
		const ref = candidate as Record<string, unknown>
		if (
			typeof ref.artifactId !== 'string' ||
			!ref.artifactId ||
			(ref.versionId !== null && typeof ref.versionId !== 'string') ||
			!['live', 'snapshot-only', 'needs-repair'].includes(String(ref.status)) ||
			typeof ref.containsPremium !== 'boolean' ||
			typeof ref.estimatedMaxCostUsd !== 'number' ||
			!Number.isFinite(ref.estimatedMaxCostUsd)
		)
			continue
		refs[chartId] = ref as unknown as ChartArtifactRefs[string]
	}
	return Object.keys(refs).length > 0 ? refs : undefined
}

// These values enter from JSON.parse'd SSE frames and raw Postgres JSONB session
// restore. Static chart types describe the intended contract; this file keeps
// old sessions and partial backend rollouts from reaching render code unfiltered.
function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(value: Record<string, unknown>, key: string) {
	return Object.prototype.hasOwnProperty.call(value, key)
}

function isUnsafeRecordKey(key: string) {
	return key === '__proto__' || key === 'constructor' || key === 'prototype'
}

function isLikelyChartConfiguration(value: unknown): value is ChartConfiguration {
	if (!isRecord(value)) return false
	if (typeof value.id !== 'string' || value.id.length === 0) return false
	if (typeof value.type !== 'string') return false
	const axes = value.axes
	return isRecord(axes) && isRecord(axes.x) && Array.isArray(axes.yAxes) && Array.isArray(value.series)
}

export function normalizeChartConfigs(value: unknown): ChartConfiguration[] {
	if (!Array.isArray(value)) return []
	const charts: ChartConfiguration[] = []
	for (const item of value) {
		if (isLikelyChartConfiguration(item)) charts.push(item)
	}
	return charts
}

function firstDatasetKey(charts?: ChartConfiguration[]) {
	return charts?.[0]?.datasetName || charts?.[0]?.id || 'default'
}

export function normalizeChartDataByKey(value: unknown, charts?: ChartConfiguration[]): ChartDataByKey {
	if (Array.isArray(value)) {
		// Sessions before the backend keyed-chart-data transition stored one flat row array.
		return { [firstDatasetKey(charts)]: value }
	}
	if (!isRecord(value)) return {}

	const normalized: ChartDataByKey = {}
	for (const key in value) {
		if (!hasOwn(value, key) || isUnsafeRecordKey(key)) continue
		const rows = value[key]
		if (Array.isArray(rows)) normalized[key] = rows
	}
	return normalized
}

export function normalizeDashboardItems(value: unknown): DashboardItem[] {
	if (!Array.isArray(value)) return []
	const items: DashboardItem[] = []
	for (const item of value) {
		if (isRecord(item) && typeof item.kind === 'string') items.push(item as unknown as DashboardItem)
	}
	return items
}

export function normalizeDashboardArtifactOutcomes(value: unknown): DashboardArtifactOutcome[] | undefined {
	if (!Array.isArray(value)) return undefined
	const outcomes = value.filter((entry): entry is DashboardArtifactOutcome => {
		if (!isRecord(entry)) return false
		return (
			typeof entry.itemId === 'string' &&
			typeof entry.chartRef === 'string' &&
			(entry.artifactId === null || typeof entry.artifactId === 'string') &&
			(entry.versionId === null || typeof entry.versionId === 'string') &&
			['live', 'snapshot-only', 'needs-repair'].includes(String(entry.status)) &&
			typeof entry.containsPremium === 'boolean' &&
			typeof entry.estimatedMaxCostUsd === 'number'
		)
	})
	return outcomes.length > 0 ? outcomes : undefined
}

export function normalizeDashboardChartData(value: unknown): DashboardChartData | undefined {
	if (!isRecord(value)) return undefined
	const normalized: DashboardChartData = {}
	for (const key in value) {
		if (!hasOwn(value, key) || isUnsafeRecordKey(key)) continue
		const entry = value[key]
		if (!isRecord(entry) || !isLikelyChartConfiguration(entry.config) || !Array.isArray(entry.data)) continue
		normalized[key] = {
			config: entry.config,
			data: entry.data as ChartDataSeries,
			toolChain: Array.isArray(entry.toolChain) ? entry.toolChain : []
		}
	}
	return Object.keys(normalized).length > 0 ? normalized : undefined
}
