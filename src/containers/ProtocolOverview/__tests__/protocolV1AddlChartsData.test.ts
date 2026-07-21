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
				[100_000, 12, undefined],
				[200_000, 23, 5]
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
				[100_000, 200, 10],
				[200_000, 330, undefined]
			]
		})
		expect(result.tokenBreakdownDataset).toEqual({
			dimensions: ['timestamp', 'ETH', 'USDC'],
			source: [
				[100_000, 2, 10],
				[200_000, 3, undefined]
			]
		})
		expect(result.usdInflowsDataset).toEqual({
			dimensions: ['timestamp', 'USD Inflows'],
			source: [[200_000, 100]]
		})
		expect(result.tokenInflowsDataset).toEqual({
			dimensions: ['timestamp', 'ETH', 'USDC'],
			source: [[200_000, 110, -10]]
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
				encode: { x: 0, y: 1 },
				color: '#123456',
				stack: 'Total',
				hideAreaStyle: true
			}
		])

		expect(buildProtocolV1ChartConfigs({ seriesNames: ['ETH'], type: 'bar', stack: 'stackA' })).toEqual([
			{
				type: 'bar',
				name: 'ETH',
				encode: { x: 0, y: 1 },
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
		expect(result.tokenBreakdownUSDDataset?.source[0]?.at(-1)).toBe(55)
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

		const othersIndex = result.tokenBreakdownUSDDataset?.dimensions.indexOf('Others') ?? -1
		expect(result.tokenBreakdownUSDDataset?.source[0]?.[othersIndex]).toBe(103)
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
			for (let columnIndex = 1; columnIndex < row.length; columnIndex++) total += (row[columnIndex] as number) ?? 0
			expect(total).toBe(550 * (index + 1))
		}

		const aggregateInflows = result.usdInflowsDataset?.source ?? []
		const tokenInflows = result.tokenInflowsDataset?.source ?? []
		expect(tokenInflows).toHaveLength(aggregateInflows.length)
		for (let i = 0; i < tokenInflows.length; i++) {
			let tokenTotal = 0
			for (let columnIndex = 1; columnIndex < tokenInflows[i].length; columnIndex++) {
				tokenTotal += (tokenInflows[i][columnIndex] as number) ?? 0
			}
			expect(tokenTotal).toBe(aggregateInflows[i][1])
		}
	})
})
