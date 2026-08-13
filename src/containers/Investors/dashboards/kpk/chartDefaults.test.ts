import { describe, expect, it } from 'vitest'
import { KPK_MONTHLY_USD_CHART_OPTIONS, KPK_PALETTE_DARK, KPK_PALETTE_LIGHT, kpkPalette } from './chartDefaults'

/** One stacked segment as ECharts hands it to a tooltip formatter: positional row + encode. */
function item(seriesName: string, month: string, value: number, yIndex: number) {
	return {
		seriesName,
		axisValue: month,
		marker: `<span data-series="${seriesName}"></span>`,
		dimensionNames: ['Month', 'Morpho', 'Gearbox', 'Euler'],
		encode: { x: [0], y: [yIndex] },
		data: [month, 34.65, 11.36, 1.54]
	}
}

const formatter = KPK_MONTHLY_USD_CHART_OPTIONS?.tooltip?.formatter as (params: unknown) => string

describe('KPK monthly composition tooltip', () => {
	it('heads with the month label the payload sent, not a reconstructed date', () => {
		const html = formatter([item('Morpho', 'Sept 25', 34.65, 1)])

		expect(html).toContain('<strong>Sept 25</strong>')
	})

	// The renderer's category formatter omits the total; a stacked composition needs it.
	it('adds a ruled total under the segment rows', () => {
		const html = formatter([item('Morpho', 'Aug 26', 34.65, 1), item('Gearbox', 'Aug 26', 11.36, 2)])

		expect(html).toContain('Morpho')
		expect(html).toContain('Gearbox')
		expect(html).toContain('Total')
		expect(html).toContain('border-top')
	})

	it('omits the total when only one segment is on the chart', () => {
		const html = formatter([item('Morpho', 'Aug 26', 34.65, 1)])

		expect(html).not.toContain('Total')
	})

	it('returns nothing for an empty hover', () => {
		expect(formatter([])).toBe('')
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
})
