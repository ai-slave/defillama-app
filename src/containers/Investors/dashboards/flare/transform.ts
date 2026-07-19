export interface UpstreamSeries {
	name: string
	type?: 'bar' | 'line'
	data: number[]
}

export interface UpstreamChart {
	title?: string
	subtitle?: string
	dates: string[]
	series: UpstreamSeries[]
}

export function parseDateToTimestampMs(dateStr: string): number {
	if (/^\d+$/.test(dateStr)) {
		const n = parseInt(dateStr, 10)
		return n > 1e12 ? n : n * 1000
	}
	return Date.parse(dateStr.length === 10 ? dateStr + 'T00:00:00Z' : dateStr)
}
