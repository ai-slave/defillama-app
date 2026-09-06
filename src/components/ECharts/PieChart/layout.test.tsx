// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => {
	const instance = {
		dispose: vi.fn(),
		getHeight: vi.fn(() => 360),
		getOption: vi.fn(() => ({})),
		getWidth: vi.fn(() => 600),
		isDisposed: vi.fn(() => false),
		resize: vi.fn(),
		setOption: vi.fn()
	}

	return {
		elementResize: undefined as (() => void) | undefined,
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
	useChartResize: (_instanceRef: unknown, _elementRef: unknown, options?: { onResize?: () => void }) => {
		mocks.elementResize = options?.onResize
	}
}))

vi.mock('~/hooks/useMedia', () => ({
	useMedia: () => false
}))

import PieChart from '.'

describe('PieChart layout', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		mocks.elementResize = undefined
		vi.clearAllMocks()
		mocks.instance.getHeight.mockReturnValue(360)
		mocks.instance.getWidth.mockReturnValue(600)
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
	})

	test('applies the pie center and watermark in one layout update', async () => {
		await act(async () => root.render(<PieChart chartData={[{ name: 'Asset', value: 10 }]} />))

		expect(mocks.instance.setOption).toHaveBeenCalledTimes(2)
		const layoutOption = mocks.instance.setOption.mock.calls[1][0]
		expect(layoutOption.series.center).toEqual(['50%', '50%'])
		expect(layoutOption.graphic[0]).toMatchObject({ id: 'defillama-watermark', type: 'image' })
	})

	test('leaves app-level resize handling to the shared chart resize hook', async () => {
		await act(async () => root.render(<PieChart chartData={[{ name: 'Asset', value: 10 }]} />))
		const callCount = mocks.instance.setOption.mock.calls.length

		await act(async () => {
			window.dispatchEvent(new Event('chartResize'))
			await new Promise((resolve) => requestAnimationFrame(resolve))
		})

		expect(mocks.instance.setOption).toHaveBeenCalledTimes(callCount)
	})

	test('recomputes pixel layout after its observed element changes size', async () => {
		await act(async () => root.render(<PieChart chartData={[{ name: 'Asset', value: 10 }]} height="360px" />))
		const initialTop = mocks.instance.setOption.mock.calls.at(-1)?.[0].graphic[0].top

		mocks.instance.getHeight.mockReturnValue(500)
		await act(async () => mocks.elementResize?.())

		const resizedTop = mocks.instance.setOption.mock.calls.at(-1)?.[0].graphic[0].top
		expect(initialTop).toBe(160)
		expect(resizedTop).toBe(230)
	})
})
