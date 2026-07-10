import { describe, expect, it } from 'vitest'
import { scaleXAxisForExport, scaleYAxisForExport } from '../ChartPngExportButton'

describe('scaleXAxisForExport', () => {
	it('keeps every rotated category label in the export instead of re-hiding overlaps', () => {
		const [scaled] = scaleXAxisForExport([
			{ type: 'category', axisLabel: { interval: 0, rotate: 35, hideOverlap: false } }
		])
		expect(scaled.axisLabel).toMatchObject({ interval: 0, rotate: 35, hideOverlap: false, fontSize: 24 })
	})

	it('hides overlaps for a normal (non-rotated) axis', () => {
		const [scaled] = scaleXAxisForExport([{ type: 'category', axisLabel: {} }])
		expect(scaled.axisLabel.hideOverlap).toBe(true)
	})

	it('uses native ECharts formatting and hides overlapping time-axis labels', () => {
		const [scaled] = scaleXAxisForExport([{ type: 'time', axisLabel: {} }])
		expect(scaled.axisLabel.formatter).toBeUndefined()
		expect(scaled.axisLabel.hideOverlap).toBe(true)
	})

	it('preserves an explicit time-axis formatter', () => {
		const formatter = () => 'custom'
		const [scaled] = scaleXAxisForExport([{ type: 'time', axisLabel: { formatter } }])
		expect(scaled.axisLabel.formatter).toBe(formatter)
	})
})
import { getChartExportIconFetchUrl } from '../chartPngExportIcon'
import { computeExportLayout } from '../chartPngExportLayout'

describe('scaleYAxisForExport', () => {
	// EXPORT_FONT_SIZE = 24; on-screen category labels use the ECharts default 12px font.
	it('scales the category-label width cap by the font ratio so the doubled export font keeps the same visible length', () => {
		// horizontal bar y-axis: venue names truncated to 120px at 12px on screen ("Bybit.eu (MiCA)" fits)
		const [scaled] = scaleYAxisForExport([{ type: 'category', axisLabel: { width: 120, overflow: 'truncate' } }], true)
		// 120 * 24 / 12 = 240 → same character capacity at the doubled font
		expect(scaled.axisLabel.width).toBe(240)
		expect(scaled.axisLabel.fontSize).toBe(24)
	})

	it('honors an explicit on-screen label fontSize when computing the ratio', () => {
		const [scaled] = scaleYAxisForExport([{ axisLabel: { width: 120, fontSize: 16 } }], true)
		// 120 * 24 / 16 = 180
		expect(scaled.axisLabel.width).toBe(180)
	})

	it('leaves a value axis (no width cap) uncapped', () => {
		const [scaled] = scaleYAxisForExport([{ type: 'value', axisLabel: {} }], false)
		expect(scaled.axisLabel.width).toBeUndefined()
	})
})

describe('computeExportLayout', () => {
	it('reserves legend space for a single exported metric', () => {
		const layout = computeExportLayout({
			title: 'Polymarket',
			legendItems: ['Revenue'],
			shouldShowLegend: true,
			hasIcon: true,
			expandLegend: undefined
		})

		expect(layout.hasLegend).toBe(true)
		expect(layout.legendRows).toBe(1)
		expect(layout.gridTop).toBeGreaterThan(layout.legendTop)
	})

	it('does not reserve legend space when there are no legend items', () => {
		const layout = computeExportLayout({
			title: 'Polymarket',
			legendItems: [],
			shouldShowLegend: true,
			hasIcon: true,
			expandLegend: undefined
		})

		expect(layout.hasLegend).toBe(false)
	})
})

describe('getChartExportIconFetchUrl', () => {
	it('routes protocol icons through the protocol icon API', () => {
		expect(getChartExportIconFetchUrl('https://icons.llamao.fi/icons/protocols/aave?w=48&h=48')).toBe(
			'/api/public/protocol-icon?slug=aave'
		)
	})

	it('routes chain icons through the chain icon API', () => {
		expect(getChartExportIconFetchUrl('https://icons.llamao.fi/icons/chains/rsz_ethereum?w=48&h=48')).toBe(
			'/api/public/chain-icon?slug=ethereum'
		)
	})

	it('falls back to the generic icon proxy for other allowed icon URLs', () => {
		const url = 'https://token-icons.llamao.fi/icons/tokens/gecko/ethereum?w=48&h=48'
		expect(getChartExportIconFetchUrl(url)).toBe(`/api/public/icon-proxy?url=${encodeURIComponent(url)}`)
	})
})
