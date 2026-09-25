// @vitest-environment happy-dom

import * as echarts from 'echarts/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { EquitiesTreemapNode, IEquitiesTreemapLeaf } from '~/containers/Equities/treemapData'
import { installChartCanvas } from '~/utils/test/chartCanvas'
import MarketTreemapChart from '.'

function leaf(marketCap: number): IEquitiesTreemapLeaf {
	return {
		name: 'TEST',
		value: [marketCap, 1.5],
		iconKey: 0,
		iconUrl: 'US:TEST',
		itemStyle: { color: 'rgb(104, 165, 115)' },
		companyName: 'Test Company',
		country: 'US',
		sector: 'Technology',
		industry: 'Software',
		marketCap
	} as IEquitiesTreemapLeaf
}

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

function chart() {
	return echarts.getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!
}

const render = (treeData: Array<EquitiesTreemapNode>, leaves: Array<IEquitiesTreemapLeaf>, onReady = vi.fn()) =>
	act(async () =>
		root.render(
			<MarketTreemapChart
				treeData={treeData}
				leaves={leaves}
				sizeLabel="Market Cap"
				colorLabel="Price 1D"
				onReady={onReady}
			/>
		)
	)

test('keeps one chart through data and grouping changes, dropping a stale drill-down, and releases it on unmount', async () => {
	const onReady = vi.fn()
	const leaves = [leaf(100)]
	await render(leaves, leaves, onReady)
	const instance = chart()
	;(instance as unknown as { trigger(event: string, params: unknown): void }).trigger('click', {
		seriesType: 'treemap',
		seriesIndex: 0,
		dataIndex: 1
	})
	expect(instance).toHaveProperty('__llamaTreemapFocusNode')

	const grouped = [leaf(200)]
	await render([{ name: 'Technology', value: [200, null], children: grouped }], grouped, onReady)

	expect(chart()).toBe(instance)
	expect(instance).not.toHaveProperty('__llamaTreemapFocusNode')
	const [group] = (instance.getOption() as Record<string, any>).series[0].data
	expect(group.name).toBe('Technology')
	expect(group.children.map((child: IEquitiesTreemapLeaf) => child.value)).toEqual([[200, 1.5]])

	await act(async () => root.unmount())
	expect(instance.isDisposed()).toBe(true)
	expect(onReady.mock.calls).toEqual([[instance], [null]])
})
