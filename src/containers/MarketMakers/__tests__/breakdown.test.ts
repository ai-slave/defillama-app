import { describe, expect, it } from 'vitest'
import { type BreakdownPayloads, reconstructBreakdown } from '../breakdown'

const metric = (value: number, percentile: number, rank: number) => ({ value, percentile, rank })

const payloads: BreakdownPayloads = {
	aggregated: [{ marketMakerId: 'keyrock', rank: { value: 4, percentile: 93 } }],
	volume: [
		{
			marketMakerId: 'keyrock',
			rank: { value: 1, percentile: 100 },
			orderFillVolumeMaker: metric(836003, 100, 1),
			orderFillVolumeTaker: metric(18882, 80, 10),
			orderFillVolumeTotal: metric(854885, 100, 1),
			orderFillVolumeMakerMarketPercentage: metric(8.31, 97, 2),
			orderFillVolumeTakerMarketPercentage: metric(0.3, 91, 5),
			orderFillVolumeTotalMarketPercentage: metric(4.31, 97, 2),
			volumeLoanUtilization: metric(46.38, 85, 8)
		}
	],
	spread: [
		{
			marketMakerId: 'keyrock',
			rank: { value: 9, percentile: 82 },
			bidAskSpread: metric(0.1756, 85, 8),
			uptime: metric(80.83, 85, 8)
		}
	],
	kpi: [
		{
			marketMakerId: 'keyrock',
			rank: { value: 12, percentile: 76 },
			bidAskDepth50: metric(36.66, 76, 12),
			bidAskDepth100: metric(50, 80, 9),
			bidAskDepth200: metric(60, 82, 8),
			bidAskSpread: metric(80.83, 85, 8)
		}
	],
	depth: {
		depth50: [{ marketMakerId: 'keyrock', rank: { value: 6, percentile: 88 }, bidDepth: metric(100, 50, 6) }],
		depth100: [{ marketMakerId: 'keyrock', rank: { value: 5, percentile: 90 }, bidDepth: metric(200, 60, 5) }],
		depth200: [
			{
				marketMakerId: 'keyrock',
				rank: { value: 5, percentile: 91 },
				bidDepth: metric(300, 70, 5),
				askDepth: metric(310, 71, 5),
				bidAskDepth: metric(377125, 87, 7),
				bidDepthMarketPercentage: metric(11, 87, 7),
				uptime: metric(99, 100, 1),
				depthLoanUtilization: metric(63, 87, 7)
			}
		]
	}
}

describe('reconstructBreakdown', () => {
	it('pulls each board rank from its list, using the 2% (depth200) bucket for depth', () => {
		const b = reconstructBreakdown('keyrock', payloads)
		expect(b.aggregatedRank).toEqual({ value: 4, percentile: 93 })
		expect(b.volumeRank).toEqual({ value: 1, percentile: 100 })
		expect(b.spreadRank).toEqual({ value: 9, percentile: 82 })
		expect(b.kpiRank).toEqual({ value: 12, percentile: 76 })
		expect(b.depthRank).toEqual({ value: 5, percentile: 91 })
	})

	it('keeps spread and KPI bid-ask spread distinct (no key collision across sections)', () => {
		const b = reconstructBreakdown('keyrock', payloads)
		expect(b.sections.spread.bidAskSpread).toEqual(metric(0.1756, 85, 8))
		expect(b.sections.kpi.bidAskSpread).toEqual(metric(80.83, 85, 8))
	})

	it('remaps volume and depth fields to the breakdown row keys', () => {
		const b = reconstructBreakdown('keyrock', payloads)
		expect(b.sections.volume.volumeMaker).toEqual(metric(836003, 100, 1))
		expect(b.sections.volume.volumeTotalLoanUtilization).toEqual(metric(46.38, 85, 8))
		expect(b.sections.volume.volumeMakerLoanUtilization).toBeNull()
		expect(b.sections.depth.bidAskDepth200).toEqual(metric(377125, 87, 7))
		expect(b.sections.depth.bidAskDepth200Uptime).toEqual(metric(99, 100, 1))
		expect(b.sections.spread.spreadUptime).toEqual(metric(80.83, 85, 8))
	})

	it('returns null ranks and null metrics for an unknown market maker', () => {
		const b = reconstructBreakdown('missing', payloads)
		expect(b.aggregatedRank).toBeNull()
		expect(b.depthRank).toBeNull()
		expect(b.sections.volume.volumeMaker).toBeNull()
		expect(b.sections.kpi.bidAskSpread).toBeNull()
	})
})
