// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EquitiesTreemapNode } from '~/containers/Equities/treemapData'

const mocks = vi.hoisted(() => {
	const instance = {
		dispatchAction: vi.fn(),
		dispose: vi.fn(),
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

import EquitiesTreemapChart from '.'

function makeTreeData(size: number): EquitiesTreemapNode[] {
	return [
		{
			name: 'TEST',
			value: [size, 1.5],
			companyName: 'Test Company',
			country: 'US',
			sector: 'Technology',
			industry: 'Software',
			marketCap: 100
		}
	]
}

describe('EquitiesTreemapChart lifecycle', () => {
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
		await act(async () => {
			root.render(
				<EquitiesTreemapChart
					treeData={makeTreeData(100)}
					sizeLabel="Market Cap"
					colorLabel="Price 1D"
					onReady={onReady}
				/>
			)
		})

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.dispose).not.toHaveBeenCalled()
		expect(onReady).toHaveBeenLastCalledWith(mocks.instance)

		await act(async () => {
			root.render(
				<EquitiesTreemapChart
					treeData={makeTreeData(200)}
					sizeLabel="Revenue"
					colorLabel="Price 7D"
					onReady={onReady}
				/>
			)
		})

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.dispose).not.toHaveBeenCalled()
	})

	it('keeps the opposite edge: it releases the chart and ready callback on unmount', async () => {
		const onReady = vi.fn()
		await act(async () => {
			root.render(
				<EquitiesTreemapChart
					treeData={makeTreeData(100)}
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
