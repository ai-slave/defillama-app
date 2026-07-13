import * as echarts from 'echarts'
import { describe, expect, it } from 'vitest'
import { chartHorizontalScrollLegendGeometry } from './chartSpacing'

type Rect = { x: number; width: number }
type Group = { x: number; getBoundingRect: () => Rect }
type ScrollLegendView = {
	type: string
	group: { x: number }
	_showController: boolean
	_containerGroup: { x: number }
	_controllerGroup: Group
	getContentGroup: () => Group
}

function getLegendBounds(names: string[]) {
	const width = 1_000
	const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height: 200 })
	chart.setOption({
		legend: { type: 'scroll', ...chartHorizontalScrollLegendGeometry },
		xAxis: {},
		yAxis: {},
		series: names.map((name) => ({ name, type: 'bar', data: [1] }))
	})

	const views = (chart as unknown as { _componentsViews: ScrollLegendView[] })._componentsViews
	const legend = views.find((view) => view.type === 'legend.scroll')!
	const content = legend.getContentGroup()
	const contentRect = content.getBoundingRect()
	const controllerRect = legend._controllerGroup.getBoundingRect()
	const hasPager = legend._showController
	const left = hasPager
		? legend.group.x + legend._containerGroup.x
		: legend.group.x + legend._containerGroup.x + content.x + contentRect.x
	const right = hasPager
		? legend.group.x + legend._controllerGroup.x + controllerRect.x + controllerRect.width
		: legend.group.x + legend._containerGroup.x + content.x + contentRect.x + contentRect.width

	chart.dispose()
	return { hasPager, left, right }
}

describe('horizontal scroll legend geometry', () => {
	it('keeps a short legend right-aligned with 8px visible spacing', () => {
		const bounds = getLegendBounds(['Inflows', 'Outflows', 'Onchain Mcap'])

		expect(bounds.hasPager).toBe(false)
		expect(1_000 - bounds.right).toBeCloseTo(8)
	})

	it('clips one oversized legend item to 8px on both sides', () => {
		const bounds = getLegendBounds(['Oversized legend '.repeat(30)])

		expect(bounds.hasPager).toBe(true)
		expect(bounds.left).toBeCloseTo(8)
		expect(1_000 - bounds.right).toBeCloseTo(8)
	})
})
