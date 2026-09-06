import { describe, expect, test } from 'vitest'
import { buildSingleMetricChartDataset } from './singleMetricChart'

describe('buildSingleMetricChartDataset', () => {
	test('normalizes ascending second points directly to final millisecond rows', () => {
		const timestampSec = 1_706_745_600
		expect(
			buildSingleMetricChartDataset(
				[
					[timestampSec, 10],
					[timestampSec + 1, 20]
				],
				'Value',
				false
			)
		).toEqual({
			dimensions: ['timestamp', 'Value'],
			source: [
				[timestampSec * 1e3, 10],
				[(timestampSec + 1) * 1e3, 20]
			]
		})
		expect(new Date(timestampSec * 1e3).toISOString().slice(0, 10)).toBe('2024-02-01')
	})

	test('running-sums flow values without summing snapshot lines by default', () => {
		const points: Array<[number, number]> = [
			[1, 10],
			[2, -3],
			[3, 5]
		]

		expect(buildSingleMetricChartDataset(points, 'Flow', true).source).toEqual([
			[1000, 10],
			[2000, 7],
			[3000, 12]
		])
		expect(buildSingleMetricChartDataset(points, 'Snapshot', false).source).toEqual([
			[1000, 10],
			[2000, -3],
			[3000, 5]
		])
	})
})
