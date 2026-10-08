import type { RWAPerpsContractOverlayRow } from '../api.types'
import { normalizeRwaAssetGroup } from '../assetGroup'
import type { RWAChartRow } from '../chartDataset'
import { changeOver, RWA_CARD_BARS, type RwaNamedBar, type RwaPerpsSplitCards } from './cardData'

/** The perps cards' build-time part, read while no filter is set: the server's venue split behind Change by Venue and
    the daily volume of every market behind the Volume card (the last RWA_CARD_VOLUME_DAYS plus a week), each in the
    two variants the split routes serve, DEX and CEX or DEX only. */
export type RwaPerpsCards = {
	venueChange: RwaPerpsSplitCards
	volume: { withCex: Array<[number, number]>; dexOnly: Array<[number, number]> }
}

export const RWA_CARD_VOLUME_DAYS = 90
export const RWA_CARD_VOLUME_WINDOW = 7
type RwaPerpsVolumeCard = { value: number | null; changePct: number | null; series: Array<[number, number]> }

/** Daily totals into their 7 day average, one point per day over the last `days`; a day short of a week averages what it has. */
export function averageRwaWeekly(
	daily: ReadonlyArray<readonly [number, number]>,
	days = RWA_CARD_VOLUME_DAYS,
	window = RWA_CARD_VOLUME_WINDOW
): Array<[number, number]> {
	const sorted = [...daily].sort((a, b) => a[0] - b[0])
	const out: Array<[number, number]> = []
	for (let i = Math.max(0, sorted.length - days); i < sorted.length; i++) {
		const slice = sorted.slice(Math.max(0, i - window + 1), i + 1)
		out.push([sorted[i][0], slice.reduce((sum, [, value]) => sum + value, 0) / slice.length])
	}
	return out
}

/** The Volume card: today's 7 day average, its change against a week earlier, and the averaged line. */
export function buildRwaPerpsVolumeCard(daily: ReadonlyArray<readonly [number, number]>): RwaPerpsVolumeCard {
	const series = averageRwaWeekly(daily)
	const latest = series[series.length - 1]
	return { value: latest ? latest[1] : null, changePct: changeOver(series, RWA_CARD_VOLUME_WINDOW).changePct, series }
}

function rankByValue(totals: Map<string, number>, max: number): Array<RwaNamedBar> {
	return Array.from(totals.entries())
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, max)
		.map(([name, value]) => ({ name, value }))
}

/** Open interest per asset group of the markets' underlyings, largest first. */
export function rankRwaPerpsOpenInterest(
	markets: Array<RWAPerpsContractOverlayRow>,
	max = RWA_CARD_BARS
): Array<RwaNamedBar> {
	const totals = new Map<string, number>()
	for (const market of markets) {
		if (market.openInterest == null || market.openInterest <= 0) continue
		const key = normalizeRwaAssetGroup(market.assetGroup)
		totals.set(key, (totals.get(key) ?? 0) + market.openInterest)
	}
	return rankByValue(totals, max)
}

/** One series per name, as the per-market history fold hands them, into split rows by time; a missing point stays out. */
export function toRwaSplitRows(series: Record<string, Array<[number, number]>>): Array<RWAChartRow> {
	const rows = new Map<number, RWAChartRow>()
	for (const [name, points] of Object.entries(series)) {
		for (const [timestamp, value] of points) {
			const row = rows.get(timestamp) ?? { timestamp }
			row[name] = value
			rows.set(timestamp, row)
		}
	}
	return Array.from(rows.values()).sort((a, b) => a.timestamp - b.timestamp)
}
