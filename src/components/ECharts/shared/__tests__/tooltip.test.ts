import { describe, expect, test } from 'vitest'
import { CHART_SERIES_LIMIT } from '~/constants/colors'
import { createSignedInflowsTooltipFormatter, getTooltipRawYValue } from '../tooltip'

describe('getTooltipRawYValue', () => {
	const row = { timestamp: 1_700_000_000_000, '180 day lock-up': 42, Team: 7 }

	test('resolves via the encoded y dimension when the series display name differs from the dataset key', () => {
		const item = {
			seriesName: '180 Day Lock Up',
			data: row,
			dimensionNames: ['timestamp', '180 day lock-up', 'Team'],
			encode: { x: [0], y: [1] }
		}
		expect(getTooltipRawYValue(item, item.seriesName)).toBe(42)
	})

	test('falls back to the series name when there is no encode info', () => {
		const item = { seriesName: 'Team', data: row }
		expect(getTooltipRawYValue(item, item.seriesName)).toBe(7)
	})

	test('reads the y value from [ts, y] value arrays', () => {
		const item = { seriesName: 'Price', value: [1_700_000_000_000, 3.5] }
		expect(getTooltipRawYValue(item, item.seriesName)).toBe(3.5)
	})

	test('reads an encoded y dimension from dataset array rows', () => {
		const item = {
			seriesName: 'Selected',
			data: [1_700_000_000_000, 7, 3.5],
			value: [1_700_000_000_000, 7, 3.5],
			encode: { x: [0], y: [2] }
		}
		expect(getTooltipRawYValue(item, item.seriesName)).toBe(3.5)
	})

	test('falls back to the direct value', () => {
		const item = { seriesName: 'Price', value: 9 }
		expect(getTooltipRawYValue(item, item.seriesName)).toBe(9)
	})
})

describe('shared signed-inflow tooltip', () => {
	test('sorts losses before gains and shows the net total first', () => {
		const output = createSignedInflowsTooltipFormatter('$')([
			{ seriesName: 'Gain', data: { timestamp: 1_767_225_600_000, Gain: 30 } },
			{ seriesName: 'Loss', data: { timestamp: 1_767_225_600_000, Loss: -10 } }
		])

		expect(output.indexOf('Total Inflows')).toBeLessThan(output.indexOf('Loss'))
		expect(output.indexOf('Loss')).toBeLessThan(output.indexOf('Gain'))
		expect(output).toContain('$20')
	})

	test('combines explicit and capped Others after the signed rows', () => {
		const timestamp = 1_767_225_600_000
		// One flow past the cap: it folds into Others beside the explicit Others of 5.
		const params = Array.from({ length: CHART_SERIES_LIMIT + 1 }, (_, index) => ({
			seriesName: `Flow ${index}`,
			marker: '',
			data: { timestamp, [`Flow ${index}`]: index + 1 }
		}))
		params.push({ seriesName: 'Others', marker: 'O', data: { timestamp, Others: 5 } })
		const output = createSignedInflowsTooltipFormatter('$')(params)

		expect(output.match(/Others/g)).toHaveLength(1)
		expect(output).toContain(`OOthers&nbsp;&nbsp;$${CHART_SERIES_LIMIT + 1 + 5}`)
	})

	test('can hide a redundant single-series name', () => {
		const output = createSignedInflowsTooltipFormatter(
			'$',
			true
		)([{ seriesName: 'USD Inflows', marker: '•', data: { timestamp: 1_767_225_600_000, 'USD Inflows': 5 } }])

		expect(output).toContain('•&nbsp;&nbsp;$5')
		expect(output).not.toContain('USD Inflows')
		expect(output).toContain('Total Inflows')
	})

	test('keeps only the lowest signed values up to the cap, with stable ties', () => {
		const timestamp = 1_767_225_600_000
		// Two tied losses and enough small gains to fill the cap; the two large gains fold into Others.
		const fillers = CHART_SERIES_LIMIT - 2
		const output = createSignedInflowsTooltipFormatter('$')(
			[100, -5, -5, 90, ...Array.from({ length: fillers }, () => 1)].map((value, index) => ({
				seriesName: `Flow ${index}`,
				data: { timestamp, [`Flow ${index}`]: value }
			}))
		)

		expect(output).not.toContain('Flow 0&')
		expect(output).not.toContain('Flow 3&')
		expect(output.indexOf('Flow 1&')).toBeLessThan(output.indexOf('Flow 2&'))
		expect(output).toContain('Others&nbsp;&nbsp;$190')
		expect(output).toContain(`Total Inflows&nbsp;&nbsp;$${180 + fillers}`)
	})

	test('leads the signed inflows tooltip with the pointed band, even one past the capped rows', () => {
		const timestamp = 1_767_225_600_000
		const pointedIndex = CHART_SERIES_LIMIT + 1
		const output = createSignedInflowsTooltipFormatter('$')(
			Array.from({ length: CHART_SERIES_LIMIT + 2 }, (_, index) => ({
				seriesName: `Flow ${index}`,
				marker: '',
				data: { timestamp, [`Flow ${index}`]: index + 1 },
				pointed: index === pointedIndex
			}))
		)

		expect(output.indexOf(`Flow ${pointedIndex}&`)).toBeGreaterThan(output.indexOf('Total Inflows'))
		expect(output.indexOf(`Flow ${pointedIndex}&`)).toBeLessThan(output.indexOf('Flow 0&'))
		// The flows below the pointed one fill the capped rows, so only the last of them folds into Others.
		expect(output).toContain(`Others&nbsp;&nbsp;$${CHART_SERIES_LIMIT + 1}`)
	})
})
