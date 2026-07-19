import { describe, expect, it } from 'vitest'
import { getBucketTimestampSec } from '~/components/ECharts/utils'
import { buildETFFlowChartData } from './chartData'
import type { IProcessedFlows } from './types'

const DAY = 86_400
const jan1 = Date.UTC(2026, 0, 1) / 1e3
const jan2 = jan1 + DAY

describe('buildETFFlowChartData', () => {
	it('groups all assets in one chronological pass and retains asset-only dates', () => {
		const flows: IProcessedFlows = {
			[jan2]: { date: jan2, Bitcoin: -2, Ethereum: 4 },
			[jan1]: { date: jan1, Ethereum: 3, Solana: 5 }
		}

		expect(buildETFFlowChartData(flows, 'daily')).toEqual([
			{ timestamp: jan1 * 1e3, Bitcoin: 0, Ethereum: 3, Solana: 5 },
			{ timestamp: jan2 * 1e3, Bitcoin: -2, Ethereum: 4, Solana: null }
		])

		const weeklyBucket = getBucketTimestampSec(jan1, 'weekly')
		expect(buildETFFlowChartData(flows, 'weekly')).toEqual([
			{ timestamp: weeklyBucket * 1e3, Bitcoin: -2, Ethereum: 7, Solana: 5 }
		])
	})

	it('keeps cumulative gaps blank and resumes each asset running total when data returns', () => {
		const jan3 = jan2 + DAY
		const flows: IProcessedFlows = {
			[jan1]: { date: jan1, Bitcoin: 10, Ethereum: 3 },
			[jan2]: { date: jan2, Bitcoin: -2 },
			[jan3]: { date: jan3, Ethereum: 4, Solana: 5 }
		}

		expect(buildETFFlowChartData(flows, 'cumulative')).toEqual([
			{ timestamp: jan1 * 1e3, Bitcoin: 10, Ethereum: 3, Solana: null },
			{ timestamp: jan2 * 1e3, Bitcoin: 8, Ethereum: null, Solana: null },
			{ timestamp: jan3 * 1e3, Bitcoin: 8, Ethereum: 7, Solana: 5 }
		])
	})

	it.each(['monthly', 'quarterly', 'yearly'] as const)('aggregates %s buckets without sorting again', (groupBy) => {
		const flows: IProcessedFlows = {
			[jan2]: { date: jan2, Bitcoin: 2, Ethereum: 4 },
			[jan1]: { date: jan1, Bitcoin: 1, Ethereum: 3 }
		}
		const bucket = getBucketTimestampSec(jan1, groupBy)

		expect(buildETFFlowChartData(flows, groupBy)).toEqual([
			{ timestamp: bucket * 1e3, Bitcoin: 3, Ethereum: 7, Solana: null }
		])
	})
})
