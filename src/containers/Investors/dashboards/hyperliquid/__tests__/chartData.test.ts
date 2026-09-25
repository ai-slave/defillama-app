import { describe, expect, test } from 'vitest'
import { buildPortfolioTrendDataset } from '../chartData'

describe('Hyperliquid chart data', () => {
	test('builds the portfolio dataset without confusing PnL and account value', () => {
		const points = [
			{ time: 1000, accountValue: 100, pnl: -5 },
			{ time: 2000, accountValue: 110, pnl: 10 }
		]

		expect(buildPortfolioTrendDataset(points)).toEqual({
			dimensions: ['timestamp', 'Portfolio Value'],
			source: [
				[1000, 100],
				[2000, 110]
			]
		})
		expect(points[0]).toEqual({ time: 1000, accountValue: 100, pnl: -5 })
	})
})
