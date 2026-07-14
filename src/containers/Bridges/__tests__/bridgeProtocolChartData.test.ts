import { describe, expect, it } from 'vitest'
import { getBucketTimestampSec } from '~/components/ECharts/utils'
import {
	buildBridgeProtocolAllChainsVolumeData,
	buildBridgeProtocolAllChainsVolumePairs,
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

		const allChainsVolumePairs = buildBridgeProtocolAllChainsVolumePairs({
			isAllChains: true,
			volumeChartDataByChain: [
				{ date: day2, Deposited: 20, Withdrawn: -6 },
				{ date: day1, Deposited: 10, Withdrawn: -4 }
			]
		})
		const result = buildBridgeProtocolAllChainsVolumeData({
			groupBy: 'weekly',
			allChainsVolumePairs
		})

		expect(allChainsVolumePairs).toEqual([
			[day2, 13],
			[day1, 7]
		])
		expect(result.groupedAllChainsVolumePairs).toEqual([[bucket, 20]])
		expect(result.volumeDataset).toEqual({
			dimensions: ['timestamp', 'Volume'],
			source: [{ timestamp: bucket * 1e3, Volume: 20 }]
		})
	})

	it('calculates all-chain current volume from totals or previous chart rows', () => {
		expect(
			getBridgeProtocolPrevDayVolumeValue({
				isAllChains: true,
				allChainsVolumePairs: [],
				totalDepositedUSD: 50,
				totalWithdrawnUSD: 10,
				dataTimestamp: toSeconds('2026-07-14'),
				currentTimeMs: NOW
			})
		).toBe(30)

		expect(
			getBridgeProtocolPrevDayVolumeValue({
				isAllChains: true,
				allChainsVolumePairs: [
					[toSeconds('2026-07-12'), 10],
					[toSeconds('2026-07-13'), 20],
					[toSeconds('2026-07-14'), 30]
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
			isAllChains: false,
			groupBy: 'daily',
			volumeChartDataByChain: [{ date: 1, Deposited: 10, Withdrawn: -4 }]
		})

		expect(result.groupedInflowsData).toEqual([{ date: 1, Deposited: 10, Withdrawn: -4 }])
		expect(result.inflowsDataset).toEqual({
			dimensions: ['timestamp', 'Deposited', 'Withdrawn'],
			source: [{ timestamp: 1_000, Deposited: 10, Withdrawn: 4 }]
		})

		expect(
			buildBridgeProtocolInflowsData({
				isAllChains: true,
				groupBy: 'daily',
				volumeChartDataByChain: [{ date: 1, Deposited: 10, Withdrawn: -4 }]
			}).inflowsDataset.source
		).toEqual([])
	})
})
