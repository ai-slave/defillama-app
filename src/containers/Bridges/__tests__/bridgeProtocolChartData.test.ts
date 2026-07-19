import { describe, expect, it } from 'vitest'
import { getBucketTimestampSec } from '~/components/ECharts/utils'
import {
	buildBridgeProtocolAllChainsVolumeData,
	buildBridgeProtocolInflowsData,
	getBridgeProtocolCompletedDayVolumes,
	getBridgeProtocolPrevDayVolumeValue
} from '../bridgeProtocolChartData'

const NOW = Date.parse('2026-07-14T12:00:00Z')
const toSeconds = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1e3

describe('bridge protocol chart data helpers', () => {
	it('builds grouped all-chain average volume datasets', () => {
		const day1 = 1_704_067_200
		const day2 = 1_704_153_600
		const bucket = getBucketTimestampSec(day1, 'weekly')

		const volumeChartDataByChain = [
			{ date: day1, Deposited: 10, Withdrawn: -4 },
			{ date: day2, Deposited: 20, Withdrawn: -6 }
		]
		const result = buildBridgeProtocolAllChainsVolumeData({
			active: true,
			groupBy: 'weekly',
			volumeChartDataByChain
		})

		expect(result).toEqual({
			dimensions: ['timestamp', 'Volume'],
			source: [{ timestamp: bucket * 1e3, Volume: 20 }]
		})
		expect(
			buildBridgeProtocolAllChainsVolumeData({ active: false, groupBy: 'daily', volumeChartDataByChain }).source
		).toEqual([])
	})

	it('calculates all-chain current volume from totals or previous chart rows', () => {
		expect(
			getBridgeProtocolPrevDayVolumeValue({
				isAllChains: true,
				volumeChartDataByChain: [],
				totalDepositedUSD: 50,
				totalWithdrawnUSD: 10,
				dataTimestamp: toSeconds('2026-07-14'),
				currentTimeMs: NOW
			})
		).toBe(30)

		expect(
			getBridgeProtocolPrevDayVolumeValue({
				isAllChains: true,
				volumeChartDataByChain: [
					{ date: toSeconds('2026-07-12'), Deposited: 16, Withdrawn: -4 },
					{ date: toSeconds('2026-07-13'), Deposited: 30, Withdrawn: -10 },
					{ date: toSeconds('2026-07-14'), Deposited: 40, Withdrawn: -20 }
				],
				totalDepositedUSD: undefined,
				totalWithdrawnUSD: undefined,
				currentTimeMs: NOW
			})
		).toBe(20)
	})

	it('requires exact completed-day endpoints for the previous-day change', () => {
		const complete = [
			{ date: toSeconds('2026-07-12'), Deposited: 5, Withdrawn: -2 },
			{ date: toSeconds('2026-07-13'), Deposited: 10, Withdrawn: -3 },
			{ date: toSeconds('2026-07-14'), Deposited: 12, Withdrawn: -4 }
		]
		expect(getBridgeProtocolCompletedDayVolumes(complete, NOW)).toEqual({
			current: complete[1],
			previous: complete[0]
		})

		expect(
			getBridgeProtocolCompletedDayVolumes(
				[{ date: toSeconds('2026-07-11'), Deposited: 5, Withdrawn: -2 }, complete[1]],
				NOW
			)
		).toBeNull()
	})

	it('builds non-all-chain inflow datasets without leaking all-chain volume data', () => {
		const result = buildBridgeProtocolInflowsData({
			active: true,
			groupBy: 'daily',
			volumeChartDataByChain: [{ date: 1, Deposited: 10, Withdrawn: -4 }]
		})

		expect(result).toEqual({
			dimensions: ['timestamp', 'Deposited', 'Withdrawn'],
			source: [{ timestamp: 1_000, Deposited: 10, Withdrawn: -4 }]
		})

		const day1 = 1_704_067_200
		const day2 = 1_704_153_600
		expect(
			buildBridgeProtocolInflowsData({
				active: true,
				groupBy: 'weekly',
				volumeChartDataByChain: [
					{ date: day1, Deposited: 10, Withdrawn: -4 },
					{ date: day2, Deposited: 20, Withdrawn: -6 }
				]
			}).source
		).toEqual([{ timestamp: getBucketTimestampSec(day1, 'weekly') * 1e3, Deposited: 30, Withdrawn: -10 }])

		expect(
			buildBridgeProtocolInflowsData({
				active: false,
				groupBy: 'daily',
				volumeChartDataByChain: [{ date: 1, Deposited: 10, Withdrawn: -4 }]
			}).source
		).toEqual([])
	})
})
