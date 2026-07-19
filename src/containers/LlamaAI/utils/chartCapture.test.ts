// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
	let renderedHandler: (() => void) | null = null
	const existingChart = { getOption: vi.fn(() => ({ xAxis: [], yAxis: [] })) }
	const tempChart = {
		dispose: vi.fn(),
		getDataURL: vi.fn(() => 'data:image/png;base64,test'),
		isDisposed: vi.fn(() => false),
		off: vi.fn(),
		on: vi.fn((event: string, handler: () => void) => {
			if (event === 'rendered') renderedHandler = handler
		}),
		setOption: vi.fn(() => renderedHandler?.())
	}
	return {
		existingChart,
		getInstanceByDom: vi.fn(() => existingChart),
		init: vi.fn(() => tempChart),
		resetRenderedHandler: () => {
			renderedHandler = null
			tempChart.setOption.mockImplementation(() => renderedHandler?.())
		},
		tempChart
	}
})

vi.mock('echarts/core', () => ({
	getInstanceByDom: mocks.getInstanceByDom,
	init: mocks.init
}))

import { captureChartById } from './chartCapture'

describe('captureChartById', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.resetRenderedHandler()
		mocks.tempChart.isDisposed.mockReturnValue(false)
		const wrapper = document.createElement('div')
		wrapper.dataset.chartId = 'chart'
		const chart = document.createElement('div')
		chart.setAttribute('_echarts_instance_', '1')
		wrapper.appendChild(chart)
		document.body.appendChild(wrapper)
	})

	afterEach(() => {
		document.body.replaceChildren()
		vi.restoreAllMocks()
	})

	it('disposes the temporary chart after a successful capture', async () => {
		await expect(captureChartById('chart', 'Chart', false)).resolves.toEqual({
			chartId: 'chart',
			imageData: 'data:image/png;base64,test',
			title: 'Chart'
		})
		expect(mocks.tempChart.dispose).toHaveBeenCalledOnce()
		expect(mocks.tempChart.on.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.tempChart.setOption.mock.invocationCallOrder[0]
		)
	})

	it('disposes the temporary chart when rendering fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined)
		mocks.tempChart.setOption.mockImplementation(() => {
			throw new Error('render failed')
		})

		await expect(captureChartById('chart', 'Chart', false)).resolves.toBeNull()
		expect(mocks.tempChart.dispose).toHaveBeenCalledOnce()
		expect(document.body.querySelectorAll('div')).toHaveLength(2)
	})
})
