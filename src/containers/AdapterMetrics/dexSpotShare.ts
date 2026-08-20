import type { ChartTimeGrouping, MultiSeriesTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import { formatNumber } from '~/utils/numberFormat'

export const DEFAULT_DEX_SPOT_SHARE_GROUPING: ChartTimeGrouping = 'monthly'

export interface CexSpotVolumeSeries {
	/** UTC day timestamps in seconds, aligned to `values`. */
	days: number[]
	values: Array<number | null>
}

export function buildDexSpotShareMethodology({
	dexProtocolCount,
	cexVenueCount
}: {
	dexProtocolCount: number
	cexVenueCount: number | null
}): string {
	const coverage =
		cexVenueCount == null
			? `${formatNumber(dexProtocolCount)} DEX protocols`
			: `${formatNumber(dexProtocolCount)} DEX protocols and ${formatNumber(cexVenueCount)} CEX venues`
	return `DEX share = DEX / (DEX + CEX) × 100. Spot volume only, including order-book DEXs such as Hyperliquid. Current coverage: ${coverage}.`
}

export function parseDexSpotShareGrouping(value: string | undefined): ChartTimeGrouping {
	switch (value) {
		case 'daily':
		case 'weekly':
		case 'monthly':
		case 'quarterly':
		case 'yearly':
			return value
		default:
			return DEFAULT_DEX_SPOT_SHARE_GROUPING
	}
}

type VolumeBucket = {
	dex: number
	cex: number
	complete: boolean
	observed: boolean
}

const UTC_DAY_MS = 24 * 60 * 60 * 1000

function utcDay(timestampMs: number): number {
	return Math.floor(timestampMs / UTC_DAY_MS) * UTC_DAY_MS
}

export function buildDexSpotShareDataset({
	dexVolume,
	cexVolume,
	groupBy
}: {
	dexVolume: MultiSeriesTimeSeriesDataset
	cexVolume: CexSpotVolumeSeries
	groupBy: ChartTimeGrouping
}): MultiSeriesTimeSeriesDataset {
	const dexByDay = new Map<number, number | null>()
	let firstDexDay = Infinity
	let lastDexDay = -Infinity
	for (const row of dexVolume.source) {
		const day = utcDay(row[0])
		dexByDay.set(day, row[1] ?? null)
		if (day < firstDexDay) firstDexDay = day
		if (day > lastDexDay) lastDexDay = day
	}

	const cexByDay = new Map<number, number | null>()
	let firstCexDay = Infinity
	let lastCexDay = -Infinity
	for (let index = 0; index < cexVolume.days.length; index++) {
		const day = utcDay(cexVolume.days[index]! * 1000)
		cexByDay.set(day, cexVolume.values[index] ?? null)
		if (day < firstCexDay) firstCexDay = day
		if (day > lastCexDay) lastCexDay = day
	}

	const firstSharedDay = Math.max(firstDexDay, firstCexDay)
	const lastSharedDay = Math.min(lastDexDay, lastCexDay)
	if (firstSharedDay > lastSharedDay) return { dimensions: ['timestamp', 'DEX Share'], source: [] }

	const buckets = new Map<number, VolumeBucket>()
	for (let day = firstSharedDay; day <= lastSharedDay; day += UTC_DAY_MS) {
		const bucketTimestamp = getBucketTimestampMs(day, groupBy)
		let bucket = buckets.get(bucketTimestamp)
		if (!bucket) {
			bucket = { dex: 0, cex: 0, complete: true, observed: false }
			buckets.set(bucketTimestamp, bucket)
		}

		const dex = dexByDay.get(day)
		const cex = cexByDay.get(day)
		if (dex == null || cex == null) {
			bucket.complete = false
			continue
		}
		bucket.dex += dex
		bucket.cex += cex
		bucket.observed = true
	}

	const source: MultiSeriesTimeSeriesDataset['source'] = []
	for (const [timestamp, bucket] of buckets) {
		const total = bucket.dex + bucket.cex
		source.push([timestamp, bucket.complete && bucket.observed && total > 0 ? (bucket.dex / total) * 100 : null])
	}

	return { dimensions: ['timestamp', 'DEX Share'], source }
}
