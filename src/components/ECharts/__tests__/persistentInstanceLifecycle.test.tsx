// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
	const instances: Array<{
		convertToPixel: ReturnType<typeof vi.fn>
		dispose: ReturnType<typeof vi.fn>
		isDisposed: ReturnType<typeof vi.fn>
		off: ReturnType<typeof vi.fn>
		on: ReturnType<typeof vi.fn>
		resize: ReturnType<typeof vi.fn>
		setOption: ReturnType<typeof vi.fn>
	}> = []
	const init = vi.fn(() => {
		const instance = {
			convertToPixel: vi.fn(),
			dispose: vi.fn(),
			isDisposed: vi.fn(() => false),
			off: vi.fn(),
			on: vi.fn(),
			resize: vi.fn(),
			setOption: vi.fn()
		}
		instances.push(instance)
		return instance
	})
	return { init, instances, use: vi.fn() }
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

vi.mock('~/hooks/useMedia', () => ({
	useMedia: () => false
}))

import { BarSparkline } from '../BarSparkline'
import CandlestickChart from '../CandlestickChart'
import HBarChart from '../HBarChart'
import ScatterChart from '../ScatterChart'
import { SparklineChart } from '../SparklineChart'
import TreemapChart from '../TreemapChart'

describe('persistent ECharts instances', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.stubGlobal(
			'ResizeObserver',
			class {
				disconnect() {}
				observe() {}
			}
		)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		mocks.instances.length = 0
		vi.clearAllMocks()
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	it('reuses the candlestick instance when its data changes', async () => {
		const initialData: Array<[number, number, number, number, number, number]> = [[1, 10, 11, 9, 12, 100]]
		const updatedData: Array<[number, number, number, number, number, number]> = [[2, 11, 12, 10, 13, 200]]

		await act(async () => root.render(<CandlestickChart data={initialData} />))
		const instance = mocks.instances[0]

		await act(async () => root.render(<CandlestickChart data={updatedData} />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()
		expect(instance.setOption).toHaveBeenLastCalledWith(
			expect.objectContaining({ dataset: { source: updatedData } }),
			expect.any(Object)
		)

		await act(async () => root.unmount())
		expect(instance.dispose).toHaveBeenCalledOnce()
	})

	it.each([
		{ name: 'line', render: (data: Array<[number, number]>) => <SparklineChart data={data} areaColor="#269f3c" /> },
		{ name: 'bar', render: (data: Array<[number, number]>) => <BarSparkline data={data} /> }
	])('reuses the $name sparkline instance while data remains non-empty', async ({ render }) => {
		await act(async () => root.render(render([[1, 10]])))
		const instance = mocks.instances[0]

		await act(async () => root.render(render([[2, 20]])))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()

		await act(async () => root.render(render([])))
		expect(instance.dispose).toHaveBeenCalledOnce()

		await act(async () => root.render(render([[3, 30]])))
		expect(mocks.init).toHaveBeenCalledTimes(2)
	})

	it('reuses the treemap instance and its event subscriptions across data updates', async () => {
		const initialData = [{ name: 'Asset', path: 'Group/Asset', value: [100] }]
		const updatedData = [{ name: 'Asset', path: 'Group/Asset', value: [200] }]

		await act(async () => root.render(<TreemapChart treeData={initialData} variant="rwa" />))
		const instance = mocks.instances[0]

		await act(async () => root.render(<TreemapChart treeData={updatedData} variant="rwa" />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()
		expect(instance.on).toHaveBeenCalledTimes(2)
		const latestOption = instance.setOption.mock.calls.at(-1)?.[0]
		expect(latestOption.series[0].data[0].value[0]).toBe(200)

		await act(async () => root.unmount())
		expect(instance.off).toHaveBeenCalledTimes(2)
		expect(instance.dispose).toHaveBeenCalledOnce()
	})

	it('reuses the horizontal bar instance and its observer subscription across data updates', async () => {
		await act(async () => root.render(<HBarChart categories={['A']} values={[10]} />))
		const instance = mocks.instances[0]

		await act(async () => root.render(<HBarChart categories={['A']} values={[20]} />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()
		expect(instance.on).toHaveBeenCalledOnce()
		const latestOption = instance.setOption.mock.calls.at(-1)?.[0]
		expect(latestOption.series[0].data[0].value).toBe(20)

		await act(async () => root.unmount())
		expect(instance.off).toHaveBeenCalledOnce()
		expect(instance.dispose).toHaveBeenCalledOnce()
	})

	it('reuses the scatter instance when its data changes', async () => {
		await act(async () => root.render(<ScatterChart chartData={[{ projectName: 'Project', sigma: 10, mu: 20 }]} />))
		const instance = mocks.instances[0]

		await act(async () => root.render(<ScatterChart chartData={[{ projectName: 'Project', sigma: 30, mu: 40 }]} />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()
		const latestOption = instance.setOption.mock.calls.at(-1)?.[0]
		expect(latestOption.series[0].data[0].slice(0, 2)).toEqual([30, 40])

		await act(async () => root.unmount())
		expect(instance.dispose).toHaveBeenCalledOnce()
	})
})
