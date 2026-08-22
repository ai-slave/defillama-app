import { describe, expect, it } from 'vitest'
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

describe('KPK composition tooltip', () => {
	it('heads with the period label the payload sent, not a reconstructed date', () => {
		const html = formatter([item('Morpho', 'Sept 25', 34_650_000, 1)])

		expect(html).toContain('<strong>Sept 25</strong>')
	})

	// The renderer's category formatter omits the total; a stacked composition needs it.
	it('adds a ruled total under the segment rows', () => {
		const html = formatter([item('Morpho', 'Aug 26', 34_650_000, 1), item('Gearbox', 'Aug 26', 11_360_000, 2)])

		expect(html).toContain('Morpho')
		expect(html).toContain('Gearbox')
		expect(html).toContain('Total')
		expect(html).toContain('border-top')
	})

	it('omits the total when only one segment is on the chart', () => {
		const html = formatter([item('Morpho', 'Aug 26', 34_650_000, 1)])

		expect(html).not.toContain('Total')
	})

	it('returns nothing for an empty hover', () => {
		expect(formatter([])).toBe('')
	})

	it('keeps the overlay line out of the total and prints it under the rule', () => {
		const html = formatterOf(kpkCompositionChartOptions('Adjusted TVA'))([
			item('Morpho', 'Aug 26', 34_650_000, 1),
			item('Gearbox', 'Aug 26', 11_360_000, 2),
			item('Adjusted TVA', 'Aug 26', 40_000_000, 3)
		])

		expect(html).toContain('Total&nbsp;&nbsp;$46.01m')
		expect(html.indexOf('Adjusted TVA')).toBeGreaterThan(html.indexOf('Total'))
	})

	it('drops a sub-cent dust reading instead of spelling it out', () => {
		const html = formatter([
			item('Morpho', 'Aug 26', 34_650_000, 1),
			item('Gearbox', 'Aug 26', 11_360_000, 2),
			item('Unallocated', 'Aug 26', 1.1e-9, 3)
		])

		expect(html).not.toContain('Unallocated')
		expect(html).not.toMatch(/\$0\.0{3,}/)
		expect(html).toContain('Total&nbsp;&nbsp;$46.01m')
	})

	it('keeps a real reading of a few dollars', () => {
		const html = formatter([item('Morpho', 'Aug 26', 4.25, 1)])

		expect(html).toContain('Morpho&nbsp;&nbsp;$4.25')
	})

	it('holds a long fraction above a dollar to two decimals', () => {
		expect(formatter([item('Morpho', 'Aug 26', 12.12762384533, 1)])).toContain('$12.13')
	})

	it('compacts on the same thresholds as the share table', () => {
		expect(formatter([item('Morpho', 'Aug 26', 70_000, 1)])).toContain('$70k')
		expect(formatter([item('Morpho', 'Aug 26', 1234.5678, 1)])).toContain('$1.23k')
	})

	it('sums the overlay series like any other when no breakdown claims it', () => {
		const html = formatter([item('Morpho', 'Aug 26', 34_650_000, 1), item('Adjusted TVA', 'Aug 26', 40_000_000, 3)])

		expect(html).toContain('Total&nbsp;&nbsp;$74.65m')
	})
})

describe('KPK palette', () => {
	// Validated per theme with the dataviz validator; see the note in chartDefaults.ts.
	// Eight is the ceiling — a ninth series must fold into "Other" rather than grow this.
	it('offers eight distinct slots per theme', () => {
		for (const palette of [KPK_PALETTE_DARK, KPK_PALETTE_LIGHT]) {
			expect(palette).toHaveLength(8)
			expect(new Set(palette).size).toBe(8)
			for (const color of palette) expect(color).toMatch(/^#[0-9a-f]{6}$/)
		}
	})

	it('steps separately for light and dark surfaces', () => {
		expect(kpkPalette(true)).toBe(KPK_PALETTE_DARK)
		expect(kpkPalette(false)).toBe(KPK_PALETTE_LIGHT)
		// The mockup's own mint is 1.65:1 on white, so the two palettes must not be equal.
		expect(KPK_PALETTE_DARK[0]).not.toBe(KPK_PALETTE_LIGHT[0])
	})

	it('keeps the overlay stroke out of the categorical slots', () => {
		expect(kpkLineStroke(true)).toBe(KPK_LINE_STROKE_DARK)
		expect(kpkLineStroke(false)).toBe(KPK_LINE_STROKE_LIGHT)
		expect(KPK_PALETTE_DARK).not.toContain(KPK_LINE_STROKE_DARK)
		expect(KPK_PALETTE_LIGHT).not.toContain(KPK_LINE_STROKE_LIGHT)
	})
})
