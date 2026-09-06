import type { ApiDate } from '../../api.types'

export interface UpstreamSeries {
	name: string
	type?: 'bar' | 'line'
	/** `null` for a period the metric wasn't tracked yet, so it's simply not drawn. */
	data: Array<number | null>
}

export interface UpstreamChart {
	title?: string
	subtitle?: string
	/** Longer explainer, shown in a hover tooltip rather than inline. */
	tooltip?: string
	// Flare cache adapters normalize daily and epoch observations to UTC YYYY-MM-DD.
	dates: Array<ApiDate>
	series: Array<UpstreamSeries>
}

export function parseDateToTimestampMs(dateStr: string): number {
	if (/^\d+$/.test(dateStr)) {
		const n = parseInt(dateStr, 10)
		return n > 1e12 ? n : n * 1000
	}
	return Date.parse(dateStr.length === 10 ? `${dateStr}T00:00:00Z` : dateStr)
}
