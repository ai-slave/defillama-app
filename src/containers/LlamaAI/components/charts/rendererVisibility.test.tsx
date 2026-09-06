// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => {
	const instances: Array<{
		dispose: ReturnType<typeof vi.fn>
		getOption: ReturnType<typeof vi.fn>
		isDisposed: ReturnType<typeof vi.fn>
		resize: ReturnType<typeof vi.fn>
		setOption: ReturnType<typeof vi.fn>
	}> = []
	return {
		instances,
		init: vi.fn(() => {
			const instance = {
				dispose: vi.fn(),
				getOption: vi.fn(() => ({
					legend: [{ selected: { Volume: false } }],
					dataZoom: [{ start: 25, end: 75 }],
					series: [{ data: ['stale'] }]
				})),
				isDisposed: vi.fn(() => false),
				resize: vi.fn(),
				setOption: vi.fn()
			}
			instances.push(instance)
			return instance
		}),
		use: vi.fn()
	}
})

vi.mock('echarts/core', () => ({ init: mocks.init, use: mocks.use }))
vi.mock('~/contexts/LocalStorage', () => ({ useDarkModeManager: () => [false] }))
vi.mock('~/hooks/useChartResize', () => ({ useChartResize: () => undefined }))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => false }))

import CandlestickChart from '~/components/ECharts/CandlestickChart'
import { EChartsRenderVisibilityProvider } from '~/components/ECharts/renderVisibility'
import ScatterChart from '~/components/ECharts/ScatterChart'

function Harness({ visible }: { visible: boolean }) {
	const [view, setView] = useState('chart')
	return (
		<EChartsRenderVisibilityProvider visible={visible}>
			<button onClick={() => setView('table')}>{view}</button>
			<ScatterChart chartData={[[1, 2]]} />
			<CandlestickChart data={[[1, 10, 12, 9, 13, 100]]} />
		</EChartsRenderVisibilityProvider>
	)
}

describe('LlamaAI ECharts visibility', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		mocks.instances.length = 0
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
			callback(0)
			return 1
		})
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	test('recreates scatter and candlestick canvases while preserving parent and chart interaction state', async () => {
		await act(async () => root.render(<Harness visible />))
		expect(mocks.init).toHaveBeenCalledTimes(2)

		await act(async () => (container.querySelector('button') as HTMLButtonElement).click())
		expect(container.querySelector('button')?.textContent).toBe('table')

		await act(async () => root.render(<Harness visible={false} />))
		expect(mocks.instances.slice(0, 2).every((instance) => instance.dispose.mock.calls.length === 1)).toBe(true)
		expect(container.querySelector('button')?.textContent).toBe('table')

		await act(async () => root.render(<Harness visible />))
		expect(mocks.init).toHaveBeenCalledTimes(4)
		expect(container.querySelector('button')?.textContent).toBe('table')

		for (const instance of mocks.instances.slice(2)) {
			expect(instance.setOption).toHaveBeenCalledWith({
				legend: [{ selected: { Volume: false } }],
				dataZoom: [{ start: 25, end: 75 }]
			})
			expect(
				instance.setOption.mock.calls.some(([option]) => 'series' in option && option.series[0]?.data?.[0] === 'stale')
			).toBe(false)
		}
	})
})
