import { describe, expect, test } from 'vitest'
import { processAdjustedProtocolTvl, processAdjustedTvl, type ProtocolChainTvls } from '../tvl'

const toUtcDay = (timestamp: number) => Math.floor(timestamp / 86_400) * 86_400

describe('TVL adjustment helpers', () => {
	test('subtracts doublecounted and liquid staking TVL while adding their overlap', () => {
		expect(
			processAdjustedTvl({
				tvl: [
					[1_700_000_000, 150.9],
					[1_700_086_400, 80]
				],
				doublecounted: [[1_700_000_000, 30.8]],
				liquidstaking: [[1_700_000_000, 60.2]],
				dcAndLsOverlap: [[1_700_000_000, 10.9]]
			})
		).toEqual([
			[1_700_000_000, 70],
			[1_700_086_400, 80]
		])
	})

	test('derives adjusted protocol TVL without adding normal extra TVL sections', () => {
		const timestamp = 1_700_000_000
		const adjusted = processAdjustedProtocolTvl({
			Ethereum: { tvl: [{ date: timestamp, totalLiquidityUSD: 100 }] },
			'Ethereum-doublecounted': { tvl: [{ date: timestamp, totalLiquidityUSD: 30 }] },
			'Ethereum-liquidstaking': { tvl: [{ date: timestamp, totalLiquidityUSD: 60 }] },
			'Ethereum-dcAndLsOverlap': { tvl: [{ date: timestamp, totalLiquidityUSD: 10 }] },
			'Ethereum-staking': { tvl: [{ date: timestamp, totalLiquidityUSD: 1000 }] },
			'Ethereum-pool2': { tvl: [{ date: timestamp, totalLiquidityUSD: 2000 }] },
			'Ethereum-borrowed': { tvl: [{ date: timestamp, totalLiquidityUSD: 3000 }] },
			'Ethereum-vesting': { tvl: [{ date: timestamp, totalLiquidityUSD: 4000 }] }
		})

		expect(adjusted).toEqual([[toUtcDay(timestamp), 20]])
	})

	test('keeps chain-scoped adjusted protocol TVL separate from unscoped adjustment keys', () => {
		const timestamp = 1_700_000_000
		const chainTvls: ProtocolChainTvls = {
			Ethereum: { tvl: [{ date: timestamp, totalLiquidityUSD: 100 }] },
			Polygon: { tvl: [{ date: timestamp, totalLiquidityUSD: 40 }] },
			'Ethereum-doublecounted': { tvl: [{ date: timestamp, totalLiquidityUSD: 30 }] },
			'Ethereum-liquidstaking': { tvl: [{ date: timestamp, totalLiquidityUSD: 60 }] },
			'Ethereum-dcAndLsOverlap': { tvl: [{ date: timestamp, totalLiquidityUSD: 10 }] },
			doublecounted: { tvl: [{ date: timestamp, totalLiquidityUSD: 1000 }] },
			liquidstaking: { tvl: [{ date: timestamp, totalLiquidityUSD: 1000 }] },
			dcAndLsOverlap: { tvl: [{ date: timestamp, totalLiquidityUSD: 1000 }] }
		}

		expect(processAdjustedProtocolTvl(chainTvls, { includeChains: ['Ethereum'] })).toEqual([[toUtcDay(timestamp), 20]])
		expect(processAdjustedProtocolTvl(chainTvls, { excludeChains: ['Polygon'] })).toEqual([[toUtcDay(timestamp), 20]])
	})

	test('filters out current UTC day adjusted protocol TVL points', () => {
		const today = new Date()
		const todayTimestamp = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 1000)
		const yesterdayTimestamp = todayTimestamp - 86_400

		expect(
			processAdjustedProtocolTvl({
				Ethereum: {
					tvl: [
						{ date: yesterdayTimestamp, totalLiquidityUSD: 100 },
						{ date: todayTimestamp, totalLiquidityUSD: 200 }
					]
				}
			})
		).toEqual([[yesterdayTimestamp, 100]])
	})
})
