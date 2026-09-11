import type { PoolHistoryRange } from './types'

export const DAY_MS = 86_400_000

export function isoDay(timestamp: number): string {
	return new Date(timestamp).toISOString().slice(0, 10)
}

export interface TimeBand<Kind extends string> {
	from: number
	to: number
	kind: Kind
}

type BandFill<Kind extends string> = Readonly<Record<Kind, readonly [light: string, dark: string]>>
type MarkAreaPoint = { xAxis: number; itemStyle?: { color: string } }

/** ECharts shading shared by the measured growth and exit-liquidity timelines. */
export function buildBandMarkArea<Kind extends string>(
	bands: ReadonlyArray<TimeBand<Kind>>,
	fills: BandFill<Kind>,
	isDark: boolean
): { silent: true; data: Array<[MarkAreaPoint, MarkAreaPoint]> } | undefined {
	if (bands.length === 0) return undefined
	return {
		silent: true,
		data: bands.map((band) => [
			{
				xAxis: band.from - DAY_MS / 2,
				itemStyle: { color: fills[band.kind][isDark ? 1 : 0] }
			},
			{ xAxis: band.to + DAY_MS / 2 }
		])
	}
}

const RANGE_RANK: Readonly<Record<PoolHistoryRange, number>> = { '30d': 0, '90d': 1, max: 2 }

/** True when a loaded nested range already contains every point requested by `range`. */
export function rangeCovers(loaded: PoolHistoryRange, range: PoolHistoryRange): boolean {
	return RANGE_RANK[range] <= RANGE_RANK[loaded]
}

export function widestNestedRange(ranges: readonly [PoolHistoryRange, ...Array<PoolHistoryRange>]): PoolHistoryRange {
	let widest: PoolHistoryRange = ranges[0]
	for (const range of ranges) if (!rangeCovers(widest, range)) widest = range
	return widest
}

/** How many trailing days of a `total`-day series the range shows. */
export function rangeCount(range: PoolHistoryRange, total: number): number {
	if (range === '30d') return Math.min(30, total)
	if (range === '90d') return Math.min(90, total)
	return total
}
