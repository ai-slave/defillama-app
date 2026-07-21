// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EquitiesTreemapNode, IEquitiesTreemapLeaf } from '~/containers/Equities/treemapData'

const mocks = vi.hoisted(() => {
	const instance = {
		dispatchAction: vi.fn(),
		dispose: vi.fn(),
		off: vi.fn(),
		on: vi.fn(),
		getModel: vi.fn(() => ({
			getSeriesByIndex: () => ({
				getData: () => ({ getItemLayout: () => ({ width: 200, height: 200 }) })
			})
		})),
		isDisposed: vi.fn(() => false),
		resize: vi.fn(),
		setOption: vi.fn()
	}
	return {
		init: vi.fn(() => instance),
		instance,
		use: vi.fn()
	}
})

vi.mock('echarts/core', () => ({
	init: mocks.init,
	use: mocks.use
}))

vi.mock('~/contexts/LocalStorage', () => ({
	useDarkModeManager: () => [false]
}))

vi.mock('~/hooks/useChartResize', () => ({
	useChartResize: () => undefined
}))

vi.mock('~/utils', () => ({
	formattedNum: (value: number) => String(value)
}))

vi.mock('~/utils/icons', () => ({
	equityIconUrl: (name: string, country: string) => `${country}:${name}`
}))

import MarketTreemapChart from '.'

function makeTreeData(size: number): EquitiesTreemapNode[] {
	return [
		{
			name: 'TEST',
			value: [size, 1.5],
			iconKey: 0,
			iconUrl: 'US:TEST',
			itemStyle: { color: 'rgb(104, 165, 115)' },
			companyName: 'Test Company',
			country: 'US',
			sector: 'Technology',
			industry: 'Software',
			marketCap: 100
		}
	]
}

describe('MarketTreemapChart lifecycle', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		vi.clearAllMocks()
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
	})

	it('reuses the existing ECharts instance across prop updates', async () => {
		const onReady = vi.fn()
		const firstTreeData = makeTreeData(100)
		await act(async () => {
			root.render(
				<MarketTreemapChart
					treeData={firstTreeData}
					leaves={firstTreeData as IEquitiesTreemapLeaf[]}
					sizeLabel="Market Cap"
					colorLabel="Price 1D"
					onReady={onReady}
				/>
			)
		})

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.dispose).not.toHaveBeenCalled()
		expect(onReady).toHaveBeenLastCalledWith(mocks.instance)
		const firstOption = mocks.instance.setOption.mock.calls.at(-1)?.[0]
		const canonicalLeaf = firstTreeData[0] as IEquitiesTreemapLeaf
		const chartLeaf = firstOption.series[0].data[0]
		expect(chartLeaf.value).toBe(canonicalLeaf.value)
		expect(chartLeaf.itemStyle).toBe(canonicalLeaf.itemStyle)
		expect(firstTreeData[0]).not.toHaveProperty('label')
		expect(
			firstOption.series[0].label.formatter({
				data: chartLeaf,
				name: 'TEST',
				value: [100, 1.5],
				seriesIndex: 0,
				dataIndex: 0
			})
		).toBe('{icon48|}\n{ticker18|TEST}\n{chg15|+1.50%}')

		const nextTreeData = makeTreeData(200)
		Object.assign(mocks.instance, {
			__llamaTreemapFocusNode: { id: 'technology/test', path: ['Technology', 'TEST'] },
			__llamaTreemapFocusNodeId: 'technology/test'
		})
		await act(async () => {
			root.render(
				<MarketTreemapChart
					treeData={nextTreeData}
					leaves={nextTreeData as IEquitiesTreemapLeaf[]}
					sizeLabel="Revenue"
					colorLabel="Price 7D"
					onReady={onReady}
				/>
			)
		})

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.dispose).not.toHaveBeenCalled()
		expect(mocks.instance).not.toHaveProperty('__llamaTreemapFocusNode')
		expect(mocks.instance).not.toHaveProperty('__llamaTreemapFocusNodeId')
		expect(mocks.instance.setOption.mock.calls.at(-1)?.[1]).toEqual({ notMerge: true })
	})

	it('reuses canvas-decorated leaves when only the grouping changes', async () => {
		const leaves = makeTreeData(100) as IEquitiesTreemapLeaf[]
		await act(async () => {
			root.render(<MarketTreemapChart treeData={leaves} leaves={leaves} sizeLabel="Market Cap" colorLabel="Price 1D" />)
		})
		const flatLeaf = mocks.instance.setOption.mock.calls.at(-1)?.[0].series[0].data[0]
		const groupedTree: EquitiesTreemapNode[] = [{ name: 'Technology', value: [100, null], children: leaves }]

		await act(async () => {
			root.render(
				<MarketTreemapChart treeData={groupedTree} leaves={leaves} sizeLabel="Market Cap" colorLabel="Price 1D" />
			)
		})

		const groupedLeaf = mocks.instance.setOption.mock.calls.at(-1)?.[0].series[0].data[0].children[0]
		expect(groupedLeaf).toBe(flatLeaf)
		expect(mocks.init).toHaveBeenCalledOnce()
	})

	it('keeps the opposite edge: it releases the chart and ready callback on unmount', async () => {
		const onReady = vi.fn()
		const treeData = makeTreeData(100)
		await act(async () => {
			root.render(
				<MarketTreemapChart
					treeData={treeData}
					leaves={treeData as IEquitiesTreemapLeaf[]}
					sizeLabel="Market Cap"
					colorLabel="Price 1D"
					onReady={onReady}
				/>
			)
		})

		await act(async () => root.unmount())

		expect(mocks.instance.dispose).toHaveBeenCalledOnce()
		expect(onReady).toHaveBeenLastCalledWith(null)
	})
})
