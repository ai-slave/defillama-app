type SeriesPoint = [number, number]

export interface ChartSeries {
	name: string
	data: Array<SeriesPoint>
	color?: string
}

type ProtocolBreakdownEntityMetadata =
	| { entityType: 'protocol'; totalProtocols: number }
	| { entityType: 'protocol-family'; totalProtocolFamilies: number }

export interface ProtocolBreakdownData {
	series: Array<ChartSeries>
	metadata: {
		chain: string
		chains: Array<string>
		categories: Array<string>
		metric: string
		topN: number
		othersCount: number
		marketSector: string | null
		error?: string
	} & ProtocolBreakdownEntityMetadata
}

export interface ProtocolChainData {
	series: Array<ChartSeries>
	metadata: {
		protocol: string
		metric: string
		chains: Array<string>
		totalChains: number
		topN?: number
		othersCount?: number
	}
}

export const toSlug = (name = ''): string => name?.toLowerCase().split(' ').join('-').split("'").join('')

const toUtcDay = (ts: number): number => Math.floor(ts / 86_400) * 86_400

export const normalizeDailyPairs = (pairs: Array<SeriesPoint>, mode: 'sum' | 'last'): Array<SeriesPoint> => {
	const daily = new Map<number, number>()
	for (const [ts, v] of pairs) {
		const day = toUtcDay(Number(ts))
		if (mode === 'sum') {
			daily.set(day, (daily.get(day) || 0) + (v || 0))
		} else {
			daily.set(day, v || 0)
		}
	}
	return Array.from(daily.entries()).sort((a, b) => a[0] - b[0]) as Array<SeriesPoint>
}

const startOfTodayUtc = (): number => {
	const now = new Date()
	return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000)
}

export const filterOutToday = (pairs: Array<SeriesPoint>): Array<SeriesPoint> => {
	const today = startOfTodayUtc()
	return pairs.filter(([ts]) => ts < today)
}

export const sumSeriesByTimestamp = (seriesList: Array<Array<SeriesPoint>>): Map<number, number> => {
	const acc = new Map<number, number>()
	for (const series of seriesList) {
		for (const [ts, val] of series) {
			acc.set(ts, (acc.get(ts) || 0) + (val || 0))
		}
	}
	return acc
}

export const alignSeries = (timestamps: Array<number>, series: Array<SeriesPoint>): Array<SeriesPoint> => {
	const map = new Map(series.map(([t, v]) => [t, v]))
	return timestamps.map((t) => [t, map.get(t) || 0])
}

export const buildAlignedTopAndOthers = (
	topSeries: Array<ChartSeries>,
	totalSeries: Array<SeriesPoint>
): { alignedTopSeries: Array<ChartSeries>; othersData: Array<SeriesPoint>; allTimestamps: Array<number> } => {
	const timestampSet = new Set<number>()
	for (const s of topSeries) {
		for (const [t] of s.data) {
			timestampSet.add(t)
		}
	}
	for (const [t] of totalSeries) {
		timestampSet.add(t)
	}
	const allTimestamps = Array.from(timestampSet).sort((a, b) => a - b)

	const alignedTopSeries = topSeries.map((s) => ({
		...s,
		data: alignSeries(allTimestamps, s.data)
	}))

	const alignedTotal = alignSeries(allTimestamps, totalSeries)
	const topSumPerTs = alignSeries(
		allTimestamps,
		Array.from(sumSeriesByTimestamp(alignedTopSeries.map((s) => s.data)).entries()).sort(
			(a, b) => a[0] - b[0]
		) as Array<[number, number]>
	)

	const othersData: Array<SeriesPoint> = allTimestamps.map((t, i) => {
		const total = alignedTotal[i]?.[1] || 0
		const topSum = topSumPerTs[i]?.[1] || 0
		return [t, Math.max(0, total - topSum)]
	})

	return { alignedTopSeries, othersData, allTimestamps }
}
