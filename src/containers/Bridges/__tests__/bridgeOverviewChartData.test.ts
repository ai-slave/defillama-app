import { describe, expect, it } from 'vitest'
import { buildBridgeOverviewActiveChart, type BridgeOverviewChartType } from '../bridgeOverviewChartData'

const chainVolumeData = [
	{ date: 1, Deposited: 10, Withdrawn: -4 },
	{ date: 2, Deposited: 0, Withdrawn: 0 }
]

describe('buildBridgeOverviewActiveChart', () => {
	it('skips derived construction for overview and raw volume views', () => {
		for (const [selectedChain, chartType] of [
			['All', 'Net Flow'],
			['Ethereum', 'Bridge Volume']
		] as Array<[string, BridgeOverviewChartType]>) {
			expect(buildBridgeOverviewActiveChart({ selectedChain, chartType, chainVolumeData })).toBeNull()
		}
	})

	it('builds the selected time-series view with unchanged values', () => {
		expect(
			buildBridgeOverviewActiveChart({ selectedChain: 'Ethereum', chartType: 'Net Flow', chainVolumeData })
		).toEqual({
			kind: 'Net Flow',
			dataset: {
				dimensions: ['timestamp', 'Net Flow'],
				source: [
					{ timestamp: 1_000, 'Net Flow': 6 },
					{ timestamp: 2_000, 'Net Flow': 0 }
				]
			}
		})

		expect(
			buildBridgeOverviewActiveChart({ selectedChain: 'Ethereum', chartType: 'Net Flow (%)', chainVolumeData })
		).toEqual({
			kind: 'Net Flow (%)',
			dataset: {
				dimensions: ['timestamp', 'Inflows', 'Outflows'],
				source: [
					{ timestamp: 1_000, Inflows: (10 / 14) * 100, Outflows: (4 / 14) * 100 },
					{ timestamp: 2_000, Inflows: 0, Outflows: 0 }
				]
			}
		})

		expect(
			buildBridgeOverviewActiveChart({ selectedChain: 'Ethereum', chartType: 'Inflows', chainVolumeData })
		).toEqual({
			kind: 'Inflows',
			dataset: {
				dimensions: ['timestamp', 'Deposits', 'Withdrawals'],
				source: [
					{ timestamp: 1_000, Deposits: 10, Withdrawals: -4 },
					{ timestamp: 2_000, Deposits: 0, Withdrawals: 0 }
				]
			}
		})
	})

	it('groups and limits only the selected token direction', () => {
		const totalTokensDeposited = Object.fromEntries(
			Array.from({ length: 12 }, (_, index) => [
				`deposit-${index}`,
				{ symbol: index < 2 ? 'USDC' : `D${index}`, usdValue: 12 - index }
			])
		)
		const result = buildBridgeOverviewActiveChart({
			selectedChain: 'Ethereum',
			chartType: '24h Tokens Deposited',
			chainVolumeData,
			bridgeStatsCurrentDay: {
				totalTokensDeposited,
				totalTokensWithdrawn: { withdrawal: { symbol: 'ETH', usdValue: 100 } }
			}
		})

		expect(result?.kind).toBe('24h Tokens Deposited')
		if (result?.kind !== '24h Tokens Deposited') return
		expect(result.data[0]).toEqual({ name: 'USDC', value: 23 })
		expect(result.data.at(-1)).toEqual({ name: 'Others', value: 1 })
	})

	it('builds the selected token direction when the opposite direction is unavailable', () => {
		expect(
			buildBridgeOverviewActiveChart({
				selectedChain: 'Ethereum',
				chartType: '24h Tokens Deposited',
				chainVolumeData,
				bridgeStatsCurrentDay: {
					totalTokensDeposited: { deposit: { symbol: 'USDC', usdValue: 10 } }
				}
			})
		).toEqual({ kind: '24h Tokens Deposited', data: [{ name: 'USDC', value: 10 }] })
	})

	it('keeps a source Others slice at the end', () => {
		expect(
			buildBridgeOverviewActiveChart({
				selectedChain: 'Ethereum',
				chartType: '24h Tokens Deposited',
				chainVolumeData,
				bridgeStatsCurrentDay: {
					totalTokensDeposited: {
						other: { symbol: 'Others', usdValue: 20 },
						usdc: { symbol: 'USDC', usdValue: 10 }
					},
					totalTokensWithdrawn: {}
				}
			})
		).toEqual({
			kind: '24h Tokens Deposited',
			data: [
				{ name: 'USDC', value: 10 },
				{ name: 'Others', value: 20 }
			]
		})
	})

	it('preserves integer-like symbol ordering when values tie', () => {
		const result = buildBridgeOverviewActiveChart({
			selectedChain: 'Ethereum',
			chartType: '24h Tokens Deposited',
			chainVolumeData,
			bridgeStatsCurrentDay: {
				totalTokensDeposited: {
					first: { symbol: '10', usdValue: 5 },
					second: { symbol: '2', usdValue: 5 }
				},
				totalTokensWithdrawn: {}
			}
		})

		expect(result).toEqual({
			kind: '24h Tokens Deposited',
			data: [
				{ name: '2', value: 5 },
				{ name: '10', value: 5 }
			]
		})
	})
})
