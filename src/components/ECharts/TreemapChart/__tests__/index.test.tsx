// @vitest-environment happy-dom

import * as echarts from 'echarts/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import TreemapChart from '..'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	installChartCanvas()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

test('hovering a narrative token shows its name, return and market cap in the tooltip', async () => {
	await act(async () =>
		root.render(
			<TreemapChart
				variant="narrative"
				treeData={[
					{
						name: 'AI',
						path: 'AI',
						value: [2_500_000_000, 12.5, 12.5],
						children: [{ name: 'Render', path: 'AI/Render', value: [2_500_000_000, 12.5, 12.5] }]
					}
				]}
			/>
		)
	)
	const instance = echarts.getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!
	await act(async () => instance.dispatchAction({ type: 'showTip', seriesIndex: 0, name: 'Render' }))

	// The canvas draws the boxes, so the tooltip is the only text in the chart.
	expect(container.textContent).toBe('RenderReturn: 12.5%Market Cap: $2.5b')
})

test('hovering a flat tile shows its name and value with the value label and symbol', async () => {
	await act(async () =>
		root.render(
			<TreemapChart
				variant="flat"
				colorMode="categorical"
				valueLabel="Collected"
				valueSymbol="S"
				treeData={[
					{ name: 'Shadow', value: [2_500_000, null, null] },
					{ name: 'Beets', value: [400, null, null] }
				]}
			/>
		)
	)
	const instance = echarts.getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!
	await act(async () => instance.dispatchAction({ type: 'showTip', seriesIndex: 0, name: 'Shadow' }))

	expect(container.textContent).toBe('ShadowCollected: 2.5M S')
})
