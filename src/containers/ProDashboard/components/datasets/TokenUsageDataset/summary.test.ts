import { describe, expect, it } from 'vitest'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import { buildTokenUsageSummary } from './summary'

const row = (
	name: string,
	amountUsd: number,
	tokens: Record<string, number>,
	category = 'Lending'
): ProtocolTokenUsageData => ({ name, amountUsd, tokens, category })

describe('buildTokenUsageSummary', () => {
	it('preserves empty and one-token behavior', () => {
		expect(buildTokenUsageSummary([], ['usdc'])).toEqual({
			totalAmount: 0,
			protocolCount: 0,
			tokenStats: null,
			categoryBreakdown: {},
			topCategories: [],
			protocolOverlap: null,
			multiTokenProtocolCount: 0
		})

		const input = [row('A', 10, { usdc: 10, dai: 0 })]
		const snapshot = structuredClone(input)
		const summary = buildTokenUsageSummary(input, ['usdc'])
		expect(summary.tokenStats).toBeNull()
		expect(summary.protocolOverlap).toBeNull()
		expect(summary.multiTokenProtocolCount).toBe(1)
		expect(input).toEqual(snapshot)
	})

	it.each([
		['two', ['usdc', 'dai']],
		['three', ['usdc', 'dai', 'usdt']],
		['four', ['usdc', 'dai', 'usdt', 'frax']]
	])('aggregates %s selected tokens in one pass', (_label, symbols) => {
		const summary = buildTokenUsageSummary(
			[
				row('Shared', 35, { usdc: 10, dai: 20, usdt: 5, frax: 0 }),
				row('Exclusive', 7, { usdc: 7 }),
				row('No positive', 0, { usdc: 0, dai: 0 }),
				row('Unselected', 9, { other: 9, second: 0 })
			],
			symbols
		)

		expect(summary.totalAmount).toBe(51)
		expect(summary.protocolCount).toBe(4)
		expect(summary.multiTokenProtocolCount).toBe(3)
		expect(summary.tokenStats?.usdc).toEqual({ total: 17, protocols: 3 })
		expect(summary.tokenStats?.dai).toEqual({ total: 20, protocols: 2 })
		if (symbols.includes('usdt')) expect(summary.tokenStats?.usdt).toEqual({ total: 5, protocols: 1 })
		if (symbols.includes('frax')) expect(summary.tokenStats?.frax).toEqual({ total: 0, protocols: 1 })
		expect(summary.protocolOverlap?.exclusive).toBe(1)
		expect(summary.protocolOverlap?.usdc_only).toBe(1)
		expect(summary.protocolOverlap?.shared).toBe(symbols.length > 1 ? 1 : 0)
	})

	it('distinguishes missing keys, present zero values, and selected-token overlap', () => {
		const summary = buildTokenUsageSummary(
			[
				row('Missing DAI', 4, { usdc: 4 }),
				row('Zero DAI', 4, { usdc: 4, dai: 0 }),
				row('DAI only', 3, { usdc: 0, dai: 3 }),
				row('Neither selected', 8, { weth: 8, wbtc: 0 })
			],
			['usdc', 'dai']
		)

		expect(summary.tokenStats).toEqual({
			usdc: { total: 8, protocols: 3 },
			dai: { total: 3, protocols: 2 }
		})
		expect(summary.protocolOverlap).toEqual({ exclusive: 3, shared: 0, usdc_only: 2, dai_only: 1 })
		expect(summary.multiTokenProtocolCount).toBe(3)
	})

	it('uses Unknown categories and stable encounter order for amount ties', () => {
		const summary = buildTokenUsageSummary(
			[
				row('First', 10, { usdc: 10 }, 'Dexes'),
				row('Unknown', 5, { usdc: 5 }, ''),
				row('Second', 10, { usdc: 10 }, 'Lending'),
				row('Unknown again', 5, { usdc: 5 }, '')
			],
			['usdc']
		)

		expect(summary.categoryBreakdown).toEqual({
			Dexes: { count: 1, amount: 10 },
			Unknown: { count: 2, amount: 10 },
			Lending: { count: 1, amount: 10 }
		})
		expect(summary.topCategories.map(([category]) => category)).toEqual(['Dexes', 'Unknown', 'Lending'])
	})
})
