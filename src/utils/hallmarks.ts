import type { Hack } from '~/containers/Hacks/model'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'

export type HallmarkPoint = [number, string]
export type HallmarkRange = [[number, number], string]
type RawHallmark = HallmarkPoint | HallmarkRange

type HallmarkDimensions = Record<string, { genuineSpikes?: Array<[string, string]>; adapter?: string }> | null

function normalizeHallmarkTimestampToSeconds(timestamp: number): number {
	return timestamp >= 1e12 ? Math.floor(timestamp / 1e3) : timestamp
}

function buildPointHallmarkMap({
	protocolHallmarks,
	dimensions
}: {
	protocolHallmarks?: Array<RawHallmark> | null | undefined
	dimensions?: HallmarkDimensions | undefined
}): Map<number, string> {
	const hallmarkMap = new Map<number, string>()

	for (const [timestampOrRange, label] of protocolHallmarks ?? []) {
		if (!Array.isArray(timestampOrRange) && label !== '-') {
			const timestamp = normalizeHallmarkTimestampToSeconds(timestampOrRange)
			if (!hallmarkMap.has(timestamp)) {
				hallmarkMap.set(timestamp, label)
			}
		}
	}

	if (dimensions) {
		for (const dimensionName in dimensions) {
			const dimension = dimensions[dimensionName]
			if (dimension === undefined) continue
			const spikes = dimension.genuineSpikes
			if (!spikes) continue

			for (const [dateStr, label] of spikes) {
				if (label === '-') continue
				const timestamp = Math.floor(new Date(dateStr).getTime() / 1e3)
				if (!Number.isFinite(timestamp) || hallmarkMap.has(timestamp)) continue
				hallmarkMap.set(timestamp, label)
			}
		}
	}

	return hallmarkMap
}

function buildRangeHallmarks(protocolHallmarks?: Array<RawHallmark> | null): Array<HallmarkRange> {
	const rangeHallmarks: Array<HallmarkRange> = []

	for (const [timestampOrRange, label] of protocolHallmarks ?? []) {
		if (!Array.isArray(timestampOrRange) || label === '-') continue

		const [start, end] = timestampOrRange

		rangeHallmarks.push([[normalizeHallmarkTimestampToSeconds(start), normalizeHallmarkTimestampToSeconds(end)], label])
	}

	return rangeHallmarks
}

/**
 * Convert `dimensions.*.genuineSpikes` tuples from the adapter API into
 * hallmark-compatible `[timestampSeconds, label]` entries and merge them
 * with any pre-existing protocol point hallmarks.
 *
 * Timestamps are in seconds because most chart layers multiply by 1e3 when
 * rendering mark lines.
 */
export function buildHallmarksWithGenuineSpikes({
	protocolHallmarks,
	dimensions
}: {
	protocolHallmarks?: Array<RawHallmark> | null | undefined
	dimensions?: HallmarkDimensions | undefined
}): Array<HallmarkPoint> | null {
	const hallmarkMap = buildPointHallmarkMap({ protocolHallmarks, dimensions })

	if (hallmarkMap.size === 0) return null

	return Array.from(hallmarkMap.entries()).sort((a, b) => a[0] - b[0])
}

// The label leads with what happened, which the event rail also reads to draw the marker red: a bare classification
// such as "Access Control" names neither a hack nor a loss.
function hackHallmarkLabel(hack: Hack) {
	const isRugpull = hack.classification === 'Rugpull'
	const cause = isRugpull ? null : hack.classification || hack.technique
	const lost = formatUsd(hack.amountUsd, USD_LOWERCASE_MILLIONS_OPTIONS)
	return [isRugpull ? 'Rug pull' : 'Hack', cause, lost && `${lost} lost`].filter(Boolean).join(' · ')
}

export function buildProtocolOverviewHallmarks({
	hacks,
	protocolHallmarks,
	dimensions
}: {
	hacks?: Array<Hack> | null
	protocolHallmarks?: Array<RawHallmark> | null | undefined
	dimensions?: HallmarkDimensions | undefined
}): {
	hallmarks: Array<HallmarkPoint>
	rangeHallmarks: Array<HallmarkRange>
} {
	const hallmarks: Array<HallmarkPoint> = []
	for (const hack of hacks ?? []) {
		if (hack.date == null) continue
		hallmarks.push([hack.date, hackHallmarkLabel(hack)])
	}

	const pointHallmarks = buildHallmarksWithGenuineSpikes({ protocolHallmarks, dimensions }) ?? []

	for (const [timestamp, label] of pointHallmarks) {
		hallmarks.push([timestamp, label])
	}

	return {
		hallmarks: hallmarks.sort((a, b) => a[0] - b[0]),
		rangeHallmarks: buildRangeHallmarks(protocolHallmarks)
	}
}
