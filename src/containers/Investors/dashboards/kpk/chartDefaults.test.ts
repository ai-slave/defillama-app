// @vitest-environment happy-dom

import { describe, expect, test } from 'vitest'
import {
	KPK_COMPOSITION_CHART_OPTIONS,
	KPK_LINE_STROKE_DARK,
	KPK_LINE_STROKE_LIGHT,
	KPK_PALETTE_DARK,
	KPK_PALETTE_LIGHT,
	kpkCompositionChartOptions,
	kpkLineStroke,
	kpkPalette
} from './chartDefaults'

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

	// The renderer's category formatter omits the total; a stacked composition needs it.
	test('adds a ruled total under the segment rows', () => {
		const html = formatter([item('Morpho', 'Aug 26', 34_650_000, 1), item('Gearbox', 'Aug 26', 11_360_000, 2)])

		expect(html).toContain('Morpho')
		expect(html).toContain('Gearbox')
		expect(html).toContain('Total')
		expect(html).toContain('border-top')
	})

	test('omits the total when only one segment is on the chart', () => {
		const html = formatter([item('Morpho', 'Aug 26', 34_650_000, 1)])

		expect(html).not.toContain('Total')
	})

	test('returns nothing for an empty hover', () => {
		expect(formatter([])).toBe('')
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

	test('holds a long fraction above a dollar to two decimals', () => {
		expect(formatter([item('Morpho', 'Aug 26', 12.12762384533, 1)])).toContain('$12.13')
	})

	test('compacts on the same thresholds as the share table', () => {
		expect(formatter([item('Morpho', 'Aug 26', 70_000, 1)])).toContain('$70k')
		expect(formatter([item('Morpho', 'Aug 26', 1234.5678, 1)])).toContain('$1.23k')
	})

	test('holds segments and the ruled Total to the same precision', () => {
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

	test('sets every figure flush right, in tabular digits', () => {
		const host = document.createElement('div')
		host.innerHTML = formatter([item('Morpho', 'Aug 26', 34_650_000, 1), item('Gearbox', 'Aug 26', 11_360_000, 2)])
		const lines = [...host.querySelectorAll('li')]

		expect(lines).toHaveLength(3)
		for (const line of lines) {
			expect(line.style.display).toBe('flex')
			const value = line.querySelector<HTMLElement>(':scope > span:last-child')!
			expect(value.style.marginLeft).toBe('auto')
			expect(value.style.fontVariantNumeric).toBe('tabular-nums')
		}
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

describe('KPK palette', () => {
	// Validated per theme with the dataviz validator; see the note in chartDefaults.ts.
	// Eight is the ceiling — a ninth series must fold into "Other" rather than grow this.
	test('offers eight distinct slots per theme', () => {
		for (const palette of [KPK_PALETTE_DARK, KPK_PALETTE_LIGHT]) {
			expect(palette).toHaveLength(8)
			expect(new Set(palette).size).toBe(8)
			for (const color of palette) expect(color).toMatch(/^#[0-9a-f]{6}$/)
		}
	})

	test('steps separately for light and dark surfaces', () => {
		expect(kpkPalette(true)).toBe(KPK_PALETTE_DARK)
		expect(kpkPalette(false)).toBe(KPK_PALETTE_LIGHT)
		// The mockup's own mint is 1.65:1 on white, so the two palettes must not be equal.
		expect(KPK_PALETTE_DARK[0]).not.toBe(KPK_PALETTE_LIGHT[0])
	})

	test('keeps the overlay stroke out of the categorical slots', () => {
		expect(kpkLineStroke(true)).toBe(KPK_LINE_STROKE_DARK)
		expect(kpkLineStroke(false)).toBe(KPK_LINE_STROKE_LIGHT)
		expect(KPK_PALETTE_DARK).not.toContain(KPK_LINE_STROKE_DARK)
		expect(KPK_PALETTE_LIGHT).not.toContain(KPK_LINE_STROKE_LIGHT)
	})
})
