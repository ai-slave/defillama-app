import { expect, test } from 'vitest'
import { candlestickLegendData } from '../legend'

test('lists one legend item per toggleable indicator line', () => {
	expect(
		candlestickLegendData(
			[{ name: 'BBands', category: 'overlay', data: [], values: [[1, { upper: 12, middle: 10, lower: 8 }]] }],
			[
				{ name: 'MACD', category: 'panel', data: [], values: [[1, { macd: 1, signal: 2, histogram: 3 }]] },
				{ name: 'Stoch RSI', category: 'panel', data: [], values: [[1, { k: 1, d: 2 }]] },
				{ name: 'RSI', category: 'panel', data: [[1, 50]] }
			]
		)
	).toEqual(['Volume', 'BBands', 'MACD', 'Signal', 'MACD Line', '%K', '%D', 'RSI'])
})
