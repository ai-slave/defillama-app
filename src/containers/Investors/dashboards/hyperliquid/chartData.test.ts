import { describe, expect, it } from 'vitest'
import { buildPortfolioTrendDataset } from './chartData'

describe('Hyperliquid chart data', () => {
	it('builds the portfolio dataset without confusing PnL and account value', () => {
		const points = [
			{ time: 1_000, accountValue: 100, pnl: -5 },
			{ time: 2_000, accountValue: 110, pnl: 10 }
		]

		expect(buildPortfolioTrendDataset(points)).toEqual({
			dimensions: ['timestamp', 'Portfolio Value'],
			source: [
				[1_000, 100],
				[2_000, 110]
			]
		})
		expect(points[0]).toEqual({ time: 1_000, accountValue: 100, pnl: -5 })
	})
})
