// @vitest-environment happy-dom

import { describe, expect, test } from 'vitest'
import { KPK_COMPOSITION_CHART_OPTIONS, kpkCompositionChartOptions } from './chartDefaults'

/**
 * One stacked segment as ECharts hands it to a tooltip formatter: positional row +
 * encode. Values are absolute USD, as `buildComposition` emits them.
 */
function item(seriesName: string, month: string, value: number, yIndex: number) {
	const data: Array<string | number> = [month, 0, 0, 0]
	data[yIndex] = value
	return {
		seriesName,
		axisValue: month,
		marker: `<span data-series="${seriesName}"></span>`,
		dimensionNames: ['Period', 'Morpho', 'Gearbox', 'Adjusted TVA'],
		encode: { x: [0], y: [yIndex] },
		data
	}
}

const formatterOf = (options: ReturnType<typeof kpkCompositionChartOptions>) =>
	options?.tooltip?.formatter as (params: unknown) => string

const formatter = formatterOf(KPK_COMPOSITION_CHART_OPTIONS)

/** The tooltip as a reader sees it: one line per row, top to bottom, as [name, value]. */
function readRows(html: string): Array<[string, string]> {
	const host = document.createElement('div')
	host.innerHTML = html
	return [...host.querySelectorAll('li')].map((line) => {
		const spans = [...line.querySelectorAll(':scope > span')]
		const [name, value] = spans.slice(-2)
		return [name?.textContent ?? '', value?.textContent ?? '']
	})
}

describe('KPK composition tooltip', () => {
	test('heads with the period label the payload sent, not a reconstructed date', () => {
		const html = formatter([item('Morpho', 'Sept 25', 34_650_000, 1)])

		expect(html).toContain('<strong>Sept 25</strong>')
	})

	test('omits the total when only one segment is on the chart', () => {
		const html = formatter([item('Morpho', 'Aug 26', 34_650_000, 1)])

		expect(readRows(html)).toEqual([['Morpho', '$34.65m']])
	})

	test('keeps the overlay line out of the total and prints it under the rule', () => {
		const html = formatterOf(kpkCompositionChartOptions('Adjusted TVA'))([
			item('Morpho', 'Aug 26', 34_650_000, 1),
			item('Gearbox', 'Aug 26', 11_360_000, 2),
			item('Adjusted TVA', 'Aug 26', 40_000_000, 3)
		])

		const rows = readRows(html)
		expect(rows).toContainEqual(['Total', '$46.01m'])
		expect(rows.at(-1)?.[0]).toBe('Adjusted TVA')
	})

	test('drops a sub-cent dust reading instead of spelling it out', () => {
		const html = formatter([
			item('Morpho', 'Aug 26', 34_650_000, 1),
			item('Gearbox', 'Aug 26', 11_360_000, 2),
			item('Unallocated', 'Aug 26', 1.1e-9, 3)
		])

		expect(html).not.toContain('Unallocated')
		expect(html).not.toMatch(/\$0\.0{3,}/)
		expect(readRows(html)).toContainEqual(['Total', '$46.01m'])
	})

	test('keeps a real reading of a few dollars', () => {
		const html = formatter([item('Morpho', 'Aug 26', 4.25, 1)])

		expect(readRows(html)).toEqual([['Morpho', '$4.25']])
	})

	test('prints values compact with a lowercase suffix, held to two decimals', () => {
		const value = (usd: number) => readRows(formatter([item('Morpho', 'Aug 26', usd, 1)]))[0][1]

		expect(value(12.12762384533)).toBe('$12.13')
		expect(value(1234.5678)).toBe('$1.23k')
		expect(value(70_000)).toBe('$70k')
	})

	// The renderer's category formatter omits the total; a stacked composition needs it.
	test('adds a Total under the segments, held to their precision', () => {
		const html = formatter([item('Morpho', 'Aug 26', 34_650_000, 1), item('Gearbox', 'Aug 26', 11_360_000, 2)])

		expect(readRows(html)).toEqual([
			['Morpho', '$34.65m'],
			['Gearbox', '$11.36m'],
			['Total', '$46.01m']
		])
	})

	test('sums the overlay series like any other when no breakdown claims it', () => {
		const html = formatter([item('Morpho', 'Aug 26', 34_650_000, 1), item('Adjusted TVA', 'Aug 26', 40_000_000, 3)])

		expect(readRows(html)).toContainEqual(['Total', '$74.65m'])
	})

	test('lists the segments largest first, whatever order the series arrive in', () => {
		const html = formatterOf(kpkCompositionChartOptions('Adjusted TVA'))([
			item('Gearbox', 'Aug 26', 11_360_000, 2),
			item('Adjusted TVA', 'Aug 26', 40_000_000, 3),
			item('Morpho', 'Aug 26', 34_650_000, 1)
		])

		expect(readRows(html).map(([name]) => name)).toEqual(['Morpho', 'Gearbox', 'Total', 'Adjusted TVA'])
	})
})

describe('KPK composition range slider', () => {
	// The chart's zoom defaults are [inside, slider]; ECharts hands a category slider the
	// bar index and its label, and the index read as a date is 1 Jan 1970.
	test('labels the slider handles with the period, not a date', () => {
		for (const options of [KPK_COMPOSITION_CHART_OPTIONS, kpkCompositionChartOptions('Adjusted TVA')]) {
			const zoom = options?.dataZoom as Array<{ labelFormatter?: (value: number, valueStr: string) => string }>
			expect(zoom[1].labelFormatter?.(3, 'Sept 25')).toBe('Sept 25')
		}
	})
})
