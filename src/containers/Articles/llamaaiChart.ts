import {
	isChartConfiguration,
	isChartData,
	type ChartConfiguration,
	type ChartDataByKey,
	type ChartDataSeries
} from '~/containers/LlamaAI/chartTypes'

export type LlamaAIChartAttrs = {
	chartConfig: ChartConfiguration
	chartData: ChartDataSeries | ChartDataByKey
	caption: string
	savedChartId: string | null
}

export const LLAMAAI_CHART_MAX_POINTS_PER_SERIES = 2000
// Client-side cap kept below the features-server backstop (512KB) so a valid
// insert can never be rejected on save.
export const LLAMAAI_CHART_MAX_DATA_BYTES = 400 * 1024

function downsampleRows<T>(rows: Array<T>, maxPoints: number): Array<T> {
	if (rows.length <= maxPoints) return rows
	const stride = (rows.length - 1) / (maxPoints - 1)
	const out: Array<T> = []
	for (let i = 0; i < maxPoints; i++) {
		const row = rows[Math.round(i * stride)]
		if (row !== undefined) out.push(row)
	}
	return out
}

export function downsampleChartData<T>(data: Array<T>, maxPointsPerSeries?: number): Array<T>
export function downsampleChartData<T>(
	data: Record<string, Array<T>>,
	maxPointsPerSeries?: number
): Record<string, Array<T>>
export function downsampleChartData(
	data: ChartDataSeries | ChartDataByKey,
	maxPointsPerSeries?: number
): ChartDataSeries | ChartDataByKey
export function downsampleChartData(
	data: ChartDataSeries | ChartDataByKey,
	maxPointsPerSeries = LLAMAAI_CHART_MAX_POINTS_PER_SERIES
): ChartDataSeries | ChartDataByKey {
	if (Array.isArray(data)) return downsampleRows(data, maxPointsPerSeries)
	let changed = false
	const out: Record<string, Array<unknown>> = {}
	for (const key in data) {
		const rows = data[key]
		if (!rows) continue
		const sampled = downsampleRows(rows, maxPointsPerSeries)
		if (sampled !== rows) changed = true
		out[key] = sampled
	}
	return changed ? out : data
}

function hasRows(data: ChartDataSeries | ChartDataByKey): boolean {
	if (Array.isArray(data)) return data.length > 0
	for (const key in data) {
		if (data[key]?.length) return true
	}
	return false
}

export function createLlamaAIChartAttrs(config: unknown, data: unknown): LlamaAIChartAttrs | null {
	if (!isChartConfiguration(config) || !isChartData(data) || !hasRows(data)) return null
	const sampled = downsampleChartData(data)
	if (JSON.stringify(sampled).length > LLAMAAI_CHART_MAX_DATA_BYTES) return null
	return { chartConfig: config, chartData: sampled, caption: '', savedChartId: null }
}
