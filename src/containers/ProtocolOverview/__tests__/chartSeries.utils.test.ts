import { describe, expect, it } from 'vitest'
import {
	normalizeBridgeVolumeToChartMs,
	normalizeChartPointsToMs,
	normalizeSeriesToMilliseconds,
	normalizeSeriesToSeconds
} from '../chartSeries.utils'

describe('ProtocolOverview chart series normalization', () => {
	it('keeps raw boundary normalization for seconds, milliseconds, and invalid points', () => {
		expect(
			normalizeChartPointsToMs([
				[1_700_000_000_000, 1],
				[1_700_000_100, 2],
				['bad', 3],
				[1_700_000_200, '4'],
				[1_700_000_300]
			])
		).toEqual([
			[1_700_000_000_000, 1],
			[1_700_000_100_000, 2],
			[1_700_000_200_000, 4]
		])
	})

	it('normalizes mixed second and millisecond timestamps to seconds', () => {
		expect(
			normalizeSeriesToSeconds([
				[1_700_000_000, 1],
				[1_700_000_100_000, 2]
			])
		).toEqual([
			[1_700_000_000, 1],
			[1_700_000_100, 2]
		])
	})

	it('normalizes mixed second and millisecond timestamps to milliseconds', () => {
		expect(
			normalizeSeriesToMilliseconds([
				[1_700_000_000_000, 1],
				[1_700_000_100, 2]
			])
		).toEqual([
			[1_700_000_000_000, 1],
			[1_700_000_100_000, 2]
		])
	})

	it('aggregates adjacent bridge rows while preserving the ascending API order', () => {
		expect(
			normalizeBridgeVolumeToChartMs([
				{ date: '1', depositUSD: 10, withdrawUSD: 2 },
				{ date: '1', depositUSD: 4, withdrawUSD: 0 },
				{ date: '2', depositUSD: 8, withdrawUSD: 2 }
			])
		).toEqual([
			[1_000, 8],
			[2_000, 5]
		])
	})
})
