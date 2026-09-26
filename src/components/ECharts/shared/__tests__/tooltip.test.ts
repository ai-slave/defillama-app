import { describe, expect, test } from 'vitest'
import { asTooltipDataRecord, createSignedInflowsTooltipFormatter } from '../tooltip'

describe('shared ECharts tooltip data access', () => {
	test('reads object rows without cloning', () => {
		const row = { timestamp: 1_767_225_600_000, Value: 5 }
		expect(asTooltipDataRecord(row)).toBe(row)
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
		const params = Array.from({ length: 11 }, (_, index) => ({
			seriesName: `Flow ${index}`,
			marker: '',
			data: { timestamp, [`Flow ${index}`]: index + 1 }
		}))
		params.push({ seriesName: 'Others', marker: 'O', data: { timestamp, Others: 5 } })
		const output = createSignedInflowsTooltipFormatter('$')(params)

		expect(output.match(/Others/g)).toHaveLength(1)
		expect(output).toContain('OOthers&nbsp;&nbsp;$16')
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

	test('keeps only the ten lowest signed values with stable ties', () => {
		const timestamp = 1_767_225_600_000
		const output = createSignedInflowsTooltipFormatter('$')(
			[12, -5, -5, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((value, index) => ({
				seriesName: `Flow ${index}`,
				data: { timestamp, [`Flow ${index}`]: value }
			}))
		)

		expect(output).not.toContain('Flow 0')
		expect(output).not.toContain('Flow 3')
		expect(output.indexOf('Flow 1')).toBeLessThan(output.indexOf('Flow 2'))
		expect(output).toContain('Others&nbsp;&nbsp;$23')
		expect(output).toContain('Total Inflows&nbsp;&nbsp;$65')
	})
})
