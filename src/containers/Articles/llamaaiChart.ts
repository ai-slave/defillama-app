import type { ChartConfiguration } from '~/containers/LlamaAI/types'

export type LlamaAIChartData = unknown[] | Record<string, unknown[]>

export type LlamaAIChartAttrs = {
	chartConfig: ChartConfiguration
	chartData: LlamaAIChartData
	caption: string
	savedChartId: string | null
}

export const LLAMAAI_CHART_MAX_POINTS_PER_SERIES = 2000
// Client-side cap kept below the features-server backstop (512KB) so a valid
// insert can never be rejected on save.
export const LLAMAAI_CHART_MAX_DATA_BYTES = 400 * 1024

export function validateLlamaAIChartConfig(value: unknown): ChartConfiguration | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	const candidate = value as Partial<ChartConfiguration>
	if (typeof candidate.id !== 'string' || !candidate.id) return null
	if (typeof candidate.type !== 'string' || !candidate.type) return null
	if (typeof candidate.title !== 'string') return null
	return value as ChartConfiguration
}

function downsampleRows<T>(rows: T[], maxPoints: number): T[] {
	if (rows.length <= maxPoints) return rows
	const stride = (rows.length - 1) / (maxPoints - 1)
	const out: T[] = []
	for (let i = 0; i < maxPoints; i++) {
		out.push(rows[Math.round(i * stride)])
	}
	return out
}

export function downsampleChartData(
	data: LlamaAIChartData,
	maxPointsPerSeries = LLAMAAI_CHART_MAX_POINTS_PER_SERIES
): LlamaAIChartData {
	if (Array.isArray(data)) return downsampleRows(data, maxPointsPerSeries)
	let changed = false
	const out: Record<string, unknown[]> = {}
	for (const key in data) {
		const rows = data[key]
		const sampled = Array.isArray(rows) ? downsampleRows(rows, maxPointsPerSeries) : rows
		if (sampled !== rows) changed = true
		out[key] = sampled
	}
	return changed ? out : data
}
