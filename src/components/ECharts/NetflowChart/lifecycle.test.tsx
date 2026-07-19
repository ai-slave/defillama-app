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

import NetflowChart from '.'

const DATA = {
	day: [{ chain: 'ethereum', value: 10 }],
	week: [{ chain: 'ethereum', value: 20 }],
	month: [{ chain: 'ethereum', value: 30 }]
}

describe('NetflowChart lifecycle', () => {
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

	it('resizes without rebuilding options when only height changes', async () => {
		const onReady = vi.fn()

		await act(async () => root.render(<NetflowChart data={DATA} height={500} onReady={onReady} />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.setOption).toHaveBeenCalledOnce()
		expect(mocks.instance.resize).toHaveBeenCalledOnce()
		expect(onReady).toHaveBeenCalledOnce()
		expect(mocks.instance.setOption.mock.invocationCallOrder[0]).toBeLessThan(onReady.mock.invocationCallOrder[0])

		await act(async () => root.render(<NetflowChart data={DATA} height={600} onReady={onReady} />))

		expect(mocks.instance.setOption).toHaveBeenCalledOnce()
		expect(mocks.instance.resize).toHaveBeenCalledTimes(2)
		expect(onReady).toHaveBeenCalledOnce()

		await act(async () => root.unmount())

		expect(mocks.instance.dispose).toHaveBeenCalledOnce()
		expect(onReady).toHaveBeenLastCalledWith(null)
	})
})
