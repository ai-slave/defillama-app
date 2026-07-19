import { describe, expect, it } from 'vitest'
import { buildSingleMetricChartDataset } from './singleMetricChart'

describe('buildSingleMetricChartDataset', () => {
	it('normalizes ascending second points directly to final millisecond rows', () => {
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
				{ timestamp: timestampSec * 1e3, Value: 10 },
				{ timestamp: (timestampSec + 1) * 1e3, Value: 20 }
			]
		})
		expect(new Date(timestampSec * 1e3).toISOString().slice(0, 10)).toBe('2024-02-01')
	})

	it('running-sums flow values without summing snapshot lines by default', () => {
		const points: [number, number][] = [
			[1, 10],
			[2, -3],
			[3, 5]
		]

		expect(buildSingleMetricChartDataset(points, 'Flow', true).source).toEqual([
			{ timestamp: 1_000, Flow: 10 },
			{ timestamp: 2_000, Flow: 7 },
			{ timestamp: 3_000, Flow: 12 }
		])
		expect(buildSingleMetricChartDataset(points, 'Snapshot', false).source).toEqual([
			{ timestamp: 1_000, Snapshot: 10 },
			{ timestamp: 2_000, Snapshot: -3 },
			{ timestamp: 3_000, Snapshot: 5 }
		])
	})
})
