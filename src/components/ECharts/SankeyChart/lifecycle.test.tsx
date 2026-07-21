// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
	const instance = {
		dispose: vi.fn(),
		isDisposed: vi.fn(() => false),
		resize: vi.fn(),
		setOption: vi.fn()
	}

	return {
		init: vi.fn(() => instance),
		instance,
		onElementResize: undefined as (() => void) | undefined,
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
	useChartResize: (_instanceRef: unknown, _elementRef: unknown, onElementResize?: () => void) => {
		mocks.onElementResize = onElementResize
	}
}))

vi.mock('~/hooks/useMedia', () => ({
	useMedia: () => false
}))

import SankeyChart from '.'

describe('SankeyChart lifecycle', () => {
	let container: HTMLDivElement
	let root: Root
	let width: number
	let height: number

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		width = 0
		height = 0
		mocks.onElementResize = undefined
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
			() =>
				({
					bottom: height,
					height,
					left: 0,
					right: width,
					top: 0,
					width,
					x: 0,
					y: 0,
					toJSON: () => ({})
				}) as DOMRect
		)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		vi.clearAllMocks()
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
		vi.restoreAllMocks()
	})

	it('defers initialization until a hidden tab becomes visible and uses the latest data', async () => {
		const onReady = vi.fn()
		const initialNodes = [{ name: 'Revenue' }, { name: 'Protocol' }]

		await act(async () =>
			root.render(
				<SankeyChart
					nodes={initialNodes}
					links={[{ source: 'Revenue', target: 'Protocol', value: 10 }]}
					onReady={onReady}
				/>
			)
		)

		expect(mocks.init).not.toHaveBeenCalled()
		expect(mocks.instance.setOption).not.toHaveBeenCalled()
		expect(onReady).not.toHaveBeenCalled()

		await act(async () =>
			root.render(
				<SankeyChart
					nodes={[{ name: 'Revenue' }, { name: 'Treasury' }]}
					links={[{ source: 'Revenue', target: 'Treasury', value: 20 }]}
					onReady={onReady}
				/>
			)
		)

		width = 640
		height = 360
		await act(async () => mocks.onElementResize?.())

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.setOption).toHaveBeenCalledOnce()
		expect(mocks.instance.setOption.mock.calls[0][0].series.links).toEqual([
			{ source: 'Revenue', target: 'Treasury', value: 20 }
		])
		expect(onReady).toHaveBeenCalledOnce()
		expect(onReady).toHaveBeenCalledWith(mocks.instance)

		await act(async () => mocks.onElementResize?.())

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.setOption).toHaveBeenCalledOnce()
	})
})
