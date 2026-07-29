import { describe, expect, it } from 'vitest'
import {
	getProtocolBridgeVolumeMetrics,
	normalizeBridgeVolumeToChartMs,
	normalizeChartPointsToMs,
	normalizeSeriesToMilliseconds,
	normalizeSeriesToSeconds
} from '../chartSeries.utils'

describe('ProtocolOverview chart series normalization', () => {
	it('normalizes the exact numeric producer tuple contract from seconds or milliseconds', () => {
		expect(
			normalizeChartPointsToMs([
				[1_700_000_000_000, 1],
				[1_700_000_100, 2],
				[1_700_000_200, 4]
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
				{ date: 1, depositUSD: 10, withdrawUSD: 2 },
				{ date: 1, depositUSD: 4, withdrawUSD: 0 },
				{ date: 2, depositUSD: 8, withdrawUSD: 2 }
			])
		).toEqual([
			[1_000, 8],
			[2_000, 5]
		])
	})

	it('preserves bridge-volume dates whose gross volume is unknown', () => {
		expect(
			normalizeBridgeVolumeToChartMs([
				{ date: 1, depositUSD: 10, withdrawUSD: null },
				{ date: 2, depositUSD: null, withdrawUSD: 4 },
				{ date: 3, depositUSD: 6, withdrawUSD: 2 }
			])
		).toEqual([
			[1_000, null],
			[2_000, null],
			[3_000, 4]
		])
	})

	it('uses exact completed UTC days, merges duplicate rows, preserves zero, and excludes the current day', () => {
		const sec = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1e3
		expect(
			getProtocolBridgeVolumeMetrics(
				[
					{ date: sec('2022-09-01'), depositUSD: 3, withdrawUSD: 1 },
					{ date: sec('2022-09-02'), depositUSD: 2, withdrawUSD: 2 },
					{ date: sec('2022-09-02'), depositUSD: 4, withdrawUSD: 2 },
					{ date: sec('2022-09-03'), depositUSD: 0, withdrawUSD: 0 },
					{ date: sec('2022-09-04'), depositUSD: 1_000, withdrawUSD: 1_000 }
				],
				Date.parse('2022-09-04T12:00:00Z')
			)
		).toEqual({
			lastCompletedDay: 0,
			sevenCompletedDays: 7,
			thirtyCompletedDays: 7,
			sinceDataStart: 7
		})
	})

	it('null-propagates an explicit unknown leg while treating omitted dates as zero activity', () => {
		const currentTimeMs = Date.parse('2026-07-14T12:00:00Z')
		const data: Array<{ date: number; depositUSD: number; withdrawUSD: number | null }> = Array.from(
			{ length: 30 },
			(_, index) => ({
				date: (Date.parse('2026-06-14T00:00:00Z') + index * 86_400_000) / 1e3,
				depositUSD: 10,
				withdrawUSD: 2
			})
		)
		data.push({ date: Date.parse('2026-07-10T12:00:00Z') / 1e3, depositUSD: 10, withdrawUSD: null })

		expect(getProtocolBridgeVolumeMetrics(data, currentTimeMs)).toEqual({
			lastCompletedDay: 6,
			sevenCompletedDays: null,
			thirtyCompletedDays: null,
			sinceDataStart: null
		})
	})
})
