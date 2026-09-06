import { describe, expect, test } from 'vitest'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import { buildETFChartSpec, buildETFFlowChartData } from './chartData'
import type { IProcessedFlows } from './types'

const DAY = 86_400
const jan1 = Date.UTC(2026, 0, 1) / 1e3
const jan2 = jan1 + DAY

describe('buildETFFlowChartData', () => {
	test('groups all assets in one chronological pass and retains asset-only dates', () => {
		const flows: IProcessedFlows = {
			[jan2]: { date: jan2, Bitcoin: -2, Ethereum: 4 },
			[jan1]: { date: jan1, Ethereum: 3, Solana: 5 }
		}

		expect(buildETFFlowChartData(flows, 'daily')).toEqual([
			[jan1 * 1e3, 0, 3, 5],
			[jan2 * 1e3, -2, 4, null]
		])

		const weeklyBucket = getBucketTimestampSec(jan1, 'weekly')
		expect(buildETFFlowChartData(flows, 'weekly')).toEqual([[weeklyBucket * 1e3, -2, 7, 5]])
	})

	test('keeps cumulative gaps blank and resumes each asset running total when data returns', () => {
		const jan3 = jan2 + DAY
		const flows: IProcessedFlows = {
			[jan1]: { date: jan1, Bitcoin: 10, Ethereum: 3 },
			[jan2]: { date: jan2, Bitcoin: -2 },
			[jan3]: { date: jan3, Ethereum: 4, Solana: 5 }
		}

		expect(buildETFFlowChartData(flows, 'cumulative')).toEqual([
			[jan1 * 1e3, 10, 3, null],
			[jan2 * 1e3, 8, null, null],
			[jan3 * 1e3, 8, 7, 5]
		])
	})

	test.each(['monthly', 'quarterly', 'yearly'] as const)('aggregates %s buckets without sorting again', (groupBy) => {
		const flows: IProcessedFlows = {
			[jan2]: { date: jan2, Bitcoin: 2, Ethereum: 4 },
			[jan1]: { date: jan1, Bitcoin: 1, Ethereum: 3 }
		}
		const bucket = getBucketTimestampSec(jan1, groupBy)

		expect(buildETFFlowChartData(flows, groupBy)).toEqual([[bucket * 1e3, 3, 7, null]])
	})

	test('builds the exact filtered dataset and chart contract used by the overview', () => {
		const flows: IProcessedFlows = {
			[jan1]: { date: jan1, Bitcoin: 1, Ethereum: -2, Solana: 3 }
		}
		const result = buildETFChartSpec({ flows, groupBy: 'daily', assets: ['Ethereum', 'Solana'] })

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Ethereum', 'Solana'],
			source: [[jan1 * 1e3, -2, 3]]
		})
		expect(result.charts).toEqual([
			{
				type: 'bar',
				name: 'Ethereum',
				encode: { x: 0, y: 1 },
				stack: 'Ethereum',
				color: '#6B7280'
			},
			{
				type: 'bar',
				name: 'Solana',
				encode: { x: 0, y: 2 },
				stack: 'Solana',
				color: '#9945FF'
			}
		])
		for (const chart of result.charts) expect(chart.encode.y).toBeGreaterThan(0)
	})

	test('uses line series for cumulative flows and supports an empty selection', () => {
		const flows: IProcessedFlows = { [jan1]: { date: jan1, Bitcoin: 1 } }
		expect(buildETFChartSpec({ flows, groupBy: 'cumulative', assets: ['Bitcoin'] }).charts[0]?.type).toBe('line')
		expect(buildETFChartSpec({ flows, groupBy: 'weekly', assets: [] })).toMatchObject({
			dataset: { dimensions: ['timestamp'] },
			charts: []
		})
	})
})
