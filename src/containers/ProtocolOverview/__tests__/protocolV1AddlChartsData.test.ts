import { describe, expect, it } from 'vitest'
import {
	buildProtocolV1AddlChartsData,
	buildProtocolV1ChartConfigs,
	formatProtocolV1TvlsByChain,
	MAX_PROTOCOL_V1_BREAKDOWN_SERIES
} from '../protocolV1AddlChartsData'

describe('protocol v1 additional chart datasets', () => {
	it('builds sparse millisecond chain rows in the legacy series order', () => {
		const result = formatProtocolV1TvlsByChain({
			historicalChainTvls: {
				Ethereum: {
					tvl: [
						{ date: 100, totalLiquidityUSD: 10 },
						{ date: 200, totalLiquidityUSD: 20 }
					]
				},
				'Ethereum-staking': {
					tvl: [
						{ date: 100, totalLiquidityUSD: 2 },
						{ date: 200, totalLiquidityUSD: 3 }
					]
				},
				Arbitrum: { tvl: [{ date: 200, totalLiquidityUSD: 5 }] }
			},
			extraTvlsEnabled: { staking: true }
		})

		expect(result.chainsUnique).toEqual(['Ethereum', 'Arbitrum'])
		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Ethereum', 'Arbitrum'],
			source: [
				{ timestamp: 100_000, Ethereum: 12 },
				{ timestamp: 200_000, Ethereum: 23, Arbitrum: 5 }
			]
		})
	})

	it('emits canonical token balance and inflow datasets without legacy date rows', () => {
		const result = buildProtocolV1AddlChartsData({
			protocolData: {
				name: 'Example',
				chainTvls: {
					Ethereum: {
						tokensInUsd: [
							{ date: 100, tokens: { ETH: 200, USDC: 10 } },
							{ date: 200, tokens: { ETH: 330 } }
						],
						tokens: [
							{ date: 100, tokens: { ETH: 2, USDC: 10 } },
							{ date: 200, tokens: { ETH: 3 } }
						]
					}
				}
			},
			extraTvlsEnabled: {}
		})

		expect(result.tokensUnique).toEqual(['ETH', 'USDC'])
		expect(result.rawTokensUnique).toEqual(['ETH', 'USDC'])
		expect(result.tokenBreakdownUSDDataset).toEqual({
			dimensions: ['timestamp', 'ETH', 'USDC'],
			source: [
				{ timestamp: 100_000, ETH: 200, USDC: 10 },
				{ timestamp: 200_000, ETH: 330 }
			]
		})
		expect(result.tokenBreakdownDataset).toEqual({
			dimensions: ['timestamp', 'ETH', 'USDC'],
			source: [
				{ timestamp: 100_000, ETH: 2, USDC: 10 },
				{ timestamp: 200_000, ETH: 3 }
			]
		})
		expect(result.usdInflowsDataset).toEqual({
			dimensions: ['timestamp', 'USD Inflows'],
			source: [{ timestamp: 200_000, 'USD Inflows': 100 }]
		})
		expect(result.tokenInflowsDataset).toEqual({
			dimensions: ['timestamp', 'ETH', 'USDC'],
			source: [{ timestamp: 200_000, ETH: 110, USDC: -10 }]
		})
	})

	it('keeps line and bar presentation semantics in chart configs', () => {
		expect(
			buildProtocolV1ChartConfigs({
				seriesNames: ['ETH'],
				type: 'line',
				colors: { ETH: '#123456' },
				stack: 'Total',
				hideAreaStyle: true
			})
		).toEqual([
			{
				type: 'line',
				name: 'ETH',
				encode: { x: 'timestamp', y: 'ETH' },
				color: '#123456',
				stack: 'Total',
				hideAreaStyle: true
			}
		])

		expect(buildProtocolV1ChartConfigs({ seriesNames: ['ETH'], type: 'bar', stack: 'stackA' })).toEqual([
			{
				type: 'bar',
				name: 'ETH',
				encode: { x: 'timestamp', y: 'ETH' },
				stack: 'stackA'
			}
		])
	})

	it('selects the daily top ten without exposing lower-value series', () => {
		const tokens: Record<string, number> = {}
		for (let i = 0; i < 20; i++) tokens[`TOKEN_${i}`] = i + 1

		const result = buildProtocolV1AddlChartsData({
			protocolData: {
				name: 'Example',
				chainTvls: {
					Ethereum: {
						tokensInUsd: [{ date: 100, tokens }],
						tokens: [{ date: 100, tokens }]
					}
				}
			},
			extraTvlsEnabled: {}
		})

		expect(result.tokensUnique).toEqual([
			'TOKEN_19',
			'TOKEN_18',
			'TOKEN_17',
			'TOKEN_16',
			'TOKEN_15',
			'TOKEN_14',
			'TOKEN_13',
			'TOKEN_12',
			'TOKEN_11',
			'TOKEN_10',
			'Others'
		])
		expect(result.rawTokensUnique).toEqual([
			'TOKEN_19',
			'TOKEN_18',
			'TOKEN_17',
			'TOKEN_16',
			'TOKEN_15',
			'TOKEN_14',
			'TOKEN_13',
			'TOKEN_12',
			'TOKEN_11',
			'TOKEN_10'
		])
		expect(result.tokenBreakdownDataset?.dimensions).not.toContain('Others')
		expect(result.tokenBreakdownUSDDataset?.source[0]).toMatchObject({ Others: 55 })
	})

	it('combines a real Others token with omitted daily tokens', () => {
		const tokens: Record<string, number> = { Others: 100 }
		for (let i = 0; i < 11; i++) tokens[`TOKEN_${i}`] = i + 1

		const result = buildProtocolV1AddlChartsData({
			protocolData: {
				name: 'Example',
				chainTvls: {
					Ethereum: {
						tokensInUsd: [{ date: 100, tokens }],
						tokens: [{ date: 100, tokens }]
					}
				}
			},
			extraTvlsEnabled: {}
		})

		expect(result.tokenBreakdownUSDDataset?.source[0]).toMatchObject({ Others: 103 })
	})

	it('bounds rotating token series and keeps Others inflows equal to aggregate inflows', () => {
		const tokensInUsd = []
		const rawTokens = []
		for (let day = 0; day < 4; day++) {
			const usd: Record<string, number> = {}
			const raw: Record<string, number> = {}
			for (let i = 0; i < 10; i++) {
				const token = `DAY_${day}_TOKEN_${i}`
				usd[token] = (i + 1) * 10 * (day + 1)
				raw[token] = i + 1
			}
			tokensInUsd.push({ date: (day + 1) * 100, tokens: usd })
			rawTokens.push({ date: (day + 1) * 100, tokens: raw })
		}

		const result = buildProtocolV1AddlChartsData({
			protocolData: {
				name: 'Example',
				chainTvls: { Ethereum: { tokensInUsd, tokens: rawTokens } }
			},
			extraTvlsEnabled: {}
		})

		expect(result.tokensUnique).toHaveLength(MAX_PROTOCOL_V1_BREAKDOWN_SERIES)
		expect(result.tokensUnique?.at(-1)).toBe('Others')
		expect(result.rawTokensUnique).toHaveLength(MAX_PROTOCOL_V1_BREAKDOWN_SERIES - 1)
		expect(result.rawTokensUnique).not.toContain('Others')
		for (const [index, row] of (result.tokenBreakdownUSDDataset?.source ?? []).entries()) {
			let total = 0
			for (const name in row) {
				if (name !== 'timestamp') total += row[name]
			}
			expect(total).toBe(550 * (index + 1))
		}

		const aggregateInflows = result.usdInflowsDataset?.source ?? []
		const tokenInflows = result.tokenInflowsDataset?.source ?? []
		expect(tokenInflows).toHaveLength(aggregateInflows.length)
		for (let i = 0; i < tokenInflows.length; i++) {
			let tokenTotal = 0
			for (const name in tokenInflows[i]) {
				if (name !== 'timestamp') tokenTotal += tokenInflows[i][name]
			}
			expect(tokenTotal).toBe(aggregateInflows[i]['USD Inflows'])
		}
	})

	it('keeps prototype-like token names as own dataset properties', () => {
		const usdDayOne = JSON.parse('{"__proto__":100,"constructor":200}') as Record<string, number>
		const usdDayTwo = JSON.parse('{"__proto__":120,"constructor":240}') as Record<string, number>
		const rawDayOne = JSON.parse('{"__proto__":10,"constructor":20}') as Record<string, number>
		const rawDayTwo = JSON.parse('{"__proto__":12,"constructor":24}') as Record<string, number>
		const result = buildProtocolV1AddlChartsData({
			protocolData: {
				name: 'Example',
				chainTvls: {
					Ethereum: {
						tokensInUsd: [
							{ date: 100, tokens: usdDayOne },
							{ date: 200, tokens: usdDayTwo }
						],
						tokens: [
							{ date: 100, tokens: rawDayOne },
							{ date: 200, tokens: rawDayTwo }
						]
					}
				}
			},
			extraTvlsEnabled: {}
		})

		const usdRow = result.tokenBreakdownUSDDataset?.source[1] as Record<string, number>
		const inflowRow = result.tokenInflowsDataset?.source[0] as Record<string, number>
		expect(Object.getPrototypeOf(usdRow)).toBe(Object.prototype)
		expect(Object.getPrototypeOf(inflowRow)).toBe(Object.prototype)
		expect(Object.hasOwn(usdRow, '__proto__')).toBe(true)
		expect(usdRow.__proto__).toBe(120)
		expect(usdRow.constructor).toBe(240)
		expect(Object.hasOwn(inflowRow, '__proto__')).toBe(true)
		expect(inflowRow.__proto__).toBe(20)
		expect(inflowRow.constructor).toBe(40)
	})
})
