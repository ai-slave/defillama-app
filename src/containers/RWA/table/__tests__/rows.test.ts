import { describe, expect, test } from 'vitest'
import type { IRWAFlowSummaryResponse } from '../../api.types'
import { buildRwaLeafRows } from '../rows'
import { perpsAsset, spotAsset } from './fixtures'

const flowSummary: IRWAFlowSummaryResponse = {
	generatedAt: 1,
	windows: {
		'7d': {
			asset: {
				'ondo/usdy': {
					flow: 1000,
					mcap: 800_000,
					intensityPct: 0.1,
					coverage: 1,
					byChain: { Ethereum: { status: 'measured', flow: 900, coverage: 1 }, Solana: { status: 'notPriced' } }
				}
			},
			assetGroup: {},
			platform: {},
			category: {},
			chain: {}
		},
		'30d': { asset: {}, assetGroup: {}, platform: {}, category: {}, chain: {} }
	}
}

describe('buildRwaLeafRows', () => {
	test('fills the shared metric shape from a spot row', () => {
		const [row] = buildRwaLeafRows([spotAsset()], { flowSummary, includeBridgeTvl: true })
		expect(row.kind).toBe('leaf')
		expect(row.id).toBe('usdy')
		expect(row.chainScope).toBeNull()
		expect(row.metrics).toEqual({
			activeMcap: 800_000,
			onChainMcap: 1_000_000,
			defiActiveTvl: 100_000,
			change: {
				'1d': {
					activeMcap: { current: 800_000, prior: 790_000 },
					onChainMcap: { current: 1_000_000, prior: 990_000 },
					defiActiveTvl: { current: 100_000, prior: 99_000 }
				},
				'7d': {
					activeMcap: { current: 800_000, prior: 700_000 },
					onChainMcap: { current: 1_000_000, prior: 900_000 },
					defiActiveTvl: { current: 100_000, prior: 80_000 }
				},
				'1m': {
					activeMcap: { current: 800_000, prior: 500_000 },
					onChainMcap: { current: 1_000_000, prior: 600_000 },
					defiActiveTvl: { current: 100_000, prior: 50_000 }
				}
			},
			netFlow7d: 1000,
			netFlow30d: null,
			price: 1.05,
			priceChange24h: null,
			openInterest: null,
			openInterestChange24h: { current: null, prior: null, percent: null, dropped: 0 },
			volume24h: null,
			volume7d: null,
			fundingApr: null,
			fundingRate: null,
			fundingIntervalHours: null,
			premium: null,
			maxLeverage: null,
			protocolFees24h: null,
			volume30d: null,
			volume24hChange24h: { current: null, prior: null, percent: null, dropped: 0 },
			volumeAllTime: null,
			oraclePrice: null,
			midPrice: null,
			previousDayPrice: null,
			protocolFees7d: null,
			protocolFees30d: null,
			protocolFeesAllTime: null,
			makerFeeRate: null,
			takerFeeRate: null,
			chains: [
				{ chain: 'Ethereum', value: 700_000, share: 0.7 },
				{ chain: 'Solana', value: 295_000, share: 0.295 },
				{ chain: 'Mantle', value: 5000, share: 0.005 }
			],
			assetCount: 1,
			issuerCount: 1,
			chainCount: 3
		})
		expect(row.breakdowns.defiActiveTvl).toEqual([['Aave', 100_000]])
		expect(row.flows['7d']?.flow).toBe(1000)
	})

	test('subtracts bridge tvl from the current and prior values when excluded', () => {
		const [row] = buildRwaLeafRows(
			[
				spotAsset({
					bridgeTvl: 30_000,
					bridgeTvlByProtocol: { total: 30_000, breakdown: [['Aave', 30_000]] },
					priors: {
						'1d': { activeMcap: 1, onChainMcap: 1, defiActiveTvl: 80_000, bridgeTvl: 20_000 },
						'7d': { activeMcap: 1, onChainMcap: 1, defiActiveTvl: 80_000, bridgeTvl: 20_000 },
						'1m': { activeMcap: 1, onChainMcap: 1, defiActiveTvl: 80_000, bridgeTvl: 20_000 }
					}
				})
			],
			{ includeBridgeTvl: false }
		)
		expect(row.metrics.defiActiveTvl).toBe(70_000)
		expect(row.metrics.change['7d'].defiActiveTvl).toEqual({ current: 70_000, prior: 60_000 })
		expect(row.breakdowns.defiActiveTvl).toEqual([['Aave', 70_000]])
	})

	test('leaves priors unavailable when the row carries none', () => {
		const [row] = buildRwaLeafRows([spotAsset({ priors: undefined, activeMcap: null })], { includeBridgeTvl: true })
		expect(row.metrics.activeMcap).toBeNull()
		expect(row.metrics.change['7d'].activeMcap).toEqual({ current: null, prior: null })
		expect(row.metrics.change['1m'].defiActiveTvl).toEqual({ current: null, prior: null })
	})

	test('fills perps metrics and nothing else', () => {
		const [row] = buildRwaLeafRows([perpsAsset()], { includeBridgeTvl: true })
		expect(row.metrics.openInterest).toBe(5000)
		expect(row.metrics.volume24h).toBe(1000)
		expect(row.metrics.volume30d).toBe(20_000)
		expect(row.metrics.priceChange24h).toBe(2.5)
		expect(row.metrics.openInterestChange24h).toEqual({ current: 5000, prior: 4000, percent: 25, dropped: 0 })
		expect(row.metrics.volume7d).toBe(6000)
		expect(row.metrics.fundingApr).toBeCloseTo(0.0001 * (8760 / 8) * 100)
		expect(row.metrics.premium).toBeCloseTo(0.2)
		expect(row.metrics.maxLeverage).toBe(50)
		expect(row.metrics.protocolFees24h).toBe(300)
		expect(row.metrics.activeMcap).toBeNull()
		expect(row.metrics.chains).toEqual([])
		expect(row.metrics.chainCount).toBe(0)
	})

	test('a market that fell to zero keeps the -100% the API sends and counts as a drop', () => {
		const [row] = buildRwaLeafRows([perpsAsset({ openInterest: 0, openInterestChange24h: -100 })], {
			includeBridgeTvl: true
		})
		expect(row.metrics.openInterestChange24h).toEqual({ current: 0, prior: null, percent: -100, dropped: 1 })
	})

	test('fills the widened perps fields', () => {
		const [big] = buildRwaLeafRows(
			[
				perpsAsset({
					openInterest: 3000,
					volume24hChange24h: 25,
					volumeAllTime: 90_000,
					oraclePrice: 1.01,
					midPrice: 1.02,
					previousDayPrice: 0.99,
					protocolFees7d: 2000,
					protocolFees30d: 8000,
					protocolFeesAllTime: 50_000,
					makerFeeRate: 0.0001,
					takerFeeRate: 0.0005
				})
			],
			{ includeBridgeTvl: true }
		)
		expect(big.metrics).toMatchObject({
			volume24hChange24h: { current: 1000, prior: 800, percent: 25 },
			volumeAllTime: 90_000,
			oraclePrice: 1.01,
			midPrice: 1.02,
			previousDayPrice: 0.99,
			protocolFees7d: 2000,
			protocolFees30d: 8000,
			protocolFeesAllTime: 50_000,
			makerFeeRate: 0.0001,
			takerFeeRate: 0.0005
		})
	})
})
