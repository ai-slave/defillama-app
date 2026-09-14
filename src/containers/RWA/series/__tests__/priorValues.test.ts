import { describe, expect, test } from 'vitest'
import { buildRwaPriorIndex, getRwaPriorValue, indexRwaMetricSeries } from '../priorValues'

const DAY = 86_400
const latest = 1_800_000_000
const day = (offset: number) => latest + offset * DAY

const series = [
	{ timestamp: day(-9), alpha: 90, beta: 5 },
	{ timestamp: day(-8), alpha: 80 },
	{ timestamp: day(-7), alpha: 70, beta: 7 },
	{ timestamp: day(-6), alpha: 60 },
	{ timestamp: day(-2), alpha: 20, gamma: 2 },
	{ timestamp: latest, alpha: 10, beta: 1, gamma: 3 }
]

describe('getRwaPriorValue', () => {
	const index = indexRwaMetricSeries(series)!

	test('takes the point exactly seven days before the latest', () => {
		expect(getRwaPriorValue(index, 'alpha')).toBe(70)
		expect(getRwaPriorValue(index, 'beta')).toBe(7)
	})

	test('falls back to the closest earlier point within one day, not beyond', () => {
		const withGap = indexRwaMetricSeries(series.filter((row) => row.timestamp !== day(-7)))!
		expect(getRwaPriorValue(withGap, 'alpha')).toBe(80)
		expect(getRwaPriorValue(withGap, 'beta')).toBeNull()
	})

	test('is zero for an asset whose series starts inside the window', () => {
		expect(getRwaPriorValue(index, 'gamma')).toBe(0)
	})

	test('is unavailable for an asset with a gap around the target', () => {
		const sparse = indexRwaMetricSeries([
			{ timestamp: day(-30), delta: 1 },
			{ timestamp: day(-3), delta: 2 },
			{ timestamp: latest, delta: 3 }
		])!
		expect(getRwaPriorValue(sparse, 'delta')).toBeNull()
	})

	test('is unavailable for an unknown asset', () => {
		expect(getRwaPriorValue(index, 'omega')).toBeNull()
	})

	test('handles unsorted rows', () => {
		const shuffled = indexRwaMetricSeries(series.slice().reverse())!
		expect(getRwaPriorValue(shuffled, 'alpha')).toBe(70)
	})
})

describe('buildRwaPriorIndex', () => {
	test('returns every metric and the first seen time in milliseconds', () => {
		const index = buildRwaPriorIndex({
			activeMcap: series,
			onChainMcap: series,
			defiActiveTvl: [{ timestamp: latest, alpha: 4 }],
			bridgeTvl: [
				{ timestamp: day(-7), alpha: 1 },
				{ timestamp: latest, alpha: 2 }
			]
		})
		expect(index.priors('alpha')['7d']).toEqual({ activeMcap: 70, onChainMcap: 70, defiActiveTvl: 0, bridgeTvl: 1 })
		// One day back has no point, so the two-day point inside the tolerance counts; bridge has none there.
		expect(index.priors('alpha')['1d']).toEqual({ activeMcap: 20, onChainMcap: 20, defiActiveTvl: 0, bridgeTvl: null })
		// Thirty days back is before every series started: the asset did not exist, so zero everywhere.
		expect(index.priors('alpha')['1m']).toEqual({ activeMcap: 0, onChainMcap: 0, defiActiveTvl: 0, bridgeTvl: 0 })
		expect(index.priors('gamma')['7d']).toEqual({ activeMcap: 0, onChainMcap: 0, defiActiveTvl: 0, bridgeTvl: 0 })
		expect(index.priors('omega')['7d']).toEqual({
			activeMcap: null,
			onChainMcap: null,
			defiActiveTvl: null,
			bridgeTvl: null
		})
		expect(index.firstSeenMs('gamma')).toBe(day(-2) * 1e3)
		expect(index.firstSeenMs('omega')).toBeNull()
		expect(index.latestMs).toBe(latest * 1e3)
	})

	test('is empty without series data', () => {
		const index = buildRwaPriorIndex(null)
		expect(index.priors('alpha')['7d']).toEqual({
			activeMcap: null,
			onChainMcap: null,
			defiActiveTvl: null,
			bridgeTvl: null
		})
		expect(index.firstSeenMs('alpha')).toBeNull()
		expect(index.latestMs).toBeNull()
	})

	test('treats an empty series as no data', () => {
		expect(indexRwaMetricSeries([])).toBeNull()
		expect(indexRwaMetricSeries(undefined)).toBeNull()
	})
})
