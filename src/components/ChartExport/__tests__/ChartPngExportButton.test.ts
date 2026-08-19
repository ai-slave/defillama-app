import { describe, expect, it, vi } from 'vitest'
import {
	applyTreemapViewportExportState,
	getTreemapTargetDataRoot,
	mutateAndWaitForChartRender,
	readTreemapViewportExportState,
	sanitizeRichImagesForExport,
	scaleXAxisForExport,
	scaleYAxisForExport
} from '../ChartPngExportButton'

describe('mutateAndWaitForChartRender', () => {
	it('subscribes before a mutation emits rendered synchronously', async () => {
		let rendered: (() => void) | null = null
		const chart = {
			on: vi.fn((_event: string, handler: () => void) => {
				rendered = handler
			}),
			off: vi.fn()
		} as any
		const mutate = vi.fn(() => rendered?.())

		await mutateAndWaitForChartRender(chart, mutate)

		expect(chart.on).toHaveBeenCalledBefore(mutate)
		expect(chart.off).toHaveBeenCalledWith('rendered', expect.any(Function))
	})
})

describe('sanitizeRichImagesForExport', () => {
	it('converts readable canvases to data URLs and removes tainted canvases without mutating the source', () => {
		const safeCanvas = { toDataURL: () => 'data:image/png;base64,safe' }
		const taintedCanvas = {
			toDataURL: () => {
				throw new DOMException('The canvas has been tainted', 'SecurityError')
			}
		}
		const rich = {
			safe: { backgroundColor: { image: safeCanvas } },
			tainted: { backgroundColor: { image: taintedCanvas } },
			text: { fontSize: 12 }
		}

		const sanitized = sanitizeRichImagesForExport(rich)

		expect(sanitized.safe.backgroundColor.image).toBe('data:image/png;base64,safe')
		expect(sanitized.tainted.backgroundColor).toBeUndefined()
		expect(sanitized.text).toBe(rich.text)
		expect(rich.tainted.backgroundColor.image).toBe(taintedCanvas)
	})
})

describe('treemap viewport export', () => {
	it('uses an index path to distinguish duplicate sibling names in a focused export', () => {
		const first = { name: 'Duplicate', value: 1 }
		const second = { name: 'Duplicate', value: 2, children: [{ name: 'Target', value: 2 }] }
		expect(
			getTreemapTargetDataRoot(
				{ name: 'All', data: [first, second] },
				{
					actionType: 'treemapZoomToNode',
					targetNodePath: ['All', 'Duplicate'],
					targetNodeIndexPath: [1]
				}
			)
		).toEqual({ name: 'Duplicate', data: second.children })
	})

	it('resolves a stashed focus path against clone-local node ids before dispatching', () => {
		const sourceSeries = { id: 'source', getData: () => ({ tree: { root: {} } }) }
		const originalChart = {
			__llamaTreemapFocusNode: { id: 'source-node', path: ['All', 'Technology'] },
			getModel: () => ({ getSeriesByType: () => [sourceSeries] })
		} as any
		const state = readTreemapViewportExportState(originalChart)
		expect(state).toMatchObject({ actionType: 'treemapZoomToNode', targetNodePath: ['All', 'Technology'] })

		const cloneNode = {
			getAncestors: () => [{ name: 'All' }, { name: 'Technology' }],
			getId: () => 'clone-node'
		}
		const cloneRoot = {
			getNodeById: () => null,
			eachNode: (visit: (node: typeof cloneNode) => unknown) => visit(cloneNode)
		}
		const cloneSeries = { id: 'clone-series', getData: () => ({ tree: { root: cloneRoot } }) }
		const dispatchAction = vi.fn()
		const cloneChart = {
			getModel: () => ({ getSeriesByType: () => [cloneSeries] }),
			dispatchAction
		} as any

		expect(applyTreemapViewportExportState(cloneChart, state!)).toBe(true)
		expect(dispatchAction).toHaveBeenCalledWith({
			type: 'treemapZoomToNode',
			seriesId: 'clone-series',
			targetNodeId: 'clone-node'
		})
	})
})

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
import { BASE_TOP_PADDING, computeExportLayout, EXPORT_HALLMARK_LABEL_RESERVE } from '../chartPngExportLayout'

describe('scaleYAxisForExport', () => {
	// EXPORT_FONT_SIZE = 24; on-screen category labels use the ECharts default 12px font.
	it('hides the cloned hbar hover shadow without mutating the live axis state', () => {
		const axis = {
			type: 'category' as const,
			axisPointer: {
				type: 'shadow' as const,
				status: 'show' as const,
				value: 2,
				seriesDataIndices: [{ seriesIndex: 0, dataIndex: 2, dataIndexInside: 2 }]
			}
		}

		const [scaled] = scaleYAxisForExport([axis], true)

		expect(scaled.axisPointer).toMatchObject({ type: 'shadow', status: 'hide', value: 2 })
		expect(axis.axisPointer.status).toBe('show')
	})

	it('preserves an explicit axis pointer outside hbar exports', () => {
		const [scaled] = scaleYAxisForExport(
			[{ type: 'category', axisPointer: { type: 'shadow', status: 'show', value: 2 } }],
			false
		)

		expect(scaled.axisPointer).toMatchObject({ type: 'shadow', status: 'show', value: 2 })
	})

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

	it('reserves a row for hallmark labels on a legend-less chart so they are not clipped', () => {
		const base = {
			title: undefined,
			legendItems: [],
			shouldShowLegend: false,
			hasIcon: false,
			expandLegend: undefined
		}
		const without = computeExportLayout(base)
		const with_ = computeExportLayout({ ...base, hasMarkLineHallmarks: true })

		expect(with_.gridTop).toBeGreaterThan(without.gridTop)
		expect(with_.gridTop).toBe(BASE_TOP_PADDING + EXPORT_HALLMARK_LABEL_RESERVE)
	})

	it('keeps the taller header reserve when a title already clears the hallmark row', () => {
		const base = {
			title: 'Pump.fun Daily Fees',
			legendItems: ['Daily Fees'],
			shouldShowLegend: true,
			hasIcon: true,
			expandLegend: undefined
		}

		expect(computeExportLayout({ ...base, hasMarkLineHallmarks: true }).gridTop).toBe(computeExportLayout(base).gridTop)
	})

	it('reserves one row no matter how many hallmarks there are — they share a single label row', () => {
		const layout = (hasMarkLineHallmarks: boolean) =>
			computeExportLayout({
				title: undefined,
				legendItems: [],
				shouldShowLegend: false,
				hasIcon: false,
				expandLegend: undefined,
				hasMarkLineHallmarks
			})

		expect(layout(true).gridTop - layout(false).gridTop).toBe(EXPORT_HALLMARK_LABEL_RESERVE)
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
