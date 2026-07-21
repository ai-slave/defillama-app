// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
	const instance = {
		clear: vi.fn(),
		dispose: vi.fn(),
		off: vi.fn(),
		on: vi.fn(),
		resize: vi.fn(),
		setOption: vi.fn()
	}

	return {
		init: vi.fn((_container: HTMLElement) => instance),
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

vi.mock('~/hooks/useMedia', () => ({
	useMedia: () => false
}))

import BuilderTreemapChart from '.'

describe('BuilderTreemapChart lifecycle', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		vi.clearAllMocks()
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
	})

	it('keeps one chart instance and its subscriptions across empty and populated data', async () => {
		const onReady = vi.fn()

		await act(async () => root.render(<BuilderTreemapChart data={[]} onReady={onReady} />))

		const chartContainer = mocks.init.mock.calls[0][0]
		expect(chartContainer).toBeInstanceOf(HTMLElement)
		expect(chartContainer.isConnected).toBe(true)
		expect(container.textContent).toContain('No data available for treemap')
		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.clear).toHaveBeenCalledOnce()
		expect(mocks.instance.on.mock.calls.map(([event]) => event)).toEqual(['click', 'restore'])

		await act(async () =>
			root.render(<BuilderTreemapChart data={[{ name: 'Initial', value: 10 }]} onReady={onReady} />)
		)

		expect(container.textContent).not.toContain('No data available for treemap')
		expect(mocks.instance.setOption).toHaveBeenLastCalledWith(
			expect.objectContaining({
				series: [expect.objectContaining({ data: [{ name: 'Initial', value: 10 }] })]
			}),
			true
		)

		const instanceWithFocus = mocks.instance as typeof mocks.instance & {
			__llamaTreemapFocusNode?: { id: string }
		}
		instanceWithFocus.__llamaTreemapFocusNode = { id: 'Initial' }
		await act(async () => root.render(<BuilderTreemapChart data={[]} onReady={onReady} />))

		expect(mocks.instance.clear).toHaveBeenCalledTimes(2)
		expect(mocks.instance).not.toHaveProperty('__llamaTreemapFocusNode')
		expect(container.textContent).toContain('No data available for treemap')

		await act(async () =>
			root.render(<BuilderTreemapChart data={[{ name: 'Current', value: 20 }]} onReady={onReady} />)
		)

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.on).toHaveBeenCalledTimes(2)
		expect(mocks.instance.setOption).toHaveBeenLastCalledWith(
			expect.objectContaining({
				series: [expect.objectContaining({ data: [{ name: 'Current', value: 20 }] })]
			}),
			true
		)
		expect(mocks.instance.dispose).not.toHaveBeenCalled()

		await act(async () => root.unmount())

		expect(mocks.instance.off.mock.calls.map(([event]) => event)).toEqual(['click', 'restore'])
		expect(mocks.instance.dispose).toHaveBeenCalledOnce()
		expect(onReady).toHaveBeenNthCalledWith(1, mocks.instance)
		expect(onReady).toHaveBeenLastCalledWith(null)
	})
})
