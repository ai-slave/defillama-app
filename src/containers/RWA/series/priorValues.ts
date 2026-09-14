import type { IRWAChartDataByAsset, IRWAChartMetricRows, RWAPrior, RWAPriorPeriod, RWAPriors } from '../api.types'

const DAY_SECONDS = 86_400
export const RWA_PRIOR_WINDOW_DAYS = 7
export const RWA_PRIOR_PERIOD_DAYS: Record<RWAPriorPeriod, number> = { '1d': 1, '7d': 7, '1m': 30 }
/** A daily series may miss the exact day. */
export const RWA_PRIOR_TOLERANCE_SECONDS = DAY_SECONDS

type RWAPriorMetric = keyof RWAPrior

type RWAMetricSeriesIndex = {
	latest: number
	/** Rows inside the prior window, latest first. */
	candidates: IRWAChartMetricRows
	/** Latest point minus the window. */
	target: number
	firstSeen: Map<string, number>
}

export type RWAPriorIndex = {
	priors: (assetKey: string) => RWAPriors
	firstSeenMs: (assetKey: string) => number | null
	/** Latest onchain mcap point in ms, the page's reference for time windows. */
	latestMs: number | null
}

const EMPTY_PRIOR: RWAPrior = { activeMcap: null, onChainMcap: null, defiActiveTvl: null, bridgeTvl: null }
const EMPTY_PRIORS: RWAPriors = { '1d': EMPTY_PRIOR, '7d': EMPTY_PRIOR, '1m': EMPTY_PRIOR }

/** No carry-forward: the closest point within tolerance, 0 before the series starts, null on a gap. */
export function getRwaPriorValue(index: RWAMetricSeriesIndex, assetKey: string): number | null {
	for (const row of index.candidates) {
		const value = row[assetKey]
		if (value != null) return value
	}
	const firstSeen = index.firstSeen.get(assetKey)
	if (firstSeen == null) return null
	return firstSeen > index.target ? 0 : null
}

export function indexRwaMetricSeries(
	rows: IRWAChartMetricRows | undefined,
	options: { windowDays?: number; toleranceSeconds?: number } = {}
): RWAMetricSeriesIndex | null {
	if (!rows || rows.length === 0) return null
	const sorted = rows.slice().sort((a, b) => a.timestamp - b.timestamp)
	const latest = sorted[sorted.length - 1].timestamp
	const target = latest - (options.windowDays ?? RWA_PRIOR_WINDOW_DAYS) * DAY_SECONDS
	const earliest = target - (options.toleranceSeconds ?? RWA_PRIOR_TOLERANCE_SECONDS)

	const candidates: IRWAChartMetricRows = []
	const firstSeen = new Map<string, number>()
	for (const row of sorted) {
		for (const key in row) {
			if (key === 'timestamp' || row[key] == null || firstSeen.has(key)) continue
			firstSeen.set(key, row.timestamp)
		}
		if (row.timestamp >= earliest && row.timestamp <= target) candidates.unshift(row)
	}

	return { latest, candidates, target, firstSeen }
}

export function buildRwaPriorIndex(data: IRWAChartDataByAsset | null | undefined): RWAPriorIndex {
	if (!data) return { priors: () => EMPTY_PRIORS, firstSeenMs: () => null, latestMs: null }

	const metrics: Record<RWAPriorMetric, IRWAChartMetricRows | undefined> = {
		activeMcap: data.activeMcap,
		onChainMcap: data.onChainMcap,
		defiActiveTvl: data.defiActiveTvl,
		bridgeTvl: data.bridgeTvl
	}
	const periods = Object.keys(RWA_PRIOR_PERIOD_DAYS) as Array<RWAPriorPeriod>
	const indexes = Object.fromEntries(
		periods.map((period) => [
			period,
			Object.fromEntries(
				(Object.keys(metrics) as Array<RWAPriorMetric>).map((metric) => [
					metric,
					indexRwaMetricSeries(metrics[metric], { windowDays: RWA_PRIOR_PERIOD_DAYS[period] })
				])
			)
		])
	) as Record<RWAPriorPeriod, Record<RWAPriorMetric, RWAMetricSeriesIndex | null>>
	const onChain = indexRwaMetricSeries(data.onChainMcap)
	const onChainFirstSeen = onChain?.firstSeen

	return {
		priors: (assetKey) => {
			// Unknown to the series: every prior stays null.
			if (!onChainFirstSeen?.has(assetKey)) return EMPTY_PRIORS
			const out = {} as RWAPriors
			for (const period of periods) {
				out[period] = {
					activeMcap: priorFor(indexes[period].activeMcap, assetKey),
					onChainMcap: priorFor(indexes[period].onChainMcap, assetKey),
					defiActiveTvl: priorFor(indexes[period].defiActiveTvl, assetKey),
					bridgeTvl: priorFor(indexes[period].bridgeTvl, assetKey)
				}
			}
			return out
		},
		firstSeenMs: (assetKey) => {
			const seconds = onChainFirstSeen?.get(assetKey)
			return seconds == null ? null : seconds * 1e3
		},
		latestMs: onChain ? onChain.latest * 1e3 : null
	}
}

/** A known asset with no series for a metric never had it: 0, not a gap. */
function priorFor(index: RWAMetricSeriesIndex | null, assetKey: string): number | null {
	if (!index || !index.firstSeen.has(assetKey)) return 0
	return getRwaPriorValue(index, assetKey)
}
