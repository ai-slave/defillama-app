import { describe, expect, it } from 'vitest'
import { getTooltipRawYValue } from '../tooltipValue'

describe('getTooltipRawYValue', () => {
	const row = { timestamp: 1700000000000, '180 day lock-up': 42, Team: 7 }

	it('resolves via the encoded y dimension when the series display name differs from the dataset key', () => {
		const item = {
			seriesName: '180 Day Lock Up',
			data: row,
			dimensionNames: ['timestamp', '180 day lock-up', 'Team'],
			encode: { x: [0], y: [1] }
		}
		expect(getTooltipRawYValue(item, item.seriesName)).toBe(42)
	})

	it('falls back to the series name when there is no encode info', () => {
		const item = { seriesName: 'Team', data: row }
		expect(getTooltipRawYValue(item, item.seriesName)).toBe(7)
	})

	it('falls back to the series name when the encoded dimension is missing from the data row', () => {
		const item = {
			seriesName: 'Team',
			data: row,
			dimensionNames: ['timestamp', 'Other'],
			encode: { x: [0], y: [1] }
		}
		expect(getTooltipRawYValue(item, item.seriesName)).toBe(7)
	})

	it('reads the y value from [ts, y] value arrays', () => {
		const item = { seriesName: 'Price', value: [1700000000000, 3.5] }
		expect(getTooltipRawYValue(item, item.seriesName)).toBe(3.5)
	})

	it('falls back to the direct value', () => {
		const item = { seriesName: 'Price', value: 9 }
		expect(getTooltipRawYValue(item, item.seriesName)).toBe(9)
	})
})
