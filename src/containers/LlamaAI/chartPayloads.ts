import { migrateDashboardItemConfig } from '~/containers/ProDashboard/dashboardConfig/migrate'
import type { PersistedDashboardItemConfig } from '~/containers/ProDashboard/dashboardConfig/persisted'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import type { ChartConfiguration, ChartDataByKey } from './chartTypes'
import type { ChartArtifactRefs, DashboardArtifactOutcome, DashboardChartData } from './types'

function isArtifactVersionId(value: unknown): value is string | null {
	return value === null || typeof value === 'string'
}

function isArtifactStatus(value: unknown): value is ChartArtifactRefs[string]['status'] {
	return value === 'live' || value === 'snapshot-only' || value === 'needs-repair'
}

export function normalizeChartArtifactRefs(value: unknown): ChartArtifactRefs | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
	const refs: ChartArtifactRefs = {}
	for (const [chartId, candidate] of Object.entries(value)) {
		if (!isRecord(candidate)) continue
		const { artifactId, versionId, status, containsPremium, estimatedMaxCostUsd } = candidate
		if (
			typeof artifactId !== 'string' ||
			!artifactId ||
			!isArtifactVersionId(versionId) ||
			!isArtifactStatus(status) ||
			typeof containsPremium !== 'boolean' ||
			typeof estimatedMaxCostUsd !== 'number' ||
			!Number.isFinite(estimatedMaxCostUsd)
		)
			continue
		refs[chartId] = { artifactId, versionId, status, containsPremium, estimatedMaxCostUsd }
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

export function migrateDashboardItems(items: PersistedDashboardItemConfig[] | undefined): DashboardItemConfig[] {
	const migratedItems: DashboardItemConfig[] = []
	for (const item of items ?? []) {
		const migrated = migrateDashboardItemConfig(item)
		if (migrated) migratedItems.push(migrated)
	}
	return migratedItems
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
			data: entry.data,
			toolChain: Array.isArray(entry.toolChain) ? entry.toolChain : []
		}
	}
	return Object.keys(normalized).length > 0 ? normalized : undefined
}
