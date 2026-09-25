import * as echarts from 'echarts'
import { afterEach, expect, test } from 'vitest'
import { registerTreemapFocusTracking } from '../focus'

let chart: echarts.ECharts

afterEach(() => chart.dispose())

// Clicks reach listeners through the instance's event bus; there is no pointer in an SSR chart.
const click = (params: Record<string, unknown>) =>
	(chart as unknown as { trigger(event: string, params: unknown): void }).trigger('click', params)

function treemap() {
	chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 600, height: 400 })
	chart.setOption({
		series: [
			{
				type: 'treemap',
				data: [
					{ name: 'Finance', value: 5, children: [{ name: 'Bank', value: 5 }] },
					{
						name: 'Technology',
						value: 10,
						children: [
							{ name: 'Microsoft', value: 4 },
							{ name: 'Apple', value: 6 }
						]
					}
				]
			}
		]
	})
	return chart
}

function focusedNode() {
	return (chart as unknown as { __llamaTreemapFocusNode?: unknown }).__llamaTreemapFocusNode
}

function dataIndexOf(name: string) {
	const data = (chart as unknown as { getModel(): any }).getModel().getSeriesByIndex(0).getData()
	for (let index = 0; index < data.count(); index++) if (data.getName(index) === name) return index
	throw new Error(`No treemap node named ${name}`)
}

test('records the drilled node path for PNG export and forgets it on restore', () => {
	registerTreemapFocusTracking(treemap())
	click({ seriesType: 'treemap', seriesIndex: 0, dataIndex: dataIndexOf('Apple') })

	expect(focusedNode()).toEqual({ id: 'Apple', path: ['Technology', 'Apple'], indexPath: [1, 1] })

	chart.dispatchAction({ type: 'restore' })
	expect(focusedNode()).toBeUndefined()
})

test('ignores clicks on other series types and stops tracking once unregistered', () => {
	const unregister = registerTreemapFocusTracking(treemap())
	click({ seriesType: 'pie', seriesIndex: 0, dataIndex: dataIndexOf('Apple') })
	expect(focusedNode()).toBeUndefined()

	unregister()
	click({ seriesType: 'treemap', seriesIndex: 0, dataIndex: dataIndexOf('Apple') })
	expect(focusedNode()).toBeUndefined()
})
