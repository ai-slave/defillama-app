import * as echarts from 'echarts'
import { describe, expect, test } from 'vitest'
import { chartHorizontalScrollLegend, chartHorizontalScrollLegendGeometry } from './chartSpacing'

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

function getLegendBounds(names: Array<string>) {
	const width = 1000
	const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height: 200 })
	chart.setOption({
		legend: { type: 'scroll', ...chartHorizontalScrollLegendGeometry },
		xAxis: {},
		yAxis: {},
		series: names.map((name) => ({ name, type: 'bar', data: [1] }))
	})

	const views = (chart as unknown as { _componentsViews: Array<ScrollLegendView> })._componentsViews
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
	test('preserves requested legend placement', () => {
		expect(chartHorizontalScrollLegend({ right: 108, top: 12 })).toMatchObject({
			right: 108,
			top: 12
		})
	})

	test('keeps a short legend right-aligned with 8px visible spacing and no pager', () => {
		const bounds = getLegendBounds(['Inflows', 'Outflows', 'Onchain Mcap'])

		expect(bounds.hasPager).toBe(false)
		expect(1000 - bounds.right).toBeCloseTo(8)
	})

	test('clips an oversized legend and its pager to 8px from both chart edges', () => {
		const bounds = getLegendBounds(['Oversized legend '.repeat(30)])

		expect(bounds.hasPager).toBe(true)
		expect(bounds.left).toBeCloseTo(8)
		expect(1000 - bounds.right).toBeCloseTo(8)
	})
})
